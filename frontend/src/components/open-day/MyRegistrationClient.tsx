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
import { SchoolPeopleEditor } from "./SchoolPeopleEditor";

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
      <Notice tone="warning" title="Tienes observaciones del equipo">
        Léelas en los mensajes de abajo; puedes responder ahí mismo. Cuando esté
        listo, envía de nuevo tu inscripción a revisión.
      </Notice>
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

/** Colegios: cambiar tutores y cantidad de escolares mientras no se acepta. */
export function EditSchoolPeople({
  event,
  registration,
}: {
  event: OpenDayEvent;
  registration: Registration;
}) {
  const router = useRouter();
  const reload = async () => router.refresh();
  return (
    <details className="rounded-lg border-2 border-border p-4">
      <summary className="cursor-pointer font-bold">
        Cambiar tutores o cantidad de escolares
      </summary>
      <div className="mt-4">
        <SchoolPeopleEditor
          key={registration.expectedVisitors}
          event={event}
          registration={registration}
          onSaved={reload}
          onVisitorsChanged={reload}
        />
      </div>
    </details>
  );
}

/** Subida opcional del PDF después de enviar o de ser aceptado. */
export function LateDocuments({
  event,
  registration,
  onChanged,
}: {
  event: OpenDayEvent;
  registration: Registration;
  /** El asistente recarga su propia copia; "Mi inscripción" refresca la página. */
  onChanged?: () => Promise<unknown>;
}) {
  const router = useRouter();
  return (
    <details className="rounded-lg border-2 border-border p-4">
      <summary className="cursor-pointer font-bold">
        {registration.documents.length === 0
          ? "¿Quieres adelantar? Sube tus documentos (opcional)"
          : "Reemplazar el PDF de documentos"}
      </summary>
      <div className="mt-4">
        <DocumentsStep
          event={event}
          registration={registration}
          onChanged={onChanged ?? (async () => router.refresh())}
          hideTemplates
        />
      </div>
    </details>
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
