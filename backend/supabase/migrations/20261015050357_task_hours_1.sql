ALTER TABLE "public"."organizational_roles"
  DROP CONSTRAINT "organizational_roles_check";

CREATE TABLE "public"."activity_types" (
  "id"          uuid         NOT NULL DEFAULT gen_random_uuid(),
  "name"        text         NOT NULL,
  "description" text,
  "weight"      numeric(4,2) NOT NULL DEFAULT 1,
  "is_active"   boolean      NOT NULL DEFAULT true,
  CONSTRAINT "activity_types_name_key" UNIQUE (name),
  CONSTRAINT "activity_types_pkey" PRIMARY KEY (id),
  CONSTRAINT "activity_types_weight_check" CHECK ((weight > (0)::numeric))
);

ALTER TABLE "public"."activity_types"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."submission_evidences" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "submission_id" uuid                     NOT NULL,
  "drive_file_id" text                     NOT NULL,
  "file_name"     text                     NOT NULL,
  "mime_type"     text,
  "size_bytes"    bigint,
  "uploaded_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "submission_evidences_pkey" PRIMARY KEY (id),
  CONSTRAINT "submission_evidences_size_bytes_check" CHECK ((size_bytes > 0)),
  CONSTRAINT "submission_evidences_submission_id_drive_file_id_key" UNIQUE (submission_id, drive_file_id)
);

ALTER TABLE "public"."submission_evidences"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."task_assignments" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "task_id"                uuid                     NOT NULL,
  "position_assignment_id" uuid                     NOT NULL,
  "assigned_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "task_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "task_assignments_task_id_position_assignment_id_key" UNIQUE (task_id, position_assignment_id)
);

ALTER TABLE "public"."task_assignments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."task_submissions" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "task_assignment_id" uuid                     NOT NULL,
  "work_date"          date,
  "notes"              text,
  "reported_hours"     numeric(5,2),
  "approved_hours"     numeric(5,2),
  "weight_applied"     numeric(4,2),
  "review_comment"     text,
  "submitted_at"       timestamp with time zone,
  "reviewed_by"        uuid,
  "reviewed_at"        timestamp with time zone,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "task_submissions_approved_hours_check" CHECK ((approved_hours > (0)::numeric)),
  CONSTRAINT "task_submissions_pkey" PRIMARY KEY (id),
  CONSTRAINT "task_submissions_reported_hours_check" CHECK ((reported_hours > (0)::numeric)),
  CONSTRAINT "task_submissions_weight_applied_check" CHECK ((weight_applied > (0)::numeric))
);

ALTER TABLE "public"."task_submissions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tasks" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "area_id"          uuid                     NOT NULL,
  "activity_type_id" uuid                     NOT NULL,
  "title"            text                     NOT NULL,
  "description"      text,
  "estimated_hours"  numeric(5,2),
  "due_date"         date,
  "created_by"       uuid,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tasks_estimated_hours_check" CHECK ((estimated_hours > (0)::numeric)),
  CONSTRAINT "tasks_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."tasks"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."task_submissions"
  ADD COLUMN "counted_hours" numeric(6,2) GENERATED ALWAYS AS (round((approved_hours * weight_applied), 2)) STORED;

ALTER TYPE "public"."access_level" ADD VALUE 'admin' BEFORE 'board';

