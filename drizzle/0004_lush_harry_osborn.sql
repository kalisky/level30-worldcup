CREATE TYPE "public"."ledger_reason" AS ENUM('opening_balance', 'initial', 'daily_grant', 'match_bet_placed', 'match_bet_payout', 'custom_wager_placed', 'custom_wager_payout', 'custom_wager_refund');--> statement-breakpoint
CREATE TABLE "chip_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"ref_match_id" uuid,
	"ref_custom_bet_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chip_ledger" ADD CONSTRAINT "chip_ledger_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_ledger" ADD CONSTRAINT "chip_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_ledger" ADD CONSTRAINT "chip_ledger_ref_match_id_matches_id_fk" FOREIGN KEY ("ref_match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_ledger" ADD CONSTRAINT "chip_ledger_ref_custom_bet_id_custom_bets_id_fk" FOREIGN KEY ("ref_custom_bet_id") REFERENCES "public"."custom_bets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chip_ledger_user_idx" ON "chip_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chip_ledger_room_idx" ON "chip_ledger" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "chip_ledger_created_idx" ON "chip_ledger" USING btree ("created_at");