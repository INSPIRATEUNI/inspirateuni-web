import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInLima } from "@/lib/open-day/format";

export type StaffEventOption = { id: string; name: string; eventDate: string };

/**
 * Evento con el que trabaja el backoffice: el de `?evento=` o, si no hay,
 * el próximo (o el último si ya pasaron todos).
 */
export async function resolveStaffEvent(
  supabase: SupabaseClient,
  param: string | string[] | undefined,
) {
  const { data } = await supabase
    .from("events")
    .select("id, name, event_date")
    .order("event_date", { ascending: true });
  const events: StaffEventOption[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    eventDate: row.event_date,
  }));
  const today = todayInLima();
  const wanted = typeof param === "string" ? param : undefined;
  const selected =
    events.find((event) => event.id === wanted) ??
    events.find((event) => event.eventDate >= today) ??
    events.at(-1) ??
    null;
  return { events, selected };
}

/** Agrega `?evento=` a un enlace del backoffice. */
export function withEvent(href: string, eventId: string | undefined) {
  if (!eventId) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}evento=${eventId}`;
}
