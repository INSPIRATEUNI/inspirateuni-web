import { z } from "zod";

export type ReviewDecision = "approve" | "reject";

type ReviewIssue = { field: "approvedHours" | "comment"; message: string };

type ReviewValues = {
  decision: ReviewDecision;
  approvedHours: number;
  comment: string;
};

/** Reglas que dependen de la decisión y de las horas que reportó el voluntario. */
export function reviewIssues(
  values: ReviewValues,
  reportedHours: number,
): ReviewIssue[] {
  if (values.decision === "reject") {
    return values.comment.trim().length < 3
      ? [
          {
            field: "comment",
            message: "Explica por qué la rechazas para que pueda corregirla.",
          },
        ]
      : [];
  }

  const hours = values.approvedHours;
  if (Number.isNaN(hours)) {
    return [
      { field: "approvedHours", message: "Escribe las horas a aprobar." },
    ];
  }
  if (hours <= 0) {
    return [
      { field: "approvedHours", message: "Las horas deben ser mayores que 0." },
    ];
  }
  if (hours > reportedHours) {
    return [
      {
        field: "approvedHours",
        message: `No puedes aprobar más de lo reportado (${reportedHours} h).`,
      },
    ];
  }
  if (Math.abs(hours * 100 - Math.round(hours * 100)) > 1e-6) {
    return [{ field: "approvedHours", message: "Usa hasta 2 decimales." }];
  }
  return [];
}

const reviewBase = z.object({
  decision: z.enum(["approve", "reject"]),
  // Vacío en el formulario llega como NaN
  approvedHours: z.union([z.number(), z.nan()]),
  comment: z
    .string()
    .trim()
    .max(1000, "El comentario puede tener hasta 1000 caracteres."),
});

/** Formulario de una tarjeta: depende de las horas reportadas de esa entrega. */
export function reviewFormSchema(reportedHours: number) {
  return reviewBase.superRefine((values, ctx) => {
    for (const issue of reviewIssues(values, reportedHours)) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: [issue.field],
      });
    }
  });
}

export type ReviewFormValues = z.infer<typeof reviewBase>;

/** Server Action: los mismos campos más la entrega que se revisa. */
export const reviewInputSchema = reviewBase.extend({
  submissionId: z.uuid(),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export type ReviewResult = { ok: true } | { ok: false; error: string };
