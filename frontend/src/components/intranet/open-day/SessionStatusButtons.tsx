"use client";

import { useState, useTransition } from "react";
import { setSessionStatus } from "@/app/intranet/open-day/horarios/actions";

type Status = "open" | "closed" | "cancelled";

/** Acciones de admin sobre un recorrido. Cancelar pide confirmación porque no se deshace. */
export function SessionStatusButtons({
  sessionId,
  status,
  seatsTaken,
}: {
  sessionId: string;
  status: Status;
  seatsTaken: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: Status) {
    if (
      next === "cancelled" &&
      !window.confirm(
        seatsTaken > 0
          ? `Este recorrido tiene ${seatsTaken} cupos tomados. Esas inscripciones pasarán a "requiere elegir otro recorrido" y recibirán un correo. ¿Cancelar?`
          : "¿Cancelar este recorrido?",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setSessionStatus({ sessionId, status: next });
      if (!result.ok) setError(result.error);
    });
  }

  if (status === "cancelled")
    return <span className="text-sm text-muted-foreground">Cancelado</span>;

  const button =
    "rounded-md px-2 py-1 text-sm font-bold hover:bg-background focus-visible:outline-2 disabled:opacity-60";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        className={`${button} text-blue-deep`}
        disabled={pending}
        onClick={() => change(status === "open" ? "closed" : "open")}
      >
        {status === "open" ? "Cerrar" : "Abrir"}
      </button>
      <button
        type="button"
        className={`${button} text-magenta-deep`}
        disabled={pending}
        onClick={() => change("cancelled")}
      >
        Cancelar
      </button>
      {error && (
        <span role="alert" className="w-full text-xs text-magenta-deep">
          {error}
        </span>
      )}
    </span>
  );
}
