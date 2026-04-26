ALTER TABLE "keys" ADD COLUMN "claim_id" uuid;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "claim_id" uuid;--> statement-breakpoint
ALTER TABLE "keys" ADD CONSTRAINT "keys_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;