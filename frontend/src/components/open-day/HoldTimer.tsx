"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { ClockIcon } from "@/components/site/Icons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type HoldTimerProps = {
  /** Vencimiento que devolvió el servidor (`hold_tour`/`renew_hold`). */
  expiresAt: string;
  canRenew: boolean;
  renewing: boolean;
  onRenew: () => void;
  onExpire: () => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Tiempo que queda para confirmar los recorridos retenidos. La hora de
 * vencimiento la fija el servidor; al llegar a cero se recarga la inscripción
 * (la BD libera las retenciones vencidas).
 */
export function HoldTimer({
  expiresAt,
  canRenew,
  renewing,
  onRenew,
  onExpire,
}: HoldTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const expire = useEffectEvent(onExpire);

  useEffect(() => {
    const end = Date.parse(expiresAt);
    let fired = false;
    const tick = () => {
      const seconds = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !fired) {
        fired = true;
        expire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const urgent = remaining !== null && remaining <= 300;
  const minutes = remaining === null ? "--" : pad(Math.floor(remaining / 60));
  const seconds = remaining === null ? "--" : pad(remaining % 60);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 px-4 py-3",
        urgent
          ? "border-magenta/40 bg-tint-magenta"
          : "border-blue/30 bg-tint-blue",
      )}
    >
      <div className="flex items-center gap-3">
        <ClockIcon
          className={cn("size-6", urgent ? "text-magenta" : "text-blue")}
        />
        <div>
          <p className="text-sm font-semibold">
            Tus recorridos están separados por
          </p>
          <p
            role="timer"
            aria-label="Tiempo restante para confirmar"
            className="font-display text-2xl font-bold tabular-nums"
          >
            {minutes}:{seconds}
          </p>
        </div>
      </div>
      {canRenew && (
        <Button variant="ghost" size="sm" onClick={onRenew} disabled={renewing}>
          {renewing ? "Renovando…" : "Necesito más tiempo"}
        </Button>
      )}
      {urgent && (
        <p
          className="w-full text-sm font-semibold text-magenta-deep"
          aria-live="polite"
        >
          {remaining === 0
            ? "Se acabó el tiempo."
            : "Quedan menos de 5 minutos: confirma tus recorridos."}
        </p>
      )}
    </div>
  );
}
