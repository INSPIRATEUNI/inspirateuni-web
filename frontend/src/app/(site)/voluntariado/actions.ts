"use server";

import { areasDeApoyo } from "@/data/voluntariado";
import { convocatoriaStatus } from "@/lib/forms/convocatoria";
import {
  type AntispamMeta,
  type FormResult,
  optionLabel,
  type VolunteerValues,
  volunteerSchema,
} from "@/lib/forms/schemas";
import { submitForm } from "@/lib/forms/submit";

/** Postulación al voluntariado. Con la convocatoria cerrada queda como "avísame". */
export async function submitVolunteer(
  values: VolunteerValues,
  meta: AntispamMeta,
): Promise<FormResult> {
  return submitForm({
    action: "volunteer_application",
    schema: volunteerSchema,
    values,
    meta,
    toData: (form) => ({
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone,
      student_code: form.studentCode,
      faculty: form.faculty,
      cycle: form.cycle,
      area: optionLabel(areasDeApoyo, form.area),
      motivation: form.motivation,
      interest_only: convocatoriaStatus() !== "open",
    }),
  });
}
