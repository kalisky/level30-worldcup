CREATE TYPE "public"."direction_pick" AS ENUM('HOME', 'DRAW', 'AWAY');--> statement-breakpoint
ALTER TABLE "match_bets" ADD COLUMN "direction_pick" "direction_pick";--> statement-breakpoint
-- Backfill existing rows: derive direction from their predicted score so the
-- on-row outcome stays consistent with how settle.ts used to compute it.
UPDATE "match_bets" SET "direction_pick" = CASE
  WHEN predicted_home_score > predicted_away_score THEN 'HOME'::"public"."direction_pick"
  WHEN predicted_away_score > predicted_home_score THEN 'AWAY'::"public"."direction_pick"
  ELSE 'DRAW'::"public"."direction_pick"
END;--> statement-breakpoint
ALTER TABLE "match_bets" ALTER COLUMN "direction_pick" SET NOT NULL;