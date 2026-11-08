-- ============================================================================
-- LIMPIEZA DE TABLAS DE PRUEBA (CLEANUP RÁPIDO PARA WSL2 / LOCAL)
-- ============================================================================
-- Trunca todas las tablas de datos operacionales y de prueba,
-- preservando únicamente los catálogos base (facultades, carreras, logística).
-- Permite que la suite pgTAP (make test-db) corra desde un estado limpio
-- sin necesidad de reiniciar contenedores ni ejecutar npx supabase db reset.

BEGIN;

TRUNCATE TABLE
  public.email_outbox,
  public.event_passes,
  public.event_attendees,
  public.tour_enrollments,
  public.registration_documents,
  public.registration_logistics,
  public.registration_events,
  public.event_registrations,
  public.tour_sessions,
  public.event_faculties,
  public.events,
  public.schools,
  public.guardian_consents,
  public.participants,
  public.submission_evidences,
  public.task_submissions,
  public.task_assignments,
  public.tasks,
  public.activity_types,
  public.position_assignments,
  public.organizational_roles,
  public.management_periods,
  public.areas,
  public.programs
CASCADE;

DELETE FROM auth.users;

COMMIT;
