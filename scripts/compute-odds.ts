import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { syncMatchOdds } from "../lib/odds-sync/service";

async function main() {
  console.warn(
    "scripts/compute-odds.ts is now a compatibility wrapper. Match odds are synced from Polymarket and exact-score odds are fit locally with a Poisson model."
  );

  const result = await syncMatchOdds({
    force: true,
    trigger: "script",
  });

  console.log(result.summary);
  for (const match of result.matchResults) {
    console.log(
      `[${match.status.toUpperCase()}] ${match.homeTeam} vs ${match.awayTeam}: ${match.message}`
    );
  }

  process.exit(result.status === "error" ? 1 : 0);
}

main().catch((error) => {
  console.error("odds:compute failed:", error);
  process.exit(1);
});
