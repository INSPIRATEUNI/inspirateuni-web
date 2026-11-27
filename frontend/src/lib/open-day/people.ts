import { isMinorOn } from "./format";
import type { Registration } from "./types";

/** Si alguien de la inscripción es menor de edad el día del evento. */
export function includesMinors(registration: Registration, eventDate: string) {
  return registration.attendees.some(
    (a) => a.birthDate && isMinorOn(a.birthDate, eventDate),
  );
}

/** Tutores de un colegio: los de la lista y el representante si asiste. */
export function tutorCount(registration: Registration) {
  return (
    registration.attendees.filter((a) => a.role === "chaperone").length +
    (registration.representativeAttends ? 1 : 0)
  );
}

/**
 * Si ya se puede pasar del paso de personas. Colegios: representante y al menos un
 * tutor (los escolares no se registran). Personas libres: todos los visitantes.
 */
export function peopleComplete(registration: Registration) {
  if (registration.kind === "school") {
    return Boolean(
      registration.representativeRole &&
        registration.representativeDocNumber &&
        tutorCount(registration) >= 1,
    );
  }
  return (
    registration.attendees.filter((a) => a.role === "visitor").length ===
    registration.expectedVisitors
  );
}
