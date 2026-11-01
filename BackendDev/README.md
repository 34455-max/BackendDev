# BackendDev

BackendDev is a local backend project workspace. It includes a project dashboard, project creation, editable starter files, project export, a local runner, and an OpenAI-compatible model connection.

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env`. Set the Supabase project URL and publishable/anon key for multi-user project storage, plus the model API key, provider URL, and exact model name for AI generation. The OpenAI-compatible URL is prefilled as an example.
3. Run `npm start` from this folder.
4. Open `http://127.0.0.1:4173/`.

Sign in with Supabase before using project creation, AI generation, execution, API testing, or exports. Project routes and runner endpoints check the user's Supabase session server-side too. `.env` and `data/` are excluded from Git. Never commit or share API keys. Restart the server after editing `.env`.

New account passwords and password resets require at least 12 characters, lowercase and uppercase letters, a number, and a symbol; common password words/patterns are rejected. The form shows a live checklist. Existing users may continue signing in with their current password. Auth requests are rate limited by visitor IP and hashed email (8 sign-in attempts per IP/account per 15 minutes and 20 per email per hour). These counters are in memory on a single app instance; use a shared Redis-compatible store before scaling to multiple instances.

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

The repository-root `render.yaml` describes a Render Free web service and sets its application root to `BackendDev/`. The migration at `supabase/migrations/001_projects.sql` defines owner-scoped project rows protected by Postgres row-level security; run it in the Supabase SQL editor before deploying. The app supports confirmation resend and forgot-password email links; configure custom SMTP in Supabase for reliable delivery. Password recovery redirects back to `APP_URL`/Render's public URL, which must be listed in Supabase Auth → URL Configuration → Redirect URLs.

To enable owner controls, set `APP_ADMIN_EMAILS` to your exact Supabase sign-in email. Set `SUPABASE_SECRET_KEY` to the project's server-side secret key in Render's Environment page. Do not put that key in the browser, Git, or a public `.env.example`. The Owner controls button appears only after an allowlisted account signs in; use your normal sign-in with that email, then select the button in the top bar. The console can review accounts, inspect saved project files across accounts, reply to support feedback by email, update feedback status, suspend or restore accounts, and permanently delete accounts/projects. Other users can access only their own projects and submit feedback; the private feedback table is accessible only to the server-side service key. The console explains administrative actions and warns before deletion. The secret key must remain on the server. The included Terms and Conditions are a starter text; replace the operator contact and have it reviewed for your business and jurisdiction before public launch.

### User feedback inbox

Signed-in users can choose **Send feedback** in the page footer to file a problem report or suggestion. The server records the authenticated account, limits submissions to five per hour per account, and stores reports in Supabase. Only the owner can read the inbox and mark reports New, In review, or Resolved. To enable this inbox, run `supabase/migrations/002_user_feedback.sql` in the Supabase SQL Editor after the existing projects migration. Users should not include passwords, API keys, or private secrets in reports.

Render's Free service can spin down after inactivity, so first requests may take about a minute to wake it. Upgrade the service if you need always-on hosting.

For local signup, BackendDev uses the exact local app origin you opened for the email confirmation redirect. If Supabase rejects it, add that origin under **Authentication → URL Configuration → Redirect URLs**. A phone cannot open a `127.0.0.1` or `localhost` URL on your computer; phone sign-in needs the deployed public HTTPS URL added to Supabase's allowed redirects.

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
