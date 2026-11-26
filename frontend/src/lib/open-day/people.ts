import type { OpenDayEvent, Registration } from "./types";

/** Si la lista guardada tiene todos los visitantes y, en colegios, los acompañantes mínimos. */
export function peopleComplete(
  event: OpenDayEvent,
  registration: Registration,
) {
  const visitors = registration.attendees.filter(
    (a) => a.role === "visitor",
  ).length;
  if (visitors !== registration.expectedVisitors) return false;
  if (registration.kind === "school") {
    const chaperones = registration.attendees.filter(
      (a) => a.role === "chaperone",
    ).length;
    return chaperones >= Math.ceil(visitors / event.studentsPerChaperone);
  }
  return true;
}
