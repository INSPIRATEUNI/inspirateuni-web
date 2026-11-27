SET local check_function_bodies = off;

ALTER TABLE "public"."document_templates"
  DROP CONSTRAINT "document_templates_kind_check";

ALTER TYPE "public"."document_kind" ADD VALUE 'presentation_letter' AFTER 'individual_consolidated';

