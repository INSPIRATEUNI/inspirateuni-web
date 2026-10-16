-- 🐧
-- Test: Un director no puede revisar entregas de otra área, y presidente y vice sí
BEGIN;
SELECT plan(13);

-- Configuración de datos de prueba
INSERT INTO public.programs (id, name, description)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Programa General', 'Programa principal');

-- Área A y Área B
INSERT INTO public.areas (id, program_id, name)
VALUES 
    ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Área A - Logística'),
    ('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Área B - Académica');

-- Periodo activo
INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo 2026-I', '2026-01-01', '2026-07-01', 'active');

-- Roles organizacionales
INSERT INTO public.organizational_roles (id, name, access_level, is_global)
VALUES 
    ('dddddddd-0001-0001-0001-dddddddddddd', 'Director de Área', 'board', false),
    ('dddddddd-0002-0002-0002-dddddddddddd', 'Presidente', 'board', true),
    ('dddddddd-0003-0003-0003-dddddddddddd', 'Vicepresidente', 'board', true),
    ('dddddddd-0004-0004-0004-dddddddddddd', 'Voluntario', 'volunteer', false);

-- 1. Director de Área A
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'director.a@uni.pe',
    '{"first_name": "Director", "last_name": "Area A"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    '11111111-aaaa-aaaa-aaaa-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', -- Asignado a Área A
    'dddddddd-0001-0001-0001-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

-- 2. Presidente (is_global = true, area_id = NULL)
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'presidente@uni.pe',
    '{"first_name": "Presidente", "last_name": "General"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    '22222222-aaaa-aaaa-aaaa-222222222222',
    '22222222-2222-2222-2222-222222222222',
    NULL,
    'dddddddd-0002-0002-0002-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

-- 3. Vicepresidente (is_global = true, area_id = NULL)
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'vicepresidente@uni.pe',
    '{"first_name": "Vice", "last_name": "Presidente"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    '33333333-aaaa-aaaa-aaaa-333333333333',
    '33333333-3333-3333-3333-333333333333',
    NULL,
    'dddddddd-0003-0003-0003-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

-- 4. Voluntario en Área A
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    'authenticated',
    'authenticated',
    'voluntario.a@uni.pe',
    '{"first_name": "Voluntario", "last_name": "A"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    '44444444-aaaa-aaaa-aaaa-444444444444',
    '44444444-4444-4444-4444-444444444444',
    'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
    'dddddddd-0004-0004-0004-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

-- 5. Voluntario en Área B
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    'authenticated',
    'authenticated',
    'voluntario.b@uni.pe',
    '{"first_name": "Voluntario", "last_name": "B"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    '55555555-aaaa-aaaa-aaaa-555555555555',
    '55555555-5555-5555-5555-555555555555',
    'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
    'dddddddd-0004-0004-0004-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

-- Tipo de actividad
INSERT INTO public.activity_types (id, name, description, weight, is_active)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Actividad Base', 'Descripción', 1.00, true);

-- Tarea en Área A
INSERT INTO public.tasks (id, area_id, activity_type_id, title, estimated_hours)
VALUES (
    'aaaa0001-0001-0001-0001-000000000001',
    'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Tarea en Área A',
    5.00
);

INSERT INTO public.task_assignments (id, task_id, position_assignment_id)
VALUES (
    'aaaa0002-0002-0002-0002-000000000002',
    'aaaa0001-0001-0001-0001-000000000001',
    '44444444-aaaa-aaaa-aaaa-444444444444'
);

-- Entrega A1 (Área A, enviada por Voluntario A)
INSERT INTO public.task_submissions (id, task_assignment_id, status, work_date, reported_hours, submitted_at)
VALUES (
    'aaaa0003-0003-0003-0003-000000000003',
    'aaaa0002-0002-0002-0002-000000000002',
    'submitted',
    CURRENT_DATE,
    5.00,
    NOW()
);

-- Tarea en Área B
INSERT INTO public.tasks (id, area_id, activity_type_id, title, estimated_hours)
VALUES (
    'bbbb0001-0001-0001-0001-000000000001',
    'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Tarea en Área B',
    4.00
);

INSERT INTO public.task_assignments (id, task_id, position_assignment_id)
VALUES (
    'bbbb0002-0002-0002-0002-000000000002',
    'bbbb0001-0001-0001-0001-000000000001',
    '55555555-aaaa-aaaa-aaaa-555555555555'
);

-- Entrega B1 (Área B, enviada por Voluntario B)
INSERT INTO public.task_submissions (id, task_assignment_id, status, work_date, reported_hours, submitted_at)
VALUES 
    (
        'bbbb0003-0003-0003-0003-000000000003',
        'bbbb0002-0002-0002-0002-000000000002',
        'submitted',
        CURRENT_DATE,
        4.00,
        NOW()
    );

-- =========================================================================
-- SECCIÓN 1: Director de Área A
-- =========================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- 1. Puede gestionar su propia área (Área A)
SELECT ok(
    public.can_manage_area('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid),
    'Director de Área A debe poder gestionar Área A'
);

-- 2. NO puede gestionar otra área (Área B)
SELECT ok(
    NOT public.can_manage_area('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid),
    'Director de Área A NO debe poder gestionar Área B'
);

-- 3. No puede ver entregas de otra área
SELECT is_empty(
    $$ SELECT * FROM public.task_submissions WHERE id = 'bbbb0003-0003-0003-0003-000000000003' $$,
    'Director de Área A no debe poder ver entregas de Área B'
);

-- 4. Intento de actualizar/revisar entrega de otra área no afecta ninguna fila
UPDATE public.task_submissions
SET status = 'approved', approved_hours = 4.00, review_comment = 'Revisión no autorizada'
WHERE id = 'bbbb0003-0003-0003-0003-000000000003';

-- Comprobamos que no se modificó a 'approved'
SELECT is_empty(
    $$ SELECT * FROM public.task_submissions WHERE id = 'bbbb0003-0003-0003-0003-000000000003' AND status = 'approved' $$,
    'La entrega de Área B no debe ser modificada por el Director de Área A'
);

-- 5. Sí puede revisar y aprobar entregas de su propia área (Área A)
UPDATE public.task_submissions
SET status = 'approved', approved_hours = 5.00, review_comment = 'Aprobado por Director A'
WHERE id = 'aaaa0003-0003-0003-0003-000000000003';

SELECT results_eq(
    $$ SELECT status::text, approved_hours FROM public.task_submissions WHERE id = 'aaaa0003-0003-0003-0003-000000000003' $$,
    $$ VALUES ('approved'::text, 5.00::numeric) $$,
    'Director de Área A puede revisar y aprobar entregas de su propia área'
);

-- =========================================================================
-- SECCIÓN 2: Presidente (is_global = true)
-- =========================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- 6. Presidente es global
SELECT ok(
    public.is_global(),
    'Presidente debe tener condición is_global activa'
);

-- 7. Presidente puede gestionar Área B
SELECT ok(
    public.can_manage_area('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid),
    'Presidente puede gestionar Área B aunque no pertenezca a ella'
);

-- 8. Presidente puede ver entregas de Área B
SELECT isnt_empty(
    $$ SELECT * FROM public.task_submissions WHERE id = 'bbbb0003-0003-0003-0003-000000000003' $$,
    'Presidente puede ver entregas de Área B'
);

-- 9. Presidente aprueba exitosamente la entrega de Área B
UPDATE public.task_submissions
SET status = 'approved', approved_hours = 4.00, review_comment = 'Aprobado por Presidencia'
WHERE id = 'bbbb0003-0003-0003-0003-000000000003';

SELECT results_eq(
    $$ SELECT status::text, approved_hours, reviewed_by FROM public.task_submissions WHERE id = 'bbbb0003-0003-0003-0003-000000000003' $$,
    $$ VALUES ('approved'::text, 4.00::numeric, '22222222-2222-2222-2222-222222222222'::uuid) $$,
    'Presidente aprueba exitosamente la entrega de Área B'
);

-- Preparamos una segunda entrega en Área B para probar al Vicepresidente
RESET ROLE;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '';

INSERT INTO public.task_submissions (id, task_assignment_id, status, work_date, reported_hours, submitted_at)
VALUES (
    'bbbb0004-0004-0004-0004-000000000004',
    'bbbb0002-0002-0002-0002-000000000002',
    'submitted',
    CURRENT_DATE,
    3.00,
    NOW()
);

-- =========================================================================
-- SECCIÓN 3: Vicepresidente (is_global = true)
-- =========================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

-- 10. Vicepresidente es global
SELECT ok(
    public.is_global(),
    'Vicepresidente debe tener condición is_global activa'
);

-- 11. Vicepresidente puede gestionar Área B
SELECT ok(
    public.can_manage_area('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid),
    'Vicepresidente puede gestionar Área B aunque no pertenezca a ella'
);

-- 12. Vicepresidente puede ver entregas de Área B
SELECT isnt_empty(
    $$ SELECT * FROM public.task_submissions WHERE id = 'bbbb0004-0004-0004-0004-000000000004' $$,
    'Vicepresidente puede ver entregas de Área B'
);

-- 13. Vicepresidente aprueba exitosamente la entrega de Área B
UPDATE public.task_submissions
SET status = 'approved', approved_hours = 3.00, review_comment = 'Aprobado por Vicepresidencia'
WHERE id = 'bbbb0004-0004-0004-0004-000000000004';

SELECT results_eq(
    $$ SELECT status::text, approved_hours, reviewed_by FROM public.task_submissions WHERE id = 'bbbb0004-0004-0004-0004-000000000004' $$,
    $$ VALUES ('approved'::text, 3.00::numeric, '33333333-3333-3333-3333-333333333333'::uuid) $$,
    'Vicepresidente aprueba exitosamente la entrega de Área B'
);

-- Finalizar
SELECT * FROM finish();
ROLLBACK;
