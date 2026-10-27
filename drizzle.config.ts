import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

loadEnvConfig(process.cwd())

const connectionString = process.env.DATABASE_URL_UNPOOLED
if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED is required to run Drizzle migrations.")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
})
