# ROCKY

ROCKY is a Next.js companion app. Chat uses Meta Muse Spark through the server-side Meta Model API, and conversations are persisted in Neon. Awareness suggestions and memories remain demo/local data.

## Neon Postgres

The project is linked to its Neon production branch through the local `.neon` context. Keep `.env.local` private; it contains the pooled `DATABASE_URL` used for runtime queries and the unpooled URL intended for migrations.

The server-side Postgres connection uses Drizzle ORM with Neon's serverless HTTP driver in `lib/db.ts`. Runtime queries use the pooled `DATABASE_URL`; Drizzle migrations use `DATABASE_URL_UNPOOLED`.

Chat history is scoped to an opaque, HttpOnly browser cookie. This provides per-browser separation, not user accounts or cross-device access. Add authentication and explicit data-retention/consent controls before treating this as a multi-user production service.

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
