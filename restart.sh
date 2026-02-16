#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "==> Building frontend assets..."
yarn build

echo "==> Running migrations..."
docker exec select-app php artisan migrate --force

echo "==> Clearing caches..."
docker exec select-app php artisan optimize:clear

echo "==> Restarting PHP containers..."
docker compose restart select queue scheduler delectus reverb

echo "==> Done!"
