#!/usr/bin/env sh
set -eu

usage() {
  echo "Usage: $0 [ghcr.io/my-account/lobehub-self-hosted:sha-83b8aa5]" >&2
  echo "If no image is provided, .last-lobe-image is used." >&2
}

if [ "$#" -gt 1 ]; then
  usage
  exit 2
fi

if [ "$#" -eq 1 ]; then
  TARGET_IMAGE="$1"
elif [ -f ".last-lobe-image" ]; then
  TARGET_IMAGE="$(cat .last-lobe-image)"
else
  echo "Error: no rollback image provided and .last-lobe-image does not exist." >&2
  exit 2
fi

case "$TARGET_IMAGE" in
  ghcr.io/*:sha-*|lobehub/lobehub*) ;;
  *)
    echo "Error: rollback image must be a GHCR sha tag or the original lobehub/lobehub image." >&2
    exit 2
    ;;
esac

if [ ! -f ".env" ]; then
  echo "Error: .env not found. Run this script from the server deployment directory." >&2
  exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
  echo "Error: docker-compose.yml not found. Run this script from the server deployment directory." >&2
  exit 1
fi

if [ -d backups ]; then
  chmod 700 backups
else
  ( umask 077 && mkdir -p backups )
fi
touch releases.log

TMP_DIR=".rollback-tmp-$(date +%Y%m%d%H%M%S)-$$"
if ! ( umask 077 && mkdir "$TMP_DIR" ); then
  echo "Error: failed to create temporary directory: $TMP_DIR" >&2
  exit 1
fi

ENV_BACKUP=""
ENV_TMP=""
BACKUP_TMP=""
ENV_MUTATED=0
ROLLBACK_SUCCEEDED=0

restore_env() {
  if [ "$ROLLBACK_SUCCEEDED" -ne 1 ] && [ "$ENV_MUTATED" -eq 1 ] && [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
    cat "$ENV_BACKUP" > .env
    ENV_MUTATED=0
  fi
}

cleanup_files() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

on_exit() {
  restore_env
  cleanup_files
}

on_signal() {
  echo "Error: interrupted. Restored previous .env if it had been changed." >&2
  restore_env
  cleanup_files
  trap - EXIT HUP INT TERM
  exit 1
}

trap on_exit EXIT
trap on_signal HUP INT TERM

CURRENT_IMAGE="$(grep '^LOBE_IMAGE=' .env | sed 's/^LOBE_IMAGE=//' || true)"

BACKUP_FILE="backups/lobehub-rollback-$(date +%Y-%m-%d-%H%M%S)-$$.sql"
BACKUP_TMP="$TMP_DIR/backup.sql"
echo "Creating database backup before rollback: $BACKUP_FILE"
if ! ( umask 077; set -C; docker exec lobe-postgres sh -c 'pg_dump -U postgres "$POSTGRES_DB"' > "$BACKUP_TMP" ); then
  echo "Error: failed to create database backup." >&2
  exit 1
fi

if ! ln "$BACKUP_TMP" "$BACKUP_FILE"; then
  echo "Error: failed to publish final backup file without overwriting: $BACKUP_FILE" >&2
  exit 1
fi
chmod 600 "$BACKUP_FILE"

LOBE_IMAGE="$TARGET_IMAGE" docker compose config >/dev/null
LOBE_IMAGE="$TARGET_IMAGE" docker compose pull lobe

ENV_BACKUP="$TMP_DIR/env-backup"
ENV_TMP="$TMP_DIR/env-tmp"
cp .env "$ENV_BACKUP"
cp .env "$ENV_TMP"

if grep -q '^LOBE_IMAGE=' .env; then
  awk -v image="$TARGET_IMAGE" '
    /^LOBE_IMAGE=/ {
      print "LOBE_IMAGE=" image
      next
    }

    {
      print
    }
  ' "$ENV_BACKUP" > "$ENV_TMP"
else
  printf '\nLOBE_IMAGE=%s\n' "$TARGET_IMAGE" >> "$ENV_TMP"
fi

ENV_MUTATED=1
cat "$ENV_TMP" > .env

if ! docker compose up -d --no-deps lobe; then
  restore_env
  if docker compose up -d --no-deps lobe; then
    echo "Error: rollback failed. Previous .env was restored and lobe recovery restart succeeded." >&2
  else
    echo "Error: rollback failed. Previous .env was restored, but lobe recovery restart failed. Manual intervention required." >&2
  fi
  exit 1
fi

ROLLBACK_SUCCEEDED=1
cleanup_files

if [ -n "$CURRENT_IMAGE" ]; then
  printf '%s\n' "$CURRENT_IMAGE" > .last-lobe-image
fi

echo "$(date +%Y-%m-%dT%H:%M:%S%z) rollback before=${CURRENT_IMAGE:-unset} after=$TARGET_IMAGE backup=$BACKUP_FILE" >> releases.log

docker compose ps
docker logs --tail=200 lobehub

echo "Rollback complete: $TARGET_IMAGE"
