import { connection } from "next/server"
import { verifyDatabaseConnection } from "@/lib/db"

export async function GET() {
  await connection()

  try {
    const connected = await verifyDatabaseConnection()
    if (!connected) {
      return Response.json(
        { status: "error", service: "postgres", error: "Database check failed." },
        { status: 503 },
      )
    }

    return Response.json({ status: "ok", service: "postgres" })
  } catch (error) {
    console.error(
      "Postgres health check failed:",
      error instanceof Error ? error.message : "Unknown database error",
    )
    return Response.json(
      { status: "error", service: "postgres", error: "Database connection unavailable." },
      { status: 503 },
    )
  }
}
