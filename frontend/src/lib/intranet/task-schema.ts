import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInLima() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  });
}

/**
 * Datos del formulario de nueva tarea. Se usa en el formulario (resolver) y
 * se vuelve a validar en la Server Action.
 */
export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Escribe un título de al menos 3 caracteres.")
    .max(120, "El título puede tener hasta 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(1000, "La descripción puede tener hasta 1000 caracteres."),
  areaId: z.uuid("Elige un área."),
  activityTypeId: z.uuid("Elige el tipo de actividad."),
  dueDate: z
    .string()
    .refine((value) => value === "" || ISO_DATE.test(value), "Fecha no válida.")
    .refine(
      (value) => value === "" || value >= todayInLima(),
      "La fecha límite no puede ser anterior a hoy.",
    ),
  assigneeIds: z
    .array(z.uuid())
    .min(1, "Elige al menos un voluntario para la tarea."),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

export type CreateTaskResult = { ok: true } | { ok: false; error: string };
