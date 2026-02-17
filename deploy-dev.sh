#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="/home/nexx/homelab-compose.yml"
SERVICE="birdnet-showoff-dev"
DEV_URL="https://birds-dev.burucker.io"
QUICK=false

for arg in "$@"; do
  case $arg in
    --quick|-q) QUICK=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

if $QUICK; then
  echo "==> quick deploy (skipping lint, tests, build)"
else
  echo "==> lint"
  npm run lint

  echo "==> unit tests"
  npm run test:coverage

  echo "==> e2e tests"
  npm run test:e2e

  echo "==> build"
  npm run build
fi

echo "==> docker build"
docker compose -f "$COMPOSE_FILE" build "$SERVICE"

echo "==> deploy"
docker compose -f "$COMPOSE_FILE" up -d "$SERVICE"

echo ""
echo "Done. $DEV_URL"
