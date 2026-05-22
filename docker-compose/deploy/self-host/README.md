# Self-hosted GHCR deployment

This folder contains helper files for deploying a customized LobeHub image to an existing Docker Compose server.

It assumes the server deployment directory already contains:

```txt
bucket.config.json
data/
docker-compose.yml
searxng-settings.yml
.env
```

The Compose stack must already be running, and the PostgreSQL container named `lobe-postgres` must be reachable. The deployment and rollback scripts run `docker exec lobe-postgres ... pg_dump` before changing the image.

## 1. Confirm server architecture

Run on the server:

```bash
uname -m
docker info --format '{{.Architecture}}'
```

Use `linux/amd64` for `x86_64` or `amd64`. Use `linux/arm64` for `aarch64` or `arm64`.

## 2. Copy helper files to the server

Copy these files into the server deployment directory, usually `/opt/lobehub`:

```txt
docker-compose.override.yml
deploy.sh
rollback.sh
```

Make scripts executable on the server:

```bash
chmod +x deploy.sh rollback.sh
```

## 3. Configure GHCR access and current image

Make sure `LOBE_IMAGE` in the server `.env` points to the image that is currently running before the first custom deployment:

```env
LOBE_IMAGE=lobehub/lobehub
```

If this server is already running a customized image, use the exact currently running image instead. The deployment script records this value in `.last-lobe-image` for default rollback, then updates `.env` to the new GHCR image passed to `./deploy.sh`.

This project is hosted in a private GitHub repository, so treat the GHCR image as a private package. Log in once on the server:

```bash
docker login ghcr.io
```

Use a GitHub personal access token with `read:packages`.

After the first GitHub Actions build, check the package settings in GitHub Packages / GHCR:

- The package is linked to this repository.
- This repository has Actions access to write the package.
- The account used by the server PAT can read the private package.

If `docker compose pull lobe` returns `denied` or `unauthorized`, check the GHCR login state, PAT `read:packages` scope, and the package repository access settings first.

## 4. First deployment

Replace sample image values like `ghcr.io/my-account/lobehub-self-hosted:sha-83b8aa5` with the exact `ghcr.io/<github-owner>/<repo>:sha-<short-sha>` tag printed by the GitHub Actions / GHCR workflow.

Run from the server deployment directory:

```bash
./deploy.sh ghcr.io/my-account/lobehub-self-hosted:sha-83b8aa5
```

The script:

- Accepts only immutable GHCR `sha-` image tags.
- Creates a private temporary directory for intermediate files.
- Records the previous image in `.last-lobe-image`.
- Creates a PostgreSQL logical backup in `backups/` before changing `.env`.
- Validates the Compose configuration and pulls the new `lobe` image before changing `.env`.
- Updates `LOBE_IMAGE` in `.env`.
- Restarts only the `lobe` container.
- Restores the previous `.env` and retries the previous `lobe` service if restart fails.
- Records a release entry in `releases.log` only after the container restart succeeds.
- Prints current Compose status and recent logs.

## 5. Routine deployment

After GitHub Actions publishes a new `sha-` image:

Use the exact `ghcr.io/<github-owner>/<repo>:sha-<short-sha>` tag printed by the workflow.

```bash
./deploy.sh ghcr.io/my-account/lobehub-self-hosted:sha-0123abc
```

Then check:

```bash
docker compose ps
docker logs --tail=200 lobehub
```

Also verify the web app:

- Home page loads.
- Login/session works.
- Model calls work.
- File or image upload works if RustFS is enabled.
- The intended fix is visible in production.

## 6. Rollback

Rollback to the previous recorded image:

```bash
./rollback.sh
```

Rollback to an explicit image:

```bash
./rollback.sh ghcr.io/my-account/lobehub-self-hosted:sha-83b8aa5
```

Rollback also creates a PostgreSQL logical backup in `backups/` before changing `.env`. If a new release has already run an irreversible database migration, image rollback alone may not be enough. Use the SQL backup created before deployment when database restoration is required.
