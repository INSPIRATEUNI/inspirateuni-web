SET local check_function_bodies = off;

CREATE EXTENSION "btree_gist" SCHEMA "extensions";

CREATE EXTENSION "pg_cron";

CREATE TABLE "public"."careers" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "faculty_id" uuid NOT NULL,
  "name"       text NOT NULL,
  CONSTRAINT "careers_faculty_id_name_key" UNIQUE (faculty_id, name),
  CONSTRAINT "careers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."careers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."faculties" (
  "id"   uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  CONSTRAINT "faculties_name_key" UNIQUE (name),
  CONSTRAINT "faculties_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."faculties"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."guardian_consents" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "participant_id"   uuid                     NOT NULL,
  "guardian_name"    text                     NOT NULL,
  "guardian_dni"     text                     NOT NULL,
  "guardian_contact" text                     NOT NULL,
  "document_path"    text                     NOT NULL,
  "accepted_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "valid_until"      timestamp with time zone NOT NULL,
  CONSTRAINT "guardian_consents_check" CHECK ((valid_until > accepted_at)),
  CONSTRAINT "guardian_consents_guardian_dni_check" CHECK ((guardian_dni ~ '^[0-9]{8}$'::text)),
  CONSTRAINT "guardian_consents_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."guardian_consents"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."participants" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "doc_number" text                     NOT NULL,
  "first_name" text                     NOT NULL,
  "last_name"  text                     NOT NULL,
  "birth_date" date                     NOT NULL,
  "grade"      text,
  "email"      extensions.citext,
  "phone"      text,
  "school_id"  uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "participants_birth_date_check" CHECK ((birth_date <= CURRENT_DATE)),
  CONSTRAINT "participants_doc_number_check" CHECK ((length(TRIM(BOTH FROM doc_number)) > 0)),
  CONSTRAINT "participants_email_key" UNIQUE (email),
  CONSTRAINT "participants_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."participants"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."schools" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"          text                     NOT NULL,
  "district"      text,
  "ugel"          text,
  "contact_email" extensions.citext,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "schools_name_key" UNIQUE (name),
  CONSTRAINT "schools_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."schools"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."doc_type" AS ENUM (
  'dni',
  'ce',
  'passport',
  'other'
);

ALTER TABLE "public"."participants"
  ADD COLUMN "doc_type" public.doc_type NOT NULL;

ALTER TABLE "public"."careers"
  ADD CONSTRAINT "careers_faculty_id_fkey" FOREIGN KEY (faculty_id) REFERENCES public.faculties(id) ON DELETE RESTRICT;

ALTER TABLE "public"."participants"
  ADD CONSTRAINT "participants_check" CHECK (((doc_type <> 'dni'::public.doc_type) OR (doc_number ~ '^[0-9]{8}$'::text)));

ALTER TABLE "public"."participants"
  ADD CONSTRAINT "participants_doc_type_doc_number_key" UNIQUE (doc_type, doc_number);

ALTER TABLE "public"."guardian_consents"
  ADD CONSTRAINT "guardian_consents_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;

ALTER TABLE "public"."participants"
  ADD CONSTRAINT "participants_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE RESTRICT;

CREATE INDEX careers_faculty_id_idx ON public.careers USING btree (faculty_id);

CREATE INDEX guardian_consents_participant_id_idx ON public.guardian_consents USING btree (participant_id);

CREATE INDEX participants_school_id_idx ON public.participants USING btree (school_id);

CREATE POLICY "careers: admin escribe" ON "public"."careers"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "careers: lectura pública" ON "public"."careers"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "faculties: admin escribe" ON "public"."faculties"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "faculties: lectura pública" ON "public"."faculties"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "guardian_consents: admin escribe" ON "public"."guardian_consents"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "guardian_consents: directiva lee" ON "public"."guardian_consents"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "participants: admin escribe" ON "public"."participants"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "participants: directiva lee" ON "public"."participants"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

CREATE POLICY "schools: admin escribe" ON "public"."schools"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "schools: directiva lee" ON "public"."schools"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

COMMENT ON COLUMN "public"."participants"."grade" IS 'Grado del escolar (texto libre).';

COMMENT ON EXTENSION "btree_gist" IS 'support for indexing common datatypes in GiST';

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

COMMENT ON TABLE "public"."careers" IS 'Carreras de cada facultad.';

COMMENT ON TABLE "public"."faculties" IS 'Catálogo de facultades de la universidad; lo comparten OVPGES y Open Day.';

COMMENT ON TABLE "public"."guardian_consents" IS 'Autorización de apoderado de OVPGES (documento en Supabase Storage). En el Open Day la autorización es el documento de la inscripción.';

COMMENT ON TABLE "public"."participants" IS 'Escolares y externos sin cuenta. Se identifican por (doc_type, doc_number); email único cuando existe.';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."careers" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."careers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."careers" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."careers" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."faculties" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."faculties" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."faculties" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."faculties" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guardian_consents" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."guardian_consents" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guardian_consents" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."guardian_consents" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."participants" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."participants" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."participants" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."participants" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."schools" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."schools" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."schools" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."schools" TO "service_role";
