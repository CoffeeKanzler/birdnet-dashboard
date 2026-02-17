#!/bin/sh
set -eu

if [ -z "${INTERNAL_PROXY_VALUE:-}" ]; then
  INTERNAL_PROXY_VALUE="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  export INTERNAL_PROXY_VALUE
fi

node /app/server/server.mjs &

exec /docker-entrypoint.sh nginx -g 'daemon off;'
