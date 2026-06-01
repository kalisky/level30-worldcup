ALTER TABLE "custom_bets" ADD COLUMN "default_key" text;--> statement-breakpoint
UPDATE "custom_bets" SET "default_key" = 'tournament_winner' WHERE "title" IN ('Tournament winner', 'אלוף הטורניר');--> statement-breakpoint
UPDATE "custom_bets" SET "default_key" = 'top_scorer' WHERE "title" IN ('Top scorer', 'מלך השערים');--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "default_language";