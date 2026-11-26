SET local check_function_bodies = off;

DROP INDEX "public"."document_templates_active_idx";

ALTER TABLE "public"."document_templates"
  DROP CONSTRAINT "document_templates_kind_version_key";

ALTER TABLE "public"."document_templates"
  ADD COLUMN "audience" public.registration_kind NOT NULL DEFAULT 'individual'::public.registration_kind;

ALTER TYPE "public"."document_kind" ADD VALUE 'individual_consolidated' AFTER 'credentials';

