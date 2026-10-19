# Self-hosted critique web service (the upload/view worker behind `critique --web`).
#
# Runs the Cloudflare Worker from cli/src/worker.tsx on workerd in wrangler's
# local mode, with KV and Durable Object state stored on a volume. No Cloudflare
# account is needed. Terminate TLS in your own reverse proxy and point your
# domain at port 8787.
#
#   docker build -t critique-selfhost .
#   docker compose up -d                # see docker-compose.yml
#
# Sync-friendly: new files only, except nine one-line URL fixes in
# cli/src/worker.tsx + cli/src/routes/annotations-context.tsx. When
# wrangler.jsonc changes upstream, the derived config below picks the change
# up on the next build.
#
# Point the CLI at your instance, otherwise `critique --web` still uploads to
# critique.work:
#   CRITIQUE_WORKER_URL=https://diff.example.com critique --web

# --- build stage: install and build with bun, as the repo expects ---
FROM oven/bun:1.4.3 AS build
ENV WRANGLER_SEND_METRICS=false WRANGLER_SEND_ERROR_REPORTS=false WRANGLER_HIDE_BANNER=true DO_NOT_TRACK=1 CI=1
WORKDIR /app

# arm64 has no prebuilt binary for tree-sitter-typescript, so `bun install`
# falls back to node-gyp; give it Python + a C toolchain (build stage only,
# x64 doesn't need it since a prebuild exists there).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Manifests first, so dependency install is cached when only source changes.
COPY package.json bun.lock ./
COPY cli/package.json cli/package.json
COPY comments-server/package.json comments-server/package.json
RUN bun install

# Fail fast if a future lockfile bump moves wrangler's entry point (used by CMD).
RUN test -f cli/node_modules/wrangler/bin/wrangler.js

COPY . .

# Never bake local secrets into the published image (defense in depth: the
# .dockerignore patterns already exclude them).
RUN test -z "$(find . -name '.env*' -not -path '*/node_modules/*' -not -name '*.example' -print -quit)"

# Build the two gitignored artifacts the worker needs:
#  - cli/public/agentation-widget.js  comments widget (static asset)
#  - comments-server/dist             CommentRoom Durable Object
RUN bun run build:comments-widget && bun run build:comments-server

# Derive a config from the real wrangler.jsonc with the critique.work
# custom-domain routes removed: in local mode wrangler rewrites request
# origins to the first route instead of the inbound Host, which would leak
# critique.work into every generated URL.
RUN bun -e 'import fs from "node:fs"; const cfg = JSON.parse(fs.readFileSync("cli/wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, "")); delete cfg.routes; if (cfg.env?.preview) delete cfg.env.preview.routes; if (JSON.stringify(cfg).includes("critique.work")) throw new Error("derived config still references critique.work"); fs.writeFileSync("cli/wrangler.selfhost.json", JSON.stringify(cfg, null, 2));'

# Trim CLI-only packages the worker never imports (opentui TUI, tree-sitter
# highlighting, PDF/OG rendering, test tooling, type-only packages). ~240MB.
# Trimming here, before the runtime COPY, keeps the deleted bytes out of the
# final image. Eagerly-imported misses fail at container start; lazily imported
# ones (e.g. miniflare's unused sharp/images path) would only surface if that
# feature is used — if either happens, delete the entry from the list.
RUN cd node_modules/.bun && rm -rf typescript@* @cloudflare+workers-types@* @opentuah+* tree-sitter* web-tree-sitter@* three@* bun-webgpu* @img+* sharp@* core-js@* react-devtools-core@* planck@* prettier@* pdfkit@* tuistory@* calldiff@* goke@* @agentclientprotocol+sdk@* @parcel+watcher* ghostty-opentui@* jimp@* @jimp+* stage-js@* yoga-layout@*

# --- runtime stage: plain Node, because `wrangler dev` hangs when run by bun ---
FROM node:26-slim
ENV WRANGLER_SEND_METRICS=false WRANGLER_SEND_ERROR_REPORTS=false WRANGLER_HIDE_BANNER=true DO_NOT_TRACK=1 CI=1
WORKDIR /app
# node-owned so wrangler/miniflare can create their scratch dirs
# (node_modules/.mf, bundler temp) as the unprivileged user.
COPY --chown=node:node --from=build /app /app

# Unprivileged runtime user; a fresh named volume inherits /data's ownership.
RUN chmod 755 docker-entrypoint.sh && mkdir -p /data && chown node:node /data
USER node

EXPOSE 8787
VOLUME /data

# PUBLIC_URL (required when serving over https): public origin for returned
# links, og:image tags and the comments widget endpoint, e.g.
# https://diff.example.com — a bare scheme://host, no path. Without it, links
# fall back to the request Host header (http). KV + comments data persist
# under /data.
CMD ["/app/docker-entrypoint.sh"]
