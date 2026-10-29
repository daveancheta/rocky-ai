# Meta Model API integration

The Meta client lives in `lib/meta-model-api.ts` and is marked server-only. It uses Meta's documented OpenAI-compatible API through the `openai` SDK and Meta's `@meta-sam/parser` for SAM output. It does not persist image, audio, result, or transcript data in Rocky's database.

## Configuration

Set these variables in the server environment. Do not add real values to `.env.example` or expose them with a `NEXT_PUBLIC_` prefix.

| Variable | Required | Default / behavior |
| --- | --- | --- |
| `MODEL_API_KEY` | Yes | Meta Model API bearer token. |
| `MODEL_API_BASE_URL` | No | `https://api.meta.ai/v1`. |
| `MODEL_API_TIMEOUT_MS` | No | `60000`. |
| `META_MUSE_SPARK_MODEL` | No | `muse-spark-1.3`; primary image analysis and follow-up. |
| `META_SAM_MODEL` | No | `sam-3.1`; image segmentation. |
| `META_MUSE_WONDER_MODEL` | No | Unset disables deeper research and grounded web search. |
| `META_MUSE_IMAGE_MODEL` | No | Unset disables image generation and editing. Set to `muse-image-1.0` to enable. |
| `META_MUSE_VOICE_MODEL` | No | Unset disables transcription. Set to `muse-voice-transcribe-1.0` to enable. |

Optional capabilities stay disabled unless their model ID variable is set. `checkMetaModelCapabilities()` checks the configured IDs against the authenticated `GET /v1/models` catalog for the account; it does not spend tokens by issuing inference requests.

## Verify account access

After setting `MODEL_API_KEY`, run:

```sh
npm run meta:check
```

The command prints capability status without printing credentials. `available` means the authenticated Meta model catalog listed that model. A configured model absent from the catalog is `unavailable`; an omitted optional model ID is `disabled`. The test suite uses mocked HTTP responses and works without provider credentials:

```sh
npm test
npm run lint
npx tsc --noEmit
```

The catalog check verifies authentication and account model access. To verify inference endpoints and billing for a capability, call the corresponding exported service with a valid sample input: `analyzeImage`, `segmentImage`, `researchWithMuseWonder`, `generateMuseImage`, `editMuseImage`, or `transcribeMuseVoice`.

## Service functions

- `analyzeImage` sends JPEG, PNG, or WebP bytes to the Responses API as a base64 data URL. It requests JSON Schema output and validates the response before returning it.
- `askMuseSparkFollowUp` resends the transient image and analysis context with the next question. It sets `store: false`, so it does not rely on persisted response IDs.
- `segmentImage` streams the Responses API result into `@meta-sam/parser`. It returns typed boxes and mask payloads; `decodeMaskToRaster` can decode a mask to a binary raster.
- `researchWithMuseWonder` uses Meta's Responses API `web_search` grounding and returns citation titles and URLs. Meta may decide a query does not need a search; in that case `searched` is false and the source list may be empty.
- `generateMuseImage` and `editMuseImage` use Muse Image's documented image endpoints.
- `transcribeMuseVoice` accepts WAV audio only, uses `POST /v1/asr/transcribe` with the documented multipart `request` and `audio` fields, and sets a request ID as Meta's `sessionId`. Files are capped below Meta's 32 MB request limit; Meta documents a maximum 10-minute recording duration.

Every request logs a generated request ID, capability, model, elapsed time, and sanitized status fields. Logs do not include images, audio, prompt text, provider response bodies, or credentials. Rate-limit errors include a parsed retry delay when Meta returns `Retry-After`.

## Official Meta references

- [Overview and authentication](https://dev.meta.ai/docs/overview)
- [Model catalog and model IDs](https://dev.meta.ai/docs/models)
- [Image understanding and Responses API image inputs](https://dev.meta.ai/docs/image-understanding)
- [SAM 3.1 segmentation request and output](https://dev.meta.ai/docs/sam/overview)
- [SAM typed parser and mask decoding](https://dev.meta.ai/docs/sam/client-libraries)
- [Search grounding and citation URLs](https://dev.meta.ai/docs/search-grounding)
- [Muse Image generation](https://dev.meta.ai/docs/api-reference/images/create-image)
- [Muse Image editing](https://dev.meta.ai/docs/api-reference/images/edit-image)
- [Muse Voice file transcription](https://dev.meta.ai/docs/api-reference/voice/transcribe)
- [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits)
