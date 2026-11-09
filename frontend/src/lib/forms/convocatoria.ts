import { convocatoria } from "@/data/voluntariado";

export type ConvocatoriaStatus = "upcoming" | "open" | "closed";

/** Estado de la convocatoria de voluntariado. Las fechas ya traen la zona de Lima. */
export function convocatoriaStatus(now = Date.now()): ConvocatoriaStatus {
  if (now < Date.parse(convocatoria.start)) return "upcoming";
  if (now > Date.parse(convocatoria.end)) return "closed";
  return "open";
}

/** Año de la convocatoria, tomado de su fecha de inicio. */
export const convocatoriaYear = convocatoria.start.slice(0, 4);
