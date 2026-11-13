# Self-hosting critique

Run your own **critique.work** — the web preview service behind `critique --web` —
in one container, under your own domain. No Cloudflare account needed: the
container runs the exact worker from `cli/src/worker.tsx` on a single
`workerd` process with SQLite-backed KV and Durable Objects.

## 1. Quickstart

```bash
git clone <your-fork> && cd critique
echo 'PUBLIC_URL=https://diff.example.com' > .env     # your public origin
docker compose up -d --build
```

The comments widget's webhook settings are **off** by default, so annotation
text cannot be pointed at a third-party URL. To restore the upstream settings
panel and allow auto/manual webhook delivery, add
`CRITIQUE_WIDGET_WEBHOOKS=on` to that `.env` (see §4).

Point your reverse proxy at `127.0.0.1:8787` (see §3), then verify:

```bash
CRITIQUE_URL=https://diff.example.com EXPECT_PUB=https://diff.example.com \
  node scripts/selfhost-smoke.mjs
```

The image ships a Docker `HEALTHCHECK` (polls `GET /a/health`), so
`docker compose ps` shows `healthy` once the server is up.

Point the CLI at your instance, otherwise uploads still go to critique.work:

```bash
export CRITIQUE_WORKER_URL=https://diff.example.com
critique --web "my diff"
```

## 2. What you get

- `/v/:id` diff pages (one responsive page for desktop and mobile; pages uploaded
  before the responsive-page change still get the auto mobile redirect to `?v=mobile`)
- `.patch` endpoint on every URL (`curl https://diff.example.com/v/<id>.patch`)
- og:image link previews (the CLI uploads the image on first share)
- password-protected links (`critique --web --password`) — need https, see §8
- comments: widget injected into every page, real-time over SSE, markdown
  context at `/v/:id/annotations` for agents
- owner-secret delete (`DELETE /v/:id` with the `X-Critique-Owner-Secret` header)

State lives in the `critique-data` docker volume (SQLite for the KV store and
comment rooms). It contains your diffs and comments — treat backups as sensitive.
Links expire after **7 days** in this setup: permanent links are tied to the
upstream author's Stripe licenses and are not part of self-hosting.

## 3. Reverse proxy

```nginx
# nginx
server {
    server_name diff.example.com;
    client_max_body_size 50m;                 # uploads are a few MB typically
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;          # required (default is upstream addr)
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /a/ {                            # comment streams (SSE)
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

```caddyfile
# Caddy — nothing special needed
diff.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

```yaml
# Traefik labels (inside docker-compose)
labels:
  - traefik.enable=true
  - traefik.http.routers.critique.rule=Host(`diff.example.com`)
  - traefik.http.services.critique.loadbalancer.server.port=8787
# add the proxy's docker network to the service, and drop the host port binding
```

If the proxy runs in Docker on the same network, delete the `ports:` mapping and
point the proxy at `http://critique:8787` instead.

## 4. Configuration

| Setting | Where | Notes |
| --- | --- | --- |
| `PUBLIC_URL` | `.env` / compose | Public origin used in returned links, og:image tags and the comments endpoint. **Required when serving over https** — a bare `scheme://host`, no path. If unset, links fall back to the request `Host` header (http). |
| `CRITIQUE_WIDGET_WEBHOOKS` | `.env` / compose | `off` by default. The comments widget can point at any URL and send annotation text, page context and the diff URL there; leave it off unless you want that. Set to `on` to show the Webhooks settings and allow auto/manual send. Invalid values make the container exit instead of guessing. |
| Port | compose | Bound to `127.0.0.1:8787` by default, meant for a local reverse proxy. |
| Volume | compose | `critique-data:/data` — uploads and comments persistence. |

## 5. Using it from other projects

Set the env var wherever the CLI runs:

```bash
# one-off
CRITIQUE_WORKER_URL=https://diff.example.com critique --web "landing page tweak"

# per project (direnv), from the project checkout:
echo 'export CRITIQUE_WORKER_URL=https://diff.example.com' >> .envrc && direnv allow

# every shell / agent session on this machine:
echo 'export CRITIQUE_WORKER_URL=https://diff.example.com' >> ~/.bashrc
```

If agents run your builds, add the export to the environment those sessions
are started with — every `critique --web` then uploads to your instance.

## 6. Distribution

Three ways to get the image onto the server:

```bash
# a) build on the server (simplest)
git clone <your-fork> && docker compose up -d --build

# b) build once, transfer the file
docker build --build-arg BUILD_ID=$(git rev-parse --short HEAD) \
  -t critique-selfhost . && \
  docker save critique-selfhost | ssh server 'docker load'

# c) registry — CI builds and pushes on every push to main (native
#    linux/amd64 + linux/arm64 runners, multi-arch manifest; each arch is
#    booted and smoke-tested before publishing)
#    image: ghcr.io/<your-github-user>/critique:latest
#    first push creates a private package; flip it to public in the
#    package settings if you want anonymous pulls.
#    Then in docker-compose.yml:  remove the whole `build:` block and set the image line.
```

Release tarballs are immutable: `critique-<version>.tgz` and its sha256 belong to one commit, and the release workflow refuses to republish an existing version. Pin the version you install.

The comments widget vendors agentation v3.1.2 under PolyForm Shield 1.0.0. The license text ships at `/third-party-licenses.txt` and at `/app/agentation-LICENSE` inside the image; keep them when redistributing the image or generated pages.

Both local build paths stamp the deployment's identity from `BUILD_ID`, which
`/a/health` and every generated page report. `docker compose` reads it from the
environment (`BUILD_ID=$(git rev-parse --short HEAD) docker compose up -d --build`);
without it the build reports `dev`. The CI image passes the commit automatically.

## 7. Updating & staying in sync with upstream

```bash
git pull upstream main && docker compose build && docker compose up -d
```

- The upstream files modified are `cli/src/worker.tsx` (URL-origin fix, the
  optional `/__migrate/kv` route, upload error logging),
  `cli/src/routes/annotations-context.tsx` (URL-origin fix), and
  `comments-server/src/comment-room.ts` plus its `tsconfig.json` (SSE reaper).
  The `cloudflare:email` alias is generated only for the self-host build, so
  `cli/wrangler.jsonc` stays upstream-compatible.
- Everything else is additive (Dockerfile, compose, CI, workerd config, smoke
  tests), so merges never conflict there. The workerd config
  (`cli/workerd.capnp`) mirrors the worker bindings: if upstream changes a KV
  or Durable Object binding, update it there too.
- If the runtime exits with `Cannot find module`, the worker imported a
  Cloudflare-only module. Add a stub to `cli/src/` and to the alias map that
  the Dockerfile writes into `cli/wrangler.workerd.json`; do not edit
  `cli/wrangler.jsonc`, which is shared with the Cloudflare deployment.

## 8. Security & privacy

- **No telemetry**: the runtime has no telemetry, `DO_NOT_TRACK=1` is set for
  tooling, and the worker only makes outbound calls when Stripe or Resend are
  configured.
- **No secrets in the image**: `.dockerignore` excludes `.env*`, `*/.dev.vars*`,
  `*.pem`, `*.key` — safe to push the image to a registry.
- compose runs the container as the unprivileged `critique` user (uid 1000). An
  existing volume from the old image is owned by uid 1000 (`node`) and stays
  readable. If it was created by root, re-own it once:
  `docker compose run --rm --user root --entrypoint chown critique -R 1000:1000 /data`.
- Password-protected diffs set a `Secure` cookie: they need https (or
  localhost). Over plain http a browser silently drops it and the lock page
  re-appears.

## 9. Migrating an existing volume

The workerd image reads existing comment rooms in place from
`/data/v3/do/critique-web-CommentRoom`. Uploaded diffs used Miniflare's KV store
at `/data/v3/kv`, which the new runtime does not read; import them once.

1. Stop the old container and back up `/data`.
2. Export a one-off secret in the shell that runs compose, then rebuild:
   `export MIGRATE_SECRET=$(openssl rand -hex 16) && docker compose up -d --build`.
   The compose file forwards it to the container; the import route is disabled
   when the variable is unset.
3. Run a dry run from the host against the mounted volume. If the volume is
   only reachable through Docker, run this in a temporary Bun container with
   the volume mounted (`docker volume ls` shows the project-prefixed name):

   ```bash
   vol=$(docker volume ls -q --filter name=critique-data | head -1)
   docker run --rm --network host -e MIGRATE_SECRET \
     -v "$vol":/data -v "$PWD":/work -w /work oven/bun:1.4.3 \
     bun scripts/migrate-kv.ts --source /data/v3/kv --namespace 844b10c9fea049c8b20fa4a8c5cae44e \
       --url http://127.0.0.1:8787 --dry-run
   ```

   `--network host` lets the temporary container reach the published port;
   on Docker Desktop use `host.docker.internal` instead. The volume name is
   project-prefixed, hence the lookup. The namespace id is the `CRITIQUE_KV` id
   in `cli/wrangler.jsonc`. The dry run reports live vs expired entries,
   missing blobs and total bytes.
4. Run the same command without `--dry-run`; add `--verify` for a sample or
   `--verify-all` for every key. Run this once before serving, then rename or
   delete `/data/v3/kv` (it is in the step-1 backup). `--skip-existing` is a
   best-effort convenience, not a safety guarantee: a diff deleted after
   cutover is a 404 in the new store and would be imported again by a re-run.
5. Remove `MIGRATE_SECRET` and restart; `/__migrate/kv` then returns 404.
6. Spot-check a few old links and comments.

The new runtime writes its KV store under `/data/v3/do/critique-kv-v1`; the old
`/data/v3/kv` directory is left untouched, so the old image can still read its
own KV data. A rollback after cutover means restoring the step-1 backup: diffs
uploaded on the new runtime are not visible to the old image, and comment rooms
are shared in place, so their SQLite is version-coupled. Restoring the step-1
backup also discards every comment written after it. Treat rollback as a
restore, not a live switch.

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Links come back as `http://…` | `PUBLIC_URL` unset | set it in `.env` |
| Links point at `127.0.0.1:8787` | proxy not forwarding `Host` and `PUBLIC_URL` unset | add `proxy_set_header Host $host` (nginx) or set `PUBLIC_URL` |
| Comments never update live | proxy buffering the SSE stream | `proxy_buffering off` on `/a/` (nginx) |
| Upload fails with 413 | proxy body limit | `client_max_body_size 50m` |
| Password page loops | http + `Secure` cookie | use https (or localhost) |
| Diff 404 after ~a week | intended 7-day expiry | permanent links need a license key from upstream |
| Container restarts, logs `EACCES ... /data` | `/data` volume was created by an image that ran as root | `docker compose run --rm --user root --entrypoint chown critique -R 1000:1000 /data` |
| Everything 404s under a sub-path | sub-path hosting not supported | serve at a (sub)domain root |
