import "server-only";
import type { z } from "zod";
import { isBot, verifyHuman } from "./antispam";
import { type FormAction, postForm } from "./apps-script";
import { antispamSchema, type FormResult } from "./schemas";

const INVALID = "Revisa los datos del formulario.";

type SubmitOptions<S extends z.ZodType> = {
  action: FormAction;
  schema: S;
  /** Lo que mandó el navegador: no es confiable hasta validarlo. */
  values: unknown;
  meta: unknown;
  /** Arma `data` para Apps Script con los valores ya validados. */
  toData: (values: z.output<S>) => Record<string, unknown>;
};

/**
 * Flujo común de las Server Actions de los formularios públicos: valida, filtra
 * el spam y envía a Apps Script. Nunca lanza: devuelve un mensaje en español.
 */
export async function submitForm<S extends z.ZodType>({
  action,
  schema,
  values,
  meta,
  toData,
}: SubmitOptions<S>): Promise<FormResult> {
  try {
    const antispam = antispamSchema.safeParse(meta);
    if (!antispam.success) return { ok: false, error: INVALID };
    if (isBot(antispam.data)) return { ok: true };

    // Antes del captcha: su token sirve una sola vez
    const parsed = schema.safeParse(values);
    if (!parsed.success) return { ok: false, error: INVALID };

    const human = await verifyHuman(antispam.data);
    if (!human.ok) return human;

    return await postForm(
      action,
      toData(parsed.data),
      antispam.data.submissionId,
    );
  } catch (error) {
    console.error(`[forms] ${action}: error inesperado.`, error);
    return {
      ok: false,
      error: "No pudimos enviar tu solicitud. Inténtalo de nuevo.",
    };
  }
}
