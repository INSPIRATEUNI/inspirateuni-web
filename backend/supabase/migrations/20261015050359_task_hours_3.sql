ALTER TABLE "public"."organizational_roles"
  ADD CONSTRAINT "organizational_roles_check" CHECK (((NOT is_global) OR (access_level = ANY (ARRAY['admin'::public.access_level, 'board'::public.access_level]))));

ALTER TABLE "public"."task_assignments"
  ADD CONSTRAINT "task_assignments_position_assignment_id_fkey" FOREIGN KEY (position_assignment_id) REFERENCES public.position_assignments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."task_submissions"
  ADD CONSTRAINT "task_submissions_check1" CHECK ((((status = 'approved'::public.submission_status) AND (approved_hours IS NOT NULL) AND (weight_applied IS
    NOT NULL)) OR ((status <> 'approved'::public.submission_status) AND (approved_hours IS NULL) AND (weight_applied IS NULL))));

ALTER TABLE "public"."task_submissions"
  ADD CONSTRAINT "task_submissions_check2" CHECK ((((status = ANY (ARRAY['approved'::public.submission_status, 'rejected'::public.submission_status])) AND (reviewed_at IS
    NOT NULL)) OR ((status = ANY (ARRAY['assigned'::public.submission_status, 'submitted'::public.submission_status])) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL))));

ALTER TABLE "public"."task_submissions"
  ADD CONSTRAINT "task_submissions_check" CHECK (((status = 'assigned'::public.submission_status) OR ((reported_hours IS NOT NULL) AND (submitted_at IS NOT NULL))));

ALTER TABLE "public"."submission_evidences"
  ADD CONSTRAINT "submission_evidences_submission_id_fkey" FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE CASCADE;

ALTER TABLE "public"."task_submissions"
  ADD CONSTRAINT "task_submissions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."task_submissions"
  ADD CONSTRAINT "task_submissions_task_assignment_id_fkey" FOREIGN KEY (task_assignment_id) REFERENCES public.task_assignments(id) ON DELETE CASCADE;

ALTER TABLE "public"."tasks"
  ADD CONSTRAINT "tasks_activity_type_id_fkey" FOREIGN KEY (activity_type_id) REFERENCES public.activity_types(id) ON DELETE RESTRICT;

ALTER TABLE "public"."tasks"
  ADD CONSTRAINT "tasks_area_id_fkey" FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."tasks"
  ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."task_assignments"
  ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

CREATE VIEW "public"."extracurricular_hours" WITH (security_invoker=true) AS  SELECT pa.profile_id,
    pa.period_id,
    sum(ts.counted_hours) AS total_hours,
    count(*) AS approved_submissions
   FROM ((public.task_submissions ts
     JOIN public.task_assignments ta ON ((ta.id = ts.task_assignment_id)))
     JOIN public.position_assignments pa ON ((pa.id = ta.position_assignment_id)))
  WHERE (ts.status = 'approved'::public.submission_status)
  GROUP BY pa.profile_id, pa.period_id;

CREATE INDEX submission_evidences_submission_id_idx ON public.submission_evidences USING btree (submission_id);

CREATE INDEX task_assignments_position_assignment_id_idx ON public.task_assignments USING btree (position_assignment_id);

CREATE UNIQUE INDEX task_submissions_one_open_idx ON public.task_submissions USING btree (task_assignment_id)
  WHERE (status = ANY (ARRAY['assigned'::public.submission_status, 'submitted'::public.submission_status]));

CREATE INDEX task_submissions_reviewed_by_idx ON public.task_submissions USING btree (reviewed_by);

CREATE INDEX task_submissions_status_idx ON public.task_submissions USING btree (status);

CREATE INDEX task_submissions_task_assignment_id_idx ON public.task_submissions USING btree (task_assignment_id);

CREATE INDEX tasks_activity_type_id_idx ON public.tasks USING btree (activity_type_id);

CREATE INDEX tasks_area_id_idx ON public.tasks USING btree (area_id);

CREATE INDEX tasks_created_by_idx ON public.tasks USING btree (created_by);

COMMENT ON COLUMN "public"."activity_types"."weight" IS 'Multiplicador de horas; casi siempre 1.';

COMMENT ON COLUMN "public"."organizational_roles"."is_global" IS 'Administrador, presidente y vice: pueden asignar y revisar tareas en todas las áreas.';

COMMENT ON COLUMN "public"."task_submissions"."counted_hours" IS 'approved_hours × weight_applied; es lo que entra al reporte.';

COMMENT ON COLUMN "public"."task_submissions"."weight_applied" IS 'Copia de activity_types.weight al aprobar; cambiar el peso después no altera horas ya aprobadas.';

COMMENT ON TABLE "public"."submission_evidences" IS 'Evidencias de una entrega; el archivo está en Drive y se identifica por drive_file_id.';

COMMENT ON VIEW "public"."extracurricular_hours" IS 'Horas extracurriculares aprobadas por voluntario y período. Es una vista, no una tabla.';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."activity_types" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."activity_types" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."activity_types" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."activity_types" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."submission_evidences" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."submission_evidences" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."submission_evidences" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."submission_evidences" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_assignments" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."task_assignments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_assignments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_assignments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_submissions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."task_submissions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_submissions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_submissions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."tasks" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."extracurricular_hours" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."extracurricular_hours" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."extracurricular_hours" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."extracurricular_hours" TO "service_role";

