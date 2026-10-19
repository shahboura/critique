# Self-hosting critique

Run your own **critique.work** — the web preview service behind `critique --web` —
in one container, under your own domain. No Cloudflare account needed: the
container runs the exact worker from `cli/src/worker.tsx` on workerd
(wrangler's local mode) with file-backed KV and Durable Objects.

## 1. Quickstart

```bash
git clone <your-fork> && cd critique
echo 'PUBLIC_URL=https://diff.example.com' > .env     # your public origin
docker compose up -d --build
```

Point your reverse proxy at `127.0.0.1:8787` (see §3), then verify:

```bash
CRITIQUE_URL=https://diff.example.com EXPECT_PUB=https://diff.example.com \
  node scripts/selfhost-smoke.mjs
```

Point the CLI at your instance, otherwise uploads still go to critique.work:

```bash
export CRITIQUE_WORKER_URL=https://diff.example.com
critique --web "my diff"
```

## 2. What you get

- `/v/:id` diff pages (desktop + mobile variants, auto mobile redirect)
- `.patch` endpoint on every URL (`curl https://diff.example.com/v/<id>.patch`)
- og:image link previews (the CLI uploads the image on first share)
- password-protected links (`critique --web --password`) — need https, see §8
- comments: widget injected into every page, real-time over SSE, markdown
  context at `/v/:id/annotations` for agents
- owner-secret delete (`DELETE /v/:id` with the `X-Critique-Owner-Secret` header)

State lives in the `critique-data` docker volume (KV blobs + Durable Object
SQLite). It contains your diffs and comments — treat backups as sensitive.
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
| Port | compose | Bound to `127.0.0.1:8787` by default, meant for a local reverse proxy. |
| Volume | compose | `critique-data:/data` — KV + comments persistence. |

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
docker build -t critique-selfhost . && \
  docker save critique-selfhost | ssh server 'docker load'

# c) registry — CI builds and pushes on every push to main (native
#    linux/amd64 + linux/arm64 runners, multi-arch manifest)
#    image: ghcr.io/<your-github-user>/critique:latest
#    first push creates a private package; flip it to public in the
#    package settings if you want anonymous pulls.
#    Then in docker-compose.yml:  delete `build: .` and set the image line.
```

## 7. Updating & staying in sync with upstream

```bash
git pull upstream main && docker compose build && docker compose up -d
```

- The only upstream files modified are `cli/src/worker.tsx` (7 one-line hunks)
  and `cli/src/routes/annotations-context.tsx` (2 hunks) — the URL-origin fix.
- Everything else is additive (Dockerfile, compose, CI, smoke test), so merges
  never conflict there. `wrangler.jsonc` changes are picked up automatically by
  the derived config at build time.
- If a container built after an upstream sync exits with `Cannot find module`,
  upstream made the worker import a trimmed CLI package: remove that package
  name from the `rm -rf` list in the Dockerfile and rebuild.

## 8. Security & privacy

- **No telemetry**: wrangler metrics disabled, error reports disabled, update
  check suppressed, `DO_NOT_TRACK=1`. The worker itself has no outbound calls.
- **No secrets in the image**: `.dockerignore` excludes `.env*`, `*/.dev.vars*`,
  `*.pem`, `*.key` — safe to push the image to a registry.
- compose runs the container with `cap_drop: ["ALL"]` and
  `no-new-privileges`; it runs as root inside, which is fine for this workload.
- Password-protected diffs set a `Secure` cookie: they need https (or
  localhost). Over plain http a browser silently drops it and the lock page
  re-appears.

## 9. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Links come back as `http://…` | `PUBLIC_URL` unset | set it in `.env` |
| Links point at `127.0.0.1:8787` | proxy not forwarding `Host` and `PUBLIC_URL` unset | add `proxy_set_header Host $host` (nginx) or set `PUBLIC_URL` |
| Comments never update live | proxy buffering the SSE stream | `proxy_buffering off` on `/a/` (nginx) |
| Upload fails with 413 | proxy body limit | `client_max_body_size 50m` |
| Password page loops | http + `Secure` cookie | use https (or localhost) |
| Diff 404 after ~a week | intended 7-day expiry | permanent links need a license key from upstream |
| Everything 404s under a sub-path | sub-path hosting not supported | serve at a (sub)domain root |
