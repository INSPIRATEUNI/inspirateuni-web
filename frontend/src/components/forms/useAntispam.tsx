"use client";

import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useEffect, useId, useRef, useState } from "react";
import type { AntispamMeta } from "@/lib/forms/schemas";

const CAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

export const CAPTCHA_MISSING =
  "Completa la verificación de que no eres un robot.";

/** UUID v4; randomUUID solo existe en contextos seguros (https o localhost). */
function newSubmissionId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Antispam de los formularios públicos: campo trampa, tiempo de llenado y
 * hCaptcha (solo si hay `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`). El servidor vuelve a
 * comprobarlo todo; aquí solo se juntan los datos.
 */
export function useAntispam() {
  const honeypotId = useId();
  const honeypotRef = useRef<HTMLInputElement>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const startedAt = useRef(0);
  const submissionId = useRef("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    submissionId.current = newSubmissionId();
  }, []);

  const fields = (
    <>
      {/* Invisible para personas y lectores de pantalla; los bots lo llenan */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor={honeypotId}>No llenes este campo</label>
        <input
          ref={honeypotRef}
          id={honeypotId}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          // Sin ancho propio: dentro de sr-only igual ensanchaba la página en móvil
          className="size-px"
        />
      </div>
      {CAPTCHA_SITE_KEY && (
        <HCaptcha
          ref={captchaRef}
          sitekey={CAPTCHA_SITE_KEY}
          languageOverride="es"
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
        />
      )}
    </>
  );

  return {
    /** Campo trampa y captcha: van dentro del <form>. */
    fields,
    /** Hay captcha y aún no se marcó. */
    captchaMissing: Boolean(CAPTCHA_SITE_KEY) && !captchaToken,
    meta(): AntispamMeta {
      if (!submissionId.current) submissionId.current = newSubmissionId();
      return {
        submissionId: submissionId.current,
        website: honeypotRef.current?.value ?? "",
        elapsedMs: Math.max(0, Date.now() - startedAt.current),
        captchaToken,
      };
    },
    /** Tras cada envío: el token del captcha sirve una sola vez. */
    afterSubmit(ok: boolean) {
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      if (ok) {
        // Un envío nuevo; un reintento tras un error conserva el id
        submissionId.current = newSubmissionId();
        startedAt.current = Date.now();
      }
    },
  };
}
