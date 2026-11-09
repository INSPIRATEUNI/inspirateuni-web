"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { resubmitRegistration } from "@/lib/open-day/rpc";
import type { OpenDayEvent, Registration } from "@/lib/open-day/types";
import { createClient } from "@/lib/supabase/client";
import { DocumentsStep } from "./DocumentsStep";
import { Notice } from "./Notice";
import { OtpStep } from "./OtpStep";

/** Acceso a "Mi inscripción" para quien vuelve: correo y código nuevo. */
export function MyRegistrationLogin() {
  const router = useRouter();
  return (
    <OtpStep
      onVerified={() => router.refresh()}
      description="Usa el correo con el que te inscribiste. Te enviaremos un código nuevo."
    />
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await createClient().auth.signOut();
        router.refresh();
      }}
    >
      Salir
    </Button>
  );
}

/** Reemplazo de documentos observados y reenvío a revisión. */
export function ObservedDocuments({
  event,
  registration,
}: {
  event: OpenDayEvent;
  registration: Registration;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = async () => router.refresh();

  async function resubmit() {
    setSending(true);
    setError(null);
    const result = await resubmitRegistration(registration.id);
    setSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <DocumentsStep
        event={event}
        registration={registration}
        onChanged={reload}
        onlyObserved
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <Button bolt onClick={resubmit} disabled={sending}>
          {sending ? "Enviando…" : "Enviar de nuevo a revisión"}
        </Button>
      </div>
    </div>
  );
}

export function PrintButton({
  label = "Imprimir códigos",
}: {
  label?: string;
}) {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
