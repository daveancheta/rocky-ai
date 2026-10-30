# Rocky

Rocky is a visual intelligence web app. Take or upload a photo, ask an optional question, and get a structured explanation of what the image supports. The analysis can include visible details, detected objects and their locations, uncertainty, and suggestions for follow-up questions.

## Screenshots

### Add a photo

![Rocky photo upload screen](app/public/Screenshot%202026-10-30%20201210.png)

### Review an analysis

![Rocky visual analysis with detected object locations](app/public/Screenshot%202026-10-30%20201221.png)

## Use Rocky

1. Open the home page and choose **Take a picture** or **Choose an image** (JPEG, PNG, or WebP up to 10 MB). Camera access requires browser permission and is available on secure origins such as localhost or HTTPS.
2. Optionally enter a question about the photo, then start the analysis.
3. Review the identification, visible observations, context, uncertainty, and object locations. Select a detected object to ask Rocky to explain it.
4. Use suggested follow-up questions or search public information for related sources. Public information search requires signing in. For a person, provide a name or public details; Rocky does not identify people from their face.
5. Sign in with Google before analyzing to save the analysis to **Recent analyses**. Saved entries are stored in this browser, and you can reopen an image or delete an entry there.

Signed-out users can make two free image analyses. Sign in to continue after reaching that limit. You can change the color theme from **Appearance** in the sidebar.

## How the system works

1. **Browser UI** — The Next.js app provides the analyzer, camera and file inputs, previews, analysis results, and recent history.
2. **Image handling** — The server checks that an upload is a valid JPEG, PNG, or WebP image, enforces size and dimension limits, corrects orientation, and re-encodes it to remove EXIF metadata before sending it for analysis.
3. **Image analysis** — The server calls Meta's OpenAI-compatible Model API. Muse Spark returns a validated structured analysis. The interface displays what is visible separately from general context and details that need external verification.
4. **Follow-up actions** — Users can request an explanation of a detected object and, when configured, search public sources related to the analysis. Search sources are displayed separately from image evidence. The person search uses details the user provides and does not match results to a face.
5. **Sign-in and history** — Better Auth handles Google sign-in and stores account/session data in PostgreSQL through Drizzle and the Neon serverless driver. Analysis images and results are not stored on Rocky's server; signed-in browser history uses IndexedDB on that device and keeps up to 30 entries per account.

The image-analysis provider key stays on the server and must never use a `NEXT_PUBLIC_` variable. The image itself is sent to Meta for the requested analysis. Public information search uses Meta search grounding when the optional Muse Wonder model is configured.

## Run locally

### Requirements

- Node.js 20.9 or newer and npm
- A PostgreSQL database, such as Neon
- A Meta Model API key with access to Muse Spark and SAM
- Google OAuth credentials for sign-in and history features

### Configure

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values. PowerShell users can run `Copy-Item .env.example .env`. The Drizzle migration commands load `.env`.
3. Create a Better Auth secret, for example with `openssl rand -base64 32`, and configure the Google OAuth application with the callback URL `http://localhost:3000/api/auth/callback/google` for local development.
4. Generate and apply the database migrations:

   ```sh
   npx drizzle-kit generate
   npx drizzle-kit migrate
   ```

5. Start the development server:

   ```sh
   npm run dev
   ```

6. Visit [http://localhost:3000](http://localhost:3000).

The app requires `DATABASE_URL`, Better Auth settings, Google OAuth credentials, and `MODEL_API_KEY` for a full local setup. The analyzer can run without Google credentials, but sign-in and saved history will not work. Public information search is disabled until `META_MUSE_WONDER_MODEL` is set to a model enabled for your Meta account.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Neon and Drizzle. |
| `BETTER_AUTH_URL` | Yes | Base URL of the app, such as `http://localhost:3000`. |
| `BETTER_AUTH_SECRET` | Yes | Secret used by Better Auth and to sign the anonymous usage cookie. |
| `GOOGLE_CLIENT_ID` | For Google sign-in | OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | For Google sign-in | OAuth client secret. |
| `MODEL_API_KEY` | Yes for analysis | Server-side Meta Model API key. |
| `MODEL_API_BASE_URL` | No | API base URL; defaults to `https://api.meta.ai/v1`. |
| `MODEL_API_TIMEOUT_MS` | No | Request timeout in milliseconds; defaults to `60000`. |
| `META_MUSE_SPARK_MODEL` | No | Analysis and object-explanation model; defaults to `muse-spark-1.3`. |
| `META_SAM_MODEL` | No | Segmentation model; defaults to `sam-3.1`. |
| `META_MUSE_WONDER_MODEL` | No | Optional model for public information search; unset disables this feature. |

Optional `META_MUSE_IMAGE_MODEL` and `META_MUSE_VOICE_MODEL` settings are also recognized by the server integration for image generation/editing and transcription. Those capabilities are not part of the current app workflow.

## Useful commands

```sh
npm run dev       # Start the local development server
npm run build     # Create a production build
npm run start     # Serve the production build
npm run lint      # Run ESLint
npm test          # Run API and visual intelligence tests
npm run meta:check # Check configured model access without making inference requests
```

See [docs/meta-model-api.md](docs/meta-model-api.md) for Meta API behavior, optional capabilities, and model-access troubleshooting.
