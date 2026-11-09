"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type ActionResult,
  fail,
  guardStaff,
  ok,
  staffError,
} from "@/lib/open-day/staff/guard";

/** Fila de la vista previa de `import_tour_sessions` (`schemas/07_events.sql`). */
export type ImportRow = {
  line: number;
  action: "insert" | "update" | "unchanged" | "error";
  faculty: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  meetingPoint: string | null;
  message: string | null;
};

type DbImportRow = {
  line: number;
  action: ImportRow["action"];
  faculty: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  meeting_point: string | null;
  message: string | null;
};

const importSchema = z.object({
  eventId: z.guid(),
  csv: z
    .string()
    .trim()
    .min(1, "Pega o sube el CSV.")
    .max(200_000, "El CSV es demasiado grande."),
});

function refresh() {
  revalidatePath("/intranet/open-day/horarios");
  revalidatePath("/intranet/open-day");
}

async function runImport(
  input: z.input<typeof importSchema>,
  apply: boolean,
): Promise<ActionResult<ImportRow[]>> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Revisa el CSV.");
  const guard = await guardStaff("board");
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase.rpc("import_tour_sessions", {
    p_event_id: parsed.data.eventId,
    p_csv: parsed.data.csv,
    p_apply: apply,
  });
  if (error) return fail(staffError(error, "No pudimos leer el CSV."));
  if (apply) refresh();
  return ok(
    ((data ?? []) as DbImportRow[]).map((row) => ({
      line: row.line,
      action: row.action,
      faculty: row.faculty,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      capacity: row.capacity,
      meetingPoint: row.meeting_point,
      message: row.message,
    })),
  );
}

/** Vista previa: no escribe nada. */
export async function previewImport(input: z.input<typeof importSchema>) {
  return runImport(input, false);
}

/** Aplica el CSV completo (todo o nada; la BD rechaza si alguna fila tiene error). */
export async function applyImport(input: z.input<typeof importSchema>) {
  return runImport(input, true);
}

const statusSchema = z.object({
  sessionId: z.guid(),
  status: z.enum(["open", "closed", "cancelled"]),
});

/**
 * Abre, cierra o cancela un recorrido (solo admin). Cancelar dispara el trigger
 * `tour_sessions_cancelled`: libera cupos, pasa las inscripciones a reasignación y avisa.
 */
export async function setSessionStatus(
  input: z.input<typeof statusSchema>,
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail("Estado no válido.");
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase
    .from("tour_sessions")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.sessionId)
    .select("id");
  if (error) return fail(staffError(error));
  if (!data?.length) return fail("No encontramos el recorrido.");
  refresh();
  return ok(null);
}
