"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, ClipboardIcon } from "@/components/site/Icons";
import { cn } from "@/lib/cn";
import { templateLabel } from "@/lib/open-day/conditions";
import {
  DOCUMENT_LABELS,
  driveDownloadUrl,
  uploadKind,
} from "@/lib/open-day/constants";
import { fetchTemplates } from "@/lib/open-day/data";
import { messageFor } from "@/lib/open-day/errors";
import { formatBytes, formatDateTime } from "@/lib/open-day/format";
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
  school_consolidated: "Junta en un solo PDF todas las cartas firmadas.",
  individual_consolidated:
    "Junta en un solo PDF la autorización de uso de datos y la carta de compromiso firmadas de todas las personas. Si algún visitante es menor de edad, incluye la declaración firmada por su apoderado.",
  consent: "Autorización para el uso de datos personales, firmada.",
  commitment_letter: "Carta de compromiso de buena conducta, firmada.",
  guardian_declaration: "Declaración firmada por la madre, padre o apoderado.",
};

type DocumentsStepProps = {
  event: OpenDayEvent;
  registration: Registration;
  onChanged: () => Promise<unknown>;
  /** Solo muestra los documentos observados (para reemplazarlos). */
  onlyObserved?: boolean;
};

/** Plantillas descargables y subida opcional del PDF consolidado. */
export function DocumentsStep({
  event,
  registration,
  onChanged,
  onlyObserved = false,
}: DocumentsStepProps) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  useEffect(() => {
    fetchTemplates(createClient(), registration.kind).then(setTemplates);
  }, [registration.kind]);

  // Una observación sobre un PDF del formato anterior también se corrige
  // subiendo el consolidado, que reemplaza a todos
  const pending = registration.documents.filter(
    (d) => d.kind !== "credentials" && d.observation && !d.verifiedAt,
  );
  const kinds =
    onlyObserved && pending.length === 0 ? [] : [uploadKind(registration.kind)];

  // La observación es una sola por revisión: se muestra una vez, en su propio recuadro
  const observations = [
    ...new Set(pending.map((d) => d.observation as string)),
  ];

  return (
    <div className="grid gap-6">
      {observations.length > 0 && (
        <section
          aria-labelledby="observations-title"
          className="grid gap-2 rounded-lg border-2 border-orange bg-tint-orange p-5"
        >
          <h3
            id="observations-title"
            className="text-xs font-extrabold uppercase tracking-widest text-orange-ink"
          >
            Observaciones del equipo
          </h3>
          {observations.map((text) => (
            <p key={text} className="whitespace-pre-line">
              {text}
            </p>
          ))}
        </section>
      )}

      {!onlyObserved && templates.length > 0 && (
        <section
          aria-labelledby="templates-title"
          className="grid gap-4 rounded-lg border-2 border-orange bg-tint-orange p-5 shadow-soft"
        >
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-ink">
              Paso 1 · Descarga y firma
            </p>
            <h3
              id="templates-title"
              className="mt-1 font-display text-xl font-bold"
            >
              Descarga primero estas plantillas
            </h3>
          </div>
          <p className="font-semibold">
            Imprímelas, fírmalas y llévalas impresas el día del evento. Si
            quieres adelantar la revisión, escanea todo en un solo PDF y súbelo
            aquí abajo.
          </p>
          <ul className="flex flex-wrap gap-3">
            {templates.map((template) => (
              <li key={template.kind}>
                <a
                  href={driveDownloadUrl(template.driveFileId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-spark"
                >
                  <ClipboardIcon className="size-5" />
                  Descargar{" "}
                  {templateLabel(
                    registration.kind,
                    template.kind,
                  ).toLowerCase()}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!onlyObserved && (
        <Notice tone="info" title="Subir el PDF es opcional">
          Puedes subirlo ahora o más adelante, hasta el día del evento. Aunque
          lo subas, debes llevar los documentos impresos y firmados.
        </Notice>
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
              Observado: corrígelo y vuelve a subirlo.
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
