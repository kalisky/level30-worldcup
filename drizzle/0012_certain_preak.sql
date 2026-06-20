CREATE TYPE "public"."daily_check_status" AS ENUM('ok', 'issues', 'error');--> statement-breakpoint
CREATE TABLE "daily_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_date" text NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "daily_check_status" NOT NULL,
	"matches_checked" integer DEFAULT 0 NOT NULL,
	"issues_found" integer DEFAULT 0 NOT NULL,
	"auto_fixed" integer DEFAULT 0 NOT NULL,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_revisions" (
	"scope" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "result_last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_direction_stake" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_score_stake" integer;--> statement-breakpoint
CREATE INDEX "daily_checks_ran_at_idx" ON "daily_checks" USING btree ("ran_at");