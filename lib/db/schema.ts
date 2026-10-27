import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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

export const memoryCategory = pgEnum("rocky_memory_category", [
  "Preferences",
  "Goals",
  "People",
  "Ongoing tasks",
])

export const memories = pgTable(
  "rocky_memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull(),
    title: varchar("title", { length: 80 }).notNull(),
    titleKey: varchar("title_key", { length: 80 }).notNull(),
    detail: varchar("detail", { length: 500 }).notNull(),
    category: memoryCategory("category").notNull(),
    consentStatus: varchar("consent_status", { length: 20 })
      .$type<"approved">()
      .default("approved")
      .notNull(),
    sourceConversationId: uuid("source_conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("rocky_memories_session_category_title_key").on(
      table.sessionId,
      table.category,
      table.titleKey,
    ),
    index("rocky_memories_session_updated_idx").on(table.sessionId, table.updatedAt),
  ],
)

export const memoryPreferences = pgTable("rocky_memory_preferences", {
  sessionId: uuid("session_id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})
