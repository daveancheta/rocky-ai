CREATE TYPE "public"."rocky_memory_category" AS ENUM('Preferences', 'Goals', 'People', 'Ongoing tasks');--> statement-breakpoint
CREATE TABLE "rocky_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"title_key" varchar(80) NOT NULL,
	"detail" varchar(500) NOT NULL,
	"category" "rocky_memory_category" NOT NULL,
	"consent_status" varchar(20) DEFAULT 'approved' NOT NULL,
	"source_conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rocky_memory_preferences" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rocky_memories" ADD CONSTRAINT "rocky_memories_source_conversation_id_rocky_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."rocky_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rocky_memories_session_category_title_key" ON "rocky_memories" USING btree ("session_id","category","title_key");--> statement-breakpoint
CREATE INDEX "rocky_memories_session_updated_idx" ON "rocky_memories" USING btree ("session_id","updated_at");