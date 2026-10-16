-- 🐧
-- Test: Un usuario no autenticado no puede leer horas
BEGIN;
SELECT plan(6);

-- 1. Verificamos la existencia de la tabla task_submissions y la vista extracurricular_hours
SELECT has_table('public', 'task_submissions', 'La tabla task_submissions debe existir');
SELECT has_view('public', 'extracurricular_hours', 'La vista extracurricular_hours debe existir');

-- Configuración de datos de prueba (como service_role/superuser)
INSERT INTO public.programs (id, name, description)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Programa Académico', 'Descripción de prueba');

INSERT INTO public.areas (id, program_id, name)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Área de Tecnología');

INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo 2026-I', '2026-01-01', '2026-07-01', 'active');

INSERT INTO public.organizational_roles (id, name, access_level, is_global)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Voluntario General', 'volunteer', false);

-- Crear usuario voluntario en auth.users (el trigger creará public.profiles)
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'voluntario.test@uni.pe',
    '{"first_name": "Luis", "last_name": "Voluntario"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

INSERT INTO public.activity_types (id, name, description, weight, is_active)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Desarrollo de Software', 'Actividad técnica', 1.00, true);

INSERT INTO public.tasks (id, area_id, activity_type_id, title, description, estimated_hours)
VALUES (
    '12121212-1212-1212-1212-121212121212',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Implementar API',
    'Desarrollo de endpoints',
    10.00
);

INSERT INTO public.task_assignments (id, task_id, position_assignment_id)
VALUES (
    '34343434-3434-3434-3434-343434343434',
    '12121212-1212-1212-1212-121212121212',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

-- Insertamos entrega aprobada con horas
INSERT INTO public.task_submissions (
    id,
    task_assignment_id,
    status,
    work_date,
    reported_hours,
    approved_hours,
    weight_applied,
    notes,
    submitted_at,
    reviewed_at
)
VALUES (
    '56565656-5656-5656-5656-565656565656',
    '34343434-3434-3434-3434-343434343434',
    'approved',
    CURRENT_DATE,
    5.00,
    5.00,
    1.00,
    'Horas completadas',
    NOW(),
    NOW()
);

-- 2. CASO: Usuario NO autenticado (rol 'anon', sin JWT claims)
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '';

SELECT is_empty(
    $$ SELECT * FROM public.extracurricular_hours $$,
    'Un usuario no autenticado no puede leer horas de la vista extracurricular_hours'
);

SELECT is_empty(
    $$ SELECT id, reported_hours, approved_hours, counted_hours FROM public.task_submissions $$,
    'Un usuario no autenticado no puede leer entregas ni horas de la tabla task_submissions'
);

-- 3. CASO: Usuario autenticado propietario (verifica que los datos existen y solo RLS los ocultaba)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

SELECT results_eq(
    $$ SELECT total_hours FROM public.extracurricular_hours $$,
    $$ VALUES (5.00::numeric) $$,
    'El voluntario autenticado sí puede ver sus horas aprobadas en extracurricular_hours'
);

SELECT isnt_empty(
    $$ SELECT id FROM public.task_submissions WHERE id = '56565656-5656-5656-5656-565656565656' $$,
    'El voluntario autenticado sí puede ver sus propias entregas en task_submissions'
);

-- Finalizar
SELECT * FROM finish();
ROLLBACK;

