CREATE TYPE "public"."advancer_side" AS ENUM('HOME', 'AWAY');--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "advancer" "advancer_side";