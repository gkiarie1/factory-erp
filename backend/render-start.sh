#!/bin/sh
# Single-instance free preview: Render Free does not support pre-deploy commands.
set -eu
export APP_ENV="${APP_ENV:-production}"
case "${DATABASE_URL:-}" in
    postgres://*) export DATABASE_URL="postgresql://${DATABASE_URL#postgres://}" ;;
esac
if [ -z "${PUBLIC_APP_URL:-}" ]; then
    : "${RENDER_EXTERNAL_URL:?Set PUBLIC_APP_URL or provide Render's RENDER_EXTERNAL_URL}"
    export PUBLIC_APP_URL="${RENDER_EXTERNAL_URL%/}"
fi
export CORS_ORIGINS="${CORS_ORIGINS:-$PUBLIC_APP_URL}"
python -m flask --app app:create_app db upgrade
python bootstrap_admin.py
exec gunicorn --config gunicorn.conf.py --bind "0.0.0.0:${PORT:-10000}" wsgi:app
