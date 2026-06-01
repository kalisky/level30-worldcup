import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ODDSCHECKER_LOCAL_FILE,
  convertLegacyH2hFeedToOddsCheckerRows,
} from "../lib/odds-sync/oddschecker-file";

const LEGACY_H2H_FILE = path.resolve(
  process.cwd(),
  "app/r/[code]/match/[id]/odds_h2h.json"
);

async function main() {
  const raw = JSON.parse(readFileSync(LEGACY_H2H_FILE, "utf8")) as Parameters<
    typeof convertLegacyH2hFeedToOddsCheckerRows
  >[0];
  const rows = convertLegacyH2hFeedToOddsCheckerRows(raw);

  mkdirSync(path.dirname(ODDSCHECKER_LOCAL_FILE), { recursive: true });
  writeFileSync(ODDSCHECKER_LOCAL_FILE, `${JSON.stringify(rows, null, 2)}\n`, "utf8");

  console.log(
    `Wrote ${rows.length} OddsChecker-style H2H rows to ${path.relative(process.cwd(), ODDSCHECKER_LOCAL_FILE)}.`
  );
}

main().catch((error) => {
  console.error("build-oddschecker-json failed:", error);
  process.exit(1);
});
