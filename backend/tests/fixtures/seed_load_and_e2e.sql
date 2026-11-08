-- ============================================================================
-- SEED FIXTURE: PRUEBAS DE CARGA Y FLUJOS E2E (Issue 1.5.9)
-- ============================================================================
-- Prepara datos deterministas en un entorno de pruebas / Supabase local.
-- Idempotente: limpia datos previos de pruebas antes de insertar.

BEGIN;

-- 1. Limpieza de pruebas previas en orden de dependencias de claves foráneas
DELETE FROM public.event_passes WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444';
DELETE FROM public.event_attendees WHERE registration_id IN (
  SELECT id FROM public.event_registrations WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444' OR contact_email LIKE '%@test-openday.pe'
);
DELETE FROM public.tour_enrollments WHERE registration_id IN (
  SELECT id FROM public.event_registrations WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444' OR contact_email LIKE '%@test-openday.pe'
);
DELETE FROM public.registration_documents WHERE registration_id IN (
  SELECT id FROM public.event_registrations WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444' OR contact_email LIKE '%@test-openday.pe'
);
DELETE FROM public.registration_logistics WHERE registration_id IN (
  SELECT id FROM public.event_registrations WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444' OR contact_email LIKE '%@test-openday.pe'
);
DELETE FROM public.registration_events WHERE registration_id IN (
  SELECT id FROM public.event_registrations WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444' OR contact_email LIKE '%@test-openday.pe'
);
DELETE FROM public.email_outbox WHERE registration_id IN (
  SELECT id FROM public.event_registrations WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444' OR contact_email LIKE '%@test-openday.pe'
);
DELETE FROM public.event_registrations WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444' OR contact_email LIKE '%@test-openday.pe';
DELETE FROM public.tour_sessions WHERE event_faculty_id IN (
  SELECT id FROM public.event_faculties WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444'
);
DELETE FROM public.event_faculties WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444';
DELETE FROM public.events WHERE id = 'eeeeeeee-1111-2222-3333-444444444444';

-- 2. Evento de pruebas
INSERT INTO public.events (
  id, name, event_date, venue, registration_open,
  registration_opens_at, registration_closes_at, docs_close_at,
  hold_minutes, reservation_hours, students_per_chaperone,
  max_visitors_per_registration, max_drafts_per_email, travel_buffer_minutes
) VALUES (
  'eeeeeeee-1111-2222-3333-444444444444',
  'Open Day 2026 - Carga y E2E',
  current_date + 30,
  'Campus Central UNI',
  true,
  now() - interval '2 hours',
  now() + interval '15 days',
  now() + interval '17 days',
  30, 48, 10, 100, 5, 15
)
ON CONFLICT (id) DO UPDATE SET
  registration_open = true,
  registration_opens_at = now() - interval '2 hours',
  registration_closes_at = now() + interval '15 days',
  docs_close_at = now() + interval '17 days';

-- 3. Facultades del evento con sus tiers de demanda
-- High (alta demanda), Mid (demanda media), Low (baja demanda)
DELETE FROM public.event_faculties WHERE event_id = 'eeeeeeee-1111-2222-3333-444444444444';

INSERT INTO public.event_faculties (id, event_id, faculty_id, tier)
SELECT v.id::uuid, 'eeeeeeee-1111-2222-3333-444444444444', f.id, v.tier::public.tour_tier
FROM (VALUES
  ('fa000000-1111-0000-0000-000000000001', 'Facultad de Ingeniería Mecánica', 'high'),
  ('fa000000-2222-0000-0000-000000000002', 'Facultad de Ingeniería Civil', 'mid'),
  ('fa000000-3333-0000-0000-000000000003', 'Facultad de Ciencias', 'low')
) AS v (id, name, tier)
JOIN public.faculties f ON f.name = v.name;

-- 4. Sesiones de recorridos (Sesiones Populares con capacidad limitada para saturar en prueba de carga)
DELETE FROM public.tour_sessions WHERE event_faculty_id IN (
  'fa000000-1111-0000-0000-000000000001',
  'fa000000-2222-0000-0000-000000000002',
  'fa000000-3333-0000-0000-000000000003'
);

INSERT INTO public.tour_sessions (id, event_faculty_id, starts_at, ends_at, capacity, seats_taken, status, meeting_point) VALUES
  -- SESIÓN POPULAR 1 (FIM, Tier High) - Capacidad 15 (para prueba de saturación de carga)
  ('5e000000-0000-0000-0000-000000000001', 'fa000000-1111-0000-0000-000000000001',
   (current_date + 30 + time '09:00') at time zone 'America/Lima', (current_date + 30 + time '10:00') at time zone 'America/Lima',
   15, 0, 'open', 'Puerta 3 - FIM'),

  -- SESIÓN POPULAR 2 (FIM, Tier High) - Capacidad 20
  ('5e000000-0000-0000-0000-000000000002', 'fa000000-1111-0000-0000-000000000001',
   (current_date + 30 + time '14:30') at time zone 'America/Lima', (current_date + 30 + time '15:30') at time zone 'America/Lima',
   20, 0, 'open', 'Puerta 3 - FIM'),

  -- SESIÓN MID (FIC, Tier Mid) - Capacidad 50
  ('5e000000-0000-0000-0000-000000000003', 'fa000000-2222-0000-0000-000000000002',
   (current_date + 30 + time '10:15') at time zone 'America/Lima', (current_date + 30 + time '11:15') at time zone 'America/Lima',
   50, 0, 'open', 'Pabellón FIC'),

  -- SESIÓN LOW (FC, Tier Low) - Capacidad 50
  ('5e000000-0000-0000-0000-000000000004', 'fa000000-3333-0000-0000-000000000003',
   (current_date + 30 + time '13:00') at time zone 'America/Lima', (current_date + 30 + time '14:00') at time zone 'America/Lima',
   50, 0, 'open', 'Plaza FC');

-- 5. Colegio de prueba
INSERT INTO public.schools (id, name, district, ugel)
VALUES ('a0000000-1111-2222-3333-444444444444', 'Colegio Mayor Test E2E', 'Rímac', 'UGEL 02')
ON CONFLICT (name) DO UPDATE SET district = 'Rímac', ugel = 'UGEL 02';

-- 6. Usuarios de prueba en auth.users
-- Usuarios específicos para roles de prueba
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'colegio@test-openday.pe', '{"first_name":"Director","last_name":"Colegio"}'::jsonb),
  ('90000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'libre.menor@test-openday.pe', '{"first_name":"Menor","last_name":"Escolar"}'::jsonb),
  ('90000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'libre.adulto@test-openday.pe', '{"first_name":"Adulto","last_name":"Postulante"}'::jsonb),
  ('90000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'staff.board@test-openday.pe', '{"first_name":"Directiva","last_name":"Staff"}'::jsonb),
  ('90000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'admin.openday@test-openday.pe', '{"first_name":"Admin","last_name":"Root"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Usuarios para Virtual Users (VUs) de pruebas de carga k6 (1 a 100)
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
SELECT
  ('90000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  'vu_' || i || '@test-openday.pe',
  jsonb_build_object('first_name', 'VU_' || i, 'last_name', 'LoadTester')
FROM generate_series(1, 100) i
ON CONFLICT (id) DO NOTHING;

-- 7. Rol de staff (board) y admin en la organización
INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('c0000000-1111-2222-3333-444444444444', 'Periodo Pruebas', '2026-01-01', '2027-12-31', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizational_roles (id, name, access_level, is_global) VALUES
  ('d0000000-1111-0000-0000-000000000001', 'Directiva Staff', 'board', false),
  ('d0000000-2222-0000-0000-000000000002', 'Administrador General', 'admin', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.position_assignments (profile_id, role_id, period_id, status) VALUES
  ('90000000-0000-0000-0000-000000000004', 'd0000000-1111-0000-0000-000000000001', 'c0000000-1111-2222-3333-444444444444', 'active'),
  ('90000000-0000-0000-0000-000000000005', 'd0000000-2222-0000-0000-000000000002', 'c0000000-1111-2222-3333-444444444444', 'active')
ON CONFLICT DO NOTHING;

COMMIT;
