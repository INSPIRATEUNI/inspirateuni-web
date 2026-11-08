import { TIERS } from "./constants";
import type { Tier, TourSession } from "./types";

/**
 * Reglas de recorridos replicadas en el cliente para avisar antes de llamar a
 * la RPC. La verdad la decide la base de datos (`hold_tour`, `confirm_selection`).
 */

/** Intervalo [inicio, fin + traslado) en milisegundos, como `tour_enrollments.time_range`. */
function range(session: TourSession, bufferMinutes: number) {
  return [
    Date.parse(session.startsAt),
    Date.parse(session.endsAt) + bufferMinutes * 60_000,
  ] as const;
}

export function overlaps(
  a: TourSession,
  b: TourSession,
  bufferMinutes: number,
) {
  const [aStart, aEnd] = range(a, bufferMinutes);
  const [bStart, bEnd] = range(b, bufferMinutes);
  return aStart < bEnd && bStart < aEnd;
}

/** Sesiones elegidas con las que `session` se cruza. */
export function findOverlaps(
  session: TourSession,
  chosen: TourSession[],
  bufferMinutes: number,
) {
  return chosen.filter(
    (other) =>
      other.sessionId !== session.sessionId &&
      overlaps(session, other, bufferMinutes),
  );
}

/** Abierta, con cupo para todo el grupo y sin cruce con lo ya elegido. */
export function isViable(
  session: TourSession,
  chosen: TourSession[],
  seatsNeeded: number,
  bufferMinutes: number,
) {
  return (
    session.status === "open" &&
    session.seatsRemaining >= seatsNeeded &&
    findOverlaps(session, chosen, bufferMinutes).length === 0
  );
}

export function groupByTier(sessions: TourSession[]) {
  const groups: Record<Tier, TourSession[]> = { high: [], mid: [], low: [] };
  for (const session of [...sessions].sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      a.facultyName.localeCompare(b.facultyName, "es"),
  )) {
    groups[session.tier].push(session);
  }
  return groups;
}

/** Niveles del evento (los que tienen al menos una sesión). */
export function eventTiers(sessions: TourSession[]) {
  return TIERS.filter((tier) => sessions.some((s) => s.tier === tier));
}

/**
 * Niveles sin elegir que todavía tienen una sesión viable. Es la regla maximal
 * de `confirm_selection`: mientras la lista no esté vacía no se puede confirmar.
 */
export function pendingTiers(
  sessions: TourSession[],
  chosen: TourSession[],
  seatsNeeded: number,
  bufferMinutes: number,
) {
  const chosenTiers = new Set(chosen.map((s) => s.tier));
  return eventTiers(sessions).filter(
    (tier) =>
      !chosenTiers.has(tier) &&
      sessions.some(
        (s) =>
          s.tier === tier && isViable(s, chosen, seatsNeeded, bufferMinutes),
      ),
  );
}

/**
 * Niveles que se quedarían sin ninguna opción viable si además se elige
 * `candidate` (y que hoy sí tienen alguna). Sirve para avisar, no para bloquear.
 */
export function tiersLeftWithoutOption(
  candidate: TourSession,
  sessions: TourSession[],
  chosen: TourSession[],
  seatsNeeded: number,
  bufferMinutes: number,
) {
  const before = pendingTiers(sessions, chosen, seatsNeeded, bufferMinutes);
  const after = new Set(
    pendingTiers(sessions, [...chosen, candidate], seatsNeeded, bufferMinutes),
  );
  return before.filter((tier) => tier !== candidate.tier && !after.has(tier));
}
