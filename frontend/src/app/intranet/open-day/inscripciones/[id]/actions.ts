"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type PersonValues,
  personSchema,
  toRpcPeople,
} from "@/lib/open-day/schemas";
import { fromLimaInput, limaDateTime } from "@/lib/open-day/staff/dates";
import {
  type ActionResult,
  fail,
  guardStaff,
  ok,
  staffError,
} from "@/lib/open-day/staff/guard";

/**
 * Validación y overrides de una inscripción. Cada action vuelve a comprobar el rol;
 * las RPC (`schemas/09_openday_rpc.sql`) lo comprueban otra vez y dejan la bitácora.
 */

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const reason = z
  .string()
  .trim()
  .min(5, "Escribe el motivo (mínimo 5 caracteres).")
  .max(500);

function refresh(registrationId: string) {
  revalidatePath(`/intranet/open-day/inscripciones/${registrationId}`);
  revalidatePath("/intranet/open-day/inscripciones");
  revalidatePath("/intranet/open-day");
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisa los datos.";
}

const confirmSchema = z.object({
  registrationId: z.guid(),
  gate: z.string().trim().min(1, "Indica la puerta.").max(60),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/, "Indica la hora de llegada."),
});

export async function confirmRegistration(
  input: z.input<typeof confirmSchema>,
): Promise<ActionResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const guard = await guardStaff("board");
  if (!guard.ok) return guard;
  const { registrationId, gate, arrivalTime } = parsed.data;

  const { data: reg } = await guard.supabase
    .from("event_registrations")
    .select("event:events(event_date)")
    .eq("id", registrationId)
    .maybeSingle<{ event: { event_date: string } | null }>();
  if (!reg?.event) return fail("No encontramos la inscripción.");

  const { error } = await guard.supabase.rpc("confirm_registration", {
    p_registration_id: registrationId,
    p_gate: gate,
    p_arrival_at: limaDateTime(reg.event.event_date, arrivalTime),
  });
  if (error) return fail(staffError(error));
  refresh(registrationId);
  return ok(null);
}

const observeSchema = z.object({
  registrationId: z.guid(),
  documentIds: z
    .array(z.guid())
    .min(1, "Marca al menos un documento a observar."),
  observation: z
    .string()
    .trim()
    .min(10, "Explica qué deben corregir (mínimo 10 caracteres).")
    .max(2000),
  deadline: z.string().regex(LOCAL_DATETIME, "Indica el nuevo plazo."),
});

export async function observeDocuments(
  input: z.input<typeof observeSchema>,
): Promise<ActionResult> {
  const parsed = observeSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const guard = await guardStaff("board");
  if (!guard.ok) return guard;
  const { registrationId, documentIds, observation, deadline } = parsed.data;

  const { error } = await guard.supabase.rpc("observe_documents", {
    p_registration_id: registrationId,
    p_observation: observation,
    p_deadline: fromLimaInput(deadline),
    p_document_ids: documentIds,
  });
  if (error) return fail(staffError(error));
  refresh(registrationId);
  return ok(null);
}

// Overrides de admin -----------------------------------------------------------------------------

const reopenSchema = z.object({
  registrationId: z.guid(),
  reason,
  deadline: z.union([z.literal(""), z.string().regex(LOCAL_DATETIME)]),
});

export async function reopenRegistration(
  input: z.input<typeof reopenSchema>,
): Promise<ActionResult> {
  const parsed = reopenSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;
  const { registrationId, deadline } = parsed.data;

  const { error } = await guard.supabase.rpc("admin_reopen_registration", {
    p_registration_id: registrationId,
    p_reason: parsed.data.reason,
    p_docs_deadline: deadline ? fromLimaInput(deadline) : null,
  });
  if (error) return fail(staffError(error));
  refresh(registrationId);
  return ok(null);
}

const limitsSchema = z.object({
  registrationId: z.guid(),
  expectedVisitors: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 visitante.")
    .max(500),
  reason,
  raiseCapacity: z.boolean(),
});

export async function overrideLimits(
  input: z.input<typeof limitsSchema>,
): Promise<ActionResult> {
  const parsed = limitsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;
  const { registrationId, expectedVisitors, raiseCapacity } = parsed.data;

  const { error } = await guard.supabase.rpc("admin_override_limits", {
    p_registration_id: registrationId,
    p_expected_visitors: expectedVisitors,
    p_reason: parsed.data.reason,
    p_raise_capacity: raiseCapacity,
  });
  // El texto de la BD nombra el parámetro de la RPC; aquí se explica con la opción del formulario
  if (error?.hint === "no_capacity") {
    return fail(
      "Algún recorrido no tiene cupo suficiente. Marca «Subir el cupo de los recorridos» para ampliarlo.",
    );
  }
  if (error) return fail(staffError(error));
  refresh(registrationId);
  return ok(null);
}

const cancelSchema = z.object({ registrationId: z.guid(), reason });

export async function cancelRegistration(
  input: z.input<typeof cancelSchema>,
): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const guard = await guardStaff("admin");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.rpc("admin_cancel_registration", {
    p_registration_id: parsed.data.registrationId,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(staffError(error));
  refresh(parsed.data.registrationId);
  return ok(null);
}

/** Override de la lista de personas; responde con la forma que espera `PeopleEditor`. */
export async function setAttendeesAsAdmin(input: {
  registrationId: string;
  people: PersonValues[];
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  const parsed = z
    .object({
      registrationId: z.guid(),
      people: z.array(personSchema).min(1),
      reason,
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { message: firstIssue(parsed.error) } };
  const guard = await guardStaff("admin");
  if (!guard.ok) return { ok: false, error: { message: guard.error } };

  const { data, error } = await guard.supabase.rpc("admin_set_attendees", {
    p_registration_id: parsed.data.registrationId,
    p_people: toRpcPeople(parsed.data.people),
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: { message: staffError(error) } };
  const result = data as { ok: boolean; message?: string } | null;
  if (!result?.ok) {
    return {
      ok: false,
      error: {
        message:
          result?.message ?? "Una de las personas ya está en otra inscripción.",
      },
    };
  }
  refresh(parsed.data.registrationId);
  return { ok: true };
}
