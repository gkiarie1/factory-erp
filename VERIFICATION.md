# Verification — 5 November 2026

- Backend: 17 tests passed with SQLite; the workflow/security suite also passed against a disposable PostgreSQL 16 cluster. Tests cover authentication, role restrictions, attendance, registration, durable requests, duplicate approvals, leave/overtime balances, warnings, recovery expiry/single use, session revocation, account status, audit access, throttling, and migrations.
- Migrations: tested empty database creation and legacy-schema adoption. A separate PostgreSQL smoke check retained employee rows and an existing JSONB warnings column and verified list mutations after adoption.
- Frontend: five interaction tests passed under Vitest, including reset-token handling in React StrictMode. The Vite production build and offline lockfile reinstall succeeded. Short-lived HTTP smoke tests also checked development/production preview, recovery routes, the favicon, and API path rewriting.
- Production server: Gunicorn started with production configuration against the disposable PostgreSQL database. Health, security headers, login, dashboard and authenticated Socket.IO polling passed. The test server and database were stopped after checks.
- Configuration: Docker Compose model validation, Nginx configuration validation on an unprivileged test port, and backup script shell syntax checks passed.
- Dependencies: final `pip-audit -r backend/requirements.txt` and `npm audit` reported no known vulnerabilities in the resolved dependency sets. Audits reflect public metadata at check time, not a guarantee of application security.

Limits: no visual browser review, live SMTP delivery, Docker image build, real TLS/DNS setup, off-host backup scheduling, or production restore drill was performed. Docker daemon access and a browser were unavailable. SMTP behavior was exercised with mocked delivery. CI definitions were added but have not run on GitHub here.

Run the checks described in README.md and DEPLOYMENT.md after configuring your environment. Existing frontend installs need `npm ci` after the Vite migration; backend installs need updated requirements and `flask --app app:create_app db upgrade`.

## Control-room redesign

The charcoal/cobalt/amber interface replaces the sidebar with horizontal navigation and introduces crew-coverage modules plus factory-specific SVG icons. The build and five interaction tests pass, including a check that machine-line coverage uses actual attendance counts. No visual browser review was available.
