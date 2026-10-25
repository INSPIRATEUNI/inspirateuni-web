"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "loading";
type Errors = { email?: string; password?: string; form?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const next: Errors = {};
    if (!email) next.email = "Escribe tu correo para ingresar.";
    else if (!EMAIL_PATTERN.test(email))
      next.email = "Revisa tu correo, parece incompleto.";
    if (!password) next.password = "Escribe tu contraseña.";

    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();

    setStatus("loading");
    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("idle");
      setErrors({
        form:
          error.code === "invalid_credentials"
            ? "Correo o contraseña incorrectos."
            : "No pudimos iniciar tu sesión. Inténtalo de nuevo en un momento.",
      });
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  const loading = status === "loading";

  return (
    <form noValidate className="grid gap-5 text-left" onSubmit={handleSubmit}>
      <Field id="login-email" label="Tu correo UNI">
        <Input
          ref={emailRef}
          type="email"
          id="login-email"
          name="email"
          autoComplete="email"
          placeholder="nombre.apellido@uni.pe"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          readOnly={loading}
          required
        />
        {errors.email && (
          <FieldError id="login-email-error" message={errors.email} />
        )}
      </Field>

      <Field id="login-password" label="Tu contraseña">
        <div className="relative">
          <Input
            ref={passwordRef}
            type={showPassword ? "text" : "password"}
            id="login-password"
            name="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? "login-password-error" : undefined
            }
            readOnly={loading}
            className="pr-24"
            required
          />
          <button
            type="button"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-bold text-blue-deep transition-colors duration-250 hover:bg-blue-soft focus-visible:outline-2 focus-visible:outline-blue"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {errors.password && (
          <FieldError id="login-password-error" message={errors.password} />
        )}
      </Field>

      {errors.form && (
        <FieldError id="login-form-error" message={errors.form} />
      )}

      <Button
        type="submit"
        bolt={!loading}
        disabled={loading}
        aria-busy={loading}
        className="mt-2 w-full justify-center"
      >
        {loading ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="text-sm font-semibold text-magenta-deep">
      {message}
    </p>
  );
}
