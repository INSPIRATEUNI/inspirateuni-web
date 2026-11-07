"use client";

import { useState } from "react";
import { PinIcon, UsersIcon } from "@/components/site/Icons";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { TIER_LABELS, TIERS } from "@/lib/open-day/constants";
import type { OpenDayError } from "@/lib/open-day/errors";
import { formatDateTime, formatTimeRange } from "@/lib/open-day/format";
import {
  confirmSelection,
  holdTour,
  releaseTour,
  renewHold,
} from "@/lib/open-day/rpc";
import {
  findOverlaps,
  groupByTier,
  pendingTiers,
  tiersLeftWithoutOption,
} from "@/lib/open-day/tours";
import type {
  OpenDayEvent,
  Registration,
  Tier,
  TourSession,
} from "@/lib/open-day/types";
import { HoldTimer } from "./HoldTimer";
import { useAvailability } from "./hooks";
import { Notice } from "./Notice";

type TourPickerProps = {
  event: OpenDayEvent;
  registration: Registration;
  onChanged: () => Promise<unknown>;
};

const TIER_TONES = { high: "magenta", mid: "orange", low: "blue" } as const;

/** Errores tras los que conviene releer la inscripción (cambió en el servidor). */
const RELOAD_CODES = new Set(["hold_expired", "bad_state", "not_found"]);

/**
 * Elección de recorridos: un recorrido por nivel, sin cruces y con cupo para
 * todo el grupo. Retiene cupo en el servidor con un temporizador y, al final,
 * confirma la selección (ya no se puede cambiar).
 */
export function TourPicker({
  event,
  registration,
  onChanged,
}: TourPickerProps) {
  const availability = useAvailability(event.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<OpenDayError | null>(null);
  const [warning, setWarning] = useState<{
    session: TourSession;
    tiers: Tier[];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const seats = registration.expectedVisitors;
  const buffer = event.travelBufferMinutes;
  const sessions = availability.sessions;
  const byId = new Map(sessions.map((s) => [s.sessionId, s]));
  const chosen = registration.enrollments
    .map((e) => byId.get(e.sessionId))
    .filter((s): s is TourSession => Boolean(s));
  const chosenIds = new Set(registration.enrollments.map((e) => e.sessionId));
  const chosenTiers = new Set(registration.enrollments.map((e) => e.tier));
  const groups = groupByTier(sessions);
  const pending = pendingTiers(sessions, chosen, seats, buffer);
  const holdExpiresAt = registration.enrollments
    .filter((e) => e.status === "held" && e.holdExpiresAt)
    .map((e) => e.holdExpiresAt as string)
    .sort()[0];
  const nothingViable =
    !availability.loading &&
    chosen.length === 0 &&
    pending.length === 0 &&
    sessions.length > 0;

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: OpenDayError }>,
  ) {
    setBusy(key);
    setError(null);
    const result = await action();
    if (!result.ok && result.error) {
      setError(result.error);
      if (RELOAD_CODES.has(result.error.code)) await onChanged();
    } else {
      await onChanged();
    }
    await availability.refresh();
    setBusy(null);
  }

  function choose(session: TourSession, force = false) {
    if (!force) {
      const lost = tiersLeftWithoutOption(
        session,
        sessions,
        chosen,
        seats,
        buffer,
      );
      if (lost.length > 0) {
        setWarning({ session, tiers: lost });
        return;
      }
    }
    setWarning(null);
    run(session.sessionId, () => holdTour(registration.id, session.sessionId));
  }

  async function confirm() {
    setBusy("confirm");
    setError(null);
    const result = await confirmSelection(registration.id);
    setBusy(null);
    setConfirming(false);
    if (!result.ok) {
      setError(result.error);
      if (RELOAD_CODES.has(result.error.code)) await onChanged();
      await availability.refresh();
      return;
    }
    await onChanged();
  }

  return (
    <div className="grid gap-6">
      {registration.status === "needs_reassignment" && (
        <Notice tone="warning" title="Uno de tus recorridos cambió">
          El staff liberó un recorrido que tenías. Elige otro y confirma de
          nuevo.
        </Notice>
      )}

      {holdExpiresAt && (
        <HoldTimer
          expiresAt={holdExpiresAt}
          canRenew={registration.holdRenewals === 0}
          renewing={busy === "renew"}
          onRenew={() => run("renew", () => renewHold(registration.id))}
          onExpire={() => {
            onChanged();
            availability.refresh();
          }}
        />
      )}

      <p className="text-muted-foreground">
        Elige un recorrido por nivel, con cupo para tus{" "}
        <strong className="text-foreground">{seats}</strong>{" "}
        {seats === 1 ? "visitante" : "visitantes"}. Entre recorridos dejamos{" "}
        {buffer} minutos para el traslado, así que no se pueden cruzar. Al
        elegir, separamos el cupo por {event.holdMinutes} minutos mientras
        terminas.
      </p>

      {availability.error && (
        <Notice tone="error">
          {availability.error}{" "}
          <button
            type="button"
            className="font-bold underline"
            onClick={() => availability.refresh()}
          >
            Reintentar
          </button>
        </Notice>
      )}
      {availability.loading && (
        <p className="text-muted-foreground" aria-live="polite">
          Cargando recorridos…
        </p>
      )}
      {nothingViable && (
        <Notice tone="error" title="Ya no hay cupos para tu grupo">
          Ningún recorrido tiene cupo para {seats} visitantes en este momento.
          Vuelve a intentarlo más tarde: a veces se liberan cupos.
        </Notice>
      )}

      {TIERS.filter((tier) => groups[tier].length > 0).map((tier) => (
        <section
          key={tier}
          aria-labelledby={`tier-${tier}`}
          className="grid gap-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h3 id={`tier-${tier}`} className="font-display text-lg font-bold">
              {TIER_LABELS[tier]}
            </h3>
            {chosenTiers.has(tier) ? (
              <Tag tone="green">Elegido</Tag>
            ) : pending.includes(tier) ? (
              <Tag tone={TIER_TONES[tier]}>Falta elegir</Tag>
            ) : (
              <Tag variant="neutral">Sin opciones para tu grupo</Tag>
            )}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups[tier].map((session) => {
              const isChosen = chosenIds.has(session.sessionId);
              const crossing = isChosen
                ? []
                : findOverlaps(session, chosen, buffer);
              const tierTaken = !isChosen && chosenTiers.has(tier);
              const full = session.seatsRemaining < seats;
              const closed = session.status !== "open";
              const disabled =
                !isChosen &&
                (tierTaken || crossing.length > 0 || full || closed);
              const reason = closed
                ? "Cerrado"
                : full
                  ? `Quedan ${session.seatsRemaining} cupos`
                  : crossing.length > 0
                    ? `Se cruza con ${crossing.map((s) => s.facultyName).join(", ")}`
                    : tierTaken
                      ? "Ya elegiste uno de este nivel"
                      : null;

              return (
                <li
                  key={session.sessionId}
                  className={cn(
                    "grid gap-3 rounded-lg border-2 p-4 transition-colors",
                    isChosen
                      ? "border-green bg-tint-green"
                      : disabled
                        ? "border-border bg-surface opacity-70"
                        : "border-border bg-surface",
                  )}
                >
                  <div>
                    <p className="font-bold">{session.facultyName}</p>
                    <p className="font-display text-lg tabular-nums">
                      {formatTimeRange(session.startsAt, session.endsAt)}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UsersIcon className="size-4" />
                        {session.seatsRemaining} cupos libres
                      </span>
                      {session.meetingPoint && (
                        <span className="inline-flex items-center gap-1">
                          <PinIcon className="size-4" />
                          {session.meetingPoint}
                        </span>
                      )}
                    </p>
                  </div>
                  {reason && !isChosen && (
                    <p className="text-sm font-semibold text-muted-foreground">
                      {reason}
                    </p>
                  )}
                  <div>
                    {isChosen ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() =>
                          run(session.sessionId, () =>
                            releaseTour(registration.id, session.sessionId),
                          )
                        }
                        aria-label={`Soltar ${session.facultyName}, ${formatTimeRange(session.startsAt, session.endsAt)}`}
                      >
                        {busy === session.sessionId ? "Soltando…" : "Soltar"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={disabled || busy !== null}
                        onClick={() => choose(session)}
                        aria-label={`Elegir ${session.facultyName}, ${formatTimeRange(session.startsAt, session.endsAt)}`}
                      >
                        {busy === session.sessionId ? "Separando…" : "Elegir"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {error && <Notice tone="error">{error.message}</Notice>}

      {chosen.length > 0 && (
        <div className="grid gap-3 rounded-lg bg-tint-magenta p-5">
          {pending.length > 0 ? (
            <p className="text-sm">
              Aún puedes elegir en:{" "}
              <strong>{pending.map((t) => TIER_LABELS[t]).join(", ")}</strong>.
              Para confirmar, elige un recorrido en cada nivel que tenga
              opciones.
            </p>
          ) : (
            <p className="text-sm">
              Listo: elegiste {chosen.length}{" "}
              {chosen.length === 1 ? "recorrido" : "recorridos"}. Revisa los
              horarios y confirma.
            </p>
          )}
          <div>
            <Button
              bolt
              disabled={pending.length > 0 || busy !== null}
              onClick={() => setConfirming(true)}
            >
              Confirmar recorridos
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={warning !== null}
        onClose={() => setWarning(null)}
        title="Este recorrido deja niveles sin opción"
      >
        {warning && (
          <div className="grid gap-5">
            <p>
              Si eliges <strong>{warning.session.facultyName}</strong> (
              {formatTimeRange(
                warning.session.startsAt,
                warning.session.endsAt,
              )}
              ), ya no podrás elegir ningún recorrido en:{" "}
              <strong>
                {warning.tiers.map((t) => TIER_LABELS[t]).join(", ")}
              </strong>
              , porque los horarios se cruzan o no queda cupo.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => choose(warning.session, true)}>
                Elegir igual
              </Button>
              <Button variant="ghost" onClick={() => setWarning(null)}>
                Ver otros horarios
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Confirmas tus recorridos?"
      >
        <div className="grid gap-5">
          <ul className="grid gap-2">
            {chosen
              .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
              .map((session) => (
                <li
                  key={session.sessionId}
                  className="rounded-md bg-tint-blue px-4 py-2"
                >
                  <span className="font-bold">{session.facultyName}</span>{" "}
                  <span className="tabular-nums">
                    {formatTimeRange(session.startsAt, session.endsAt)}
                  </span>
                </li>
              ))}
          </ul>
          <Notice tone="warning" title="Después no podrás cambiarlos">
            Al confirmar, reservamos estos recorridos para tu grupo. Tendrás{" "}
            {event.reservationHours} horas
            {event.docsCloseAt
              ? ` (como máximo hasta el ${formatDateTime(event.docsCloseAt)})`
              : ""}{" "}
            para registrar a las personas y subir los documentos; si no, la
            reserva vence.
          </Notice>
          <div className="flex flex-wrap gap-3">
            <Button bolt onClick={confirm} disabled={busy === "confirm"}>
              {busy === "confirm" ? "Confirmando…" : "Sí, confirmar"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Revisar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
