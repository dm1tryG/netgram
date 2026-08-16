#!/bin/bash
# Assemble what electron-builder bundles into the app:
#   server-dist/ — Next.js standalone server + static assets + public
# Run from desktop/: ./scripts/prepare.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=..

echo "» building Next.js standalone bundle"
(cd "$ROOT" && npm run build)

echo "» assembling server-dist"
rm -rf server-dist
# -L: dereference symlinks — Next standalone contains relative symlinks that
# break codesigning inside the app bundle.
cp -RL "$ROOT/.next/standalone" server-dist
rm -rf server-dist/.next/static server-dist/public server-dist/data server-dist/.env \
       server-dist/desktop server-dist/mcp
# Paranoia: never ship local state (TG session/creds) inside the app.
if [ -e server-dist/data ] || [ -e server-dist/.env ]; then
  echo "!! local state leaked into server-dist" >&2; exit 1
fi
cp -R "$ROOT/.next/static" server-dist/.next/static
cp -R "$ROOT/public" server-dist/public

echo "» done: server-dist/"
