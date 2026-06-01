import { setDefaultResultOrder } from "dns";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Neon's pooler endpoint sometimes returns only AAAA records. Networks
// without working IPv6 routing then time out on the TLS handshake. Forcing
// IPv4-first resolution falls back to A records where they exist and is a
// no-op everywhere else.
setDefaultResultOrder("ipv4first");

declare global {
  var __pg__: ReturnType<typeof postgres> | undefined;
  var __drizzle__: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function getDb() {
  if (globalThis.__drizzle__) return globalThis.__drizzle__;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Postgres URL."
    );
  }
  const client =
    globalThis.__pg__ ??
    postgres(url, {
      prepare: false, // safe with PgBouncer / Neon pooler
      // Serverless functions handle one in-flight request at a time per
      // instance, so a single connection per instance is enough. Each extra
      // permitted connection multiplies against Vercel's concurrent
      // invocations and can exhaust Neon's project-level connection ceiling.
      max: 1,
      // Recycle idle connections quickly so warm invocations don't hold
      // sockets that Neon may already have torn down server-side.
      idle_timeout: 20,
      // Don't queue forever — fail fast if Neon is at capacity.
      connect_timeout: 10,
      max_lifetime: 60 * 30,
    });
  const d = drizzle(client, { schema });
  // Cache the client for the lifetime of the current Node.js runtime so
  // warm serverless invocations reuse it instead of creating a new pool.
  globalThis.__pg__ = client;
  globalThis.__drizzle__ = d;
  return d;
}

// Proxy so that any `db.xxx` access calls getDb() lazily — lets `next build`
// import this module without DATABASE_URL set, deferring the error to runtime.
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const v = real[prop];
    return typeof v === "function" ? v.bind(real) : v;
  },
});

export { schema };
