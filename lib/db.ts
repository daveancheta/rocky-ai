import "server-only"

import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let sql: NeonQueryFunction<false, false> | undefined

function getDatabaseClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.")
  }

  sql ??= neon(connectionString)
  return sql
}

export async function verifyDatabaseConnection() {
  const result = await getDatabaseClient()`SELECT 1`
  return result.length === 1
}
