# Self-hosted critique web service on production workerd.
#
# Build:   docker build -t critique-selfhost .
# Run:     docker compose up -d
#
# The image builds the same Cloudflare Worker bundle as `wrangler deploy`, then
# runs it on a single workerd process with a local KV Durable Object and the
# existing CommentRoom Durable Object. No Cloudflare account is needed.

# --- build stage ---
FROM oven/bun:1.4.3 AS build
ENV WRANGLER_SEND_METRICS=false WRANGLER_SEND_ERROR_REPORTS=false WRANGLER_HIDE_BANNER=true DO_NOT_TRACK=1 CI=1
WORKDIR /app

COPY package.json bun.lock ./
COPY cli/package.json cli/package.json
COPY comments-server/package.json comments-server/package.json
COPY packages/agentation/package.json packages/agentation/package.json
RUN bun install --ignore-scripts --frozen-lockfile

COPY . .

ARG BUILD_ID=dev
RUN case "$BUILD_ID" in ""|*[!A-Za-z0-9._-]*) BUILD_ID=dev ;; esac; \
    printf 'export const BUILD_ID: string = "%s"\n' "$BUILD_ID" > cli/src/build-info.ts

RUN bun run build:comments-widget && bun run build:comments-server
# The email alias is self-host-only; keep it out of the shared wrangler.jsonc
# so the Cloudflare deployment keeps the real cloudflare:email module.
RUN bun -e 'import fs from "node:fs"; const cfg = JSON.parse(fs.readFileSync("cli/wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, "")); cfg.alias = { ...(cfg.alias ?? {}), "cloudflare:email": "./src/email-stub.js" }; fs.writeFileSync("cli/wrangler.workerd.json", JSON.stringify(cfg, null, 2))'
RUN cd cli && node node_modules/wrangler/bin/wrangler.js deploy -c wrangler.workerd.json --dry-run --outdir dist-workerd --env=""

# Copy the native runtime that matches this build platform. The npm `workerd`
# package is a Node launcher; the platform package contains the binary.
ARG TARGETARCH
RUN arch="${TARGETARCH:-$(uname -m)}"; \
    case "$arch" in \
      amd64|x86_64) pkg=64 ;; \
      arm64|aarch64) pkg=arm64 ;; \
      *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    bin=$(find node_modules/.bun -path "*@cloudflare+workerd-linux-${pkg}@*/node_modules/@cloudflare/workerd-linux-${pkg}/bin/workerd" -type f | head -1); \
    test -n "$bin"; \
    cp "$bin" /tmp/workerd; \
    chmod +x /tmp/workerd; \
    /tmp/workerd --version

# --- runtime stage ---
FROM debian:bookworm-slim
ENV DO_NOT_TRACK=1
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 1000 --create-home --shell /usr/sbin/nologin critique \
    && mkdir -p /app /data \
    && chown critique:critique /app /data

COPY --from=build /tmp/workerd /usr/local/bin/workerd
COPY --from=build --chown=critique:critique /app/cli/dist-workerd/worker.js /app/worker.js
COPY --from=build --chown=critique:critique /app/cli/kv-service.js /app/kv-service.js
COPY --from=build --chown=critique:critique /app/cli/kv-store.js /app/kv-store.js
COPY --from=build --chown=critique:critique /app/cli/kv-protocol.js /app/kv-protocol.js
COPY --from=build --chown=critique:critique /app/cli/router.js /app/router.js
COPY --from=build --chown=critique:critique /app/cli/workerd.capnp /app/workerd.capnp
COPY --from=build --chown=critique:critique /app/cli/public /app/public
COPY --from=build --chown=critique:critique /app/packages/agentation/LICENSE /app/agentation-LICENSE
COPY --chown=critique:critique docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod 755 /app/docker-entrypoint.sh && chmod 755 /usr/local/bin/workerd

USER critique
EXPOSE 8787
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/a/health || exit 1

CMD ["/app/docker-entrypoint.sh"]
