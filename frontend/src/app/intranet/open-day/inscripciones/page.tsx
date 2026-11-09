import type { Metadata, Route } from "next";
import Link from "next/link";
import { EventBar, NoEvent } from "@/components/intranet/open-day/EventBar";
import { Mascot } from "@/components/site/Mascot";
import { fieldClasses } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { getCurrentUser } from "@/lib/intranet/user";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/open-day/constants";
import { formatDateTime } from "@/lib/open-day/format";
import { resolveStaffEvent } from "@/lib/open-day/staff/event";
import {
  fetchInbox,
  fetchStatusCounts,
  INBOX_PAGE_SIZE,
  INBOX_TABS,
  type InboxTab,
  isInboxTab,
} from "@/lib/open-day/staff/queries";
import type { RegistrationKind } from "@/lib/open-day/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Inscripciones del Open Day - Inspírate UNI",
};

const KIND_LABELS: Record<RegistrationKind, string> = {
  school: "Colegio",
  individual: "Persona libre",
};

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function InboxPage({
  searchParams,
}: PageProps<"/intranet/open-day/inscripciones">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { events, selected } = await resolveStaffEvent(supabase, params.evento);
  if (!selected) return <NoEvent isAdmin={Boolean(user?.isAdmin)} />;

  const tab: InboxTab = isInboxTab(params.tab) ? params.tab : "por-validar";
  const kindParam = one(params.tipo);
  const kind: RegistrationKind | null =
    kindParam === "school" || kindParam === "individual" ? kindParam : null;
  const query = one(params.q) ?? "";
  const page = Math.max(1, Number.parseInt(one(params.pagina) ?? "1", 10) || 1);

  const [{ rows, total }, status] = await Promise.all([
    fetchInbox(supabase, { eventId: selected.id, tab, kind, query, page }),
    fetchStatusCounts(supabase, selected.id),
  ]);
  const pages = Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE));

  const href = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams({ evento: selected.id, tab });
    if (kind) next.set("tipo", kind);
    if (query) next.set("q", query);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    return `/intranet/open-day/inscripciones?${next}` as Route;
  };

  return (
    <div className="grid gap-6">
      <EventBar events={events} selected={selected} />

      <nav aria-label="Estados" className="flex flex-wrap gap-2">
        {(
          Object.entries(INBOX_TABS) as [
            InboxTab,
            (typeof INBOX_TABS)[InboxTab],
          ][]
        ).map(([key, def]) => {
          const n = def.statuses.reduce(
            (sum, s) => sum + (status.counts[s] ?? 0),
            0,
          );
          const active = key === tab;
          return (
            <Link
              key={key}
              href={href({ tab: key, pagina: null })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md border-2 px-3 py-1.5 text-sm font-bold transition-colors duration-250",
                active
                  ? "border-magenta bg-magenta-soft text-magenta-deep"
                  : "border-border bg-surface hover:border-magenta/40",
              )}
            >
              {def.label} <span className="tabular-nums">({n})</span>
            </Link>
          );
        })}
      </nav>

      <form
        className="flex flex-wrap items-end gap-3"
        action="/intranet/open-day/inscripciones"
      >
        <input type="hidden" name="evento" value={selected.id} />
        <input type="hidden" name="tab" value={tab} />
        <label className="grid flex-1 gap-1 text-sm font-semibold sm:min-w-64">
          Buscar
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Código OD-, colegio, contacto o correo"
            className={cn(fieldClasses, "py-2")}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Tipo
          <select
            name="tipo"
            defaultValue={kind ?? ""}
            className={cn(fieldClasses, "py-2")}
          >
            <option value="">Todos</option>
            <option value="school">Colegios</option>
            <option value="individual">Personas libres</option>
          </select>
        </label>
        <button type="submit" className="btn btn-ghost btn-sm">
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <Mascot pose="durmiendo" className="w-28" />
          <p className="text-muted-foreground">
            {query || kind
              ? "No hay inscripciones con esos filtros."
              : "No hay inscripciones aquí."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface">
          <table className="w-full min-w-[48rem] border-collapse">
            <caption className="sr-only">
              Inscripciones: {INBOX_TABS[tab].label}, página {page} de {pages}
            </caption>
            <thead className="bg-background">
              <tr>
                {[
                  "Código",
                  "Inscripción",
                  "Visitantes",
                  "Estado",
                  "Enviada",
                  "Plazo de documentos",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-sm font-extrabold whitespace-nowrap"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-background/60">
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={
                        `/intranet/open-day/inscripciones/${row.id}?evento=${selected.id}` as Route
                      }
                      className="font-mono font-bold whitespace-nowrap text-blue-deep hover:underline"
                    >
                      {row.referenceCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-semibold">
                      {row.schoolName ?? row.contactName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {KIND_LABELS[row.kind]}
                      {row.schoolName ? ` · ${row.contactName}` : ""} ·{" "}
                      {row.contactEmail}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums">
                    {row.expectedVisitors}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Tag tone={STATUS_TONES[row.status]}>
                      {STATUS_LABELS[row.status]}
                    </Tag>
                  </td>
                  <td className="px-4 py-3 align-top text-sm whitespace-nowrap">
                    {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 align-top text-sm whitespace-nowrap">
                    {row.docsDeadline ? formatDateTime(row.docsDeadline) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav
          aria-label="Páginas"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Link
              href={href({ pagina: page - 1 })}
              className="btn btn-ghost btn-sm"
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Página {page} de {pages} · {total} inscripciones
          </span>
          {page < pages ? (
            <Link
              href={href({ pagina: page + 1 })}
              className="btn btn-ghost btn-sm"
            >
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
