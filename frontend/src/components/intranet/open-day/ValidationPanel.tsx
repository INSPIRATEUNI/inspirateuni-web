"use client";

import { useState, useTransition } from "react";
import {
  confirmRegistration,
  observeDocuments,
} from "@/app/intranet/open-day/inscripciones/[id]/actions";
import { Notice } from "@/components/open-day/Notice";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { Heading } from "@/components/ui/Heading";
import { cn } from "@/lib/cn";
import { DOCUMENT_LABELS } from "@/lib/open-day/constants";
import { formatDateTime } from "@/lib/open-day/format";
import { CHECKLISTS, composeObservation } from "@/lib/open-day/staff/checklist";
import type { DocumentKind, RegistrationStatus } from "@/lib/open-day/types";
import { DocumentButton } from "./DocumentButton";

export type ValidationDocument = {
  id: string;
  kind: DocumentKind;
  fileName: string;
  uploadedAt: string;
  observation: string | null;
  verifiedAt: string | null;
};

type ValidationPanelProps = {
  registrationId: string;
  status: RegistrationStatus;
  documents: ValidationDocument[];
  /** Documentos obligatorios que aún no se subieron. */
  missing: DocumentKind[];
  usedGates: string[];
  defaultGate: string;
  defaultArrival: string;
  defaultDeadline: string;
};

/**
 * Validación con lista de verificación. Confirmar exige todo marcado; observar
 * marca los documentos con algo pendiente y arma el texto para quien se inscribió.
 */
export function ValidationPanel({
  registrationId,
  status,
  documents,
  missing,
  usedGates,
  defaultGate,
  defaultArrival,
  defaultDeadline,
}: ValidationPanelProps) {
  const [checks, setChecks] = useState<Record<string, string[]>>({});
  const [gate, setGate] = useState(defaultGate);
  const [arrival, setArrival] = useState(defaultArrival);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canValidate = status === "submitted" || status === "docs_observed";
  const canConfirm = status === "submitted";

  const failures = documents.map((doc) => {
    const ticked = checks[doc.id] ?? [];
    return {
      doc,
      missing: CHECKLISTS[doc.kind].filter((item) => !ticked.includes(item.id)),
    };
  });
  const allChecked =
    documents.length > 0 &&
    missing.length === 0 &&
    failures.every((f) => f.missing.length === 0);
  const toObserve = failures.filter((f) => f.missing.length > 0);
  const observation = composeObservation(
    toObserve.map((f) => ({
      kind: f.doc.kind,
      missing: f.missing.map((i) => i.label),
    })),
    notes,
  );

  function toggle(docId: string, itemId: string) {
    setChecks((current) => {
      const list = current[docId] ?? [];
      return {
        ...current,
        [docId]: list.includes(itemId)
          ? list.filter((id) => id !== itemId)
          : [...list, itemId],
      };
    });
  }

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setDone(success);
        setChecks({});
        setNotes("");
      } else {
        setError(result.error ?? "No pudimos guardar el cambio.");
      }
    });
  }

  return (
    <section
      aria-labelledby="validacion"
      className="grid gap-5 rounded-lg border-2 border-border bg-surface p-5 sm:p-6"
    >
      <Heading id="validacion" variant="item" level={2}>
        Validación de documentos
      </Heading>

      {!canValidate && (
        <Notice tone="info">
          {status === "confirmed"
            ? "La inscripción ya está confirmada."
            : "Se valida cuando la inscripción está enviada. Mientras tanto puedes ver los documentos."}
        </Notice>
      )}
      {missing.length > 0 && (
        <Notice tone="warning" title="Faltan documentos">
          {missing.map((kind) => DOCUMENT_LABELS[kind]).join(", ")}.
        </Notice>
      )}

      {documents.length === 0 ? (
        <p className="text-muted-foreground">Aún no hay documentos subidos.</p>
      ) : (
        <ul className="grid gap-4">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded-md border-2 border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{DOCUMENT_LABELS[doc.kind]}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.fileName} · subido {formatDateTime(doc.uploadedAt)}
                    {doc.verifiedAt && " · verificado"}
                  </p>
                </div>
                <DocumentButton documentId={doc.id} />
              </div>
              {doc.observation && (
                <p className="mt-2 rounded-md bg-tint-magenta px-3 py-2 text-sm whitespace-pre-line">
                  <span className="font-bold">Observación anterior:</span>{" "}
                  {doc.observation}
                </p>
              )}
              {canValidate && (
                <fieldset className="mt-3 grid gap-2">
                  <legend className="sr-only">
                    Verificación de {DOCUMENT_LABELS[doc.kind]}
                  </legend>
                  {CHECKLISTS[doc.kind].map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-green"
                        checked={(checks[doc.id] ?? []).includes(item.id)}
                        onChange={() => toggle(doc.id, item.id)}
                      />
                      {item.label}
                    </label>
                  ))}
                </fieldset>
              )}
            </li>
          ))}
        </ul>
      )}

      {done && <Notice tone="success">{done}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {canValidate && documents.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div
            className={cn(
              "grid content-start gap-3",
              !canConfirm && "opacity-60",
            )}
          >
            <Heading variant="item" level={3}>
              Confirmar
            </Heading>
            <p className="text-sm text-muted-foreground">
              {allChecked
                ? "Todo está en orden. Al confirmar se generan los códigos y se envía el correo."
                : "Marca todos los puntos de cada documento para confirmar."}
            </p>
            <label className="grid gap-1 text-sm font-semibold">
              Puerta de ingreso
              <input
                list="puertas-usadas"
                value={gate}
                onChange={(e) => setGate(e.target.value)}
                placeholder="Ej.: Puerta 3 (Av. Túpac Amaru)"
                className={cn(fieldClasses, "py-2")}
                disabled={!canConfirm}
              />
              <datalist id="puertas-usadas">
                {usedGates.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Hora de llegada (el día del evento)
              <input
                type="time"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                className={cn(fieldClasses, "py-2")}
                disabled={!canConfirm}
              />
            </label>
            <Button
              bolt={!pending}
              disabled={
                !canConfirm ||
                !allChecked ||
                pending ||
                !gate.trim() ||
                !arrival
              }
              aria-busy={pending}
              onClick={() =>
                run(
                  () =>
                    confirmRegistration({
                      registrationId,
                      gate,
                      arrivalTime: arrival,
                    }),
                  "Inscripción confirmada. Se enviarán los códigos por correo.",
                )
              }
            >
              Confirmar inscripción
            </Button>
          </div>

          <div className="grid content-start gap-3">
            <Heading variant="item" level={3}>
              Observar
            </Heading>
            <p className="text-sm text-muted-foreground">
              {toObserve.length > 0
                ? `Se observarán: ${toObserve.map((f) => DOCUMENT_LABELS[f.doc.kind]).join(", ")}.`
                : "Desmarca lo que no cumple para observar ese documento."}
            </p>
            {observation && (
              <div className="rounded-md bg-background px-3 py-2 text-sm whitespace-pre-line">
                {observation}
              </div>
            )}
            <label className="grid gap-1 text-sm font-semibold">
              Notas para quien se inscribió (opcional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                className={cn(fieldClasses, "py-2 text-sm")}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Nuevo plazo para corregir
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={cn(fieldClasses, "py-2")}
              />
            </label>
            <Button
              variant="ghost"
              disabled={toObserve.length === 0 || pending || !deadline}
              aria-busy={pending}
              onClick={() =>
                run(
                  () =>
                    observeDocuments({
                      registrationId,
                      documentIds: toObserve.map((f) => f.doc.id),
                      observation,
                      deadline,
                    }),
                  "Observación enviada. Quien se inscribió recibirá un correo.",
                )
              }
            >
              Enviar observación
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
