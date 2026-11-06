-- 🐧
-- Test: catálogo público, participantes privados y restricciones de identidad
BEGIN;
SELECT plan(15);

-- Datos de prueba (como superusuario)
INSERT INTO public.schools (id, name) VALUES ('aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa', 'Colegio Prueba');

INSERT INTO public.participants (id, doc_type, doc_number, first_name, last_name, birth_date, email, school_id)
VALUES ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb', 'dni', '12345678', 'Ana', 'Quispe', '2009-05-01', 'ana@correo.pe', 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa');

INSERT INTO public.guardian_consents (participant_id, guardian_name, guardian_dni, guardian_contact, document_path, valid_until)
VALUES ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb', 'Rosa Quispe', '87654321', '999111222', 'consents/ana.pdf', now() + interval '30 days');

-- Directiva (board, período activo)
INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo 2026-II', '2026-07-01', '2026-12-31', 'active');
INSERT INTO public.organizational_roles (id, name, access_level, is_global)
VALUES ('dddddddd-0001-0001-0001-dddddddddddd', 'Director de Prueba', 'board', false);
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'director@uni.pe', '{"first_name": "Dir", "last_name": "Ector"}'::jsonb);
INSERT INTO public.position_assignments (profile_id, role_id, period_id, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'dddddddd-0001-0001-0001-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active');

-- Estructura y datos iniciales
SELECT has_table('public', 'faculties', 'faculties existe');
SELECT has_table('public', 'careers', 'careers existe');
SELECT has_table('public', 'participants', 'participants existe');
SELECT is((SELECT count(*)::int FROM public.faculties), 11, 'Hay 11 facultades iniciales');
SELECT cmp_ok((SELECT count(*)::int FROM public.careers), '>=', 11, 'Cada facultad tiene al menos una carrera');
SELECT is(
  (SELECT count(*)::int FROM public.faculties f WHERE NOT EXISTS (SELECT 1 FROM public.careers c WHERE c.faculty_id = f.id)),
  0, 'Ninguna facultad queda sin carreras'
);

-- Restricciones
SELECT throws_ok(
  $$ INSERT INTO public.participants (doc_type, doc_number, first_name, last_name, birth_date)
     VALUES ('dni', '12345678', 'Otra', 'Persona', '2008-01-01') $$,
  '23505', NULL, 'No se duplica (doc_type, doc_number)'
);
SELECT lives_ok(
  $$ INSERT INTO public.participants (doc_type, doc_number, first_name, last_name, birth_date)
     VALUES ('ce', '12345678', 'Otra', 'Persona', '2008-01-01') $$,
  'El mismo número con otro doc_type sí se permite'
);
SELECT throws_ok(
  $$ INSERT INTO public.participants (doc_type, doc_number, first_name, last_name, birth_date, email)
     VALUES ('dni', '11111111', 'Copia', 'Correo', '2008-01-01', 'ANA@correo.pe') $$,
  '23505', NULL, 'El email es único sin distinguir mayúsculas'
);
SELECT lives_ok(
  $$ INSERT INTO public.participants (doc_type, doc_number, first_name, last_name, birth_date)
     VALUES ('dni', '22222222', 'Sin', 'Correo1', '2008-01-01'),
            ('dni', '33333333', 'Sin', 'Correo2', '2008-01-01') $$,
  'Varios participantes sin email son válidos'
);
SELECT throws_ok(
  $$ INSERT INTO public.participants (doc_type, doc_number, first_name, last_name, birth_date)
     VALUES ('dni', '123', 'Corto', 'Dni', '2008-01-01') $$,
  '23514', NULL, 'Un dni debe tener 8 dígitos'
);

-- anon: catálogo sí, datos personales no
SET LOCAL ROLE anon;
SELECT cmp_ok((SELECT count(*)::int FROM public.faculties), '>', 0, 'anon lee facultades');
SELECT is((SELECT count(*)::int FROM public.participants), 0, 'anon no ve participantes');
SELECT is((SELECT count(*)::int FROM public.guardian_consents), 0, 'anon no ve autorizaciones');

-- Directiva: lee participantes
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
SELECT cmp_ok((SELECT count(*)::int FROM public.participants), '>=', 1, 'La directiva lee participantes');

SELECT * FROM finish();
ROLLBACK;
