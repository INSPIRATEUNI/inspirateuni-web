"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  type CheckInResult,
  checkIn,
  searchCheckIn,
} from "@/app/intranet/open-day/check-in/actions";
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

/**
 * Check-in en puerta: busca por código (lo que tiene el QR), documento o nombre
 * y marca el ingreso. El campo queda enfocado para la siguiente persona.
 */
export function CheckInClient({ eventId }: { eventId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CheckInCandidate[] | null>(null);
  const [last, setLast] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function search(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLast(null);
    startTransition(async () => {
      const result = await searchCheckIn({ eventId, query });
      if (!result.ok) {
        setError(result.error);
        setResults(null);
        return;
      }
      setResults(result.data);
      // Un código exacto y válido se marca de inmediato (flujo rápido con lector de QR)
      const exact = result.data.filter(
        (c) =>
          c.accessCode === query.trim().toUpperCase() &&
          c.passStatus === "active",
      );
      if (exact.length === 1 && result.data.length === 1)
        mark(exact[0].accessCode);
    });
  }

  function mark(accessCode: string) {
    setError(null);
    startTransition(async () => {
      const result = await checkIn({ accessCode });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLast(result.data);
      setQuery("");
      setResults(
        (current) =>
          current?.map((c) =>
            c.accessCode === accessCode && result.data.ok
              ? { ...c, checkedInAt: result.data.checkedInAt }
              : c,
          ) ?? null,
      );
      inputRef.current?.focus();
    });
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1 font-semibold sm:min-w-80">
          Código, documento o nombre
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
        {last && <CheckInOutcome result={last} />}
      </div>

      {results && results.length === 0 && (
        <Notice tone="warning">
          No encontramos a nadie con ese dato en este evento.
        </Notice>
      )}

      {results && results.length > 0 && (
        <ul className="grid gap-3">
          {results.map((c) => {
            const confirmed = c.registrationStatus === "confirmed";
            const usable = c.passStatus === "active" && confirmed;
            return (
              <li
                key={c.accessCode}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-border bg-surface p-4"
              >
                <div className="grid gap-1">
                  <p className="text-lg font-bold">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {DOC_TYPE_LABELS[c.docType]} {c.docNumber}
                    {c.role && ` · ${ROLE_LABELS[c.role]}`}
                    {c.schoolName && ` · ${c.schoolName}`}
                  </p>
                  <p className="text-sm">
                    <span className="font-mono font-bold">{c.accessCode}</span>
                    {c.referenceCode && ` · ${c.referenceCode}`}
                    {c.gate && ` · ${formatGate(c.gate)}`}
                    {c.arrivalAt && ` · llegada ${formatTime(c.arrivalAt)}`}
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
                  </div>
                </div>
                {c.checkedInAt ? (
                  <p className="font-bold text-green-ink">
                    Ingresó a las {formatTime(c.checkedInAt)}
                  </p>
                ) : (
                  <Button
                    disabled={!usable || pending}
                    onClick={() => mark(c.accessCode)}
                    aria-busy={pending}
                  >
                    {usable ? "Marcar ingreso" : "No puede ingresar"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CheckInOutcome({ result }: { result: CheckInResult }) {
  if (!result.ok) {
    return (
      <Notice
        tone="error"
        title={
          result.reason === "not_found"
            ? "Código no válido"
            : "No puede ingresar"
        }
      >
        {result.reason === "not_found"
          ? "El código no existe o fue revocado."
          : `${result.participant ?? "Esta persona"} pertenece a una inscripción que no está confirmada${
              result.registrationStatus
                ? ` (${STATUS_LABELS[result.registrationStatus]})`
                : ""
            }.`}
      </Notice>
    );
  }
  return (
    <Notice
      tone={result.already ? "warning" : "success"}
      title={result.already ? "Ya había ingresado" : "Ingreso registrado"}
    >
      <p className="text-base font-bold">{result.participant}</p>
      <p>
        {[
          result.role && ROLE_LABELS[result.role],
          result.school,
          result.referenceCode,
          result.gate && formatGate(result.gate),
          result.already && `ingresó a las ${formatTime(result.checkedInAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </Notice>
  );
}
