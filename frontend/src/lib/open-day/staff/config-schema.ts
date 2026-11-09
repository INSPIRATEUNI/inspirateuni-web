import { z } from "zod";

/** Formulario de configuración del evento (columnas editables de `events`). Fechas en hora de Lima. */

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Indica fecha y hora.");
const optionalInt = z.union([z.literal(""), z.coerce.number().int().min(1)]);

export const eventConfigSchema = z
  .object({
    name: z.string().trim().min(3, "Escribe el nombre.").max(120),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha."),
    venue: z.string().trim().max(200),
    registrationOpen: z.boolean(),
    registrationOpensAt: localDateTime,
    registrationClosesAt: localDateTime,
    docsCloseAt: z.union([z.literal(""), localDateTime]),
    holdMinutes: z.coerce.number().int().min(5, "Mínimo 5.").max(240),
    reservationHours: z.coerce.number().int().min(1).max(240),
    maxFileMb: z.coerce.number().int().min(1).max(50, "Máximo 50 MB."),
    studentsPerChaperone: z.coerce.number().int().min(1).max(100),
    maxVisitorsPerRegistration: optionalInt,
    maxAdultsPerRegistration: optionalInt,
    maxDraftsPerEmail: z.coerce.number().int().min(1).max(20),
    travelBufferMinutes: z.coerce.number().int().min(0).max(120),
  })
  .superRefine((values, ctx) => {
    if (values.registrationClosesAt <= values.registrationOpensAt) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationClosesAt"],
        message: "Debe ser después de la apertura.",
      });
    }
    if (
      values.docsCloseAt &&
      values.docsCloseAt < values.registrationClosesAt
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["docsCloseAt"],
        message: "Debe ser igual o posterior al cierre de la inscripción.",
      });
    }
  });

export type EventConfigInput = z.input<typeof eventConfigSchema>;
export type EventConfigValues = z.output<typeof eventConfigSchema>;

/** Id de un archivo de Drive a partir de su enlace (o el id tal cual). */
export function driveFileIdFrom(value: string) {
  const text = value.trim();
  const match =
    text.match(/\/d\/([\w-]{10,})/) ??
    text.match(/[?&]id=([\w-]{10,})/) ??
    text.match(/^([\w-]{10,})$/);
  return match?.[1] ?? null;
}
