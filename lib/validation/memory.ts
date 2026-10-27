import { z } from "zod"
import { MEMORY_CATEGORIES } from "@/types/memory"

export const MEMORY_CATEGORY_SCHEMA = z.enum(MEMORY_CATEGORIES)

export const MEMORY_CREATE_SCHEMA = z
  .object({
    category: MEMORY_CATEGORY_SCHEMA,
    title: z.string().trim().min(1).max(80),
    detail: z.string().trim().min(1).max(500),
    approved: z.literal(true),
    sourceConversationId: z.string().uuid().optional(),
  })
  .strict()

export const MEMORY_UPDATE_SCHEMA = z
  .object({
    category: MEMORY_CATEGORY_SCHEMA.optional(),
    title: z.string().trim().min(1).max(80).optional(),
    detail: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)

export const MEMORY_PREFERENCE_SCHEMA = z
  .object({ enabled: z.boolean() })
  .strict()

export const MEMORY_SUGGESTION_REQUEST_SCHEMA = z
  .object({ conversationId: z.string().uuid() })
  .strict()
