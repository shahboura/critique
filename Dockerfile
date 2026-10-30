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

# Manifests first, so dependency install is cached when only source changes.
COPY package.json bun.lock ./
COPY cli/package.json cli/package.json
COPY comments-server/package.json comments-server/package.json
# The CLI depends on @critique.work/agentation (workspace:*), so its manifest is
# part of the workspace set the lockfile pins; without it a frozen install
# cannot resolve the workspace link.
COPY packages/agentation/package.json packages/agentation/package.json
# Skip lifecycle scripts: every package in this image that would compile a native
# binding (tree-sitter grammars, node-pty, sharp, @parcel/watcher) is trimmed
# below anyway, and Bun's arm64 node-gyp fallback downloads `node-gyp@latest`
# during install, which flakes in CI. esbuild uses its prebuilt optional package,
# and workerd's bin is a JS launcher that resolves @cloudflare/workerd-<platform>.
RUN bun install --ignore-scripts --frozen-lockfile

# Fail fast if a future lockfile bump moves wrangler's entry point (used by CMD).
RUN test -f cli/node_modules/wrangler/bin/wrangler.js

COPY . .

# Identity of the running worker: /a/health reports it and the comments widget
# URL carries it, so a stale widget or a mixed version is visible instead of
# silent. Defaults to "dev" for a plain `docker build`.
ARG BUILD_ID=dev
# Only a plain token may reach the generated source line: anything else would
# break the string literal or, worse, inject code into the worker bundle.
RUN case "$BUILD_ID" in ""|*[!A-Za-z0-9._-]*) BUILD_ID=dev ;; esac; \
    printf 'export const BUILD_ID: string = "%s"\n' "$BUILD_ID" > cli/src/build-info.ts

# Never bake local secrets into the published image (defense in depth: the
# .dockerignore patterns already exclude them).
RUN test -z "$(find . -name '.env*' -not -path '*/node_modules/*' -not -name '*.example' -print -quit)"

# Build the gitignored artifacts the worker needs:
#  - cli/public/agentation-widget.js  comments widget (static asset); the script
#                                     builds the vendored packages/agentation first
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
RUN cd node_modules/.bun && rm -rf typescript@* @cloudflare+workers-types@* @opentuah+* tree-sitter* web-tree-sitter@* three@* bun-webgpu* @img+* sharp@* core-js@* react-devtools-core@* planck@* prettier@* pdfkit@* tuistory@* calldiff@* goke@* @agentclientprotocol+sdk@* @parcel+watcher* ghostty-opentui@* jimp@* @jimp+* stage-js@* yoga-layout@* kill-port-process@* pid-from-port@* execa@0.9.0* cross-spawn@5.1.0* file-type@16* diff@8.0.2* node-pty@*

# The vendored widget's build and test toolchain is build-time only.
RUN cd node_modules/.bun && rm -rf tsup@* vitest@* jsdom@* sass@* postcss@* postcss-modules@* esbuild-sass-plugin@* @vitejs+plugin-react@* @testing-library+* @types+react@* @types+react-dom@* @types+node@*

# --- runtime stage: plain Node, because `wrangler dev` hangs when run by bun ---
FROM node:26-slim
ENV WRANGLER_SEND_METRICS=false WRANGLER_SEND_ERROR_REPORTS=false WRANGLER_HIDE_BANNER=true DO_NOT_TRACK=1 CI=1
WORKDIR /app
# node-owned so wrangler/miniflare can create their scratch dirs
# (node_modules/.mf, bundler temp) as the unprivileged user.
COPY --chown=node:node --from=build /app /app

# npm ships inside the base image and is never invoked at runtime (the entrypoint
# runs node directly); its bundled node_modules are the only app-unrelated
# packages scanners still flag in this layer.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# node:26-slim ships without a CA bundle, and workerd refuses to start without
# one ("service internet: TLS configuration: ... No CA certificates").
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

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

# Liveness for Docker/orchestrators: the app-level health endpoint used by the
# comments API. `docker compose ps` reports healthy/unhealthy from this.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/a/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
