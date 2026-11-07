import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  fetchEvent,
  fetchLogisticsOptions,
  fetchUpcomingEvent,
  isRegistrationOpen,
} from "./data";
import { todayInLima } from "./format";
import type { OpenDayEvent } from "./types";

/** Próximo Open Day, leído una vez por petición (layout y página lo comparten). */
export const getUpcomingEvent = cache(async () => {
  const supabase = await createClient();
  return fetchUpcomingEvent(supabase, todayInLima());
});

export const getLogisticsOptions = cache(async () => {
  const supabase = await createClient();
  return fetchLogisticsOptions(supabase);
});

/**
 * Evento para el asistente. Con `?id=` se usa el evento de esa inscripción
 * (RLS: solo si es del usuario), que se puede continuar aunque la inscripción
 * de nuevos ya haya cerrado; sin id, el próximo evento si está abierto.
 */
export async function getWizardEvent(
  registrationId: string | null,
): Promise<{ event: OpenDayEvent | null; available: boolean }> {
  if (registrationId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_registrations")
      .select("event_id")
      .eq("id", registrationId)
      .maybeSingle();
    if (data) {
      const event = await fetchEvent(supabase, data.event_id);
      return { event, available: Boolean(event) };
    }
  }
  const event = await getUpcomingEvent();
  // Sin sesión todavía no se puede leer la inscripción: el asistente pide el OTP primero
  return {
    event,
    available: Boolean(event && (registrationId || isRegistrationOpen(event))),
  };
}

/** Id del usuario de la sesión (OTP o intranet), validado en el servidor. */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? "" };
});
