"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TERMS_VERSION } from "@/lib/open-day/constants";
import { formatDateTime } from "@/lib/open-day/format";
import { submitRegistration } from "@/lib/open-day/rpc";
import type { Registration } from "@/lib/open-day/types";
import { Notice } from "./Notice";

type SubmitStepProps = {
  registration: Registration;
  /** Si ya se aceptaron las tres declaraciones. */
  canSubmit: boolean;
  onSubmitted: () => Promise<unknown>;
};

/** Envío final (`submit_registration`); guarda la versión de las condiciones aceptadas. */
export function SubmitStep({
  registration,
  canSubmit,
  onSubmitted,
}: SubmitStepProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSending(true);
    setError(null);
    const result = await submitRegistration(registration.id, TERMS_VERSION);
    setSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await onSubmitted();
  }

  return (
    <div className="grid gap-5">
      <p className="text-muted-foreground">
        Revisaremos tu inscripción y te escribiremos a{" "}
        <strong className="text-foreground">{registration.contactEmail}</strong>
        .{" "}
        {registration.kind === "school"
          ? "Hasta que la aceptemos podrás cambiar los tutores y la cantidad de escolares desde Mi inscripción."
          : "Después de enviar, ya no podrás cambiar la lista de personas."}
      </p>
      {registration.docsDeadline && (
        <p className="text-sm">
          Plazo para enviar:{" "}
          <strong>{formatDateTime(registration.docsDeadline)}</strong>
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Al enviar confirmas que la información es verdadera, que cuentas con la
        autorización de las personas inscritas y que aceptas el aviso de
        privacidad para el uso de sus datos.
      </p>
      {!canSubmit && (
        <Notice tone="warning">
          Primero acepta las tres declaraciones del paso de condiciones.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <Button bolt disabled={!canSubmit || sending} onClick={submit}>
          {sending ? "Enviando…" : "Enviar inscripción"}
        </Button>
      </div>
    </div>
  );
}
