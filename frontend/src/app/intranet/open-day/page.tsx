import type { Metadata, Route } from "next";
import Link from "next/link";
import { EventBar, NoEvent } from "@/components/intranet/open-day/EventBar";
import { Heading } from "@/components/ui/Heading";
import { getCurrentUser } from "@/lib/intranet/user";
import { formatTimeRange } from "@/lib/open-day/format";
import { resolveStaffEvent, withEvent } from "@/lib/open-day/staff/event";
import {
  fetchCheckInCount,
  fetchSessions,
  fetchStatusCounts,
} from "@/lib/open-day/staff/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Open Day - Inspírate UNI" };

export default async function OpenDayOverviewPage({
  searchParams,
}: PageProps<"/intranet/open-day">) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { events, selected } = await resolveStaffEvent(
    supabase,
    (await searchParams).evento,
  );
  if (!selected) return <NoEvent isAdmin={Boolean(user?.isAdmin)} />;

  const [status, checkIns, sessions] = await Promise.all([
    fetchStatusCounts(supabase, selected.id),
    fetchCheckInCount(supabase, selected.id),
    fetchSessions(supabase, selected.id),
  ]);
  const count = (s: keyof typeof status.counts) => status.counts[s] ?? 0;
  const inbox = (tab: string) =>
    withEvent(
      `/intranet/open-day/inscripciones?tab=${tab}`,
      selected.id,
    ) as Route;

  const tiles = [
    {
      label: "Por validar",
      value: count("submitted"),
      hint: "Enviadas, esperan revisión",
      href: inbox("por-validar"),
      tone: "text-blue-deep",
    },
    {
      label: "Observadas",
      value: count("docs_observed"),
      hint: "Esperan documentos corregidos",
      href: inbox("observadas"),
      tone: "text-magenta-deep",
    },
    {
      label: "Confirmadas",
      value: count("confirmed"),
      hint: `${status.visitors.confirmed ?? 0} visitantes`,
      href: inbox("confirmadas"),
      tone: "text-green-ink",
    },
    {
      label: "En curso",
      value: count("draft") + count("held") + count("reserved"),
      hint: "Aún no envían",
      href: inbox("en-curso"),
      tone: "text-orange-ink",
    },
    {
      label: "Por reasignar",
      value: count("needs_reassignment"),
      hint: "Su recorrido se canceló",
      href: inbox("reasignar"),
      tone: "text-magenta-deep",
    },
    {
      label: "Ingresos",
      value: checkIns.checkedIn,
      hint: `de ${checkIns.active} pases activos`,
      href: withEvent("/intranet/open-day/check-in", selected.id) as Route,
      tone: "text-foreground",
    },
  ];

  const active = sessions.filter((s) => s.status !== "cancelled");

  return (
    <div className="grid gap-8">
      <EventBar events={events} selected={selected} />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className="block rounded-lg border-2 border-border bg-surface p-5 transition-colors duration-250 hover:border-magenta/50"
            >
              <p className="text-sm font-bold text-muted-foreground">
                {tile.label}
              </p>
              <p
                className={`mt-1 font-display text-4xl font-bold tabular-nums ${tile.tone}`}
              >
                {tile.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{tile.hint}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section className="grid gap-4">
        <Heading variant="item" level={2}>
          Ocupación de los recorridos
        </Heading>
        {active.length === 0 ? (
          <p className="text-muted-foreground">
            Aún no hay recorridos. Cárgalos en{" "}
            <Link
              href={
                withEvent("/intranet/open-day/horarios", selected.id) as Route
              }
              className="text-link"
            >
              Horarios
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface">
            <table className="w-full min-w-[36rem] border-collapse">
              <caption className="sr-only">Cupos tomados por recorrido</caption>
              <thead className="bg-background">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-extrabold">
                    Facultad
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-extrabold">
                    Horario
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-extrabold">
                    Ocupación
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map((s) => {
                  const pct =
                    s.capacity > 0
                      ? Math.round((s.seatsTaken / s.capacity) * 100)
                      : 0;
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-semibold">
                        {s.facultyName}
                        {s.status === "closed" && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (cerrado)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {formatTimeRange(s.startsAt, s.endsAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-2 w-32 overflow-hidden rounded-full bg-background"
                            aria-hidden="true"
                          >
                            <div
                              className={
                                pct >= 100
                                  ? "h-full bg-magenta"
                                  : "h-full bg-green"
                              }
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm tabular-nums">
                            {s.seatsTaken} de {s.capacity}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
