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
import {
  type CheckInCandidate,
  searchPasses,
} from "@/lib/open-day/staff/queries";
import type {
  AttendeeRole,
  DocType,
  RegistrationStatus,
} from "@/lib/open-day/types";

export async function searchCheckIn(input: {
  eventId: string;
  query: string;
}): Promise<ActionResult<CheckInCandidate[]>> {
  const parsed = z
    .object({ eventId: z.guid(), query: z.string().trim().min(2).max(80) })
    .safeParse(input);
  if (!parsed.success) return fail("Escribe al menos 2 caracteres.");
  const guard = await guardStaff("board");
  if (!guard.ok) return guard;
  try {
    return ok(
      await searchPasses(
        guard.supabase,
        parsed.data.eventId,
        parsed.data.query,
      ),
    );
  } catch (error) {
    console.error("Búsqueda de check-in", error);
    return fail("No pudimos buscar. Inténtalo de nuevo.");
  }
}

/** Respuesta de `preview_pass` y `check_in_pass` (`schemas/10_rls_openday.sql`). */
export type PassInfo = {
  ok: boolean;
  error: "not_found" | "not_confirmed" | "docs_pending" | null;
  /** `group`: la ficha de un colegio; `person`: el pase de una persona libre. */
  kind: "group" | "person";
  participant: string;
  role: AttendeeRole | null;
  registrationId: string | null;
  registrationStatus: RegistrationStatus | null;
  referenceCode: string | null;
  school: string | null;
  gate: string | null;
  arrivalAt: string | null;
  students: number | null;
  tutors: { name: string; docType: DocType; docNumber: string }[];
  representativeAttends: boolean;
  docsPending: boolean;
  already: boolean;
  checkedInAt: string | null;
};

type DbPassInfo = {
  ok: boolean;
  error?: PassInfo["error"];
  pass_kind?: PassInfo["kind"];
  participant?: string;
  attendee_role?: AttendeeRole | null;
  registration_id?: string | null;
  registration_status?: RegistrationStatus | null;
  reference_code?: string | null;
  school?: string | null;
  gate?: string | null;
  arrival_at?: string | null;
  students?: number | null;
  tutors?: { name: string; doc_type: DocType; doc_number: string }[];
  representative_attends?: boolean;
  docs_pending?: boolean;
  already?: boolean;
  checked_in_at?: string | null;
};

function toPassInfo(row: DbPassInfo): PassInfo {
  return {
    ok: row.ok,
    error: row.error ?? null,
    kind: row.pass_kind ?? "person",
    participant: row.participant ?? "",
    role: row.attendee_role ?? null,
    registrationId: row.registration_id ?? null,
    registrationStatus: row.registration_status ?? null,
    referenceCode: row.reference_code ?? null,
    school: row.school ?? null,
    gate: row.gate ?? null,
    arrivalAt: row.arrival_at ?? null,
    students: row.students ?? null,
    tutors: (row.tutors ?? []).map((t) => ({
      name: t.name,
      docType: t.doc_type,
      docNumber: t.doc_number,
    })),
    representativeAttends: Boolean(row.representative_attends),
    docsPending: Boolean(row.docs_pending),
    already: Boolean(row.already),
    checkedInAt: row.checked_in_at ?? null,
  };
}

const accessCodeSchema = z.string().trim().min(4).max(20);

/** Lo que se ve al escanear; no registra nada. */
export async function previewPass(input: {
  accessCode: string;
}): Promise<ActionResult<PassInfo>> {
  const parsed = z.object({ accessCode: accessCodeSchema }).safeParse(input);
  if (!parsed.success) return fail("Código no válido.");
  const guard = await guardStaff("board");
  if (!guard.ok) return guard;
  const { data, error } = await guard.supabase.rpc("preview_pass", {
    p_access_code: parsed.data.accessCode,
  });
  if (error) return fail(staffError(error, "No pudimos leer el código."));
  return ok(toPassInfo(data as DbPassInfo));
}

/** Registra el ingreso. Sin documentos en físico exige `overrideReason`. */
export async function checkIn(input: {
  accessCode: string;
  overrideReason?: string;
}): Promise<ActionResult<PassInfo>> {
  const parsed = z
    .object({
      accessCode: accessCodeSchema,
      overrideReason: z.string().trim().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail("Código no válido.");
  const guard = await guardStaff("board");
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase.rpc("check_in_pass", {
    p_access_code: parsed.data.accessCode,
    p_override_reason: parsed.data.overrideReason || null,
  });
  if (error) return fail(staffError(error, "No pudimos registrar el ingreso."));
  revalidatePath("/intranet/open-day");
  return ok(toPassInfo(data as DbPassInfo));
}
