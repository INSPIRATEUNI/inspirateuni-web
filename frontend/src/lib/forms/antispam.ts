import "server-only";
import type { AntispamMeta } from "./schemas";

const MIN_FILL_MS = 3000;
const SITEVERIFY_URL = "https://api.hcaptcha.com/siteverify";

export type HumanCheck = { ok: true } | { ok: false; error: string };

/** Llenó el campo trampa: se finge éxito y no se envía nada. */
export function isBot(meta: AntispamMeta) {
  return meta.website.trim() !== "";
}

/**
 * Tiempo mínimo de llenado y, si hay `HCAPTCHA_SECRET`, el captcha. Sin la
 * clave pública el widget no aparece, así que tampoco se exige el token.
 */
export async function verifyHuman(meta: AntispamMeta): Promise<HumanCheck> {
  if (meta.elapsedMs < MIN_FILL_MS) {
    return {
      ok: false,
      error: "Vas muy rápido. Revisa tus datos y vuelve a enviar.",
    };
  }

  const secret = process.env.HCAPTCHA_SECRET;
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  if (!secret) return { ok: true };
  if (!siteKey) {
    console.error(
      "[forms] Hay HCAPTCHA_SECRET pero falta NEXT_PUBLIC_HCAPTCHA_SITE_KEY: no se verifica el captcha.",
    );
    return { ok: true };
  }
  if (!meta.captchaToken) {
    return {
      ok: false,
      error: "Completa la verificación de que no eres un robot.",
    };
  }

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: meta.captchaToken,
        sitekey: siteKey,
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const body = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (body.success) return { ok: true };
    console.warn("[forms] hCaptcha rechazado:", body["error-codes"]);
    return {
      ok: false,
      error: "La verificación venció. Márcala de nuevo y vuelve a enviar.",
    };
  } catch (error) {
    console.error("[forms] No se pudo verificar el captcha:", error);
    return {
      ok: false,
      error: "No pudimos verificar el captcha. Inténtalo de nuevo.",
    };
  }
}
