CREATE TYPE "public"."custom_bet_status" AS ENUM('open', 'locked', 'settled', 'void');--> statement-breakpoint
CREATE TYPE "public"."match_bet_status" AS ENUM('open', 'settled', 'void');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'final');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('pending', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."settlement_kind" AS ENUM('match', 'custom_bet', 'void_custom_bet');--> statement-breakpoint
CREATE TYPE "public"."wager_status" AS ENUM('open', 'won', 'lost', 'void');--> statement-breakpoint
CREATE TABLE "custom_bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"match_id" uuid,
	"proposer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"options" jsonb NOT NULL,
	"ai_reasoning" text DEFAULT '' NOT NULL,
	"status" "custom_bet_status" DEFAULT 'open' NOT NULL,
	"winning_option_idx" integer,
	"locks_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_wagers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_bet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_idx" integer NOT NULL,
	"stake" integer NOT NULL,
	"odds_locked" numeric(5, 2) NOT NULL,
	"status" "wager_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"predicted_home_score" integer NOT NULL,
	"predicted_away_score" integer NOT NULL,
	"total_stake" integer NOT NULL,
	"direction_stake" integer NOT NULL,
	"score_stake" integer NOT NULL,
	"direction_odds_locked" numeric(5, 2) NOT NULL,
	"score_odds_locked" numeric(6, 2) NOT NULL,
	"status" "match_bet_status" DEFAULT 'open' NOT NULL,
	"direction_outcome" "outcome" DEFAULT 'pending' NOT NULL,
	"score_outcome" "outcome" DEFAULT 'pending' NOT NULL,
	"payout" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_label" text NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"kickoff" timestamp with time zone NOT NULL,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"odds_home" numeric(5, 2),
	"odds_draw" numeric(5, 2),
	"odds_away" numeric(5, 2),
	"score_odds" jsonb
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"starting_chips" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" "settlement_kind" NOT NULL,
	"target_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"name" text NOT NULL,
	"chips" integer NOT NULL,
	"is_creator" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_bets" ADD CONSTRAINT "custom_bets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_bets" ADD CONSTRAINT "custom_bets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_bets" ADD CONSTRAINT "custom_bets_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_wagers" ADD CONSTRAINT "custom_wagers_custom_bet_id_custom_bets_id_fk" FOREIGN KEY ("custom_bet_id") REFERENCES "public"."custom_bets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_wagers" ADD CONSTRAINT "custom_wagers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_bets" ADD CONSTRAINT "match_bets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_bets" ADD CONSTRAINT "match_bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_bets" ADD CONSTRAINT "match_bets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_bets_room_idx" ON "custom_bets" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "custom_bets_match_idx" ON "custom_bets" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "custom_bets_status_idx" ON "custom_bets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "custom_wagers_bet_idx" ON "custom_wagers" USING btree ("custom_bet_id");--> statement-breakpoint
CREATE INDEX "custom_wagers_user_idx" ON "custom_wagers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_bets_one_per_user_per_match" ON "match_bets" USING btree ("room_id","user_id","match_id");--> statement-breakpoint
CREATE INDEX "match_bets_room_idx" ON "match_bets" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "match_bets_match_idx" ON "match_bets" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "matches_kickoff_idx" ON "matches" USING btree ("kickoff");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "settlements_room_idx" ON "settlements" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "users_room_idx" ON "users" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_room_name_idx" ON "users" USING btree ("room_id","name");