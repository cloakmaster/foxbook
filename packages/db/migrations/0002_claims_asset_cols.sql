CREATE TYPE "public"."asset_type" AS ENUM('github_handle', 'x_handle', 'domain');--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "asset_type" "asset_type";--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "asset_value" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "ed25519_public_key_hex" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "recovery_key_fingerprint" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "verification_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "claims_asset_uniq_idx" ON "claims" USING btree ("asset_type","asset_value") WHERE "claims"."asset_type" IS NOT NULL AND "claims"."asset_value" IS NOT NULL;