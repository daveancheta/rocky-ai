import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const chatRole = pgEnum("rocky_chat_role", ["user", "assistant"])

export const conversations = pgTable(
  "rocky_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull(),
    title: varchar("title", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("rocky_conversations_session_updated_idx").on(table.sessionId, table.updatedAt),
  ],
)

export const chatMessages = pgTable(
  "rocky_chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: chatRole("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("rocky_chat_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
)
