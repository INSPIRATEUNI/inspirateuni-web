import type { Metadata } from "next";
import { HoursHistoryTable } from "@/components/intranet/HoursHistoryTable";
import { Mascot } from "@/components/site/Mascot";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import {
  type AssignmentRecord,
  buildHistory,
  formatHours,
} from "@/lib/intranet/history";
import { getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Historial de horas - Inspírate UNI",
};

type PeriodRow = { id: string; name: string };
type TotalRow = { total_hours: number | string; approved_submissions: number };

export default async function HoursHistoryPage() {
  const user = await getCurrentUser();
  // El layout ya redirige sin sesión; esto solo estrecha el tipo.
  if (!user) return null;

  const supabase = await createClient();

  const { data: periodData } = await supabase
    .from("management_periods")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();
  const period = periodData as PeriodRow | null;

  // RLS ya limita todo al propio usuario; se filtra además para que un
  // director no vea aquí las tareas de su área.
  const [totalResult, assignmentsResult] = await Promise.all([
    period
      ? supabase
          .from("extracurricular_hours")
          .select("total_hours, approved_submissions")
          .eq("profile_id", user.id)
          .eq("period_id", period.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("task_assignments")
      .select(
        "id, assigned_at, task:tasks!inner(id, title, due_date, area:areas(name), activity_type:activity_types(name)), position_assignment:position_assignments!inner(profile_id, period:management_periods(id, name)), submissions:task_submissions(id, status, reported_hours, approved_hours, counted_hours, work_date, review_comment, created_at, submitted_at)",
      )
      .eq("position_assignment.profile_id", user.id),
  ]);

  const total = totalResult.data as TotalRow | null;
  const rows = buildHistory(
    (assignmentsResult.data ?? []) as unknown as AssignmentRecord[],
  );
  const showPeriod = new Set(rows.map((row) => row.periodName)).size > 1;

  return (
    <section>
      <Heading variant="page">
        Historial de <GradientText gradient="discover">horas</GradientText>.
      </Heading>
      <Text variant="lead" className="mt-4 mb-10 max-w-2xl">
        Tus tareas, el estado de cada reporte y las horas que ya cuentan para tu
        constancia.
      </Text>

      {period ? (
        <div className="mb-10 inline-grid max-w-md gap-1 rounded-lg border-2 border-border bg-surface px-6 py-5">
          <p className="text-sm text-muted-foreground">
            Horas contadas · período {period.name}
          </p>
          <p className="text-h2 font-extrabold">
            {formatHours(Number(total?.total_hours ?? 0))}
          </p>
          <p className="text-sm text-muted-foreground">
            {total?.approved_submissions
              ? `${total.approved_submissions} ${total.approved_submissions === 1 ? "entrega aprobada" : "entregas aprobadas"}`
              : "Aún no tienes entregas aprobadas."}
          </p>
        </div>
      ) : (
        <Text variant="muted" className="mb-10">
          No hay un período activo, así que todavía no se cuentan horas.
        </Text>
      )}

      {rows.length === 0 ? (
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <Mascot pose="pensando" className="w-32" />
          <Text variant="muted">
            Todavía no tienes tareas asignadas. Cuando un director te asigne
            una, la verás aquí.
          </Text>
        </div>
      ) : (
        <HoursHistoryTable rows={rows} showPeriod={showPeriod} />
      )}
    </section>
  );
}
