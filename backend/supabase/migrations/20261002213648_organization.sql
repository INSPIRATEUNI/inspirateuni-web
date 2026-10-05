CREATE TABLE "public"."areas" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "program_id" uuid NOT NULL,
  "name"       text NOT NULL,
  CONSTRAINT "areas_pkey" PRIMARY KEY (id),
  CONSTRAINT "areas_program_id_name_key" UNIQUE (program_id, name)
);

ALTER TABLE "public"."areas"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."management_periods" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "name"       text NOT NULL,
  "start_date" date NOT NULL,
  "end_date"   date NOT NULL,
  CONSTRAINT "management_periods_check" CHECK ((end_date > start_date)),
  CONSTRAINT "management_periods_name_key" UNIQUE (name),
  CONSTRAINT "management_periods_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."management_periods"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."organizational_roles" (
  "id"        uuid    NOT NULL DEFAULT gen_random_uuid(),
  "name"      text    NOT NULL,
  "is_global" boolean NOT NULL DEFAULT false,
  CONSTRAINT "organizational_roles_name_key" UNIQUE (name),
  CONSTRAINT "organizational_roles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."organizational_roles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."position_assignments" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL,
  "area_id"    uuid,
  "role_id"    uuid NOT NULL,
  "period_id"  uuid NOT NULL,
  "start_date" date,
  "end_date"   date,
  CONSTRAINT "position_assignments_check" CHECK (((end_date IS NULL) OR (start_date IS NULL) OR (end_date >= start_date))),
  CONSTRAINT "position_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "position_assignments_profile_id_period_id_area_id_role_id_key" UNIQUE NULLS NOT DISTINCT (profile_id, period_id, area_id, role_id)
);

ALTER TABLE "public"."position_assignments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."programs" (
  "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
  "name"        text NOT NULL,
  "description" text,
  CONSTRAINT "programs_name_key" UNIQUE (name),
  CONSTRAINT "programs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."programs"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."access_level" AS ENUM (
  'board',
  'volunteer'
);

ALTER TABLE "public"."organizational_roles"
  ADD COLUMN "access_level" public.access_level NOT NULL DEFAULT 'volunteer'::public.access_level;

CREATE TYPE "public"."assignment_status" AS ENUM (
  'active',
  'finished'
);

ALTER TABLE "public"."position_assignments"
  ADD COLUMN "status" public.assignment_status NOT NULL DEFAULT 'active'::public.assignment_status;

CREATE TYPE "public"."period_status" AS ENUM (
  'planned',
  'active',
  'closed'
);

ALTER TABLE "public"."management_periods"
  ADD COLUMN "status" public.period_status NOT NULL DEFAULT 'planned'::public.period_status;

ALTER TABLE "public"."organizational_roles"
  ADD CONSTRAINT "organizational_roles_check" CHECK (((NOT is_global) OR (access_level = 'board'::public.access_level)));

ALTER TABLE "public"."position_assignments"
  ADD CONSTRAINT "position_assignments_area_id_fkey" FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."position_assignments"
  ADD CONSTRAINT "position_assignments_period_id_fkey" FOREIGN KEY (period_id) REFERENCES public.management_periods(id) ON DELETE RESTRICT;

ALTER TABLE "public"."position_assignments"
  ADD CONSTRAINT "position_assignments_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."position_assignments"
  ADD CONSTRAINT "position_assignments_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.organizational_roles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."areas"
  ADD CONSTRAINT "areas_program_id_fkey" FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE RESTRICT;

CREATE INDEX areas_program_id_idx ON public.areas USING btree (program_id);

CREATE UNIQUE INDEX management_periods_single_active_idx ON public.management_periods USING btree (status)
  WHERE (status = 'active'::public.period_status);

CREATE INDEX position_assignments_area_id_idx ON public.position_assignments USING btree (area_id);

CREATE INDEX position_assignments_period_id_idx ON public.position_assignments USING btree (period_id);

CREATE INDEX position_assignments_profile_id_idx ON public.position_assignments USING btree (profile_id);

CREATE INDEX position_assignments_role_id_idx ON public.position_assignments USING btree (role_id);

COMMENT ON COLUMN "public"."organizational_roles"."is_global" IS 'Presidente y vice: pueden asignar y revisar tareas en todas las áreas.';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."areas" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."areas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."areas" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."areas" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."management_periods" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."management_periods" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."management_periods" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."management_periods" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organizational_roles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."organizational_roles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organizational_roles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organizational_roles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."position_assignments" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."position_assignments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."position_assignments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."position_assignments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."programs" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."programs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."programs" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."programs" TO "service_role";
