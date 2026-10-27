import { z } from "zod";
import {
  EVIDENCE_TYPES,
  evidenceFileError,
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_FILES,
} from "./evidence";
import { todayInLima } from "./task-schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Campos del reporte; iguales en el formulario y en la Server Action. */
const reportFields = z.object({
  reportedHours: z
    .number({ error: "Escribe las horas que dedicaste." })
    .positive("Las horas deben ser mayores que 0.")
    .max(200, "Las horas no pueden pasar de 200.")
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
      "Usa hasta 2 decimales.",
    ),
  workDate: z
    .string()
    .refine((value) => ISO_DATE.test(value), "Elige la fecha del trabajo.")
    .refine(
      (value) => value <= todayInLima(),
      "La fecha no puede ser posterior a hoy.",
    ),
  notes: z
    .string()
    .trim()
    .max(1000, "Las notas pueden tener hasta 1000 caracteres."),
});

/** Formulario: las evidencias son los archivos elegidos, aún sin subir. */
export const reportFormSchema = reportFields.extend({
  files: z
    .array(z.custom<File>((value) => value instanceof File))
    .min(1, "Adjunta al menos una evidencia.")
    .max(MAX_EVIDENCE_FILES, `Máximo ${MAX_EVIDENCE_FILES} archivos.`)
    .superRefine((files, ctx) => {
      files.forEach((file, index) => {
        const message = evidenceFileError(file);
        if (message) ctx.addIssue({ code: "custom", message, path: [index] });
      });
    }),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;

/** Servidor: las evidencias ya están en Storage y llegan como metadatos. */
export const reportSchema = reportFields.extend({
  taskId: z.uuid(),
  evidences: z
    .array(
      z.object({
        path: z.string().min(1),
        name: z.string().min(1).max(200),
        mimeType: z.enum(EVIDENCE_TYPES),
        size: z.number().int().positive().max(MAX_EVIDENCE_BYTES),
      }),
    )
    .min(1)
    .max(MAX_EVIDENCE_FILES),
});

export type ReportInput = z.infer<typeof reportSchema>;

export type SubmitReportResult = { ok: true } | { ok: false; error: string };
