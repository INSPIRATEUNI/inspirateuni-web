"use server";

import {
  type AntispamMeta,
  type FormResult,
  type IgirlValues,
  igirlInterests,
  igirlSchema,
  optionLabel,
} from "@/lib/forms/schemas";
import { submitForm } from "@/lib/forms/submit";

/** Interés en participar en Inspírate Girl. */
export async function submitIgirl(
  values: IgirlValues,
  meta: AntispamMeta,
): Promise<FormResult> {
  return submitForm({
    action: "igirl_interest",
    schema: igirlSchema,
    values,
    meta,
    toData: (form) => ({
      interest: optionLabel(igirlInterests, form.interest),
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone,
      institution: form.institution,
      grade: form.grade,
      message: form.message,
    }),
  });
}
