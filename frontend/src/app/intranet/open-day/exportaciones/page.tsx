import type { Metadata, Route } from "next";
import Link from "next/link";
import { EventBar, NoEvent } from "@/components/intranet/open-day/EventBar";
import { buttonClasses } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { getCurrentUser } from "@/lib/intranet/user";
import { resolveStaffEvent } from "@/lib/open-day/staff/event";
import { EXPORTS, type ExportKind } from "@/lib/open-day/staff/exports";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Exportaciones del Open Day - Inspírate UNI",
};

export default async function ExportsPage({
  searchParams,
}: PageProps<"/intranet/open-day/exportaciones">) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { events, selected } = await resolveStaffEvent(
    supabase,
    (await searchParams).evento,
  );
  if (!selected) return <NoEvent isAdmin={Boolean(user?.isAdmin)} />;

  return (
    <div className="grid gap-6">
      <EventBar events={events} selected={selected} />
      <p className="text-sm text-muted-foreground">
        Solo incluyen inscripciones confirmadas. Descárgalas otra vez el mismo
        día para tener lo último.
      </p>
      <ul className="grid gap-4 md:grid-cols-3">
        {(
          Object.entries(EXPORTS) as [
            ExportKind,
            (typeof EXPORTS)[ExportKind],
          ][]
        ).map(([kind, def]) => (
          <li
            key={kind}
            className="grid content-between gap-4 rounded-lg border-2 border-border bg-surface p-5"
          >
            <div>
              <Heading variant="item" level={2}>
                {def.title}
              </Heading>
              <p className="mt-2 text-sm text-muted-foreground">
                {def.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/intranet/open-day/exportaciones/${kind}/csv?evento=${selected.id}`}
                className={buttonClasses({ size: "sm" })}
                download
              >
                Descargar CSV
              </a>
              <Link
                href={
                  `/intranet/open-day/exportaciones/${kind}?evento=${selected.id}` as Route
                }
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                Ver para imprimir
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
