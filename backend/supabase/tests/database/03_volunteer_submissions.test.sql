-- 🐧
-- Test: Un voluntario X no puede leer las entregas del voluntario Y
BEGIN;
SELECT plan(7);

-- 1. Verificamos existencia de tablas requeridas
SELECT has_table('public', 'task_submissions', 'La tabla task_submissions debe existir');
SELECT has_table('public', 'task_assignments', 'La tabla task_assignments debe existir');

-- Configuración de datos de prueba
INSERT INTO public.programs (id, name, description)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Programa Voluntariado', 'Programa de prueba');

INSERT INTO public.areas (id, program_id, name)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Área de Proyectos');

INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo 2026-I', '2026-01-01', '2026-07-01', 'active');

INSERT INTO public.organizational_roles (id, name, access_level, is_global)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Voluntario de Proyectos', 'volunteer', false);

INSERT INTO public.activity_types (id, name, description, weight, is_active)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Gestión de Proyectos', 'Actividades de gestión', 1.00, true);

INSERT INTO public.tasks (id, area_id, activity_type_id, title, estimated_hours)
VALUES (
    '12121212-1212-1212-1212-121212121212',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Elaborar Informe de Avance',
    6.00
);

-- Voluntario X
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'voluntario.x@uni.pe',
    '{"first_name": "Voluntario", "last_name": "X"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

INSERT INTO public.task_assignments (id, task_id, position_assignment_id)
VALUES (
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
    '12121212-1212-1212-1212-121212121212',
    'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'
);

INSERT INTO public.task_submissions (id, task_assignment_id, status, notes)
VALUES (
    '10101010-1010-1010-1010-101010101010',
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
    'assigned',
    'Entrega asignada a Voluntario X'
);

-- Voluntario Y
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'voluntario.y@uni.pe',
    '{"first_name": "Voluntario", "last_name": "Y"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
    '22222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

INSERT INTO public.task_assignments (id, task_id, position_assignment_id)
VALUES (
    'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2',
    '12121212-1212-1212-1212-121212121212',
    'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2'
);

INSERT INTO public.task_submissions (id, task_assignment_id, status, notes)
VALUES (
    '20202020-2020-2020-2020-202020202020',
    'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2',
    'assigned',
    'Entrega confidencial de Voluntario Y'
);

-- 2. CASO: Autenticarse como Voluntario X
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Voluntario X no debe ver la entrega de Y consultando por ID
SELECT is_empty(
    $$ SELECT * FROM public.task_submissions WHERE id = '20202020-2020-2020-2020-202020202020' $$,
    'Voluntario X no debe poder leer la entrega del voluntario Y buscando por ID'
);

-- Voluntario X solo debe ver su propia entrega en el listado
SELECT set_eq(
    $$ SELECT id FROM public.task_submissions $$,
    ARRAY['10101010-1010-1010-1010-101010101010'::uuid],
    'Voluntario X solo debe ver sus propias entregas en task_submissions'
);

-- Voluntario X no debe ver la asignación de tarea del voluntario Y
SELECT is_empty(
    $$ SELECT * FROM public.task_assignments WHERE id = 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2' $$,
    'Voluntario X no debe poder leer la asignación de tarea del voluntario Y'
);

-- 3. CASO: Autenticarse como Voluntario Y
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- Voluntario Y no debe ver la entrega de X consultando por ID
SELECT is_empty(
    $$ SELECT * FROM public.task_submissions WHERE id = '10101010-1010-1010-1010-101010101010' $$,
    'Voluntario Y no debe poder leer la entrega del voluntario X buscando por ID'
);

-- Voluntario Y solo debe ver su propia entrega en el listado
SELECT set_eq(
    $$ SELECT id FROM public.task_submissions $$,
    ARRAY['20202020-2020-2020-2020-202020202020'::uuid],
    'Voluntario Y solo debe ver sus propias entregas en task_submissions'
);

-- Finalizar
SELECT * FROM finish();
ROLLBACK;
