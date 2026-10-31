# BackendDev

BackendDev is a local backend project workspace. It includes a project dashboard, project creation, editable starter files, project export, a local runner, and an OpenAI-compatible model connection.

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env`. Set the Supabase project URL and publishable/anon key for multi-user project storage, plus the model API key, provider URL, and exact model name for AI generation. The OpenAI-compatible URL is prefilled as an example.
3. Run `npm start` from this folder.
4. Open `http://127.0.0.1:4173/`.

When Supabase is configured, projects are stored per signed-in user in Supabase. Without Supabase, project data falls back to this machine's `data/projects.json` (and the browser keeps a local fallback). `.env` and `data/` are excluded from Git. Never commit or share API keys. Restart the server after editing `.env`.

## Typical workflow

1. Select **Build my backend**, write what the backend should do in everyday words, and choose a language. The builder previews a starter resource and routes; Python is the beginner-friendly default.
2. Search projects from the dashboard or choose a project card to open its workspace.
3. Select a file, edit it, and choose **Save file**. Saved project files are stored by the local backend.
4. Use **Generate** to describe a change. BackendDev asks the configured model for a JSON proposal; inspect it and choose **Apply proposed files** to save it.
5. Choose **Run**, **Build**, or **Test** and press **Start**. The dashboard's runtime check tells you which runtimes the local machine has installed. Read stdout/stderr in the output panel.
6. Use **Try a deployed API** to send GET/POST/PUT/PATCH/DELETE requests to a public URL. The target must allow browser CORS requests. Use **How to deploy** for the checklist, then **Export project** to download project metadata and files as JSON.

The Python beginner starter creates a working in-memory JSON REST API with a health endpoint and sample collection/item routes, plus `unittest` checks. Its sample data resets when the process stops. Other language starters are simpler examples; Python can run and discover `unittest` tests; JavaScript uses Node; Go and Rust support basic build/test commands; Java compiles and runs `Main.java`. TypeScript is currently JavaScript syntax only. Framework dependencies are not installed by the app. The runtime check also reports .NET, Ruby, and PHP availability, but those are not yet runnable from BackendDev.

The dashboard activity list is stored in the current browser only. The API tester sends requests from the browser and does not proxy traffic through the server. BackendDev does not publish generated backends to the internet; users must export/deploy each generated API themselves.

## Multi-user deployment

`render.yaml` describes a Render web service, and `supabase/migrations/001_projects.sql` defines owner-scoped project rows protected by Postgres row-level security. Run that SQL in the Supabase SQL editor before deploying. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `MODEL_API_KEY`, `MODEL_API_URL`, and `MODEL_NAME` in Render environment settings. Set `APP_URL` to the public Render URL and allow that URL in Supabase Auth redirect settings so confirmation links return to the hosted app. Keep the Supabase service-role key server-side only; BackendDev does not need it.

The server authenticates project API requests against Supabase Auth and scopes database access by owner; it filters writes to valid table columns and sets `updated_at`. Smoke tests use a fake Supabase endpoint to verify this contract. Production code execution remains disabled until a hardened isolated worker is configured. The deployment checklist confirms configuration presence; it cannot verify email delivery or the live Supabase migration by itself.

The local runner has a time limit and temporary working directory, but no OS/container security boundary. Run trusted code only. For public multi-user hosting, production code execution stays disabled until a secure worker is added.

## Cursor behavior reviewed

The design takes workflow cues from Cursor's public product documentation:

- Cursor Agent searches a codebase, edits multiple files, runs shell commands, and reads results as it iterates. [Agent mode](https://cursor.com/help/ai-features/agent) and [coding agents](https://prod.cursor.com/help/ai-features/coding-agents)
- Cursor documents distinct read-only Ask, planning, and autonomous Agent workflows, plus reviewable diffs. [Agent overview](https://cursor.com/docs/agent/overview) and [modes](https://docs.cursor.com/en/agent/modes)
- Terminal execution is part of the agent workflow. [Terminal integration](https://docs.cursor.com/en/agent/terminal)

This is documentary evidence of described product behavior, not a reverse-engineering result from Cursor's private source or a running Cursor process. The research environment did not expose the REA inspection tools or a Cursor application target, so implementation details beyond those docs remain unknown. UI details in this prototype are design choices, not claims about Cursor's interface.

## Prototype boundary

The picker offers TypeScript, Python, Go, Rust, Java, C#, Ruby, PHP, and custom project entries. The included local runner currently executes only Python, JavaScript, Go, Rust, and Java, and requires each runtime/compiler to be installed. It runs processes in temporary folders with a timeout, but does not provide OS-level sandboxing; only run trusted code. The AI route expects an OpenAI-compatible Chat Completions endpoint. Actual generation requires a valid key, model name, and network access to the provider.

## Files

- `index.html` — dashboard and project creation dialog
- `styles.css` — responsive dark workspace styling
- `app.js` — client-side interactions
