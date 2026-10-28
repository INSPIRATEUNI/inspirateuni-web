import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ReportForm } from "@/components/intranet/ReportForm";
import {
  SubmissionSummary,
  type SubmissionView,
} from "@/components/intranet/SubmissionSummary";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reportar horas - Inspírate UNI" };

type AssignmentRow = {
  id: string;
  task: {
    title: string;
    description: string | null;
    due_date: string | null;
    area: { name: string } | null;
    activity_type: { name: string } | null;
  };
};

type SubmissionRow = {
  id: string;
  status: "assigned" | "submitted" | "approved" | "rejected";
  reported_hours: number | null;
  approved_hours: number | null;
  work_date: string | null;
  notes: string | null;
  review_comment: string | null;
  evidences: { id: string; file_name: string; size_bytes: number | null }[];
};

export default async function ReportPage({
  params,
}: PageProps<"/intranet/tareas/[id]/reportar">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();

  const supabase = await createClient();

  // Solo quien tiene la tarea asignada puede reportarla.
  const { data: assignments } = await supabase
    .from("task_assignments")
    .select(
      "id, task:tasks!inner(title, description, due_date, area:areas(name), activity_type:activity_types(name)), position_assignment:position_assignments!inner(profile_id)",
    )
    .eq("task_id", id)
    .eq("position_assignment.profile_id", user.id)
    .limit(1);
  const assignment = (assignments as unknown as AssignmentRow[] | null)?.[0];
  if (!assignment) notFound();

  const { data: rows } = await supabase
    .from("task_submissions")
    .select(
      "id, status, reported_hours, approved_hours, work_date, notes, review_comment, evidences:submission_evidences(id, file_name, size_bytes)",
    )
    .eq("task_assignment_id", assignment.id)
    .order("created_at", { ascending: false });
  const submissions = (rows ?? []) as unknown as SubmissionRow[];

  // Un borrador no cuenta: la última entrega real manda.
  const latest = submissions.find((row) => row.status !== "assigned");
  const { task } = assignment;

  const view: SubmissionView | null =
    latest && latest.status !== "rejected"
      ? {
          status: latest.status as "submitted" | "approved",
          reportedHours: latest.reported_hours,
          approvedHours: latest.approved_hours,
          workDate: latest.work_date,
          notes: latest.notes,
          evidences: latest.evidences.map((file) => ({
            id: file.id,
            name: file.file_name,
            size: file.size_bytes,
          })),
        }
      : null;

  return (
    <section>
      <Heading variant="page">
        Reportar <GradientText gradient="discover">horas</GradientText>.
      </Heading>

      <div className="mt-6 grid max-w-2xl gap-3">
        <Heading variant="item" level={2}>
          {task.title}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          {task.area && <Tag tone="blue">{task.area.name}</Tag>}
          {task.activity_type && (
            <Tag tone="green">{task.activity_type.name}</Tag>
          )}
          {task.due_date && (
            <Text variant="muted" className="text-sm">
              Fecha límite:{" "}
              {new Date(`${task.due_date}T00:00:00`).toLocaleDateString(
                "es-PE",
                { dateStyle: "long" },
              )}
            </Text>
          )}
        </div>
        {task.description && (
          <Text variant="muted" className="whitespace-pre-line">
            {task.description}
          </Text>
        )}
      </div>

      <div className="mt-10">
        {view ? (
          <SubmissionSummary submission={view} />
        ) : (
          <>
            {latest?.status === "rejected" && (
              <div
                role="status"
                className="mb-8 grid max-w-2xl gap-1 rounded-lg border-2 border-orange bg-orange-soft p-5"
              >
                <p className="font-extrabold text-orange-ink">
                  Tu entrega fue rechazada
                </p>
                <p className="whitespace-pre-line">
                  {latest.review_comment || "El director no dejó comentarios."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Corrige lo que haga falta y vuelve a enviarla con tus
                  evidencias.
                </p>
              </div>
            )}
            <ReportForm
              taskId={id}
              userId={user.id}
              defaults={
                latest?.status === "rejected"
                  ? {
                      reportedHours: latest.reported_hours,
                      workDate: latest.work_date,
                      notes: latest.notes,
                    }
                  : undefined
              }
            />
          </>
        )}
      </div>
    </section>
  );
}
