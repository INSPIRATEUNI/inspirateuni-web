import { createClient } from "@/lib/supabase/client";
import { type OpenDayError, toOpenDayError } from "./errors";
import type { PersonValues } from "./schemas";
import { toRpcPeople } from "./schemas";
import type { RegistrationKind } from "./types";

/**
 * Llamadas del navegador a las RPC del dueño (`schemas/09_openday_rpc.sql`).
 * Todas exigen una sesión (OTP de Supabase Auth) y validan en la base de datos;
 * aquí solo se tipan y se traducen los errores.
 */
export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OpenDayError };

async function call<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const { data, error } = await createClient().rpc(fn, args);
  if (error) return { ok: false, error: toOpenDayError(error) };
  return { ok: true, data: data as T };
}

export type SchoolMatch = {
  id: string;
  name: string;
  district: string | null;
  ugel: string | null;
};

export function searchSchools(query: string) {
  return call<SchoolMatch[]>("search_schools", { p_query: query, p_limit: 8 });
}

export function ensureSchool(input: {
  name: string;
  district: string;
  ugel: string;
}) {
  return call<string>("ensure_school", {
    p_name: input.name,
    p_district: input.district || null,
    p_ugel: input.ugel || null,
  });
}

export function startRegistration(input: {
  eventId: string;
  kind: RegistrationKind;
  schoolId: string | null;
  expectedVisitors: number;
  contactName: string;
  contactEmail: string;
}) {
  return call<{ id: string; reference_code: string }>("start_registration", {
    p_event_id: input.eventId,
    p_kind: input.kind,
    p_school_id: input.schoolId,
    p_expected_visitors: input.expectedVisitors,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
  });
}

/** Retiene cupo en una sesión; devuelve cuándo vence la retención (reloj del servidor). */
export function holdTour(registrationId: string, sessionId: string) {
  return call<string>("hold_tour", {
    p_registration_id: registrationId,
    p_session_id: sessionId,
  });
}

export function releaseTour(registrationId: string, sessionId: string) {
  return call<null>("release_tour", {
    p_registration_id: registrationId,
    p_session_id: sessionId,
  });
}

export function renewHold(registrationId: string) {
  return call<string>("renew_hold", { p_registration_id: registrationId });
}

/** Bloquea la selección; devuelve el plazo para completar personas y documentos. */
export function confirmSelection(registrationId: string) {
  return call<string>("confirm_selection", {
    p_registration_id: registrationId,
  });
}

type SetAttendeesResponse =
  | { ok: true; people: number; visitors: number }
  | { ok: false; error: string; message: string };

export async function setAttendees(
  registrationId: string,
  people: PersonValues[],
): Promise<RpcResult<{ people: number; visitors: number }>> {
  const result = await call<SetAttendeesResponse>("set_attendees", {
    p_registration_id: registrationId,
    p_people: toRpcPeople(people),
  });
  if (!result.ok) return result;
  if (!result.data.ok) {
    return {
      ok: false,
      error: { code: result.data.error, message: result.data.message },
    };
  }
  return {
    ok: true,
    data: { people: result.data.people, visitors: result.data.visitors },
  };
}

export function setLogistics(
  registrationId: string,
  items: { option_code: string; quantity: number; notes: string | null }[],
) {
  return call<null>("set_logistics", {
    p_registration_id: registrationId,
    p_items: items,
  });
}

export function submitRegistration(
  registrationId: string,
  termsVersion: string,
) {
  return call<null>("submit_registration", {
    p_registration_id: registrationId,
    p_terms_version: termsVersion,
  });
}

export function resubmitRegistration(registrationId: string) {
  return call<null>("resubmit_registration", {
    p_registration_id: registrationId,
  });
}
