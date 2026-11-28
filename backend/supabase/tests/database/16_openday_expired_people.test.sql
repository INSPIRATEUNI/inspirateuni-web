-- 🐧
-- Test: una inscripción vencida o cancelada no bloquea a sus personas; pueden inscribirse otra vez.
BEGIN;
SELECT plan(7);

INSERT INTO public.events (id, name, event_date, registration_opens_at, registration_closes_at)
VALUES ('eeeeeeee-0000-0000-0000-000000000016', 'Open Day Vencidas', current_date + 30, now() - interval '1 day', now() + interval '10 days');
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('16000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'uno16@correo.pe', '{}'::jsonb),
  ('16000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'dos16@correo.pe', '{}'::jsonb);
INSERT INTO public.schools (id, name) VALUES ('a0000000-0000-0000-0000-000000000016', 'Colegio Dieciséis');

-- Una libre y un colegio, ambos reservados y con el plazo ya vencido
INSERT INTO public.event_registrations (id, event_id, school_id, owner_id, kind, status, expected_visitors, contact_name, contact_email, docs_deadline) VALUES
  ('b0000000-0000-0000-0000-000000000161', 'eeeeeeee-0000-0000-0000-000000000016', NULL, '16000000-0000-0000-0000-000000000001', 'individual', 'reserved', 1, 'Libre Vencida', 'uno16@correo.pe', now() + interval '1 day'),
  ('b0000000-0000-0000-0000-000000000162', 'eeeeeeee-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000016', '16000000-0000-0000-0000-000000000002', 'school', 'reserved', 10, 'Profe Vencido', 'dos16@correo.pe', now() + interval '1 day');

CREATE TEMP TABLE people AS SELECT
  '[{"doc_type":"dni","doc_number":"16000001","first_name":"Ana","last_name":"Libre","birth_date":"2000-01-01","attendee_role":"visitor"}]'::jsonb AS visitor,
  '[{"doc_type":"dni","doc_number":"16000002","first_name":"Luis","last_name":"Tutor","birth_date":"1985-01-01","attendee_role":"chaperone"}]'::jsonb AS tutor;

SELECT public._apply_attendees('b0000000-0000-0000-0000-000000000161', (SELECT visitor FROM people), true);
SELECT public._apply_attendees('b0000000-0000-0000-0000-000000000162', (SELECT tutor FROM people), true);

UPDATE public.event_registrations SET docs_deadline = now() - interval '1 minute'
WHERE event_id = 'eeeeeeee-0000-0000-0000-000000000016';
SELECT public.job_expire_holds();
SELECT is(
  (SELECT count(*)::int FROM public.event_registrations WHERE event_id = 'eeeeeeee-0000-0000-0000-000000000016' AND status = 'expired'),
  2, 'Las dos inscripciones vencen');
SELECT is(
  (SELECT count(*)::int FROM public.event_attendees WHERE event_id = 'eeeeeeee-0000-0000-0000-000000000016'),
  2, 'Sus personas se conservan como historial');

-- Las mismas personas se inscriben otra vez
INSERT INTO public.event_registrations (id, event_id, school_id, owner_id, kind, status, expected_visitors, contact_name, contact_email, docs_deadline) VALUES
  ('b0000000-0000-0000-0000-000000000163', 'eeeeeeee-0000-0000-0000-000000000016', NULL, '16000000-0000-0000-0000-000000000001', 'individual', 'reserved', 1, 'Libre Nueva', 'uno16@correo.pe', now() + interval '1 day'),
  ('b0000000-0000-0000-0000-000000000164', 'eeeeeeee-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000016', '16000000-0000-0000-0000-000000000002', 'school', 'reserved', 10, 'Profe Nuevo', 'dos16@correo.pe', now() + interval '1 day');

SELECT is(
  public._apply_attendees('b0000000-0000-0000-0000-000000000163', (SELECT visitor FROM people), true) ->> 'ok',
  'true', 'Un visitante de una inscripción vencida puede volver a inscribirse');
SELECT is(
  public._apply_attendees('b0000000-0000-0000-0000-000000000164', (SELECT tutor FROM people), true) ->> 'ok',
  'true', 'Un tutor de una inscripción vencida puede volver a inscribirse');

-- Entre inscripciones activas se sigue impidiendo el duplicado
INSERT INTO public.event_registrations (id, event_id, school_id, owner_id, kind, status, expected_visitors, contact_name, contact_email, docs_deadline) VALUES
  ('b0000000-0000-0000-0000-000000000165', 'eeeeeeee-0000-0000-0000-000000000016', NULL, '16000000-0000-0000-0000-000000000002', 'individual', 'reserved', 1, 'Duplicada', 'dos16@correo.pe', now() + interval '1 day');
SELECT is(
  public._apply_attendees('b0000000-0000-0000-0000-000000000165', (SELECT visitor FROM people), true) ->> 'error',
  'attendee_conflict', 'Entre inscripciones activas no se repite un visitante');

-- Cancelar también libera
UPDATE public.event_registrations SET status = 'cancelled' WHERE id = 'b0000000-0000-0000-0000-000000000163';
SELECT is(
  public._apply_attendees('b0000000-0000-0000-0000-000000000165', (SELECT visitor FROM people), true) ->> 'ok',
  'true', 'Una inscripción cancelada tampoco bloquea');
SELECT is(
  (SELECT count(*)::int FROM public.event_attendees WHERE event_id = 'eeeeeeee-0000-0000-0000-000000000016' AND active),
  2, 'Solo cuentan las personas de inscripciones vivas');

SELECT * FROM finish();
ROLLBACK;
