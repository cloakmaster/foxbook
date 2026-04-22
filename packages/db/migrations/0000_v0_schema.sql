CREATE TYPE "public"."claim_method" AS ENUM('gist', 'tweet', 'email', 'dns', 'endpoint');--> statement-breakpoint
CREATE TYPE "public"."claim_state" AS ENUM('unclaimed', 'gist_pending', 'tier1_verified', 'tier2_pending', 'tier2_verified');--> statement-breakpoint
CREATE TYPE "public"."key_purpose" AS ENUM('signing', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."report_event_type" AS ENUM('hire.settled', 'hire.failed', 'delegation.announced');--> statement-breakpoint
CREATE TABLE "agents" (
	"did" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"owner_handle" text NOT NULL,
	"slug" text NOT NULL,
	"class_did" text,
	"verification_tier" integer DEFAULT 0 NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"current_manifest_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_did" text NOT NULL,
	"state" "claim_state" DEFAULT 'unclaimed' NOT NULL,
	"method" "claim_method",
	"challenge_nonce" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "firehose_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" text NOT NULL,
	"envelope_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_did" text NOT NULL,
	"purpose" "key_purpose" NOT NULL,
	"public_key_hex" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "manifests_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_did" text NOT NULL,
	"version_number" integer NOT NULL,
	"content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"signed_by_key_id" uuid NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" "report_event_type" NOT NULL,
	"hirer_did" text NOT NULL,
	"hiree_did" text NOT NULL,
	"envelope" jsonb NOT NULL,
	"envelope_hash" text NOT NULL,
	"reported_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "revocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_did" text NOT NULL,
	"revoked_key_id" uuid NOT NULL,
	"recovery_signature" text NOT NULL,
	"merkle_leaf_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tl_leaves" (
	"leaf_index" bigint PRIMARY KEY NOT NULL,
	"leaf_hash" text NOT NULL,
	"leaf_data" jsonb NOT NULL,
	"appended_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transparency_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" text DEFAULT 'foxbook-v1' NOT NULL,
	"root_hash" text NOT NULL,
	"leaf_count" bigint NOT NULL,
	"signed_tree_head" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_did" text NOT NULL,
	"tier" integer NOT NULL,
	"method" text NOT NULL,
	"evidence_url" text,
	"evidence_hash" text,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
