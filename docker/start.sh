#!/bin/sh
set -eu

if [ -z "${INTERNAL_PROXY_VALUE:-}" ]; then
  INTERNAL_PROXY_VALUE="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  export INTERNAL_PROXY_VALUE
fi

# Repair bind-mounted cache permissions on boot (best effort) so cache refresh
# can persist regardless of host-side ownership drift.
if [ -d /cache ]; then
  chown -R nginx:nginx /cache 2>/dev/null || true
  chmod -R u+rwX /cache 2>/dev/null || true
fi

su-exec nginx node /app/server/server.mjs &

exec su-exec nginx /docker-entrypoint.sh nginx -g 'daemon off;'
