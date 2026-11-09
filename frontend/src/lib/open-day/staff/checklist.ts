import { DOCUMENT_LABELS } from "@/lib/open-day/constants";
import type { DocumentKind } from "@/lib/open-day/types";

/**
 * Lista de verificación de cada documento. Confirmar exige todo marcado; lo que
 * falte arma el texto de la observación que recibe quien se inscribió.
 */
export type ChecklistItem = { id: string; label: string };

const readable = {
  id: "legible",
  label: "Se lee completo (no está cortado ni borroso)",
};
const template = { id: "plantilla", label: "Usa la plantilla vigente" };
const matches = {
  id: "datos",
  label: "Nombres y documentos coinciden con la inscripción",
};
const signed = { id: "firmas", label: "Tiene todas las firmas" };

export const CHECKLISTS: Record<DocumentKind, ChecklistItem[]> = {
  school_consolidated: [
    readable,
    { id: "personas", label: "Incluye a todas las personas de la lista" },
    matches,
    { id: "firmas", label: "Tiene las firmas y el sello del colegio" },
    template,
  ],
  consent: [readable, template, matches, signed],
  guardian_declaration: [
    readable,
    template,
    { id: "apoderado", label: "El apoderado y su documento están completos" },
    signed,
  ],
  commitment_letter: [readable, template, matches, signed],
};

export function checklistFor(kind: DocumentKind | "credentials") {
  return kind === "credentials" ? [] : CHECKLISTS[kind];
}

/** Texto de la observación a partir de lo que no pasó la revisión. */
export function composeObservation(
  failures: { kind: DocumentKind; missing: string[] }[],
  notes: string,
) {
  const lines = failures
    .filter((f) => f.missing.length > 0)
    .map(
      (f) =>
        `${DOCUMENT_LABELS[f.kind]}: revisa que ${f.missing
          .map((label) => label.charAt(0).toLowerCase() + label.slice(1))
          .join("; ")}.`,
    );
  const extra = notes.trim();
  return [...lines, extra].filter(Boolean).join("\n");
}
