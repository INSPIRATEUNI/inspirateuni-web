import type { NextRequest } from "next/server";
import { z } from "zod";
import { toCsv } from "@/lib/csv";
import { getCurrentUser } from "@/lib/intranet/user";
import {
  buildExport,
  exportToRows,
  isExportKind,
} from "@/lib/open-day/staff/exports";
import { createClient } from "@/lib/supabase/server";

/** Descarga en CSV (para Excel) de una exportación del Open Day. Solo la directiva. */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/intranet/open-day/exportaciones/[tipo]/csv">,
) {
  const user = await getCurrentUser();
  if (!user?.isBoard) return new Response("No autorizado", { status: 403 });

  const { tipo } = await ctx.params;
  const eventId = request.nextUrl.searchParams.get("evento");
  if (!isExportKind(tipo) || !z.guid().safeParse(eventId).success) {
    return new Response("Exportación no válida", { status: 400 });
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("event_date")
    .eq("id", eventId as string)
    .maybeSingle();
  if (!event) return new Response("Evento no encontrado", { status: 404 });

  const table = await buildExport(supabase, eventId as string, tipo);
  return new Response(toCsv(exportToRows(tipo, table)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="open-day-${event.event_date}-${tipo}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
