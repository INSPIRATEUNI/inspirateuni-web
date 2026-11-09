"use server";

import {
  type AntispamMeta,
  type FormResult,
  optionLabel,
  type VisitValues,
  visitSchema,
  visitShifts,
} from "@/lib/forms/schemas";
import { submitForm } from "@/lib/forms/submit";

const modeLabels: Record<string, string> = {
  uni: "En la UNI",
  colegio: "En el colegio",
};

/** Solicitud de visita guiada (a la UNI o al colegio). */
export async function submitVisit(
  values: VisitValues,
  meta: AntispamMeta,
): Promise<FormResult> {
  return submitForm({
    action: "guided_visit",
    schema: visitSchema,
    values,
    meta,
    toData: (form) => ({
      school: form.school,
      district: form.district,
      students: form.students,
      mode: modeLabels[form.mode] ?? form.mode,
      date: form.date,
      shift: optionLabel(visitShifts, form.shift),
      name: form.name,
      email: form.email,
      phone: form.phone,
    }),
  });
}
