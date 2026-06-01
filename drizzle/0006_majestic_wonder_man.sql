CREATE TYPE "public"."odds_snapshot_market" AS ENUM('winner', 'correct_score');--> statement-breakpoint
CREATE TYPE "public"."odds_sync_status" AS ENUM('running', 'success', 'partial_success', 'skipped', 'error');--> statement-breakpoint
CREATE TABLE "match_odds_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"market" "odds_snapshot_market" NOT NULL,
	"source_url" text NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"normalized_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odds_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"target_match_id" uuid,
	"force" boolean DEFAULT false NOT NULL,
	"status" "odds_sync_status" NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "odds_source_winner_url" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "odds_source_correct_score_url" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "odds_last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "odds_last_sync_status" "odds_sync_status";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "odds_last_sync_error" text;--> statement-breakpoint
ALTER TABLE "match_odds_snapshots" ADD CONSTRAINT "match_odds_snapshots_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_odds_snapshots" ADD CONSTRAINT "match_odds_snapshots_run_id_odds_sync_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."odds_sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_sync_runs" ADD CONSTRAINT "odds_sync_runs_target_match_id_matches_id_fk" FOREIGN KEY ("target_match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_odds_snapshots_match_idx" ON "match_odds_snapshots" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_odds_snapshots_run_idx" ON "match_odds_snapshots" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "odds_sync_runs_started_idx" ON "odds_sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "odds_sync_runs_target_match_idx" ON "odds_sync_runs" USING btree ("target_match_id");