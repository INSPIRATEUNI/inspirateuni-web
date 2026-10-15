SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assignment_area_id (
  target_task_assignment_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select t.area_id
  from public.task_assignments ta
  join public.tasks t on t.id = ta.task_id
  where ta.id = target_task_assignment_id;
$function$;

REVOKE ALL ON FUNCTION "public"."assignment_area_id"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.assignment_owner_id (
  target_task_assignment_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select pa.profile_id
  from public.task_assignments ta
  join public.position_assignments pa on pa.id = ta.position_assignment_id
  where ta.id = target_task_assignment_id;
$function$;

REVOKE ALL ON FUNCTION "public"."assignment_owner_id"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.can_manage_area (
  target_area_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select public.is_global()
    or exists (
      select 1
      from public.position_assignments pa
      join public.organizational_roles r on r.id = pa.role_id
      join public.management_periods mp on mp.id = pa.period_id
      where pa.profile_id = (select auth.uid())
        and pa.status = 'active'
        and mp.status = 'active'
        and r.access_level = 'board'
        and pa.area_id = target_area_id
    );
$function$;

REVOKE ALL ON FUNCTION "public"."can_manage_area"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.guard_task_submission()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_area_id uuid;
  v_owner_id uuid;
  v_weight numeric;
  v_is_owner boolean;
  v_can_review boolean;
begin
  select t.area_id, pa.profile_id, at.weight
    into v_area_id, v_owner_id, v_weight
  from public.task_assignments ta
  join public.tasks t on t.id = ta.task_id
  join public.activity_types at on at.id = t.activity_type_id
  join public.position_assignments pa on pa.id = ta.position_assignment_id
  where ta.id = new.task_assignment_id;

  if tg_op = 'UPDATE' then
    if old.status in ('approved', 'rejected') then
      raise exception 'La entrega % ya fue revisada y no se puede modificar', old.id
        using errcode = 'check_violation';
    end if;
    if new.task_assignment_id is distinct from old.task_assignment_id then
      raise exception 'No se puede cambiar la asignación de una entrega'
        using errcode = 'check_violation';
    end if;
  end if;

  if v_uid is not null then
    v_is_owner := v_owner_id = v_uid;
    -- Un director no revisa sus propias entregas
    v_can_review := not v_is_owner and public.can_manage_area(v_area_id);

    if v_is_owner then
      if new.status not in ('assigned', 'submitted')
        or (tg_op = 'UPDATE' and old.status = 'submitted' and new.status = 'assigned') then
        raise exception 'El voluntario solo puede dejar la entrega en assigned o enviarla (submitted)'
          using errcode = 'insufficient_privilege';
      end if;
      if new.review_comment is not null
        or (tg_op = 'UPDATE' and (
          new.approved_hours is distinct from old.approved_hours
          or new.weight_applied is distinct from old.weight_applied
          or new.reviewed_by is distinct from old.reviewed_by
          or new.reviewed_at is distinct from old.reviewed_at
        )) then
        raise exception 'Solo un director del área puede revisar la entrega'
          using errcode = 'insufficient_privilege';
      end if;
    elsif v_can_review then
      if tg_op = 'INSERT' or old.status <> 'submitted' or new.status not in ('approved', 'rejected') then
        raise exception 'Un director solo puede aprobar o rechazar una entrega en estado submitted'
          using errcode = 'insufficient_privilege';
      end if;
      if new.reported_hours is distinct from old.reported_hours
        or new.work_date is distinct from old.work_date
        or new.notes is distinct from old.notes then
        raise exception 'Un director no puede modificar el reporte del voluntario'
          using errcode = 'insufficient_privilege';
      end if;
      new.reviewed_by := v_uid;
    else
      raise exception 'No tienes permiso sobre esta entrega'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    new.submitted_at := now();
  end if;

  if new.status in ('approved', 'rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.reviewed_at := now();
  end if;

  if new.status = 'approved' then
    new.weight_applied := v_weight;
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."guard_task_submission"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.position_assignments pa
    join public.organizational_roles r on r.id = pa.role_id
    join public.management_periods mp on mp.id = pa.period_id
    where pa.profile_id = (select auth.uid())
      and pa.status = 'active'
      and mp.status = 'active'
      and r.access_level = 'admin'
  );
$function$;

REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.is_board()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.position_assignments pa
    join public.organizational_roles r on r.id = pa.role_id
    join public.management_periods mp on mp.id = pa.period_id
    where pa.profile_id = (select auth.uid())
      and pa.status = 'active'
      and mp.status = 'active'
      and r.access_level in ('admin', 'board')
  );
$function$;

REVOKE ALL ON FUNCTION "public"."is_board"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.is_global()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.position_assignments pa
    join public.organizational_roles r on r.id = pa.role_id
    join public.management_periods mp on mp.id = pa.period_id
    where pa.profile_id = (select auth.uid())
      and pa.status = 'active'
      and mp.status = 'active'
      and (r.is_global or r.access_level = 'admin')
  );
$function$;

REVOKE ALL ON FUNCTION "public"."is_global"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.owns_assignment (
  target_position_assignment_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.position_assignments pa
    where pa.id = target_position_assignment_id
      and pa.profile_id = (select auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION "public"."owns_assignment"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.submission_status_of (
  target_submission_id uuid
)
  RETURNS public.submission_status
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select ts.status from public.task_submissions ts where ts.id = target_submission_id;
$function$;

REVOKE ALL ON FUNCTION "public"."submission_status_of"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.submission_task_assignment_id (
  target_submission_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select ts.task_assignment_id from public.task_submissions ts where ts.id = target_submission_id;
$function$;

REVOKE ALL ON FUNCTION "public"."submission_task_assignment_id"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.task_area_id (
  target_task_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select t.area_id from public.tasks t where t.id = target_task_id;
$function$;

REVOKE ALL ON FUNCTION "public"."task_area_id"(uuid) FROM PUBLIC, "anon";

CREATE TRIGGER task_submissions_guard
  BEFORE INSERT OR UPDATE ON public.task_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_task_submission();

CREATE POLICY "activity_types: global escribe" ON "public"."activity_types"
  FOR ALL
  TO "authenticated"
  USING (public.is_global())
  WITH CHECK (public.is_global());

CREATE POLICY "activity_types: lectura autenticados" ON "public"."activity_types"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "areas: admin escribe" ON "public"."areas"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "areas: lectura autenticados" ON "public"."areas"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "management_periods: admin escribe" ON "public"."management_periods"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "management_periods: lectura autenticados" ON "public"."management_periods"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "organizational_roles: admin escribe" ON "public"."organizational_roles"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "organizational_roles: lectura autenticados" ON "public"."organizational_roles"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "position_assignments: global escribe" ON "public"."position_assignments"
  FOR ALL
  TO "authenticated"
  USING (public.is_global())
  WITH CHECK (public.is_global());

CREATE POLICY "position_assignments: ver propias o de su área" ON "public"."position_assignments"
  FOR SELECT
  TO "authenticated"
  USING (((profile_id = ( SELECT auth.uid() AS uid)) OR public.can_manage_area(area_id)));

CREATE POLICY "profiles: admin edita" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles: editar el propio" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "profiles: ver el propio o directiva" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (((id = ( SELECT auth.uid() AS uid)) OR public.is_board()));

CREATE POLICY "programs: admin escribe" ON "public"."programs"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "programs: lectura autenticados" ON "public"."programs"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "submission_evidences: directiva ve su área" ON "public"."submission_evidences"
  FOR SELECT
  TO "authenticated"
  USING (public.can_manage_area(public.assignment_area_id(public.submission_task_assignment_id(submission_id))));

CREATE POLICY "submission_evidences: voluntario agrega las suyas" ON "public"."submission_evidences"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((public.assignment_owner_id(public.submission_task_assignment_id(submission_id)) = ( SELECT auth.uid() AS uid)) AND (public.submission_status_of(submission_id) = ANY
    (ARRAY['assigned'::public.submission_status, 'submitted'::public.submission_status]))));

CREATE POLICY "submission_evidences: voluntario quita las suyas" ON "public"."submission_evidences"
  FOR DELETE
  TO "authenticated"
  USING
    (((public.assignment_owner_id(public.submission_task_assignment_id(submission_id)) = ( SELECT auth.uid() AS uid)) AND (public.submission_status_of(submission_id) = ANY
    (ARRAY['assigned'::public.submission_status, 'submitted'::public.submission_status]))));

CREATE POLICY "submission_evidences: voluntario ve las suyas" ON "public"."submission_evidences"
  FOR SELECT
  TO "authenticated"
  USING ((public.assignment_owner_id(public.submission_task_assignment_id(submission_id)) = ( SELECT auth.uid() AS uid)));

CREATE POLICY "task_assignments: directiva gestiona su área" ON "public"."task_assignments"
  FOR ALL
  TO "authenticated"
  USING (public.can_manage_area(public.task_area_id(task_id)))
  WITH CHECK (public.can_manage_area(public.task_area_id(task_id)));

CREATE POLICY "task_assignments: voluntario ve las suyas" ON "public"."task_assignments"
  FOR SELECT
  TO "authenticated"
  USING (public.owns_assignment(position_assignment_id));

CREATE POLICY "task_submissions: directiva revisa su área" ON "public"."task_submissions"
  FOR UPDATE
  TO "authenticated"
  USING (public.can_manage_area(public.assignment_area_id(task_assignment_id)))
  WITH CHECK (public.can_manage_area(public.assignment_area_id(task_assignment_id)));

CREATE POLICY "task_submissions: directiva ve su área" ON "public"."task_submissions"
  FOR SELECT
  TO "authenticated"
  USING (public.can_manage_area(public.assignment_area_id(task_assignment_id)));

CREATE POLICY "task_submissions: voluntario crea las suyas" ON "public"."task_submissions"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((public.assignment_owner_id(task_assignment_id) = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['assigned'::public.submission_status,
    'submitted'::public.submission_status]))));

CREATE POLICY "task_submissions: voluntario edita las suyas" ON "public"."task_submissions"
  FOR UPDATE
  TO "authenticated"
  USING
    (((public.assignment_owner_id(task_assignment_id) = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['assigned'::public.submission_status,
    'submitted'::public.submission_status]))))
  WITH
    CHECK
    (((public.assignment_owner_id(task_assignment_id) = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['assigned'::public.submission_status,
    'submitted'::public.submission_status]))));

CREATE POLICY "task_submissions: voluntario ve las suyas" ON "public"."task_submissions"
  FOR SELECT
  TO "authenticated"
  USING ((public.assignment_owner_id(task_assignment_id) = ( SELECT auth.uid() AS uid)));

CREATE POLICY "tasks: directiva gestiona su área" ON "public"."tasks"
  FOR ALL
  TO "authenticated"
  USING (public.can_manage_area(area_id))
  WITH CHECK ((public.can_manage_area(area_id) AND (created_by = ( SELECT auth.uid() AS uid))));

CREATE POLICY "tasks: voluntario ve las suyas" ON "public"."tasks"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.task_assignments ta
  WHERE ((ta.task_id = tasks.id) AND public.owns_assignment(ta.position_assignment_id)))));

GRANT EXECUTE ON FUNCTION "public"."assignment_area_id"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."assignment_area_id"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."assignment_area_id"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."assignment_area_id"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."assignment_owner_id"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."assignment_owner_id"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."assignment_owner_id"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."assignment_owner_id"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."can_manage_area"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."can_manage_area"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."can_manage_area"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."can_manage_area"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_task_submission"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_task_submission"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_task_submission"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_admin"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_board"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_board"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_board"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_board"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_global"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_global"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_global"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_global"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."owns_assignment"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."owns_assignment"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_assignment"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_assignment"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."submission_status_of"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submission_status_of"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submission_status_of"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."submission_status_of"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."submission_task_assignment_id"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submission_task_assignment_id"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submission_task_assignment_id"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."submission_task_assignment_id"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."task_area_id"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."task_area_id"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."task_area_id"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."task_area_id"(uuid) TO "service_role";
