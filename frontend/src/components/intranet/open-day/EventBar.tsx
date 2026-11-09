"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Notice } from "@/components/open-day/Notice";
import { fieldClasses } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { formatEventDate } from "@/lib/open-day/format";
import type { StaffEventOption } from "@/lib/open-day/staff/event";

/** Evento con el que se trabaja; con varios, un selector que cambia `?evento=`. */
export function EventBar({
  events,
  selected,
}: {
  events: StaffEventOption[];
  selected: StaffEventOption;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="text-sm text-muted-foreground">
        <span className="font-bold text-foreground">{selected.name}</span> ·{" "}
        {formatEventDate(selected.eventDate)}
      </p>
      {events.length > 1 && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          Evento
          <select
            className={cn(fieldClasses, "w-auto py-2 text-sm")}
            value={selected.id}
            onChange={(event) =>
              router.push(`${pathname}?evento=${event.target.value}` as Route)
            }
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({event.eventDate})
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/** Aviso cuando todavía no hay ningún Open Day creado. */
export function NoEvent({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Notice tone="info" title="Aún no hay un Open Day creado">
      {isAdmin ? (
        <>
          Créalo en{" "}
          <Link href="/intranet/open-day/configuracion" className="text-link">
            Configuración
          </Link>
          .
        </>
      ) : (
        "Pídele a un admin que lo cree en Configuración."
      )}
    </Notice>
  );
}
