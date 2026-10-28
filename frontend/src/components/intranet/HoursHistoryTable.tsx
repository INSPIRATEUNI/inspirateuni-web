import Link from "next/link";
import {
  formatHours,
  type HistoryRow,
  type HistoryStatus,
} from "@/lib/intranet/history";
import { StatusBadge } from "./StatusBadge";

const ACTION: Record<HistoryStatus, string> = {
  assigned: "Reportar",
  submitted: "Ver",
  approved: "Ver",
  rejected: "Corregir",
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-PE", {
    dateStyle: "medium",
  });
}

const headClasses =
  "px-4 py-3 text-left text-sm font-extrabold whitespace-nowrap";
const cellClasses = "px-4 py-3 align-top";

/** Historial de tareas del voluntario; en pantallas chicas se desplaza de lado. */
export function HoursHistoryTable({
  rows,
  showPeriod,
}: {
  rows: HistoryRow[];
  showPeriod: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface">
      <table className="w-full min-w-[44rem] border-collapse">
        <caption className="sr-only">Historial de tareas y horas</caption>
        <thead className="bg-background">
          <tr>
            <th scope="col" className={headClasses}>
              Tarea
            </th>
            <th scope="col" className={headClasses}>
              Actividad
            </th>
            <th scope="col" className={headClasses}>
              Estado
            </th>
            <th scope="col" className={`${headClasses} text-right`}>
              Reportadas
            </th>
            <th scope="col" className={`${headClasses} text-right`}>
              Contadas
            </th>
            <th scope="col" className={headClasses}>
              Fecha del trabajo
            </th>
            <th scope="col" className={headClasses}>
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" className={`${cellClasses} text-left font-bold`}>
                {row.title}
                <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                  {[row.area, showPeriod ? row.periodName : null]
                    .filter(Boolean)
                    .join(" · ")}
                  {row.dueDate && ` · límite ${formatDate(row.dueDate)}`}
                </span>
                {row.comment && (
                  <span className="mt-2 block rounded-md bg-magenta-soft px-3 py-2 text-sm font-normal text-magenta-deep">
                    Comentario del director: {row.comment}
                  </span>
                )}
              </th>
              <td className={cellClasses}>{row.activity ?? "—"}</td>
              <td className={cellClasses}>
                <StatusBadge status={row.status} />
              </td>
              <td className={`${cellClasses} text-right tabular-nums`}>
                {row.reportedHours === null
                  ? "—"
                  : formatHours(row.reportedHours)}
              </td>
              <td
                className={`${cellClasses} text-right font-extrabold tabular-nums`}
              >
                {row.countedHours === null
                  ? "—"
                  : formatHours(row.countedHours)}
              </td>
              <td className={`${cellClasses} whitespace-nowrap`}>
                {row.workDate ? formatDate(row.workDate) : "—"}
              </td>
              <td className={`${cellClasses} text-right`}>
                <Link
                  href={`/intranet/tareas/${row.taskId}/reportar`}
                  className="font-bold text-blue-deep underline-offset-4 hover:underline"
                >
                  {ACTION[row.status]}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
