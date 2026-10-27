import "server-only"

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { sql } from "drizzle-orm"

let db: ReturnType<typeof drizzle> | undefined

function getDatabaseClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.")
  }

  db ??= drizzle(neon(connectionString))
  return db
}

export async function verifyDatabaseConnection() {
  const result = await getDatabaseClient().execute(sql`SELECT 1 AS connected`)
  return result.rows.length === 1
}
