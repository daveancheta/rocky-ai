CREATE TYPE "public"."rocky_chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "rocky_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "rocky_chat_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rocky_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rocky_chat_messages" ADD CONSTRAINT "rocky_chat_messages_conversation_id_rocky_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."rocky_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rocky_chat_messages_conversation_created_idx" ON "rocky_chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "rocky_conversations_session_updated_idx" ON "rocky_conversations" USING btree ("session_id","updated_at");