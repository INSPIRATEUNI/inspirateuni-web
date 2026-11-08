"use client";

import HCaptcha from "@hcaptcha/react-hcaptcha";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FieldError } from "@/components/ui/FieldError";
import { Text } from "@/components/ui/Text";
import {
  type OtpCodeValues,
  type OtpEmailValues,
  otpCodeSchema,
  otpEmailSchema,
} from "@/lib/open-day/schemas";
import { createClient } from "@/lib/supabase/client";
import { Notice } from "./Notice";

const CAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
const RESEND_SECONDS = 60;

type OtpStepProps = {
  /** Se llama cuando la sesión quedó abierta. */
  onVerified: () => void;
  /** Texto bajo el formulario del correo. */
  description?: string;
};

/**
 * Acceso con un código de 6 dígitos enviado al correo (OTP de Supabase Auth).
 * El captcha solo aparece si hay `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`; su token se
 * envía a Supabase, que lo valida cuando `[auth.captcha]` está activo.
 */
export function OtpStep({ onVerified, description }: OtpStepProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const captchaRef = useRef<HCaptcha>(null);

  const emailForm = useForm<OtpEmailValues>({
    resolver: zodResolver(otpEmailSchema),
    defaultValues: { email: "" },
  });
  const codeForm = useForm<OtpCodeValues>({
    resolver: zodResolver(otpCodeSchema),
    defaultValues: { token: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendCode(email: string) {
    setServerError(null);
    if (CAPTCHA_SITE_KEY && !captchaToken) {
      setServerError("Completa la verificación de que no eres un robot.");
      return false;
    }
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        captchaToken: captchaToken ?? undefined,
      },
    });
    // Cada token de captcha sirve una sola vez
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);

    if (error) {
      setServerError(
        error.status === 429
          ? "Pediste demasiados códigos. Espera unos minutos e inténtalo de nuevo."
          : "No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.",
      );
      return false;
    }
    setSentTo(email);
    setCooldown(RESEND_SECONDS);
    return true;
  }

  const onSendEmail = emailForm.handleSubmit(async ({ email }) => {
    await sendCode(email);
  });

  const onVerify = codeForm.handleSubmit(async ({ token }) => {
    if (!sentTo) return;
    setServerError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: sentTo,
      token,
      type: "email",
    });
    if (error) {
      setServerError("El código no es válido o ya venció. Pide uno nuevo.");
      return;
    }
    onVerified();
  });

  const captcha = CAPTCHA_SITE_KEY ? (
    <HCaptcha
      ref={captchaRef}
      sitekey={CAPTCHA_SITE_KEY}
      languageOverride="es"
      onVerify={setCaptchaToken}
      onExpire={() => setCaptchaToken(null)}
    />
  ) : null;

  if (!sentTo) {
    const { errors, isSubmitting } = emailForm.formState;
    return (
      <form onSubmit={onSendEmail} noValidate className="grid max-w-md gap-5">
        <Field id="otp-email" label="Tu correo">
          <Input
            id="otp-email"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby="otp-email-hint otp-email-error"
            {...emailForm.register("email")}
          />
          <p id="otp-email-hint" className="text-sm text-muted-foreground">
            {description ??
              "Te enviaremos un código de 6 dígitos. Con este correo podrás volver a tu inscripción."}
          </p>
          <FieldError id="otp-email-error" message={errors.email?.message} />
        </Field>
        {captcha}
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <div>
          <Button type="submit" disabled={isSubmitting} bolt>
            {isSubmitting ? "Enviando…" : "Enviarme el código"}
          </Button>
        </div>
      </form>
    );
  }

  const { errors, isSubmitting } = codeForm.formState;
  return (
    <div className="grid max-w-md gap-5">
      <Text variant="muted">
        Enviamos un código a{" "}
        <strong className="text-foreground">{sentTo}</strong>. Revisa también la
        carpeta de spam.
      </Text>
      <form onSubmit={onVerify} noValidate className="grid gap-5">
        <Field id="otp-token" label="Código de 6 dígitos">
          <Input
            id="otp-token"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="max-w-48 text-center font-display text-2xl tracking-[0.4em]"
            aria-invalid={Boolean(errors.token)}
            aria-describedby="otp-token-error"
            {...codeForm.register("token")}
          />
          <FieldError id="otp-token-error" message={errors.token?.message} />
        </Field>
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting} bolt>
            {isSubmitting ? "Verificando…" : "Ingresar"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSentTo(null);
              setServerError(null);
              codeForm.reset();
            }}
          >
            Cambiar correo
          </Button>
        </div>
      </form>
      <div className="grid gap-3">
        {cooldown === 0 && captcha}
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={() => sendCode(sentTo)}
          className="justify-self-start text-sm font-bold text-magenta underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0
            ? `Puedes pedir otro código en ${cooldown} s`
            : "Enviarme otro código"}
        </button>
      </div>
    </div>
  );
}
