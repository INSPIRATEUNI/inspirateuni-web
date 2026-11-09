import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoEvent } from "@/components/intranet/open-day/EventBar";
import { PrintButton } from "@/components/open-day/MyRegistrationClient";
import { Heading } from "@/components/ui/Heading";
import { getCurrentUser } from "@/lib/intranet/user";
import { formatEventDate } from "@/lib/open-day/format";
import { resolveStaffEvent } from "@/lib/open-day/staff/event";
import {
  buildExport,
  EXPORTS,
  isExportKind,
} from "@/lib/open-day/staff/exports";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Exportación del Open Day - Inspírate UNI",
};

/** Vista imprimible: un bloque por grupo, que no se parte entre páginas si cabe. */
export default async function ExportPrintPage({
  params,
  searchParams,
}: PageProps<"/intranet/open-day/exportaciones/[tipo]">) {
  const { tipo } = await params;
  if (!isExportKind(tipo)) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { selected } = await resolveStaffEvent(
    supabase,
    (await searchParams).evento,
  );
  if (!selected) return <NoEvent isAdmin={Boolean(user?.isAdmin)} />;

  const table = await buildExport(supabase, selected.id, tipo);
  const generated = new Date().toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={
            `/intranet/open-day/exportaciones?evento=${selected.id}` as Route
          }
          className="text-sm font-bold text-blue-deep hover:underline"
        >
          ← Exportaciones
        </Link>
        <PrintButton label="Imprimir" />
      </div>

      <header>
        <Heading variant="section" level={2}>
          {EXPORTS[tipo].title}
        </Heading>
        <p className="mt-1 text-sm text-muted-foreground">
          {selected.name} · {formatEventDate(selected.eventDate)} · generado el{" "}
          {generated} · solo inscripciones confirmadas
        </p>
      </header>

      {table.sections.length === 0 ? (
        <p className="text-muted-foreground">
          Aún no hay inscripciones confirmadas.
        </p>
      ) : (
        table.sections.map((section) => (
          <section
            key={section.title}
            className="grid gap-2 break-inside-avoid-page"
          >
            <div>
              <h3 className="font-display text-lg font-bold">
                {section.title}
              </h3>
              {section.subtitle && (
                <p className="text-sm text-muted-foreground">
                  {section.subtitle}
                </p>
              )}
            </div>
            <div className="overflow-x-auto rounded-md border-2 border-border bg-surface print:overflow-visible print:border">
              <table className="w-full border-collapse text-sm print:text-xs">
                <thead className="bg-background">
                  <tr>
                    {table.columns.map((column) => (
                      <th
                        key={column}
                        className="px-3 py-2 text-left font-extrabold whitespace-nowrap"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {section.rows.map((row, index) => (
                    <tr
                      // biome-ignore lint/suspicious/noArrayIndexKey: filas de solo lectura que no se reordenan
                      key={`${section.title}-${index}`}
                      className="break-inside-avoid"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          // biome-ignore lint/suspicious/noArrayIndexKey: columnas fijas de la tabla
                          key={cellIndex}
                          className="px-3 py-1.5 align-top"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
