SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_in_pass (
  p_access_code text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_pass public.event_passes;
  v_name text;
  v_already boolean;
begin
  if not public.is_board() then
    perform public._fail('forbidden', 'Solo la directiva puede registrar ingresos');
  end if;

  select * into v_pass
  from public.event_passes ep
  where ep.access_code = upper(btrim(p_access_code)) and ep.status = 'active'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select p.first_name || ' ' || p.last_name into v_name
  from public.participants p where p.id = v_pass.participant_id;

  v_already := v_pass.checked_in_at is not null;
  if not v_already then
    update public.event_passes set checked_in_at = now() where id = v_pass.id
    returning checked_in_at into v_pass.checked_in_at;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', v_already,
    'checked_in_at', v_pass.checked_in_at,
    'participant', v_name
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."check_in_pass"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.owns_participant (
  target_participant_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.event_attendees ea
    join public.event_registrations r on r.id = ea.registration_id
    where ea.participant_id = target_participant_id
      and r.owner_id = (select auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION "public"."owns_participant"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.owns_pass (
  target_pass_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.event_attendees ea
    join public.event_registrations r on r.id = ea.registration_id
    where ea.pass_id = target_pass_id
      and r.owner_id = (select auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION "public"."owns_pass"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.owns_registration (
  target_registration_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.event_registrations r
    where r.id = target_registration_id
      and r.owner_id = (select auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION "public"."owns_registration"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.owns_school (
  target_school_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.event_registrations r
    where r.school_id = target_school_id
      and r.owner_id = (select auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION "public"."owns_school"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.set_logistics (
  p_registration_id uuid,
  p_items           jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_item jsonb;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status <> 'reserved' then
    perform public._fail('bad_state', 'La logística ya no se puede cambiar');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    perform public._fail('attendees_invalid', 'La logística no es válida');
  end if;

  delete from public.registration_logistics where registration_id = v_reg.id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if not exists (
      select 1 from public.logistics_options o where o.code = v_item ->> 'option_code' and o.active
    ) then
      perform public._fail('invalid_option', 'La opción de logística "' || coalesce(v_item ->> 'option_code', '') || '" no existe');
    end if;
    insert into public.registration_logistics (registration_id, option_code, quantity, notes)
    values (v_reg.id, v_item ->> 'option_code', (v_item ->> 'quantity')::integer, nullif(btrim(v_item ->> 'notes'), ''));
  end loop;

  perform public._log_registration_event(
    v_reg.id, 'logistics_set', v_reg.status, v_reg.status, null,
    jsonb_build_object('items', jsonb_array_length(p_items))
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."set_logistics"(uuid, jsonb) FROM PUBLIC, "anon";

CREATE POLICY "document_templates: admin escribe" ON "public"."document_templates"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "document_templates: directiva ve todas" ON "public"."document_templates"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "document_templates: lectura de activas" ON "public"."document_templates"
  FOR SELECT
  TO "authenticated"
  USING (active);

CREATE POLICY "email_outbox: directiva lee" ON "public"."email_outbox"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "event_attendees: directiva ve todos" ON "public"."event_attendees"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "event_attendees: dueño ve los suyos" ON "public"."event_attendees"
  FOR SELECT
  TO "authenticated"
  USING (public.owns_registration(registration_id));

CREATE POLICY "event_passes: directiva ve todos" ON "public"."event_passes"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "event_passes: dueño ve los de su inscripción" ON "public"."event_passes"
  FOR SELECT
  TO "authenticated"
  USING (public.owns_pass(id));

CREATE POLICY "event_registrations: directiva ve todas" ON "public"."event_registrations"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "event_registrations: dueño ve la suya" ON "public"."event_registrations"
  FOR SELECT
  TO "authenticated"
  USING ((owner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "logistics_options: admin escribe" ON "public"."logistics_options"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "logistics_options: directiva ve todas" ON "public"."logistics_options"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "logistics_options: lectura de activas" ON "public"."logistics_options"
  FOR SELECT
  TO "anon", "authenticated"
  USING (active);

CREATE POLICY "participants: dueño ve los de su inscripción" ON "public"."participants"
  FOR SELECT
  TO "authenticated"
  USING (public.owns_participant(id));

CREATE POLICY "registration_documents: directiva ve todos" ON "public"."registration_documents"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "registration_documents: dueño ve los suyos" ON "public"."registration_documents"
  FOR SELECT
  TO "authenticated"
  USING (public.owns_registration(registration_id));

CREATE POLICY "registration_events: directiva lee" ON "public"."registration_events"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "registration_logistics: directiva ve todas" ON "public"."registration_logistics"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "registration_logistics: dueño ve la suya" ON "public"."registration_logistics"
  FOR SELECT
  TO "authenticated"
  USING (public.owns_registration(registration_id));

CREATE POLICY "schools: dueño ve el suyo" ON "public"."schools"
  FOR SELECT
  TO "authenticated"
  USING (public.owns_school(id));

CREATE POLICY "tour_enrollments: directiva ve todos" ON "public"."tour_enrollments"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "tour_enrollments: dueño ve los suyos" ON "public"."tour_enrollments"
  FOR SELECT
  TO "authenticated"
  USING (public.owns_registration(registration_id));

GRANT EXECUTE ON FUNCTION "public"."check_in_pass"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."check_in_pass"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_in_pass"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_in_pass"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."owns_participant"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."owns_participant"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_participant"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_participant"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."owns_pass"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."owns_pass"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_pass"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_pass"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."owns_registration"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."owns_registration"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_registration"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_registration"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."owns_school"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."owns_school"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_school"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_school"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_logistics"(uuid, jsonb) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_logistics"(uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_logistics"(uuid, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_logistics"(uuid, jsonb) TO "service_role";

REVOKE ALL ON TABLE "public"."email_outbox" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."email_outbox" TO "anon";

REVOKE ALL ON TABLE "public"."email_outbox" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."email_outbox" TO "authenticated";

REVOKE ALL ON TABLE "public"."event_attendees" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."event_attendees" TO "anon";

REVOKE ALL ON TABLE "public"."event_attendees" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."event_attendees" TO "authenticated";

REVOKE ALL ON TABLE "public"."event_passes" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."event_passes" TO "anon";

REVOKE ALL ON TABLE "public"."event_passes" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."event_passes" TO "authenticated";

REVOKE ALL ON TABLE "public"."event_registrations" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."event_registrations" TO "anon";

REVOKE ALL ON TABLE "public"."event_registrations" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."event_registrations" TO "authenticated";

REVOKE ALL ON TABLE "public"."registration_documents" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."registration_documents" TO "anon";

REVOKE ALL ON TABLE "public"."registration_documents" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."registration_documents" TO "authenticated";

REVOKE ALL ON TABLE "public"."registration_events" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."registration_events" TO "anon";

REVOKE ALL ON TABLE "public"."registration_events" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."registration_events" TO "authenticated";

REVOKE ALL ON TABLE "public"."registration_logistics" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."registration_logistics" TO "anon";

REVOKE ALL ON TABLE "public"."registration_logistics" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."registration_logistics" TO "authenticated";

REVOKE ALL ON TABLE "public"."tour_enrollments" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."tour_enrollments" TO "anon";

REVOKE ALL ON TABLE "public"."tour_enrollments" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."tour_enrollments" TO "authenticated";
