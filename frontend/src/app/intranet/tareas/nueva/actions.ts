"use server";

import {
  type CreateTaskResult,
  type TaskFormValues,
  taskSchema,
} from "@/lib/intranet/task-schema";
import { getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

const RLS_DENIED = "42501";

/**
 * Crea la tarea y sus asignaciones como el usuario de la sesión: RLS decide si
 * puede gestionar el área. No hay RPC, así que si falla la asignación se borra
 * la tarea recién creada para no dejarla huérfana.
 */
export async function createTask(
  values: TaskFormValues,
): Promise<CreateTaskResult> {
  const parsed = taskSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const { title, description, areaId, activityTypeId, dueDate, assigneeIds } =
    parsed.data;

  const user = await getCurrentUser();
  if (!user?.isBoard) {
    return { ok: false, error: "Solo la directiva puede crear tareas." };
  }

  const supabase = await createClient();

  // Los voluntarios deben pertenecer al área elegida (RLS no lo comprueba).
  const { count } = await supabase
    .from("position_assignments")
    .select("id", { count: "exact", head: true })
    .in("id", assigneeIds)
    .eq("area_id", areaId)
    .eq("status", "active");
  if (count !== assigneeIds.length) {
    return {
      ok: false,
      error: "Alguno de los voluntarios no pertenece al área elegida.",
    };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      area_id: areaId,
      activity_type_id: activityTypeId,
      title,
      description: description || null,
      due_date: dueDate || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (taskError || !task) {
    return {
      ok: false,
      error:
        taskError?.code === RLS_DENIED
          ? "No tienes permiso para crear tareas en esa área."
          : "No pudimos crear la tarea. Inténtalo de nuevo.",
    };
  }

  const { error: assignmentsError } = await supabase
    .from("task_assignments")
    .insert(
      assigneeIds.map((positionAssignmentId) => ({
        task_id: task.id,
        position_assignment_id: positionAssignmentId,
      })),
    );

  if (assignmentsError) {
    await supabase.from("tasks").delete().eq("id", task.id);
    return {
      ok: false,
      error:
        assignmentsError.code === RLS_DENIED
          ? "No tienes permiso para asignar tareas en esa área."
          : "No pudimos asignar la tarea a los voluntarios. Inténtalo de nuevo.",
    };
  }

  return { ok: true };
}
