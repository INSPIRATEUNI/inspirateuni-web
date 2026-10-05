"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

/** Maqueta: aún no hay sesión con JWT, solo se confirma el envío. */
export function LoginForm() {
  const [sent, setSent] = useState(false);

  return (
    <form
      className="grid gap-5 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
      }}
    >
      <Field id="login-email" label="Tu correo UNI">
        <Input
          type="email"
          id="login-email"
          name="email"
          autoComplete="email"
          placeholder="nombre.apellido@uni.pe"
          required
        />
      </Field>
      <Field id="login-password" label="Tu contraseña">
        <Input
          type="password"
          id="login-password"
          name="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit" bolt className="mt-2 w-full justify-center">
        Ingresar
      </Button>
      <p
        aria-live="polite"
        className="text-center text-sm text-muted-foreground"
      >
        {sent && "La intranet aún está en construcción. Pronto podrás entrar."}
      </p>
    </form>
  );
}
