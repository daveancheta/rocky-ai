# ROCKY

ROCKY is a Next.js companion app. Chat uses Meta Muse Spark through the server-side Meta Model API; conversations and user-approved long-term memories are persisted in Neon. Awareness suggestions remain demo/local data.

## Neon Postgres

The project is linked to its Neon production branch through the local `.neon` context. Keep `.env.local` private; it contains the pooled `DATABASE_URL` used for runtime queries and the unpooled URL intended for migrations.

The server-side Postgres connection uses Drizzle ORM with Neon's serverless HTTP driver in `lib/db.ts`. Runtime queries use the pooled `DATABASE_URL`; Drizzle migrations use `DATABASE_URL_UNPOOLED`.

Chat history, approved memories, and the memory-use preference are scoped to an opaque, HttpOnly browser cookie. This provides per-browser separation, not user accounts or cross-device access. Anyone with access to that browser profile can access its data. Add authentication and explicit data-retention controls before treating this as a multi-user production service.

Memories are never extracted or saved automatically. Users can add memories directly or ask Muse Spark to suggest non-sensitive candidates from a selected conversation; candidates are transient until explicitly approved. Approved memories are only sent to Muse Spark when memory use is enabled and lexical relevance matches the current message. Retrieval is capped at five memories and 2,500 characters. Memory text is treated as untrusted context, not instructions. Turning memory use off prevents retrieval and suggestion requests but does not delete saved records; use the Memories page or Settings to delete them.

Set `MODEL_API_KEY` in the server environment to enable Muse Spark 1.3. It is never read by client-side code. Chat request validation and provider calls are implemented in server-only modules; the provider does not silently switch models.

The chat tables are managed with Drizzle migrations. Review generated SQL before applying schema changes:

```bash
npm run db:generate
npm run db:migrate
```

Check the Neon connection by starting the app and requesting `GET /api/health/database`. The endpoint returns only the service health status and never exposes connection details.

To refresh local Neon variables after changing branches:

```bash
neon env pull
```

## Development

```bash
npm install
npm run dev
```
