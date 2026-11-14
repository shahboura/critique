#!/bin/sh
# Entrypoint for the self-hosted critique worker: validates optional settings,
# prepares the persistent Durable Object directory, then starts workerd.
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

# The one-off KV import route is a root-equivalent credential while enabled.
# Require a long random token; unset/empty means the route is disabled.
if [ -n "${MIGRATE_SECRET:-}" ]; then
  case "$MIGRATE_SECRET" in
    *[!A-Za-z0-9_-]*)
      echo "critique: MIGRATE_SECRET may only contain letters, digits, _ and -" >&2
      exit 1
      ;;
  esac
  if [ "${#MIGRATE_SECRET}" -lt 32 ]; then
    echo "critique: MIGRATE_SECRET must be at least 32 characters" >&2
    exit 1
  fi
fi

# Durable Object SQLite files contain diffs and comments.
umask 077
mkdir -p /data/v3/do

exec /usr/local/bin/workerd serve /app/workerd.capnp config
