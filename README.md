# Factory — People & Operations

A Flask + React workspace for attendance, employee records, leave, and overtime. The interface includes a live workforce overview, searchable team directory, request review queue, employee shift workspace, activity history, and account settings.

## Run locally

Use Python 3.10+ and Node.js 22.13+ (22 LTS) or 24+. SQLite works out of the box; PostgreSQL is optional for local use.

Backend, from the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m flask --app app:create_app db upgrade
python -m flask --app app:create_app seed-demo
python app.py
```

In another terminal:

```bash
cd frontend
npm ci
npm start
```

Open http://localhost:3000. The API uses http://localhost:5000. After pulling changes, apply migrations again with `python -m flask --app app:create_app db upgrade` before starting the backend. The `init-db` command is an alias for applying migrations. Startup does not delete, seed, or automatically migrate your database.

Optional development demo accounts:

| Role | Staff ID | Password |
| --- | --- | --- |
| Administrator | ADM001 | admin123 |
| Employee | EMP001 | employee123 |

For a real installation, use `flask --app app:create_app create-admin` instead. Production disables demo seeding. New account passwords require at least 12 characters.

## What works

- Administrator overview with real attendance coverage, machine-line coverage, pending reviews, and recent activity.
- Team search, attendance and line filters, filtered CSV exports, employee editing, and recorded warnings.
- Explicit employee clock-in/out, employment details, leave and overtime requests, and request history.
- Durable requests with duplicate protection and atomic, single-decision approvals. Leave reserves one calendar day on approval; overtime totals are approved hours, not measured hours worked.
- Password recovery, password changes, account deactivation/reactivation, expiring sessions, logout revocation, database-backed login limits, and persistent audit events.
- Responsive layouts, keyboard-accessible dialogs, clear empty/error states, reduced-motion support, live updates, and polling fallback.

Each employee can submit one request of each type per date, including rejected requests. Multi-day leave, holidays, resubmission policy, payroll, and attendance timesheet history remain outside the current scope.

## Configuration

Factory calendar-day validation uses `APP_TIMEZONE` (default `Africa/Nairobi`); timestamps are stored in UTC.

The backend reads shell environment variables; it does not load `.env` automatically:

```bash
export DATABASE_URL='postgresql://erp_user:your_url_encoded_password@localhost/erp'
export JWT_SECRET_KEY='a-long-random-secret-at-least-32-characters'
export CORS_ORIGINS='http://localhost:3000'
export PUBLIC_APP_URL='http://localhost:3000'
```

With no `DATABASE_URL`, data lives in `backend/instance/factory.db`. Local development generates a private signing secret in `backend/instance/jwt-secret`. Back up the database and keep the instance directory private.

Copy `frontend/.env.example` to `frontend/.env` to change `VITE_API_URL`, then restart the frontend. A production build uses `/api` through the supplied same-origin proxy; Socket.IO follows the same API path.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_STARTTLS=true` for emailed recovery links. Without SMTP, a trusted operator can run `flask --app app:create_app reset-link EMP001` and privately deliver the resulting one-use link after verifying identity. Never expose these links in public logs or tickets.

## Validation

```bash
cd backend
source .venv/bin/activate
python -m unittest discover -s tests -v
```

```bash
cd frontend
npm test
npm run build
```

Backend tests use isolated in-memory or temporary SQLite databases by default. To exercise workflow/security tests against PostgreSQL, set `FACTORY_TEST_DATABASE_URL` to a dedicated disposable database whose name starts with `factory_test_`. These integration tests create and drop tables. Never use a live database. Migration tests also verify adoption of a pre-security schema without losing rows.

Frontend interaction tests cover failed sign-in, the reset-token flow under React StrictMode, combined directory filters, and request decisions/history. They do not replace a visual browser review.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for PostgreSQL/Gunicorn/Nginx containers, HTTPS proxy configuration, migrations, first-admin creation, email recovery, private backups, restore checks, and maintenance. These are deployment foundations; the repository has not been published or configured with your live secrets, domain, or SMTP service.

Legacy virtual environments and `node_modules` were already committed in this repository. They are not the source of truth: install with the commands above. Ignore rules prevent new generated files but do not untrack existing files. The frontend now uses Vite and Vitest. Existing checkouts must rerun `npm ci` after this upgrade; the old committed dependency directory does not match the new lockfile. Both Python and npm dependency sets were checked against public vulnerability metadata during this change; this does not replace ongoing patching or an application security review.
