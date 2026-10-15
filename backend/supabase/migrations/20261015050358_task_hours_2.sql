CREATE TYPE "public"."submission_status" AS ENUM (
  'assigned',
  'submitted',
  'approved',
  'rejected'
);

ALTER TABLE "public"."task_submissions"
  ADD COLUMN "status" public.submission_status NOT NULL DEFAULT 'assigned'::public.submission_status;

