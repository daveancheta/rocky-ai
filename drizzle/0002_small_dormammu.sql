ALTER TABLE "rocky_chat_messages" ADD COLUMN "kind" varchar(20) DEFAULT 'conversation' NOT NULL;--> statement-breakpoint
ALTER TABLE "rocky_chat_messages" ADD COLUMN "event_key" varchar(64);--> statement-breakpoint
ALTER TABLE "rocky_chat_messages" ADD COLUMN "cooldown_key" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "rocky_chat_messages_proactive_event_key_uq" ON "rocky_chat_messages" USING btree ("event_key") WHERE "rocky_chat_messages"."event_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rocky_chat_messages_proactive_cooldown_key_uq" ON "rocky_chat_messages" USING btree ("cooldown_key") WHERE "rocky_chat_messages"."cooldown_key" IS NOT NULL;