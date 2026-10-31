#!/bin/sh
# Entrypoint for the self-hosted critique worker: validates PUBLIC_URL, then
# starts the same wrangler dev server the image is documented to run.
set -e

if [ -n "$PUBLIC_URL" ]; then
  case "$PUBLIC_URL" in
    http://*|https://*) ;;
    *)
      echo "critique: PUBLIC_URL must start with http:// or https:// (got: $PUBLIC_URL)" >&2
      exit 1
      ;;
  esac
  host_part=${PUBLIC_URL#*://}
  if [ -z "$host_part" ]; then
    echo "critique: PUBLIC_URL is missing a host (got: $PUBLIC_URL)" >&2
    exit 1
  fi
  case "${host_part%/}" in
    */*)
      echo "critique: PUBLIC_URL must be a bare origin without a path (got: $PUBLIC_URL)" >&2
      exit 1
      ;;
  esac
fi

# Widget flags are booleans: refuse anything else so a typo cannot leave a
# security switch in an unexpected state. Empty means "use the default".
case "${CRITIQUE_WIDGET_WEBHOOKS:-}" in
  ""|on|off|true|false|1|0) ;;
  *)
    echo "critique: CRITIQUE_WIDGET_WEBHOOKS must be on or off (got: $CRITIQUE_WIDGET_WEBHOOKS)" >&2
    exit 1
    ;;
esac

exec node cli/node_modules/wrangler/bin/wrangler.js dev \
  -c cli/wrangler.selfhost.json \
  --ip 0.0.0.0 \
  --port 8787 \
  --persist-to /data \
  ${PUBLIC_URL:+--var "PUBLIC_URL:$PUBLIC_URL"} \
  ${CRITIQUE_WIDGET_WEBHOOKS:+--var "CRITIQUE_WIDGET_WEBHOOKS:$CRITIQUE_WIDGET_WEBHOOKS"}
