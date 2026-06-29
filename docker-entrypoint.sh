#!/bin/sh
# ============================================================================
# NeuroAlert · Entrypoint del backend (Render / Docker)
# ============================================================================
# 1) Aplica migraciones de Prisma.
#    - Si la BD tiene tablas pero NO historial de migraciones, Prisma falla con
#      P3005 ("schema is not empty"). En ese caso, hacemos UN reset (drop +
#      re-aplicar todas las migraciones desde cero, incl. baseline + RLS). Esto
#      solo ocurre la PRIMERA vez; luego ya hay historial y migrate deploy corre
#      limpio sin tocar los datos.
# 2) Siembra datos de demo (idempotente: el seed usa upsert).
# 3) Arranca la API.
# ============================================================================
set -e

echo ">> Aplicando migraciones (prisma migrate deploy)…"
if ! npx prisma migrate deploy 2> /tmp/migrate.err; then
  cat /tmp/migrate.err
  if grep -q "P3005" /tmp/migrate.err; then
    echo ">> P3005: la BD tiene tablas sin historial de migraciones."
    echo ">> Reset único: se recrea el esquema y se aplican todas las migraciones desde cero…"
    npx prisma migrate reset --force --skip-seed
  else
    echo ">> Error de migración no recuperable. Abortando."
    exit 1
  fi
else
  cat /tmp/migrate.err 2>/dev/null || true
fi

echo ">> Sembrando datos de demo (idempotente)…"
npx prisma db seed || echo ">> Seed omitido (no-fatal)."

echo ">> Iniciando NeuroAlert API…"
exec node dist/src/main
