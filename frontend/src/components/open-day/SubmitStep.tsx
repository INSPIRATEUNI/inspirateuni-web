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
  onSubmitted: () => Promise<unknown>;
};

/** Aceptación del aviso de privacidad y envío final (`submit_registration`). */
export function SubmitStep({ registration, onSubmitted }: SubmitStepProps) {
  const [accepted, setAccepted] = useState(false);
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
        Revisaremos los documentos y te escribiremos a{" "}
        <strong className="text-foreground">{registration.contactEmail}</strong>
        . Después de enviar, ya no podrás cambiar la lista de personas; solo
        reemplazar documentos si te los observamos.
      </p>
      {registration.docsDeadline && (
        <p className="text-sm">
          Plazo para enviar:{" "}
          <strong>{formatDateTime(registration.docsDeadline)}</strong>
        </p>
      )}
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1 size-5 shrink-0 accent-magenta"
        />
        <span>
          Acepto el aviso de privacidad para el uso de los datos registrados y
          declaro que la información es verdadera y que cuento con la
          autorización de las personas inscritas.
        </span>
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <Button bolt disabled={!accepted || sending} onClick={submit}>
          {sending ? "Enviando…" : "Enviar inscripción"}
        </Button>
      </div>
    </div>
  );
}
