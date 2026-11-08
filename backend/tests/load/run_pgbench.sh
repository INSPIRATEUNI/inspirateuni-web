#!/usr/bin/env bash
# ============================================================================
# RUNNER: PGBENCH LOAD TEST
# Issue 1.5.9: Prueba de carga y flujo de extremo a extremo (#42)
# ============================================================================
set -euo pipefail

PG_HOST="${PGHOST:-127.0.0.1}"
PG_PORT="${PGPORT:-54322}"
PG_USER="${PGUSER:-postgres}"
PG_DB="${PGDATABASE:-postgres}"
PG_PASS="${PGPASSWORD:-postgres}"

CLIENTS="${1:-20}"
TRANSACTIONS="${2:-25}"

export PGPASSWORD="$PG_PASS"

echo "============================================================"
echo "    INICIANDO PRUEBA DE ESTRÉS CON PGBENCH EN POSTGRESQL    "
echo "============================================================"
echo "Host: $PG_HOST:$PG_PORT | BD: $PG_DB | Usuario: $PG_USER"
echo "Clientes concurrentes: $CLIENTS | Transacciones por cliente: $TRANSACTIONS"
echo "============================================================"

# Verificar conectividad
if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" > /dev/null 2>&1; then
  echo "❌ Error: No se puede conectar a PostgreSQL en $PG_HOST:$PG_PORT"
  echo "Asegúrate de que Supabase esté iniciado (npx supabase start)"
  exit 1
fi

echo "Aplicando seed de pruebas..."
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -f backend/tests/fixtures/seed_load_and_e2e.sql > /dev/null

echo "Ejecutando pgbench (modo custom -n)..."
pgbench -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
  -n -c "$CLIENTS" -j 4 -t "$TRANSACTIONS" \
  -f backend/tests/load/pgbench_openday_hold.sql

echo ""
echo "============================================================"
echo "         VERIFICACIÓN DE INTEGRIDAD POST-PGBENCH            "
echo "============================================================"

psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "
SELECT
  id,
  capacity,
  seats_taken,
  CASE
    WHEN seats_taken <= capacity THEN '✅ OK: Sin sobreventa'
    ELSE '❌ ERROR: Capacidad superada'
  END AS estado_integridad
FROM public.tour_sessions
WHERE id = '5e000000-0000-0000-0000-000000000001';
"

