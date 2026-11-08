const TIME_ZONE = "America/Lima";

/** Fecha de hoy en Lima, en formato ISO (aaaa-mm-dd). */
export function todayInLima() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** "sábado 14 de noviembre" (para fechas `date` sin hora). */
export function formatEventDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "10:30" en hora de Lima. */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  });
}

/** "lun 9 nov, 18:00" en hora de Lima. */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  });
}

export function formatTimeRange(startsAt: string, endsAt: string) {
  return `${formatTime(startsAt)} a ${formatTime(endsAt)}`;
}

/** Edad cumplida en una fecha (ambas en ISO aaaa-mm-dd), igual que `age()` en Postgres. */
export function ageOn(birthDate: string, onDate: string) {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

export function isMinorOn(birthDate: string, eventDate: string) {
  return ageOn(birthDate, eventDate) < 18;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
