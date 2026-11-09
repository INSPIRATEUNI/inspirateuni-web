import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOC_TYPE_LABELS,
  ROLE_LABELS,
  TIER_LABELS,
} from "@/lib/open-day/constants";
import { formatGate, formatTime, formatTimeRange } from "@/lib/open-day/format";
import {
  fetchConfirmedRegistrations,
  fetchLogistics,
  fetchSessionRoster,
} from "./queries";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Exportaciones del día del evento. Todas cuentan solo inscripciones confirmadas. */
export const EXPORTS = {
  puertas: {
    title: "Lista por puerta",
    description:
      "Para seguridad de la UNI: quién entra por cada puerta, a qué hora y con qué código.",
  },
  sesiones: {
    title: "Lista por recorrido",
    description:
      "Para el guía de cada facultad: los grupos de cada recorrido con su contacto.",
  },
  logistica: {
    title: "Resumen de logística",
    description:
      "Buses, estacionamiento y demás pedidos, con su puerta y hora de llegada.",
  },
} as const;

export type ExportKind = keyof typeof EXPORTS;

export function isExportKind(value: unknown): value is ExportKind {
  return typeof value === "string" && value in EXPORTS;
}

export type ExportTable = {
  /** Grupo (puerta, recorrido u opción) con sus filas. */
  sections: { title: string; subtitle?: string; rows: string[][] }[];
  columns: string[];
};

export async function buildExport(
  supabase: SupabaseClient,
  eventId: string,
  kind: ExportKind,
): Promise<ExportTable> {
  if (kind === "puertas") {
    const registrations = await fetchConfirmedRegistrations(supabase, eventId);
    const byGate = new Map<string, typeof registrations>();
    for (const r of registrations) {
      const gate = r.gate ? formatGate(r.gate) : "Sin puerta";
      byGate.set(gate, [...(byGate.get(gate) ?? []), r]);
    }
    return {
      columns: [
        "Llegada",
        "Apellidos",
        "Nombres",
        "Documento",
        "Rol",
        "Código",
        "Inscripción",
        "Colegio o contacto",
      ],
      sections: [...byGate.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "es"))
        .map(([gate, regs]) => {
          const people = regs.reduce((sum, r) => sum + r.people.length, 0);
          return {
            title: gate,
            subtitle: `${plural(people, "persona", "personas")} · ${plural(regs.length, "inscripción", "inscripciones")}`,
            rows: regs.flatMap((r) =>
              r.people.map((p) => [
                r.arrivalAt ? formatTime(r.arrivalAt) : "",
                p.lastName,
                p.firstName,
                `${DOC_TYPE_LABELS[p.docType]} ${p.docNumber}`,
                ROLE_LABELS[p.role],
                p.accessCode ?? "",
                r.referenceCode,
                r.schoolName ?? r.contactName,
              ]),
            ),
          };
        }),
    };
  }

  if (kind === "sesiones") {
    const roster = await fetchSessionRoster(supabase, eventId);
    return {
      columns: [
        "Inscripción",
        "Colegio o contacto",
        "Visitantes",
        "Adultos",
        "Cupos",
        "Correo del contacto",
      ],
      sections: roster.map(({ session, groups }) => ({
        title: `${session.facultyName} · ${formatTimeRange(session.startsAt, session.endsAt)}`,
        subtitle: [
          TIER_LABELS[session.tier],
          session.meetingPoint && `Punto de encuentro: ${session.meetingPoint}`,
          `${groups.reduce((sum, g) => sum + g.seats, 0)} de ${session.capacity} cupos`,
        ]
          .filter(Boolean)
          .join(" · "),
        rows: groups.map((g) => [
          g.referenceCode,
          g.schoolName ? `${g.schoolName} (${g.contactName})` : g.contactName,
          String(g.visitors),
          String(g.adults),
          String(g.seats),
          g.contactEmail,
        ]),
      })),
    };
  }

  const rows = await fetchLogistics(supabase, eventId);
  const byOption = new Map<string, typeof rows>();
  for (const r of rows)
    byOption.set(r.optionLabel, [...(byOption.get(r.optionLabel) ?? []), r]);
  return {
    columns: [
      "Cantidad",
      "Inscripción",
      "Colegio o contacto",
      "Puerta",
      "Llegada",
      "Notas",
    ],
    sections: [...byOption.entries()].map(([label, items]) => ({
      title: label,
      subtitle: `Total: ${items.reduce((sum, r) => sum + r.quantity, 0)}`,
      rows: items.map((r) => [
        String(r.quantity),
        r.referenceCode,
        r.schoolName ?? r.contactName,
        r.gate ?? "",
        r.arrivalAt ? formatTime(r.arrivalAt) : "",
        r.notes ?? "",
      ]),
    })),
  };
}

/** Filas planas para el CSV: la columna del grupo va primero. */
export function exportToRows(kind: ExportKind, table: ExportTable): string[][] {
  const groupColumn =
    kind === "puertas"
      ? "Puerta"
      : kind === "sesiones"
        ? "Recorrido"
        : "Opción";
  return [
    [groupColumn, ...table.columns],
    ...table.sections.flatMap((section) =>
      section.rows.map((row) => [section.title, ...row]),
    ),
  ];
}
