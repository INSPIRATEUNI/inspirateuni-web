-- ============================================================================
-- PGBENCH SCRIPT: ESTRÉS DE CONCURRENCIA ATÓMICA EN HOLD_TOUR
-- Issue 1.5.9: Prueba de carga y flujo de extremo a extremo (#42)
-- ============================================================================
-- Simula transacciones de base de datos directas compitiendo por la misma
-- sesión popular '5e000000-0000-0000-0000-000000000001'.
-- Ejecutar con:
-- pgbench -h 127.0.0.1 -p 54322 -U postgres -d postgres -c 20 -j 4 -t 25 -f backend/tests/load/pgbench_openday_hold.sql
-- ============================================================================

\set random_num random(100000, 999999)

BEGIN;

-- 1. Simular contexto de usuario autenticado
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub": "90000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

-- 2. Crear inscripción y retener recorrido popular en una sola transacción
DO $$
DECLARE
  v_reg_id uuid;
  v_res jsonb;
BEGIN
  v_res := public.start_registration(
    'eeeeeeee-1111-2222-3333-444444444444'::uuid,
    'individual'::public.registration_kind,
    NULL::uuid,
    1::integer,
    ('Pgbench User ' || :random_num)::text,
    ('pgbench_' || :client_id || '_' || :random_num || '@test-openday.pe')::text
  );
  v_reg_id := (v_res ->> 'id')::uuid;

  PERFORM public.hold_tour(v_reg_id, '5e000000-0000-0000-0000-000000000001'::uuid);
EXCEPTION
  -- Capturar rechazo esperado de cupo agotado para evitar aborto abrupto
  WHEN check_violation THEN
    -- Rechazo por CHECK (seats_taken <= capacity)
    NULL;
  WHEN raise_exception THEN
    -- Rechazo de negocio 'no_capacity'
    NULL;
END $$;

COMMIT;
