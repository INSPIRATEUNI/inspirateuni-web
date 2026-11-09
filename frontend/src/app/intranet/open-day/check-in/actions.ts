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
import type { AttendeeRole, RegistrationStatus } from "@/lib/open-day/types";

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

/** Respuesta de `check_in_pass` (`schemas/10_rls_openday.sql`). */
export type CheckInResult =
  | {
      ok: true;
      already: boolean;
      checkedInAt: string;
      participant: string;
      role: AttendeeRole | null;
      referenceCode: string | null;
      school: string | null;
      gate: string | null;
      arrivalAt: string | null;
    }
  | {
      ok: false;
      reason: "not_found" | "not_confirmed";
      participant: string | null;
      referenceCode: string | null;
      registrationStatus: RegistrationStatus | null;
    };

type DbCheckIn = {
  ok: boolean;
  error?: "not_found" | "not_confirmed";
  already?: boolean;
  checked_in_at?: string;
  participant?: string;
  attendee_role?: AttendeeRole;
  reference_code?: string;
  registration_status?: RegistrationStatus;
  school?: string | null;
  gate?: string | null;
  arrival_at?: string | null;
};

export async function checkIn(input: {
  accessCode: string;
}): Promise<ActionResult<CheckInResult>> {
  const parsed = z
    .object({ accessCode: z.string().trim().min(4).max(20) })
    .safeParse(input);
  if (!parsed.success) return fail("Código no válido.");
  const guard = await guardStaff("board");
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase.rpc("check_in_pass", {
    p_access_code: parsed.data.accessCode,
  });
  if (error) return fail(staffError(error, "No pudimos registrar el ingreso."));
  const row = data as DbCheckIn;
  revalidatePath("/intranet/open-day");

  if (!row.ok) {
    return ok({
      ok: false,
      reason: row.error ?? "not_found",
      participant: row.participant ?? null,
      referenceCode: row.reference_code ?? null,
      registrationStatus: row.registration_status ?? null,
    });
  }
  return ok({
    ok: true,
    already: Boolean(row.already),
    checkedInAt: row.checked_in_at ?? new Date().toISOString(),
    participant: row.participant ?? "",
    role: row.attendee_role ?? null,
    referenceCode: row.reference_code ?? null,
    school: row.school ?? null,
    gate: row.gate ?? null,
    arrivalAt: row.arrival_at ?? null,
  });
}
