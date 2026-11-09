import "server-only";
import { contact } from "@/components/site/navigation";
import type { FormResult } from "./schemas";

export type FormAction =
  | "volunteer_application"
  | "igirl_interest"
  | "guided_visit";

type AppsScriptResponse = { ok?: boolean; error?: string; permanent?: boolean };

const NOT_CONFIGURED = `El formulario aún no está configurado. Escríbenos a ${contact.email}.`;
const UNAVAILABLE = `No pudimos enviar tu solicitud. Inténtalo de nuevo en unos minutos o escríbenos a ${contact.email}.`;
const REJECTED = `No pudimos registrar tu solicitud. Escríbenos a ${contact.email}.`;
const TIMEOUT =
  "El envío tardó demasiado. Inténtalo de nuevo: si ya te llegó el correo de confirmación, no hace falta.";

/**
 * Envía un formulario a la web app de Apps Script (backend/apps-script/forms),
 * que lo guarda en la hoja y manda los correos. Solo corre en el servidor: el
 * secreto nunca llega al navegador. No lanza errores.
 *
 * Apps Script responde con un 302 a googleusercontent.com: seguirlo es lo correcto.
 */
export async function postForm(
  action: FormAction,
  data: Record<string, unknown>,
  submissionId: string = crypto.randomUUID(),
): Promise<FormResult> {
  const url = process.env.FORMS_APPS_SCRIPT_URL;
  const secret = process.env.FORMS_APPS_SCRIPT_SECRET;
  if (!url || !secret) {
    console.error(
      "[forms] Falta FORMS_APPS_SCRIPT_URL o FORMS_APPS_SCRIPT_SECRET.",
    );
    return { ok: false, error: NOT_CONFIGURED };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      // text/plain evita el preflight y Apps Script lo lee en e.postData.contents
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret,
        action,
        submission_id: submissionId,
        data,
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const body = (await res
      .json()
      .catch(() => null)) as AppsScriptResponse | null;

    if (!res.ok || !body) {
      console.error(
        `[forms] ${action}: Apps Script respondió ${res.status} sin JSON (¿la implementación tiene acceso "cualquier persona"?).`,
      );
      return { ok: false, error: UNAVAILABLE };
    }
    if (body.ok === true) return { ok: true };

    if (body.error === "unauthorized") {
      console.error(
        `[forms] ${action}: FORMS_APPS_SCRIPT_SECRET no coincide con SHARED_SECRET.`,
      );
      return { ok: false, error: NOT_CONFIGURED };
    }
    console.error(
      `[forms] ${action}: Apps Script rechazó el envío:`,
      body.error,
    );
    return { ok: false, error: body.permanent ? REJECTED : UNAVAILABLE };
  } catch (error) {
    const timedOut = (error as { name?: string })?.name === "TimeoutError";
    console.error(
      `[forms] ${action}: ${timedOut ? "tiempo agotado" : "error de red"}.`,
      timedOut ? "" : error,
    );
    return { ok: false, error: timedOut ? TIMEOUT : UNAVAILABLE };
  }
}
