#!/usr/bin/env sh
set -eu

usage() {
  echo "Usage: $0 registry.example.com/my-account/lobehub-self-hosted:sha-83b8aa5" >&2
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

NEW_IMAGE="$1"

validate_image() {
  image="$1"
  image_name="${image##*/}"

  case "$image" in
    ""|*[[:space:]]*)
      echo "Error: image must be a single Docker image reference without whitespace." >&2
      exit 2
      ;;
  esac

  case "$image_name" in
    *:*)
      tag="${image_name##*:}"
      if [ -n "$tag" ] && [ "$tag" != "latest" ]; then
        return 0
      fi
      ;;
  esac

  echo "Error: image must include an explicit non-latest tag, for example registry.example.com/my-account/lobehub-self-hosted:sha-83b8aa5" >&2
  exit 2
}

validate_image "$NEW_IMAGE"

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

TMP_DIR=".deploy-tmp-$(date +%Y%m%d%H%M%S)-$$"
if ! ( umask 077 && mkdir "$TMP_DIR" ); then
  echo "Error: failed to create temporary directory: $TMP_DIR" >&2
  exit 1
fi

ENV_BACKUP=""
ENV_TMP=""
BACKUP_TMP=""
ENV_MUTATED=0
DEPLOY_SUCCEEDED=0

restore_env() {
  if [ "$DEPLOY_SUCCEEDED" -ne 1 ] && [ "$ENV_MUTATED" -eq 1 ] && [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
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
if [ -n "$CURRENT_IMAGE" ]; then
  printf '%s\n' "$CURRENT_IMAGE" > .last-lobe-image
fi

BACKUP_FILE="backups/lobehub-$(date +%Y-%m-%d-%H%M%S)-$$.sql"
BACKUP_TMP="$TMP_DIR/backup.sql"
echo "Creating database backup: $BACKUP_FILE"
if ! ( umask 077; set -C; docker exec lobe-postgres sh -c 'pg_dump -U postgres "$POSTGRES_DB"' > "$BACKUP_TMP" ); then
  echo "Error: failed to create database backup." >&2
  exit 1
fi

if ! ln "$BACKUP_TMP" "$BACKUP_FILE"; then
  echo "Error: failed to publish final backup file without overwriting: $BACKUP_FILE" >&2
  exit 1
fi
chmod 600 "$BACKUP_FILE"

LOBE_IMAGE="$NEW_IMAGE" docker compose config >/dev/null
LOBE_IMAGE="$NEW_IMAGE" docker compose pull lobe

ENV_BACKUP="$TMP_DIR/env-backup"
ENV_TMP="$TMP_DIR/env-tmp"
cp .env "$ENV_BACKUP"
cp .env "$ENV_TMP"

if grep -q '^LOBE_IMAGE=' .env; then
  awk -v image="$NEW_IMAGE" '
    /^LOBE_IMAGE=/ {
      print "LOBE_IMAGE=" image
      next
    }

    {
      print
    }
  ' "$ENV_BACKUP" > "$ENV_TMP"
else
  printf '\nLOBE_IMAGE=%s\n' "$NEW_IMAGE" >> "$ENV_TMP"
fi

ENV_MUTATED=1
cat "$ENV_TMP" > .env

if ! docker compose up -d --no-deps lobe; then
  restore_env
  if docker compose up -d --no-deps lobe; then
    echo "Error: deploy failed. Previous .env was restored and lobe recovery restart succeeded." >&2
  else
    echo "Error: deploy failed. Previous .env was restored, but lobe recovery restart failed. Manual intervention required." >&2
  fi
  exit 1
fi

DEPLOY_SUCCEEDED=1
cleanup_files
echo "$(date +%Y-%m-%dT%H:%M:%S%z) deploy before=${CURRENT_IMAGE:-unset} after=$NEW_IMAGE backup=$BACKUP_FILE" >> releases.log

docker compose ps
docker logs --tail=200 lobehub

echo "Deploy complete: $NEW_IMAGE"
