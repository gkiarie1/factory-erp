# Deployment and operations

These files prepare a single-host installation. No service has been published or production database changed by this work. Use your own domain, secrets, SMTP provider and backup destination.

## First installation

1. Install Docker Compose and a TLS reverse proxy on the host. The supplied [Caddy example](deploy/Caddyfile.example) proxies HTTPS to the web container on host loopback. Set DNS and arrange certificate issuance for your domain.
2. Copy `.env.example` to `.env`. Set a random database password, a matching internal `DATABASE_URL` using host `db`, a random JWT signing secret of at least 32 characters, and `PUBLIC_APP_URL` such as `https://factory.example.com`. URL-encode special characters in the database password. Keep `.env` private (`chmod 600 .env`). A signing secret can be generated with `python3 -c 'import secrets; print(secrets.token_hex(32))'`.
3. Configure SMTP to enable public password recovery. STARTTLS is mandatory in production. Without SMTP, operators can issue private, one-use recovery links with the CLI.
4. Build and initialize:

```bash
docker compose build
docker compose up -d db
docker compose run --rm api flask --app app:create_app db upgrade
docker compose run --rm api flask --app app:create_app create-admin
docker compose up -d
```

`create-admin` prompts for credentials; do not pass passwords on the command line. Production rejects demo seeding, development-server startup, SQLite, short signing secrets, wildcard CORS, and non-HTTPS public origins. Run migrations as a deliberate release step, not on every web worker startup. The web container waits for API readiness; `/api/health` checks both database access and the security schema.

Only `127.0.0.1:8080` is published. PostgreSQL and Gunicorn are internal. Never expose port 8080 directly to the Internet. Nginx trusts `X-Real-IP` only from loopback and Docker's private 172.16/12 range; narrow or adjust this to your actual TLS proxy gateway. Caddy overwrites that header with the client address. Nginx overwrites the API's forwarded headers; `TRUST_PROXY=1` must only be enabled in this topology. Verify client IP forwarding before relying on per-IP throttling. Per-account limits remain independent of IP addresses.

Gunicorn uses one threaded worker and simple-websocket, following the [Flask-SocketIO deployment guidance](https://flask-socketio.readthedocs.io/en/stable/deployment.html). Do not increase the worker count without designing shared Socket.IO routing and sticky sessions. This setup is suitable for a modest single-host workload; it is not a highly available cluster.

## Existing databases and upgrades

Take and verify a backup first. The initial migration adopts the project's existing `employee`, `users` and `work_request` tables, creates missing request/security tables, and adds defaulted account status and session-version columns. Existing PostgreSQL JSONB values are retained. It does not erase or recreate the legacy workforce tables. Custom schema changes need individual review. The adoption migration is intentionally forward-only; rollback uses a verified backup and the corresponding application version, not a destructive downgrade.

```bash
./scripts/backup.sh /private/factory-backups
docker compose stop web api
docker compose build
docker compose run --rm api flask --app app:create_app db upgrade
docker compose up -d
```

Retain the previous application release for rollback. Future model changes should have reviewed migration revisions created with `flask --app app:create_app db migrate -m 'describe change'` and applied with `db upgrade`; see [Flask-Migrate](https://flask-migrate.readthedocs.io/en/latest/). Do not stamp a database to skip an unapplied migration. The initial adoption revision needs a live database connection and does not support offline `--sql` generation.

## Account recovery and sessions

- New passwords require at least 12 characters and at most 72 UTF-8 bytes. Demo passwords remain available only in development.
- Public recovery always returns the same response for known and unknown emails. Links expire in 30 minutes, are stored as hashes, and can be used once. A newer link replaces older links. Links are never returned through the public API or logged by this app.
- Password changes/recovery and account deactivation invalidate all existing sessions. Reactivation does not revive old tokens. Logout revokes the current session. Tokens expire after 30 minutes and the UI stores them in tab-scoped session storage. Existing pre-upgrade tokens without a session version are rejected.
- Login is limited to 10 attempts per staff ID and 60 per client IP per 15-minute fixed window. Recovery is limited to 3 requests per email and 10 per IP per hour. Counters use atomic database updates and survive worker restarts. Limits count successful as well as failed attempts.
- Browser requests still require bearer tokens. Browser storage is not immune to XSS; the production frontend provides a restrictive CSP, same-origin API proxy, no third-party fonts/scripts, and no-referrer headers.
- SMTP delivery errors are logged without links or recipient details. Verify real email delivery before announcing recovery to staff.

Operator fallback, after verifying the employee's identity:

```bash
docker compose exec api flask --app app:create_app reset-link EMP001
```

This prints a sensitive link for private delivery. Do not paste it into logs or public tickets. Configure external proxy logs to omit reset-link query strings as well.

## Backups and maintenance

```bash
./scripts/backup.sh /private/factory-backups
docker compose exec api flask --app app:create_app prune-security
docker compose ps
docker compose logs --tail=100 api
```

The backup script writes a private PostgreSQL custom archive, verifies it can be read, then emits a checksum. Schedule it daily and before every migration; copy backups to encrypted off-host storage. Schedule `prune-security` daily to remove expired throttle counters, revocations and reset links. Audit events remain retained; define a retention policy appropriate to your organization.

A readable dump is not a restore test. Regularly restore into a separate, disposable database and verify expected records:

```bash
docker compose exec db createdb -U factory factory_restore_check
docker compose exec -T db pg_restore -U factory -d factory_restore_check --exit-on-error < /private/factory-backups/your-backup.dump
docker compose exec db psql -U factory -d factory_restore_check -c 'SELECT count(*) FROM users;'
```

Never restore over a live database without a deliberate recovery plan. Development SQLite databases can be backed up with SQLite's online backup API; copying a live database file alone can miss WAL data.

## Checks before going live

Confirm TLS and DNS, inspect real forwarded client IPs, send a recovery email to a test account, verify account/session revocation, run a restore drill, and monitor `/api/health`, disk usage, database connectivity, and email failures. The frontend uses Vite/Vitest with a locked dependency set. Python and npm audits reported no known vulnerabilities after the dependency updates. CI repeats dependency checks; continue monitoring new advisories. Passing tests and audits do not replace a visual browser review or a broader application security review.
