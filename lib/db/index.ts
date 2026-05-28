import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pg__: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
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
      max: 5,
    });
  const d = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__pg__ = client;
    globalThis.__drizzle__ = d;
  }
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
