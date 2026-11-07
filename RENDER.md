# Render backend — free preview

The root `render.yaml` provisions a free Python web service and a free PostgreSQL 16 database in the same region. It does not deploy the frontend or create paid resources.

## Deploy

1. Push the deployment files to GitHub, then use **New → Blueprint** in Render and select this repository and the branch containing `render.yaml`.
2. Review the service/database plans: both must be **Free**.
3. Apply the Blueprint. Render links the internal database URL and generates the JWT signing key and first administrator's password.
4. Wait until `https://YOUR-SERVICE.onrender.com/health` returns `{"status":"ok"}`.
5. In the API service's Environment settings, retrieve `INITIAL_ADMIN_PASSWORD`. The preview administrator staff ID is `ADM001`.

Python is pinned to the latest 3.12 patch through `.python-version`, rather than Render's newer default runtime. The web service follows Render's `PORT` value and uses one Gunicorn worker for Socket.IO polling.

## First administrator

The startup wrapper applies migrations and creates an administrator **only when no administrator exists**. It never resets credentials on restart or promotes an existing employee. The generated password is not written to application logs.

The reserved placeholder email is `preview-admin@factory.invalid`. If you want a real administrator email, change `INITIAL_ADMIN_EMAIL` in Render before the first successful startup. Changing the bootstrap environment later does not edit an existing account. SMTP is left unconfigured for this preview.

Once the administrator exists, remove `INITIAL_ADMIN_PASSWORD` from the service environment and redeploy. Existing administrators remain unchanged, and removing this variable prevents the bootstrap from recreating an administrator if the database is accidentally replaced without new credentials being supplied.

## Connect the Vercel frontend afterwards

On the backend, set these to the exact deployed frontend origin (no trailing slash):

```env
PUBLIC_APP_URL=https://YOUR-FRONTEND.vercel.app
CORS_ORIGINS=https://YOUR-FRONTEND.vercel.app
```

Redeploy the backend. On Vercel, set `VITE_API_URL` to the backend's HTTPS URL and redeploy the frontend. Until this is configured, the backend defaults its public URL and allowed origin to its own Render URL. Health and API checks work, but a frontend on another origin is not allowed yet. Password reset links should not be issued until the frontend URL is configured.

## Free-tier constraints

Free PostgreSQL expires after 30 days and is not a persistent production database. Free web services sleep when idle and may take time to wake. Render Free has no pre-deploy command, shell access, or one-off jobs, so this preview applies migrations in its single-instance start script before Gunicorn starts. For paid production, move migrations into `preDeployCommand` and remove them from startup.

The database's public IP allowlist is empty; the backend connects internally. No local SQLite data or existing users are uploaded to this new database. Automatic deploys are disabled so dependency or application updates do not unexpectedly trigger preview migrations.

Render Free also blocks standard SMTP ports, so this preview does not promise email-based recovery. Upgrade or implement a supported HTTPS email provider before enabling mailed recovery on this host.

References: [Blueprint specification](https://render.com/docs/blueprint-spec), [free-tier limitations](https://render.com/docs/free), [Python version selection](https://render.com/docs/python-version).
