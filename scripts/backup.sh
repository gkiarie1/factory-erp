#!/bin/sh
set -eu
umask 077
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_dir=${1:-"$project_root/backups"}
mkdir -p "$backup_dir"
archive="$backup_dir/factory-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
trap 'rm -f "$archive.partial"' EXIT HUP INT TERM
docker compose --project-directory "$project_root" exec -T db pg_dump -U factory -d factory --format=custom > "$archive.partial"
# Validate the archive before marking the backup complete.
docker compose --project-directory "$project_root" exec -T db pg_restore --list < "$archive.partial" > /dev/null
mv "$archive.partial" "$archive"
sha256sum "$archive" > "$archive.sha256"
printf 'Backup created: %s\n' "$archive"
