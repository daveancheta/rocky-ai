# ROCKY

ROCKY is a Next.js companion UI prototype. Chat responses, awareness suggestions, and memories are still demo/local data; personal content is not sent to Neon.

## Neon Postgres

The project is linked to its Neon production branch through the local `.neon` context. Keep `.env.local` private; it contains the pooled `DATABASE_URL` used for runtime queries and the unpooled URL intended for migrations.

The server-side Postgres connection is available through `lib/db.ts`. Check it end to end by starting the app and requesting `GET /api/health/database`. The endpoint returns only the service health status and never exposes connection details.

No user-data tables are created yet. Add authentication and explicit data-retention/consent behavior before persisting personal memories or conversations.

To refresh local Neon variables after changing branches:

```bash
neon env pull
```

## Development

```bash
npm install
npm run dev
```
