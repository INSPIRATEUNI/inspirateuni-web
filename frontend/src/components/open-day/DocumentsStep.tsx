"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, ClipboardIcon } from "@/components/site/Icons";
import { cn } from "@/lib/cn";
import {
  DOCUMENT_LABELS,
  driveDownloadUrl,
  requiredDocuments,
} from "@/lib/open-day/constants";
import { fetchTemplates } from "@/lib/open-day/data";
import { messageFor } from "@/lib/open-day/errors";
import { formatBytes, formatDateTime, isMinorOn } from "@/lib/open-day/format";
import type {
  DocumentKind,
  DocumentTemplate,
  OpenDayEvent,
  Registration,
} from "@/lib/open-day/types";
import { StorageError, uploadRegistrationDocument } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { Notice } from "./Notice";

const DOCUMENT_HINTS: Record<DocumentKind, string> = {
  school_consolidated:
    "Junta en un solo PDF las autorizaciones firmadas de todos los escolares y la carta de compromiso del colegio.",
  consent: "Autorización para el uso de tus datos personales, firmada.",
  commitment_letter: "Carta de compromiso de buena conducta, firmada.",
  guardian_declaration:
    "Declaración firmada por tu madre, padre o apoderado (eres menor de edad el día del evento).",
};

type DocumentsStepProps = {
  event: OpenDayEvent;
  registration: Registration;
  onChanged: () => Promise<unknown>;
  /** Solo muestra los documentos observados (para reemplazarlos). */
  onlyObserved?: boolean;
};

/** Plantillas descargables y subida de los PDF obligatorios a Drive. */
export function DocumentsStep({
  event,
  registration,
  onChanged,
  onlyObserved = false,
}: DocumentsStepProps) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  useEffect(() => {
    fetchTemplates(createClient()).then(setTemplates);
  }, []);

  const minorVisitor = registration.attendees.some(
    (a) =>
      a.role === "visitor" &&
      a.birthDate &&
      isMinorOn(a.birthDate, event.eventDate),
  );
  const required = requiredDocuments(registration.kind, minorVisitor);
  const kinds = onlyObserved
    ? required.filter((kind) =>
        registration.documents.some(
          (d) => d.kind === kind && d.observation && !d.verifiedAt,
        ),
      )
    : required;

  return (
    <div className="grid gap-6">
      {!onlyObserved && templates.length > 0 && (
        <section aria-labelledby="templates-title" className="grid gap-3">
          <h3 id="templates-title" className="font-display text-lg font-bold">
            Plantillas para descargar
          </h3>
          <p className="text-sm text-muted-foreground">
            Descárgalas, imprímelas y fírmalas.
            {registration.kind === "school"
              ? " Luego escanea todo en un solo PDF."
              : " Luego escanea cada una en PDF."}
          </p>
          <ul className="flex flex-wrap gap-3">
            {templates
              .filter(
                (t) =>
                  t.kind !== "guardian_declaration" ||
                  registration.kind === "school" ||
                  minorVisitor,
              )
              .map((template) => (
                <li key={template.kind}>
                  <a
                    href={driveDownloadUrl(template.driveFileId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    <ClipboardIcon className="size-4" />
                    {DOCUMENT_LABELS[template.kind]} (v{template.version})
                  </a>
                </li>
              ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-4">
        {kinds.map((kind) => (
          <DocumentUpload
            key={kind}
            kind={kind}
            event={event}
            registration={registration}
            onUploaded={onChanged}
          />
        ))}
      </ul>
    </div>
  );
}

function DocumentUpload({
  kind,
  event,
  registration,
  onUploaded,
}: {
  kind: DocumentKind;
  event: OpenDayEvent;
  registration: Registration;
  onUploaded: () => Promise<unknown>;
}) {
  const current = registration.documents.find((d) => d.kind === kind);
  const inputId = `doc-${kind}`;
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const maxBytes = event.maxFileMb * 1024 * 1024;

  async function upload(file: File) {
    setError(null);
    setDone(false);
    if (file.type !== "application/pdf") {
      setError(messageFor("invalid_type"));
      return;
    }
    if (file.size > maxBytes) {
      setError(
        `El archivo pesa ${formatBytes(file.size)}; el máximo es ${event.maxFileMb} MB.`,
      );
      return;
    }
    controller.current = new AbortController();
    setProgress(0);
    try {
      await uploadRegistrationDocument({
        file,
        registrationId: registration.id,
        kind,
        signal: controller.current.signal,
        onProgress: (sent, total) =>
          setProgress(Math.round((sent / total) * 100)),
      });
      setDone(true);
      await onUploaded();
    } catch (cause) {
      if (controller.current?.signal.aborted) {
        setError("Cancelaste la subida.");
      } else if (cause instanceof StorageError) {
        setError(messageFor(cause.code, cause.message));
      } else {
        setError(messageFor("upload_failed"));
      }
    } finally {
      setProgress(null);
      controller.current = null;
    }
  }

  const observed = current?.observation && !current.verifiedAt;

  return (
    <li
      className={cn(
        "grid gap-3 rounded-lg border-2 p-4",
        observed
          ? "border-orange/50 bg-tint-orange"
          : current
            ? "border-green/40 bg-tint-green"
            : "border-border bg-surface",
      )}
    >
      <div className="flex items-start gap-3">
        {current && !observed ? (
          <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-green-ink" />
        ) : (
          <ClipboardIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="font-bold">{DOCUMENT_LABELS[kind]}</p>
          <p className="text-sm text-muted-foreground">
            {DOCUMENT_HINTS[kind]}
          </p>
          {current && (
            <p className="mt-1 text-sm break-words">
              Subido: <strong>{current.fileName}</strong> ·{" "}
              {formatDateTime(current.uploadedAt)}
              {current.verifiedAt && " · Verificado"}
            </p>
          )}
          {observed && (
            <p className="mt-1 text-sm font-semibold text-orange-ink">
              Observación: {current.observation}
            </p>
          )}
        </div>
      </div>

      {progress !== null ? (
        <div className="grid gap-2">
          <div
            role="progressbar"
            aria-label={`Subiendo ${DOCUMENT_LABELS[kind]}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2.5 overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-magenta to-orange transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="tabular-nums">{progress}%</span>
            <button
              type="button"
              onClick={() => controller.current?.abort()}
              className="font-bold text-magenta hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label
            htmlFor={inputId}
            className="btn btn-ghost btn-sm cursor-pointer"
          >
            {current ? "Reemplazar PDF" : "Subir PDF"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload(file);
            }}
          />
          <p
            id={`${inputId}-hint`}
            className="mt-1 text-xs text-muted-foreground"
          >
            Solo PDF, hasta {event.maxFileMb} MB.
          </p>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {done && !error && <Notice tone="success">Recibimos el archivo.</Notice>}
    </li>
  );
}

/** Si ya están todos los documentos obligatorios. */
export function documentsComplete(
  event: OpenDayEvent,
  registration: Registration,
) {
  const minorVisitor = registration.attendees.some(
    (a) =>
      a.role === "visitor" &&
      a.birthDate &&
      isMinorOn(a.birthDate, event.eventDate),
  );
  return requiredDocuments(registration.kind, minorVisitor).every((kind) =>
    registration.documents.some((d) => d.kind === kind),
  );
}
