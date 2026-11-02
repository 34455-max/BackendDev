# BackendDev

BackendDev is a local backend project workspace. It includes a project dashboard, project creation, editable starter files, project export, a local runner, and an OpenAI-compatible model connection.

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env`. Set the Supabase project URL and publishable/anon key for multi-user project storage, plus the model API key, provider URL, and exact model name for AI generation. The OpenAI-compatible URL is prefilled as an example.
3. Run `npm start` from this folder.
4. Open `http://127.0.0.1:4173/`.

Sign in with Supabase before using project creation, AI generation, execution, API testing, or exports. Project routes and runner endpoints check the user's Supabase session server-side too. `.env` and `data/` are excluded from Git. Never commit or share API keys. Restart the server after editing `.env`.

New account passwords and password resets require at least 12 characters, lowercase and uppercase letters, a number, and a symbol; common password words/patterns are rejected. The form shows a live checklist. Existing users may continue signing in with their current password. Sign-in attempts are limited to 8 per visitor IP/account pair per 15 minutes and 20 per visitor IP per 15 minutes. There is deliberately no shared per-email sign-in lockout: someone who knows an email address must not be able to block that account on every device. Signup, password recovery, and confirmation-email requests have separate per-email controls. Counters are in memory on one app instance; use a shared Redis-compatible store before scaling to multiple instances.

Supabase email delivery has a separate project-wide quota. Supabase's built-in sender is intended for testing and is heavily limited; configure custom SMTP in **Supabase → Authentication → SMTP Settings** before inviting users. When the provider reports an email-send limit, repeated retries will not reset the quota. Password sign-in itself does not send email; an `invalid_credentials` response means the password/account needs attention, and `email_not_confirmed` means the user must follow the confirmation link.

## Typical workflow

1. Sign in or create an account and confirm its email if Supabase asks you to.
2. Select **Build my project**, write what the backend should do in everyday words, and choose a language. The builder previews a starter resource and routes; Python is the beginner-friendly default.
3. Search projects from the dashboard or choose a project card to open its workspace.
4. Select a file, edit it, and choose **Save file**. Saved project files are stored in your Supabase account.
5. Use **Generate** to describe a change. BackendDev asks the configured model for a JSON proposal; inspect it and choose **Apply proposed files** to save it. The AI feature needs a working provider key, model ID, URL, network access, and API credits.
6. Choose **Run API server** and start it. Unlike a one-shot command, the local server stays alive until you press **Stop backend**. Use the API tester at `http://127.0.0.1:3000/health`, `/products`, or the resource name in your project. Try GET, POST, PUT, PATCH, and DELETE; send JSON in the body for writes. The dashboard runtime check shows which language tools are installed.
7. Choose **Run tests** to exercise checks, or **Build** for the language's compile/syntax step. Output and errors appear in the workspace. **Export project** downloads a source ZIP that you can extract and open in your editor. `.env`, private keys, and common credential files are excluded from exports; add secrets locally or in your host's environment settings.

### Deploying an exported starter

Use **How to deploy** inside a project to see commands for its language. The Python, JavaScript, Go, and C++ HTTP starters listen on `127.0.0.1:3000` for local runs, then use the host-provided `PORT` and bind to `0.0.0.0` in deployment. Go projects include `go.mod`; C++ includes a Dockerfile. Rust and Java currently produce console examples rather than HTTP services, and Assembly targets Linux x86-64 with NASM. They need extra framework or platform work before being deployed as a web API.

The generated HTTP starters are learning examples: data is in memory, CORS is open for the built-in browser tester, and routes have no authentication. Records disappear when the backend restarts. Before using real users or private data, add persistent storage, authentication and authorization, input validation, rate limits, backups, and an allowlist for CORS. The readiness review flags common omissions but is a source heuristic, not a security audit.

### Existing code and API contracts

Sign in and choose **Import project folder** to bring an existing local source folder into your workspace. BackendDev skips Git history, dependency/build folders, environment files, and common private-key files. To keep the Supabase project record within its request-size limit, imports are capped at 150 files, 200 KB per file, and 500 KB total source. Review imported files and dependency manifests before running them; importing does not install packages or include Git history.

Python, JavaScript, Go, C++, and Assembly HTTP starters include an `openapi.json` contract. Select **API contract** in the workspace to inspect it. The Python and JavaScript CRUD starters have collection and item routes; Go, C++, and Assembly describe their health route. Rust and Java currently create console starters and do not claim to serve HTTP until you add a framework.

AI proposals are shown as a per-file diff. Review the changed lines and check the review confirmation before applying. The AI currently returns whole-file contents for changed files; BackendDev does not merge concurrent edits or run generated tests automatically before saving, so build and test the project after applying a proposal.

Use **Run project readiness review** after importing or editing code to check for common production gaps such as missing tests, API contracts, persistent storage, authentication, environment templates, and deployment files. The scan also flags some high-confidence leaked-key patterns, dynamic execution, and wildcard CORS. It is a source heuristic, not a vulnerability scanner, and cannot certify that an application is secure or production-ready.

### Continuous integration

The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml`. Each push and pull request targeting `master` or `main` runs syntax checks and the full BackendDev test suite on Node.js 22. To require these checks before merging, enable branch protection or a ruleset for your default branch in GitHub and select both `verify (20)` and `verify (22)` as required status checks.

### GitHub repository and branch workflow

In a project workspace, expand **GitHub workflow**. Create a fine-grained personal access token restricted to the repositories you intend to use, with **Metadata: read**, **Contents: read and write**, and **Pull requests: write**. These permissions cover repository/branch listing, import, branch creation, commit publishing, and opening pull requests; see GitHub’s [Git reference](https://docs.github.com/en/rest/git/refs) and [pull request](https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request) endpoint requirements. BackendDev sends the token to its server, validates it with GitHub, encrypts it using AES-256-GCM, and stores only ciphertext in a private Supabase table. Each account has its own token. Disconnect removes the stored token.

Before connecting users, run `supabase/migrations/003_github_connections.sql` in the Supabase SQL Editor and configure `GITHUB_TOKEN_ENCRYPTION_KEY` in Render. Generate a key locally with Node.js: `node --input-type=commonjs -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Save the output directly in Render's environment settings; do not paste it into chat, GitHub, the app, or this example file. Keep a secure backup: changing this key makes saved tokens unreadable, so users will need to reconnect.

Select a repository to view its branches. **Import selected branch** creates a new private BackendDev project from that branch; common secrets, dependency folders, and binary files are skipped, with the same 150-file/500-KB limits. **Create branch** creates a branch from the repository default branch. **Commit current project** adds or updates project files on the selected branch after confirmation. It does not delete remote-only files. Select the feature branch and choose **Create pull request** to open a GitHub PR against the repository default branch. GitHub handles review, checks, and merging. Publishing directly to a protected default branch will usually be rejected.

The GitHub panel needs Supabase, the server-side Supabase key, the migration, an encryption key, and a fine-grained token for each user. GitHub integration is not available until those are configured. Tokens are not stored in browser storage or returned by the API.
Use the Light mode / Dark mode button in the header or sign-in panel to choose a theme; BackendDev remembers the choice in that browser. If an AI request reports HTTP 429 or no credits, add credits in the provider account. If it reports HTTP 404, check the exact model ID and API endpoint in `.env`.

The Python and JavaScript beginner starters create working in-memory CRUD REST APIs with a health check, collection/detail routes, CORS for the built-in API tester, and tests. Their sample records reset when the backend stops; connect a database for persistent data. Go includes an HTTP health endpoint. Rust and Java are runnable console starters that explain where to add a web framework. C++ creates a small native `/health` HTTP service and requires a modern C++17 compiler (GCC 7+ or current MinGW); it is a practical backend language. Assembly creates a low-level `/health` HTTP service for Linux x86-64 using NASM and GNU ld; on Windows, use WSL. Assembly is specialized and platform-specific, not a beginner-friendly general-purpose backend choice. Build, Test, and Run are local-only; hosted code execution is disabled until an isolated worker is configured. The app does not install framework dependencies.

To change a project's language, open its workspace, choose **Backend language**, and press **Switch language**. BackendDev creates a starter for the new language and saves a copy of the previous files under `migration-backup/<old-language>/`. It does not automatically translate application logic; review and rewrite it for the new language. Export the project to keep an independent copy before switching if you want an extra backup.

The dashboard activity list is stored in the current browser only. The API tester sends requests from the browser and does not proxy traffic through the server. BackendDev does not publish generated backends to the internet; users must export/deploy each generated API themselves.

## Multi-user deployment

The repository-root `render.yaml` describes a Render Free web service and sets its application root to `BackendDev/`. The migration at `supabase/migrations/001_projects.sql` defines owner-scoped project rows protected by Postgres row-level security; run it in the Supabase SQL editor before deploying. The app supports confirmation resend and forgot-password email links. Supabase’s built-in SMTP is testing-only: it sends only to addresses in your Supabase organization and currently allows about 2 emails/hour. Configure a custom SMTP provider in Supabase Authentication → SMTP Settings for user-facing mail. Password recovery redirects to `APP_URL` (set in `render.yaml` to `https://backenddev.hanskhan.me`); add that URL in Supabase Authentication → URL Configuration → Redirect URLs and use it as Site URL. Supabase intentionally returns generic success for unknown accounts to prevent email enumeration, so the success message alone cannot prove delivery.

To enable owner controls, set `APP_ADMIN_EMAILS` to your exact Supabase sign-in email. Set `SUPABASE_SECRET_KEY` to the project's server-side secret key in Render's Environment page. Do not put that key in the browser, Git, or a public `.env.example`. Server-side Supabase Auth calls use this secret key with Supabase's `Sb-Forwarded-For` header when a valid visitor IP is available, so users behind one Render service are not all bucketed under the same Render egress IP. The Owner controls button appears only after an allowlisted account signs in and enables TOTP in **Security**; each owner-console request also requires an AAL2 session from the verified authenticator code. Keep a recovery copy of the authenticator setup key in a secure password manager. The console can review accounts, inspect saved project files across accounts, update feedback status, suspend or restore accounts, and permanently delete accounts/projects. Other users can access only their own projects and submit feedback; the private feedback table is accessible only to the server-side secret key. The owner must reply to users from their email client; the app does not send support replies. The console warns before deletion. The secret key must remain on the server. The included Terms and Conditions are starter text; replace the operator contact and have it reviewed for your business and jurisdiction before public launch.

### User feedback inbox

Signed-in users can choose **Send feedback** in the page footer to file a problem report or suggestion. The server records the authenticated account, limits submissions to five per hour per account, and stores reports in Supabase. Only the owner can read the inbox and mark reports New, In review, or Resolved. To enable this inbox, run `supabase/migrations/002_user_feedback.sql` in the Supabase SQL Editor after the existing projects migration. Users should not include passwords, API keys, or private secrets in reports.

Render's Free service can spin down after inactivity, so first requests may take about a minute to wake it. Upgrade the service if you need always-on hosting.

For local signup, BackendDev uses the exact local app origin you opened for the email confirmation redirect. If Supabase rejects it, add that origin under **Authentication → URL Configuration → Redirect URLs**. A phone cannot open a `127.0.0.1` or `localhost` URL on your computer; phone sign-in needs the deployed public HTTPS URL added to Supabase's allowed redirects.

The server authenticates project API requests against Supabase Auth and scopes database access by owner; it filters writes to valid table columns and sets `updated_at`. Smoke tests use a fake Supabase endpoint to verify this contract. Production code execution remains disabled until a hardened isolated worker is configured.

The deployment checklist now calls a live readiness endpoint to check Supabase Auth reachability, the projects table/migration, and the public auth URL, without returning credentials. AI provider reachability is only proven when a generation request runs; email delivery still requires a single end-to-end email check.

The local runner uses a temporary working directory and keeps up to four local run sessions open, with a 30-minute cap per session. It has no OS/container security boundary. Run only code you trust. For public multi-user hosting, production code execution stays disabled until a secure worker is added. A hosted isolated worker still needs a separate provider/service, a defined API contract, and secrets configured on the host; this repository does not claim to provide remote sandbox execution yet.

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

