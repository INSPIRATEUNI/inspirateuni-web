-- 🐧
-- Test: counted_hours aplica el peso correctamente
BEGIN;
SELECT plan(9);

-- 1. Verificamos la existencia de las columnas en task_submissions
SELECT has_column('public', 'task_submissions', 'counted_hours', 'La columna counted_hours debe existir en task_submissions');
SELECT has_column('public', 'task_submissions', 'weight_applied', 'La columna weight_applied debe existir en task_submissions');

-- Configuración de datos de prueba
INSERT INTO public.programs (id, name, description)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Programa Horas', 'Programa para prueba de horas');

INSERT INTO public.areas (id, program_id, name)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Área de Desarrollo');

INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo 2026-I', '2026-01-01', '2026-07-01', 'active');

INSERT INTO public.organizational_roles (id, name, access_level, is_global)
VALUES 
    ('dddddddd-0001-0001-0001-dddddddddddd', 'Director de Área', 'board', false),
    ('dddddddd-0002-0002-0002-dddddddddddd', 'Voluntario', 'volunteer', false);

-- Director de Área
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'director@uni.pe',
    '{"first_name": "Director", "last_name": "Horas"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    '11111111-aaaa-aaaa-aaaa-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-0001-0001-0001-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

-- Voluntario
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'voluntario@uni.pe',
    '{"first_name": "Voluntario", "last_name": "Horas"}'::jsonb
);

INSERT INTO public.position_assignments (id, profile_id, area_id, role_id, period_id, status)
VALUES (
    '22222222-aaaa-aaaa-aaaa-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-0002-0002-0002-dddddddddddd',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'active'
);

-- Distintos tipos de actividad con diferentes pesos
INSERT INTO public.activity_types (id, name, description, weight, is_active)
VALUES 
    ('ffffffff-0001-0001-0001-ffffffffffff', 'Actividad Estándar', 'Peso neutro', 1.00, true),
    ('ffffffff-0002-0002-0002-ffffffffffff', 'Actividad Compleja', 'Peso alto', 1.50, true),
    ('ffffffff-0003-0003-0003-ffffffffffff', 'Actividad Fraccional', 'Peso fraccionario', 1.25, true),
    ('ffffffff-0004-0004-0004-ffffffffffff', 'Actividad Ligera', 'Peso menor', 0.50, true),
    ('ffffffff-0005-0005-0005-ffffffffffff', 'Actividad Variable', 'Para probar cambios de peso', 1.75, true);

-- Tareas asociadas
INSERT INTO public.tasks (id, area_id, activity_type_id, title, estimated_hours)
VALUES 
    ('aaaa0001-0001-0001-0001-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ffffffff-0001-0001-0001-ffffffffffff', 'Tarea Peso 1.0', 10.00),
    ('aaaa0002-0002-0002-0002-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ffffffff-0002-0002-0002-ffffffffffff', 'Tarea Peso 1.5', 4.00),
    ('aaaa0003-0003-0003-0003-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ffffffff-0003-0003-0003-ffffffffffff', 'Tarea Peso 1.25', 3.50),
    ('aaaa0004-0004-0004-0004-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ffffffff-0004-0004-0004-ffffffffffff', 'Tarea Peso 0.5', 6.00),
    ('aaaa0005-0005-0005-0005-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ffffffff-0005-0005-0005-ffffffffffff', 'Tarea Peso 1.75', 8.00);

-- Asignaciones de tarea
INSERT INTO public.task_assignments (id, task_id, position_assignment_id)
VALUES 
    ('ea000001-0001-0001-0001-000000000001', 'aaaa0001-0001-0001-0001-000000000001', '22222222-aaaa-aaaa-aaaa-222222222222'),
    ('ea000002-0002-0002-0002-000000000002', 'aaaa0002-0002-0002-0002-000000000002', '22222222-aaaa-aaaa-aaaa-222222222222'),
    ('ea000003-0003-0003-0003-000000000003', 'aaaa0003-0003-0003-0003-000000000003', '22222222-aaaa-aaaa-aaaa-222222222222'),
    ('ea000004-0004-0004-0004-000000000004', 'aaaa0004-0004-0004-0004-000000000004', '22222222-aaaa-aaaa-aaaa-222222222222'),
    ('ea000005-0005-0005-0005-000000000005', 'aaaa0005-0005-0005-0005-000000000005', '22222222-aaaa-aaaa-aaaa-222222222222');

-- 2. Inserción directa de entregas aprobadas para validar la columna generada counted_hours
INSERT INTO public.task_submissions (id, task_assignment_id, status, work_date, reported_hours, approved_hours, weight_applied, submitted_at, reviewed_at)
VALUES 
    ('eb000001-0001-0001-0001-000000000001', 'ea000001-0001-0001-0001-000000000001', 'approved', CURRENT_DATE, 10.00, 10.00, 1.00, NOW(), NOW()),
    ('eb000002-0002-0002-0002-000000000002', 'ea000002-0002-0002-0002-000000000002', 'approved', CURRENT_DATE, 4.00, 4.00, 1.50, NOW(), NOW()),
    ('eb000003-0003-0003-0003-000000000003', 'ea000003-0003-0003-0003-000000000003', 'approved', CURRENT_DATE, 3.50, 3.50, 1.25, NOW(), NOW()),
    ('eb000004-0004-0004-0004-000000000004', 'ea000004-0004-0004-0004-000000000004', 'approved', CURRENT_DATE, 6.00, 6.00, 0.50, NOW(), NOW());

-- 3. Verificamos cálculo con peso neutro: 10.00 * 1.00 = 10.00
SELECT results_eq(
    $$ SELECT counted_hours FROM public.task_submissions WHERE id = 'eb000001-0001-0001-0001-000000000001' $$,
    $$ VALUES (10.00::numeric) $$,
    'counted_hours debe ser 10.00 cuando approved_hours es 10.00 y weight_applied es 1.00'
);

-- 4. Verificamos cálculo con peso multiplicador: 4.00 * 1.50 = 6.00
SELECT results_eq(
    $$ SELECT counted_hours FROM public.task_submissions WHERE id = 'eb000002-0002-0002-0002-000000000002' $$,
    $$ VALUES (6.00::numeric) $$,
    'counted_hours debe ser 6.00 cuando approved_hours es 4.00 y weight_applied es 1.50'
);

-- 5. Verificamos redondeo a dos decimales: 3.50 * 1.25 = 4.375 -> 4.38
SELECT results_eq(
    $$ SELECT counted_hours FROM public.task_submissions WHERE id = 'eb000003-0003-0003-0003-000000000003' $$,
    $$ VALUES (4.38::numeric) $$,
    'counted_hours debe redondearse a 4.38 cuando 3.50 * 1.25 = 4.375'
);

-- 6. Verificamos cálculo con peso reductor: 6.00 * 0.50 = 3.00
SELECT results_eq(
    $$ SELECT counted_hours FROM public.task_submissions WHERE id = 'eb000004-0004-0004-0004-000000000004' $$,
    $$ VALUES (3.00::numeric) $$,
    'counted_hours debe ser 3.00 cuando approved_hours es 6.00 y weight_applied es 0.50'
);

-- 7. Prueba del trigger: al aprobar una entrega, el trigger copia activity_types.weight a weight_applied
-- Creamos una entrega en estado 'submitted'
INSERT INTO public.task_submissions (id, task_assignment_id, status, work_date, reported_hours, submitted_at)
VALUES (
    'eb000005-0005-0005-0005-000000000005',
    'ea000005-0005-0005-0005-000000000005',
    'submitted',
    CURRENT_DATE,
    8.00,
    NOW()
);

-- Director aprueba la entrega
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

UPDATE public.task_submissions
SET status = 'approved', approved_hours = 8.00, review_comment = 'Excelente trabajo'
WHERE id = 'eb000005-0005-0005-0005-000000000005';

-- Verificamos que weight_applied se asignó automáticamente como 1.75 y counted_hours es 8.00 * 1.75 = 14.00
SELECT results_eq(
    $$ SELECT weight_applied, counted_hours FROM public.task_submissions WHERE id = 'eb000005-0005-0005-0005-000000000005' $$,
    $$ VALUES (1.75::numeric, 14.00::numeric) $$,
    'El trigger debe copiar activity_types.weight (1.75) y counted_hours debe ser 14.00'
);

-- 8. Verificamos inmutabilidad histórica: modificar activity_types.weight posteriormente NO debe alterar la entrega ya aprobada
RESET ROLE;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '';

UPDATE public.activity_types
SET weight = 2.50
WHERE id = 'ffffffff-0005-0005-0005-ffffffffffff';

SELECT results_eq(
    $$ SELECT weight_applied, counted_hours FROM public.task_submissions WHERE id = 'eb000005-0005-0005-0005-000000000005' $$,
    $$ VALUES (1.75::numeric, 14.00::numeric) $$,
    'Modificar el peso en activity_types no altera weight_applied ni counted_hours ya aprobados'
);

-- 9. Verificamos que la vista extracurricular_hours suma los counted_hours de todas las entregas aprobadas
-- Total voluntario: sub1 (10.00) + sub2 (6.00) + sub3 (4.38) + sub4 (3.00) + sub5 (14.00) = 37.38
SELECT results_eq(
    $$ SELECT total_hours, approved_submissions FROM public.extracurricular_hours WHERE profile_id = '22222222-2222-2222-2222-222222222222' $$,
    $$ VALUES (37.38::numeric, 5::bigint) $$,
    'La vista extracurricular_hours debe totalizar la suma exacta de counted_hours (37.38)'
);

-- Finalizar
SELECT * FROM finish();
ROLLBACK;
