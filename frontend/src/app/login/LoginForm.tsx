"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

type Status = "idle" | "loading" | "success";
type Errors = { email?: string; password?: string };

const FAKE_LATENCY_MS = 900;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "ana.perez@uni.pe" -> "Ana". */
function firstNameFrom(email: string) {
  const [local = ""] = email.split("@");
  const [name = ""] = local.split(/[._-]/);
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** Maqueta: acepta cualquier credencial válida; aún no hay sesión con JWT. */
export function LoginForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    timer.current = setTimeout(() => {
      setName(firstNameFrom(email));
      setStatus("success");
    }, FAKE_LATENCY_MS);
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-6 text-center"
      >
        <Mascot
          pose="alegre"
          className="w-28 animate-mascot-float motion-reduce:animate-none"
        />
        <div>
          <Heading variant="section" level={3}>
            ¡Qué bueno verte,{" "}
            <GradientText gradient="fresh">{name || "voluntario"}</GradientText>
            !
          </Heading>
          <Text variant="lead" className="mt-3">
            Entraste en modo de prueba. La intranet con tus turnos, eventos y
            visitas llegará pronto.
          </Text>
          <Button
            variant="ghost"
            className="mt-6"
            onClick={() => {
              setStatus("idle");
              setShowPassword(false);
            }}
          >
            Cerrar sesión de prueba
          </Button>
        </div>
      </div>
    );
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

      <Button
        type="submit"
        bolt={!loading}
        disabled={loading}
        aria-busy={loading}
        className="mt-2 w-full justify-center"
      >
        {loading ? "Ingresando…" : "Ingresar"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Prototipo: cualquier correo y contraseña válidos te dejan entrar.
      </p>
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
