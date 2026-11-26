"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  checkIn,
  type PassInfo,
  previewPass,
  searchCheckIn,
} from "@/app/intranet/open-day/check-in/actions";
import { markDocumentsReceived } from "@/app/intranet/open-day/inscripciones/[id]/actions";
import { Notice } from "@/components/open-day/Notice";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import {
  DOC_TYPE_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
} from "@/lib/open-day/constants";
import { formatGate, formatTime } from "@/lib/open-day/format";
import type { CheckInCandidate } from "@/lib/open-day/staff/queries";

type Scanned = { code: string; info: PassInfo; justRegistered: boolean };

/**
 * Check-in en puerta: se busca por código (lo que tiene el QR o las barras),
 * documento o nombre. Escanear solo muestra los datos; el ingreso se registra con
 * un botón y, sin los documentos firmados en físico, exige un motivo.
 */
export function CheckInClient({ eventId }: { eventId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CheckInCandidate[] | null>(null);
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function show(code: string) {
    const result = await previewPass({ accessCode: code });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReason("");
    setScanned({ code, info: result.data, justRegistered: false });
  }

  function search(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setScanned(null);
    startTransition(async () => {
      const result = await searchCheckIn({ eventId, query });
      if (!result.ok) {
        setError(result.error);
        setResults(null);
        return;
      }
      setResults(result.data);
      // Un código exacto abre su ficha de inmediato (flujo rápido con lector)
      const typed = query.trim().toUpperCase();
      if (result.data.length === 1 && result.data[0].accessCode === typed) {
        setResults(null);
        setQuery("");
        await show(typed);
      }
    });
  }

  function open(code: string) {
    setError(null);
    startTransition(() => show(code));
  }

  function register(code: string, overrideReason?: string) {
    setError(null);
    startTransition(async () => {
      const result = await checkIn({ accessCode: code, overrideReason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setScanned({
        code,
        info: result.data,
        justRegistered: result.data.ok && !result.data.already,
      });
      setResults(null);
      setQuery("");
      inputRef.current?.focus();
    });
  }

  function receiveDocuments(code: string, registrationId: string) {
    setError(null);
    startTransition(async () => {
      const result = await markDocumentsReceived({ registrationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await show(code);
    });
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1 font-semibold sm:min-w-80">
          Código, documento, nombre o colegio
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Ej.: K7M2QX9A o 71234567"
            className={cn(fieldClasses, "text-lg")}
          />
        </label>
        <Button
          type="submit"
          bolt={!pending}
          disabled={pending || query.trim().length < 2}
        >
          Buscar
        </Button>
      </form>

      <div aria-live="polite" className="grid gap-4">
        {error && <Notice tone="error">{error}</Notice>}
        {scanned && (
          <PassCard
            scanned={scanned}
            pending={pending}
            reason={reason}
            onReason={setReason}
            onRegister={(overrideReason) =>
              register(scanned.code, overrideReason)
            }
            onReceive={(registrationId) =>
              receiveDocuments(scanned.code, registrationId)
            }
          />
        )}
      </div>

      {results && results.length === 0 && (
        <Notice tone="warning">
          No encontramos a nadie con ese dato en este evento.
        </Notice>
      )}

      {results && results.length > 0 && (
        <ul className="grid gap-3">
          {results.map((c) => (
            <li
              key={c.accessCode}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-border bg-surface p-4"
            >
              <div className="grid gap-1">
                <p className="text-lg font-bold">{c.title}</p>
                <p className="text-sm text-muted-foreground">{c.subtitle}</p>
                <p className="text-sm">
                  <span className="font-mono font-bold">{c.accessCode}</span>
                  {c.referenceCode && ` · ${c.referenceCode}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {c.registrationStatus && (
                    <Tag tone={STATUS_TONES[c.registrationStatus]}>
                      {STATUS_LABELS[c.registrationStatus]}
                    </Tag>
                  )}
                  {c.passStatus === "revoked" && (
                    <Tag tone="magenta">Código revocado</Tag>
                  )}
                  {c.checkedInAt && (
                    <Tag tone="green">
                      Ingresó a las {formatTime(c.checkedInAt)}
                    </Tag>
                  )}
                </div>
              </div>
              <Button
                disabled={c.passStatus !== "active" || pending}
                onClick={() => open(c.accessCode)}
              >
                Ver
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PassCard({
  scanned,
  pending,
  reason,
  onReason,
  onRegister,
  onReceive,
}: {
  scanned: Scanned;
  pending: boolean;
  reason: string;
  onReason: (value: string) => void;
  onRegister: (overrideReason?: string) => void;
  onReceive: (registrationId: string) => void;
}) {
  const { info, justRegistered } = scanned;

  if (info.error === "not_found") {
    return (
      <Notice tone="error" title="Código no válido">
        El código no existe o fue revocado.
      </Notice>
    );
  }
  if (info.error === "not_confirmed") {
    return (
      <Notice tone="error" title="No puede ingresar">
        {info.school ?? info.participant} pertenece a una inscripción que no
        está confirmada
        {info.registrationStatus
          ? ` (${STATUS_LABELS[info.registrationStatus]})`
          : ""}
        .
      </Notice>
    );
  }

  const isGroup = info.kind === "group";
  const done = info.already || justRegistered;
  const tutorTotal = info.tutors.length + (info.representativeAttends ? 1 : 0);

  return (
    <article className="grid gap-4 rounded-lg border-2 border-border bg-surface p-5">
      {justRegistered && <Notice tone="success">Ingreso registrado.</Notice>}
      {info.already && !justRegistered && (
        <Notice tone="warning" title="Ya había ingresado">
          {info.checkedInAt && `Ingresó a las ${formatTime(info.checkedInAt)}.`}
        </Notice>
      )}

      <div>
        <p className="text-xl font-bold">
          {isGroup ? (info.school ?? info.participant) : info.participant}
        </p>
        <p className="text-sm text-muted-foreground">
          {[
            isGroup
              ? `Representante: ${info.participant}`
              : info.role && ROLE_LABELS[info.role],
            !isGroup && info.school,
            info.referenceCode,
            info.gate && formatGate(info.gate),
            info.arrivalAt && `llegada ${formatTime(info.arrivalAt)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {isGroup && (
        <>
          <dl className="flex flex-wrap gap-4">
            <div className="rounded-md bg-tint-blue px-5 py-3">
              <dt className="text-sm font-semibold">Escolares</dt>
              <dd className="font-display text-4xl font-bold tabular-nums">
                {info.students}
              </dd>
            </div>
            <div className="rounded-md bg-tint-blue px-5 py-3">
              <dt className="text-sm font-semibold">Tutores</dt>
              <dd className="font-display text-4xl font-bold tabular-nums">
                {tutorTotal}
              </dd>
            </div>
          </dl>
          <ul className="grid gap-1 text-sm">
            {info.representativeAttends && (
              <li>{info.participant} (representante)</li>
            )}
            {info.tutors.map((t) => (
              <li key={`${t.docType}-${t.docNumber}`}>
                {t.name} · {DOC_TYPE_LABELS[t.docType]} {t.docNumber}
              </li>
            ))}
          </ul>
        </>
      )}

      {info.docsPending ? (
        <div className="grid gap-3 rounded-md border-2 border-orange bg-tint-orange p-4">
          <p className="font-bold">Documentos pendientes</p>
          <p className="text-sm">
            Revisa que traigan los documentos impresos y firmados.
          </p>
          <div>
            <Button
              size="sm"
              disabled={pending || !info.registrationId}
              onClick={() =>
                info.registrationId && onReceive(info.registrationId)
              }
            >
              Documentos recibidos
            </Button>
          </div>
          {!done && (
            <>
              <label className="grid gap-1 text-sm font-semibold">
                Si no los traen, motivo para dejarlos ingresar
                <input
                  value={reason}
                  onChange={(e) => onReason(e.target.value)}
                  maxLength={500}
                  className={cn(fieldClasses, "py-2")}
                />
              </label>
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending || reason.trim().length < 5}
                  onClick={() => onRegister(reason.trim())}
                >
                  Autorizar y registrar ingreso
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="font-bold text-green-ink">Documentos recibidos.</p>
      )}

      {!done && !info.docsPending && (
        <div>
          <Button bolt disabled={pending} onClick={() => onRegister()}>
            Registrar ingreso
          </Button>
        </div>
      )}
    </article>
  );
}
