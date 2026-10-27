"use server";

import { revalidatePath } from "next/cache";
import {
  type ReviewInput,
  type ReviewResult,
  reviewInputSchema,
  reviewIssues,
} from "@/lib/intranet/review-schema";
import { getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

const RLS_DENIED = "42501";
const CHECK_VIOLATION = "23514";

type SubmissionRow = {
  status: string;
  reported_hours: number | null;
  task_assignment: { position_assignment: { profile_id: string } };
};

/**
 * Aprueba o rechaza una entrega como el usuario de la sesión.
 */
export async function reviewSubmission(
  input: ReviewInput,
): Promise<ReviewResult> {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos de la revisión." };
  }
  const { submissionId, decision, approvedHours, comment } = parsed.data;

  const user = await getCurrentUser();
  if (!user?.isBoard) {
    return { ok: false, error: "Solo la directiva puede revisar entregas." };
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("task_submissions")
    .select(
      "status, reported_hours, task_assignment:task_assignments!inner(position_assignment:position_assignments!inner(profile_id))",
    )
    .eq("id", submissionId)
    .maybeSingle();
  const submission = data as unknown as SubmissionRow | null;
  if (!submission) {
    return {
      ok: false,
      error: "No encontramos la entrega o no es de tu área.",
    };
  }
  if (submission.status !== "submitted") {
    return { ok: false, error: "Esta entrega ya fue revisada." };
  }
  if (submission.task_assignment.position_assignment.profile_id === user.id) {
    return { ok: false, error: "No puedes revisar tu propia entrega." };
  }

  const issue = reviewIssues(
    { decision, approvedHours, comment },
    submission.reported_hours ?? 0,
  )[0];
  if (issue) return { ok: false, error: issue.message };

  const { data: updated, error } = await supabase
    .from("task_submissions")
    .update(
      decision === "approve"
        ? {
            status: "approved",
            approved_hours: approvedHours,
            review_comment: comment || null,
          }
        : { status: "rejected", review_comment: comment },
    )
    .eq("id", submissionId)
    .eq("status", "submitted")
    .select("id");

  if (error) {
    return {
      ok: false,
      error:
        error.code === RLS_DENIED
          ? "No tienes permiso para revisar esta entrega."
          : error.code === CHECK_VIOLATION
            ? "Esta entrega ya fue revisada."
            : "No pudimos guardar la revisión. Inténtalo de nuevo.",
    };
  }
  if (!updated?.length) {
    return { ok: false, error: "Esta entrega ya fue revisada." };
  }

  revalidatePath("/intranet/revision");
  return { ok: true };
}
