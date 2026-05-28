import type { Config } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });
config(); // also pick up .env if present

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
} satisfies Config;
