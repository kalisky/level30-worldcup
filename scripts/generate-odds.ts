import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { syncMatchOdds } from "../lib/odds-sync/service";

async function main() {
  console.log("Syncing match odds from Polymarket + Poisson…");
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
  console.error("odds:generate failed:", error);
  process.exit(1);
});
