import type { Metadata } from "next";
import { EventBar, NoEvent } from "@/components/intranet/open-day/EventBar";
import { ScheduleImport } from "@/components/intranet/open-day/ScheduleImport";
import { SessionStatusButtons } from "@/components/intranet/open-day/SessionStatusButtons";
import { Heading } from "@/components/ui/Heading";
import { getCurrentUser } from "@/lib/intranet/user";
import { TIER_LABELS } from "@/lib/open-day/constants";
import { formatTimeRange } from "@/lib/open-day/format";
import { resolveStaffEvent } from "@/lib/open-day/staff/event";
import {
  fetchEventFaculties,
  fetchSessions,
} from "@/lib/open-day/staff/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Horarios del Open Day - Inspírate UNI",
};

const STATUS_TEXT = {
  open: "Abierto",
  closed: "Cerrado",
  cancelled: "Cancelado",
} as const;

export default async function SchedulePage({
  searchParams,
}: PageProps<"/intranet/open-day/horarios">) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { events, selected } = await resolveStaffEvent(
    supabase,
    (await searchParams).evento,
  );
  if (!selected) return <NoEvent isAdmin={Boolean(user?.isAdmin)} />;

  const [sessions, faculties] = await Promise.all([
    fetchSessions(supabase, selected.id),
    fetchEventFaculties(supabase, selected.id),
  ]);

  return (
    <div className="grid gap-8">
      <EventBar events={events} selected={selected} />

      {faculties.length === 0 ? (
        <p className="text-muted-foreground">
          Primero agrega las facultades del evento en Configuración (solo
          admin).
        </p>
      ) : (
        <ScheduleImport
          eventId={selected.id}
          eventDate={selected.eventDate}
          faculties={faculties.map((f) => f.name)}
        />
      )}

      <section className="grid gap-3">
        <Heading variant="item" level={2}>
          Recorridos ({sessions.length})
        </Heading>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">
            Aún no hay recorridos cargados.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface">
            <table className="w-full min-w-[48rem] border-collapse">
              <caption className="sr-only">Recorridos del evento</caption>
              <thead className="bg-background">
                <tr>
                  {[
                    "Facultad",
                    "Horario",
                    "Cupo",
                    "Punto de encuentro",
                    "Estado",
                    "",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-sm font-extrabold"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className={
                      s.status === "cancelled" ? "opacity-60" : undefined
                    }
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">{s.facultyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {TIER_LABELS[s.tier]}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {formatTimeRange(s.startsAt, s.endsAt)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {s.seatsTaken} de {s.capacity}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {s.meetingPoint ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {STATUS_TEXT[s.status]}
                    </td>
                    <td className="px-4 py-3">
                      {user?.isAdmin && (
                        <SessionStatusButtons
                          sessionId={s.id}
                          status={s.status}
                          seatsTaken={s.seatsTaken}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
