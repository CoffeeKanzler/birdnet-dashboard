#!/bin/sh
set -eu

if [ -z "${INTERNAL_PROXY_VALUE:-}" ]; then
  INTERNAL_PROXY_VALUE="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  export INTERNAL_PROXY_VALUE
fi

RUNTIME_CONFIG_PATH="${RUNTIME_CONFIG_PATH:-/usr/share/nginx/html/runtime-config.js}"
export RUNTIME_CONFIG_PATH

node <<'EOF'
const fs = require('node:fs')

const path = process.env.RUNTIME_CONFIG_PATH || '/usr/share/nginx/html/runtime-config.js'
const keys = [
  'VITE_SITE_NAME',
  'VITE_SITE_TAGLINE',
  'VITE_SITE_SUBTITLE',
  'VITE_LOCALE',
  'VITE_DEFAULT_THEME',
  'VITE_BIRDNET_API_BASE_URL',
  'VITE_APP_VERSION',
]

const config = {}
for (const key of keys) {
  if (Object.prototype.hasOwnProperty.call(process.env, key)) {
    config[key] = process.env[key] ?? ''
  }
}

const content = `window.__BIRDNET_CONFIG__ = Object.freeze(${JSON.stringify(config)});\n`
fs.writeFileSync(path, content, { encoding: 'utf8' })
EOF

# Repair bind-mounted cache permissions on boot (best effort) so cache refresh
# can persist regardless of host-side ownership drift.
if [ -d /cache ]; then
  chown -R nginx:nginx /cache 2>/dev/null || true
  chmod -R u+rwX /cache 2>/dev/null || true
fi

su-exec nginx node /app/server/server.mjs &

exec /docker-entrypoint.sh nginx -g 'daemon off;'
