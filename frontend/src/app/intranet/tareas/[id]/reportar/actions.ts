"use server";

import {
  type ReportInput,
  reportSchema,
  type SubmitReportResult,
} from "@/lib/intranet/report-schema";
import { getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

const RLS_DENIED = "42501";

type AssignmentRow = { id: string };
type SubmissionRow = { id: string; status: string };

/**
 * Registra el reporte de horas del voluntario como el usuario de la sesión
 *
 * Una entrega no se puede borrar ni, una vez revisada, modificar. Por eso se
 * crea primero como `assigned`, se agregan las evidencias y solo entonces pasa
 * a `submitted`: si algo falla queda un borrador reutilizable, no una entrega
 * a medias. Reenviar una entrega rechazada crea una fila nueva.
 */
export async function submitReport(
  input: ReportInput,
): Promise<SubmitReportResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del reporte." };
  }
  const { taskId, reportedHours, workDate, notes, evidences } = parsed.data;

  const user = await getCurrentUser();
  if (!user)
    return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };

  // Los archivos deben estar en la carpeta del propio usuario.
  if (!evidences.every((file) => file.path.startsWith(`${user.id}/`))) {
    return { ok: false, error: "Alguna evidencia no es válida." };
  }

  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("task_assignments")
    .select("id, position_assignment:position_assignments!inner(profile_id)")
    .eq("task_id", taskId)
    .eq("position_assignment.profile_id", user.id)
    .limit(1);
  const assignment = (assignments as AssignmentRow[] | null)?.[0];
  if (!assignment) {
    return { ok: false, error: "Esta tarea no está asignada a ti." };
  }

  const { data: existing } = await supabase
    .from("task_submissions")
    .select("id, status")
    .eq("task_assignment_id", assignment.id)
    .order("created_at", { ascending: false });
  const submissions = (existing ?? []) as SubmissionRow[];

  if (submissions.some((row) => row.status === "submitted")) {
    return { ok: false, error: "Esta tarea ya tiene una entrega en revisión." };
  }
  if (submissions.some((row) => row.status === "approved")) {
    return { ok: false, error: "Esta tarea ya fue aprobada." };
  }

  let submissionId = submissions.find((row) => row.status === "assigned")?.id;
  if (!submissionId) {
    const { data: draft, error: draftError } = await supabase
      .from("task_submissions")
      .insert({ task_assignment_id: assignment.id, status: "assigned" })
      .select("id")
      .single();
    if (draftError || !draft) {
      return {
        ok: false,
        error:
          draftError?.code === RLS_DENIED
            ? "No tienes permiso para reportar esta tarea."
            : "No pudimos iniciar tu reporte. Inténtalo de nuevo.",
      };
    }
    submissionId = draft.id as string;
  }

  const removeEvidenceRows = () =>
    supabase
      .from("submission_evidences")
      .delete()
      .eq("submission_id", submissionId)
      .in(
        "drive_file_id",
        evidences.map((file) => file.path),
      );

  const { error: evidenceError } = await supabase
    .from("submission_evidences")
    .insert(
      evidences.map((file) => ({
        submission_id: submissionId,
        drive_file_id: file.path,
        file_name: file.name,
        mime_type: file.mimeType,
        size_bytes: file.size,
      })),
    );
  if (evidenceError) {
    await removeEvidenceRows();
    return {
      ok: false,
      error: "No pudimos registrar tus evidencias. Inténtalo de nuevo.",
    };
  }

  const { error: submitError } = await supabase
    .from("task_submissions")
    .update({
      status: "submitted",
      reported_hours: reportedHours,
      work_date: workDate,
      notes: notes || null,
    })
    .eq("id", submissionId);
  if (submitError) {
    await removeEvidenceRows();
    return {
      ok: false,
      error:
        submitError.code === RLS_DENIED
          ? "No tienes permiso para enviar este reporte."
          : "No pudimos enviar tu reporte. Inténtalo de nuevo.",
    };
  }

  return { ok: true };
}
