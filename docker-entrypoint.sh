#!/bin/sh
set -e

echo "Applying pending Prisma migrations..."
npx prisma migrate deploy

exec "$@"
