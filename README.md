# ROCKY

ROCKY is a Next.js companion app. Chat uses Meta Muse Spark through the server-side Meta Model API; conversations and user-approved long-term memories are persisted in Neon. Awareness suggestions remain demo/local data.

## Neon Postgres

The project is linked to its Neon production branch through the local `.neon` context. Keep `.env.local` private; it contains the pooled `DATABASE_URL` used for runtime queries and the unpooled URL intended for migrations.

The server-side Postgres connection uses Drizzle ORM with Neon's serverless HTTP driver in `lib/db.ts`. Runtime queries use the pooled `DATABASE_URL`; Drizzle migrations use `DATABASE_URL_UNPOOLED`.

Chat history, approved memories, and the memory-use preference are scoped to an opaque, HttpOnly browser cookie. This provides per-browser separation, not user accounts or cross-device access. Anyone with access to that browser profile can access its data. Add authentication and explicit data-retention controls before treating this as a multi-user production service.

Memories are never extracted or saved automatically. Users can add memories directly or ask Muse Spark to suggest non-sensitive candidates from a selected conversation; candidates are transient until explicitly approved. Approved memories are only sent to Muse Spark when memory use is enabled and lexical relevance matches the current message. Retrieval is capped at five memories and 2,500 characters. Memory text is treated as untrusted context, not instructions. Turning memory use off prevents retrieval and suggestion requests but does not delete saved records; use the Memories page or Settings to delete them.

Set `MODEL_API_KEY` in the server environment to enable Muse Spark 1.3. It is never read by client-side code. Chat request validation and provider calls are implemented in server-only modules; the provider does not silently switch models.

## Voice conversation

The chat microphone uses Meta Muse Voice Transcribe (`muse-voice-transcribe-1.0`) through the server-only `POST /api/voice/transcribe` route. The route sends WAV audio as multipart form data to `https://api.meta.ai/v1/asr/transcribe`, authenticated with a bearer token from the same server-only `MODEL_API_KEY` as chat, and receives a JSON transcript. See Meta's [speech-to-text guide](https://dev.meta.ai/docs/speech-to-text) and [transcription API reference](https://dev.meta.ai/docs/api-reference/voice/transcribe). Meta accepts mono 16-bit PCM RIFF/WAVE at 16 kHz or 24 kHz, up to 10 minutes and 32 MB; ROCKY applies a more conservative two-minute, 8-MB cap. A read-only Meta model catalog check on 2026-10-27 returned HTTP 200 and listed both Muse Voice Transcribe 1.0 and Muse Spark 1.3 for this key; a short locally synthesized test phrase was transcribed successfully through the app route.

Recording starts only after the user activates the microphone. The browser converts captured mono audio to 16-bit PCM WAV at 16 kHz, stops after two minutes, and allows cancellation. The server independently checks the MIME type, WAV structure, channel count, bit depth, sample rate, duration, and request size (8 MB max) before forwarding it. Audio is held temporarily in memory for transcription; it is not written to the database or filesystem. The returned transcript is placed in the composer for review and editing, and is only persisted if sent as an ordinary chat message. Voice is optional; typed chat remains available if permission or transcription fails.

Meta Voice Transcribe is speech-to-text only; the Meta Model API does not provide text-to-speech. When a browser supports it, assistant messages offer explicitly started, pausable, and stoppable playback using that browser's native speech synthesis. Nothing is spoken automatically, and this browser voice is not a Meta model. A server-side Azure Speech TTS adapter is a compatible optional provider for a future consistent voice; see Microsoft's [text-to-speech documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech). It would require separate credentials and is not configured in ROCKY.

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
