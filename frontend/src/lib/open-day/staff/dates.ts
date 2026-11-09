/**
 * Fechas del backoffice en hora de Lima (UTC-5 todo el año, sin horario de verano).
 * Los inputs `datetime-local` y `time` trabajan sin zona; aquí se convierten.
 */

const LIMA_OFFSET = "-05:00";

/** "2026-11-20T09:30" (hora de Lima) para un input `datetime-local`. */
export function toLimaInput(iso: string | null | undefined) {
  if (!iso) return "";
  const lima = new Date(Date.parse(iso) - 5 * 60 * 60 * 1000);
  return lima.toISOString().slice(0, 16);
}

/** Valor de un `datetime-local` (hora de Lima) a ISO con zona. */
export function fromLimaInput(value: string) {
  return `${value}:00${LIMA_OFFSET}`;
}

/** Fecha del evento + hora "HH:MM" de Lima a ISO con zona. */
export function limaDateTime(date: string, time: string) {
  return `${date}T${time}:00${LIMA_OFFSET}`;
}

/** "HH:MM" de Lima de un ISO, para un input `time`. */
export function toLimaTime(iso: string | null | undefined) {
  return toLimaInput(iso).slice(11, 16);
}
