SET local check_function_bodies = off;

ALTER TABLE "public"."document_templates"
  ADD CONSTRAINT "document_templates_kind_check"
    CHECK ((kind <> ALL (ARRAY['school_consolidated'::public.document_kind, 'individual_consolidated'::public.document_kind, 'credentials'::public.document_kind])));

