# BackendDev

BackendDev is a local backend project workspace. It includes a project dashboard, project creation, editable starter files, project export, a local runner, and an OpenAI-compatible model connection.

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env`. Set the Supabase project URL and publishable/anon key for multi-user project storage, plus the model API key, provider URL, and exact model name for AI generation. The OpenAI-compatible URL is prefilled as an example.
3. Run `npm start` from this folder.
4. Open `http://127.0.0.1:4173/`.

Sign in with Supabase before using project creation, AI generation, execution, API testing, or exports. Project routes and runner endpoints check the user's Supabase session server-side too. `.env` and `data/` are excluded from Git. Never commit or share API keys. Restart the server after editing `.env`.

## Typical workflow

1. Sign in or create an account and confirm its email if Supabase asks you to.
2. Select **Build my project**, write what the backend should do in everyday words, and choose a language. The builder previews a starter resource and routes; Python is the beginner-friendly default.
3. Search projects from the dashboard or choose a project card to open its workspace.
4. Select a file, edit it, and choose **Save file**. Saved project files are stored in your Supabase account.
5. Use **Generate** to describe a change. BackendDev asks the configured model for a JSON proposal; inspect it and choose **Apply proposed files** to save it. The AI feature needs a working provider key, model ID, URL, network access, and API credits.
6. Choose **Run API server** and start it. Unlike a one-shot command, the local server stays alive until you press **Stop backend**. Use the API tester at `http://127.0.0.1:3000/health`, `/products`, or the resource name in your project. Try GET, POST, PUT, PATCH, and DELETE; send JSON in the body for writes. The dashboard runtime check shows which language tools are installed.
7. Choose **Run tests** to exercise checks, or **Build** for the language's compile/syntax step. Output and errors appear in the workspace. Export the project when you want to continue in your own editor or deploy it.

Use the Light mode / Dark mode button in the header or sign-in panel to choose a theme; BackendDev remembers the choice in that browser. If an AI request reports HTTP 429 or no credits, add credits in the provider account. If it reports HTTP 404, check the exact model ID and API endpoint in `.env`.

The Python and JavaScript beginner starters create working in-memory CRUD REST APIs with a health check, collection/detail routes, CORS for the built-in API tester, and tests. Their sample records reset when the backend stops; connect a database for persistent data. Go includes an HTTP health endpoint. Rust and Java are runnable console starters that explain where to add a web framework. The app does not install framework dependencies. The runtime check also reports .NET, Ruby, and PHP availability, but those runtimes are not currently offered as runnable starter templates.

The dashboard activity list is stored in the current browser only. The API tester sends requests from the browser and does not proxy traffic through the server. BackendDev does not publish generated backends to the internet; users must export/deploy each generated API themselves.

## Multi-user deployment

`render.yaml` describes a Render web service, and `supabase/migrations/001_projects.sql` defines owner-scoped project rows protected by Postgres row-level security. Run that SQL in the Supabase SQL editor before deploying. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `MODEL_API_KEY`, `MODEL_API_URL`, and `MODEL_NAME` in Render environment settings. Set `APP_URL` to the public Render URL and allow that URL in Supabase Auth redirect settings so confirmation links return to the hosted app. Keep the Supabase service-role key server-side only; BackendDev does not need it.

For local signup, BackendDev uses the exact local app origin you opened for the email confirmation redirect. If Supabase rejects it, add that origin under **Authentication → URL Configuration → Redirect URLs**. A phone cannot open a `127.0.0.1` or `localhost` URL on your computer; phone sign-in needs the app deployed at a public HTTPS URL and that same URL configured as `APP_URL` and an allowed redirect.

The server authenticates project API requests against Supabase Auth and scopes database access by owner; it filters writes to valid table columns and sets `updated_at`. Smoke tests use a fake Supabase endpoint to verify this contract. Production code execution remains disabled until a hardened isolated worker is configured. The deployment checklist confirms configuration presence; it cannot verify email delivery or the live Supabase migration by itself.

The local runner uses a temporary working directory and keeps up to four local run sessions open, with a 30-minute cap per session. It has no OS/container security boundary. Run only code you trust. For public multi-user hosting, production code execution stays disabled until a secure worker is added.

## Cursor behavior reviewed

The design takes workflow cues from Cursor's public product documentation:

- Cursor Agent searches a codebase, edits multiple files, runs shell commands, and reads results as it iterates. [Agent mode](https://cursor.com/help/ai-features/agent) and [coding agents](https://prod.cursor.com/help/ai-features/coding-agents)
- Cursor documents distinct read-only Ask, planning, and autonomous Agent workflows, plus reviewable diffs. [Agent overview](https://cursor.com/docs/agent/overview) and [modes](https://docs.cursor.com/en/agent/modes)
- Terminal execution is part of the agent workflow. [Terminal integration](https://docs.cursor.com/en/agent/terminal)

This is documentary evidence of described product behavior, not a reverse-engineering result from Cursor's private source or a running Cursor process. The research environment did not expose the REA inspection tools or a Cursor application target, so implementation details beyond those docs remain unknown. UI details in this prototype are design choices, not claims about Cursor's interface.

## Prototype boundary

Runnable starters are Python, JavaScript / Node.js, Go, Rust, and Java. Python and JavaScript have CRUD API examples; Go has a health endpoint; Rust and Java are console starters. Each local runtime/compiler must be installed first. The AI route expects an OpenAI-compatible Chat Completions endpoint and needs a valid server-side key, model URL, model name, and network access to the provider.

## Files

- `index.html` — dashboard and project creation dialog
- `styles.css` — responsive interface and dark/light themes
- `app.js` — client-side interactions
- `starter-templates.js` — generated project files and beginner CRUD templates
- `scripts/smoke-test.mjs` — server, database schema contract, starter, runner, and production safety checks
