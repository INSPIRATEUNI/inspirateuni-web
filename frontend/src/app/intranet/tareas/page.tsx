import type { Metadata, Route } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/intranet/StatusBadge";
import { Mascot } from "@/components/site/Mascot";
import { buttonClasses } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import {
  type AssignmentRecord,
  buildHistory,
  formatHours,
  type HistoryRow,
} from "@/lib/intranet/history";
import { getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mis tareas - Inspírate UNI" };

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function TaskCard({ row }: { row: HistoryRow }) {
  const pending = row.status === "assigned" || row.status === "rejected";
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 rounded-lg border-2 border-border bg-surface p-5">
      <div className="grid min-w-0 gap-1">
        <p className="font-bold">{row.title}</p>
        <p className="text-sm text-muted-foreground">
          {[
            row.area,
            row.activity,
            row.dueDate && `vence el ${formatDate(row.dueDate)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {row.comment && (
          <p className="mt-1 rounded-md bg-tint-magenta px-3 py-2 text-sm">
            <span className="font-bold">Comentario de la revisión:</span>{" "}
            {row.comment}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={row.status} />
          {row.countedHours !== null && (
            <span>{formatHours(row.countedHours)} contadas</span>
          )}
          {row.status === "submitted" && row.reportedHours !== null && (
            <span>{formatHours(row.reportedHours)} reportadas</span>
          )}
        </div>
      </div>
      {pending && (
        <Link
          href={`/intranet/tareas/${row.taskId}/reportar` as Route}
          className={buttonClasses({
            size: "sm",
            variant: row.status === "rejected" ? "spark" : "ghost",
          })}
        >
          {row.status === "rejected" ? "Corregir y reenviar" : "Reportar horas"}
        </Link>
      )}
    </li>
  );
}

/** Tareas asignadas al usuario: primero lo pendiente, luego lo enviado o aprobado. */
export default async function MyTasksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("task_assignments")
    .select(
      "id, assigned_at, task:tasks!inner(id, title, due_date, area:areas(name), activity_type:activity_types(name)), position_assignment:position_assignments!inner(profile_id, period:management_periods(id, name)), submissions:task_submissions(id, status, reported_hours, approved_hours, counted_hours, work_date, review_comment, created_at, submitted_at)",
    )
    .eq("position_assignment.profile_id", user.id);
  const rows = buildHistory((data ?? []) as unknown as AssignmentRecord[]);
  const pending = rows.filter(
    (r) => r.status === "assigned" || r.status === "rejected",
  );
  const done = rows.filter(
    (r) => r.status === "submitted" || r.status === "approved",
  );

  return (
    <section className="grid gap-10">
      <div>
        <Heading variant="page">
          Mis <GradientText gradient="discover">tareas</GradientText>.
        </Heading>
        <Text variant="lead" className="mt-4 max-w-2xl">
          Reporta tus horas con evidencia en cada tarea. Si te piden corregir
          algo, lo verás aquí.
        </Text>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <Mascot pose="durmiendo" className="w-32" />
          <p className="text-muted-foreground">
            Aún no tienes tareas asignadas.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            <Heading variant="item" level={2}>
              Pendientes ({pending.length})
            </Heading>
            {pending.length === 0 ? (
              <p className="text-muted-foreground">Todo al día.</p>
            ) : (
              <ul className="grid gap-3">
                {pending.map((row) => (
                  <TaskCard key={row.id} row={row} />
                ))}
              </ul>
            )}
          </div>
          {done.length > 0 && (
            <div className="grid gap-4">
              <Heading variant="item" level={2}>
                Enviadas y aprobadas ({done.length})
              </Heading>
              <ul className="grid gap-3">
                {done.map((row) => (
                  <TaskCard key={row.id} row={row} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
