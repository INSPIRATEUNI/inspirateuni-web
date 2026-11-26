"use client";

import { useState, useTransition } from "react";
import {
  markDocumentsReceived,
  verifyDocuments,
} from "@/app/intranet/open-day/inscripciones/[id]/actions";
import { Notice } from "@/components/open-day/Notice";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { formatDateTime } from "@/lib/open-day/format";

/** Documentos firmados en físico (obligatorios) y PDF subido después de aceptar. */
export function PhysicalDocuments({
  registrationId,
  receivedAt,
  canReceive,
  unverifiedPdf,
}: {
  registrationId: string;
  receivedAt: string | null;
  canReceive: boolean;
  /** Hay un PDF sin validar en una inscripción ya confirmada. */
  unverifiedPdf: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: typeof markDocumentsReceived) {
    setError(null);
    startTransition(async () => {
      const result = await action({ registrationId });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="grid gap-3 rounded-lg border-2 border-border bg-surface p-5">
      <Heading variant="item" level={2}>
        Documentos en físico
      </Heading>
      {receivedAt ? (
        <p className="font-bold text-green-ink">
          Recibidos el {formatDateTime(receivedAt)}.
        </p>
      ) : (
        <>
          <p>
            Pendientes. Deben traerlos impresos y firmados, aunque hayan subido
            el PDF.
          </p>
          {canReceive && (
            <div>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(markDocumentsReceived)}
              >
                Documentos recibidos
              </Button>
            </div>
          )}
        </>
      )}
      {unverifiedPdf && (
        <div className="grid gap-2">
          <p className="text-sm">Hay un PDF subido que aún no está validado.</p>
          <div>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(verifyDocuments)}
            >
              Marcar PDF como validado
            </Button>
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
