import "server-only"

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { sql } from "drizzle-orm"
import * as schema from "@/lib/db/schema"

function createDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.")
  }

  return drizzle({ client: neon(connectionString), schema })
}

let db: ReturnType<typeof createDb> | undefined

export function getDb() {
  db ??= createDb()
  return db
}

export async function verifyDatabaseConnection() {
  const result = await getDb().execute(sql`SELECT 1 AS connected`)
  return result.rows.length === 1
}
