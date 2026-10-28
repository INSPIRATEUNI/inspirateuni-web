export type HistoryStatus = "assigned" | "submitted" | "approved" | "rejected";

type SubmissionRecord = {
  id: string;
  status: HistoryStatus;
  reported_hours: number | null;
  approved_hours: number | null;
  counted_hours: number | null;
  work_date: string | null;
  review_comment: string | null;
  created_at: string;
  submitted_at: string | null;
};

/** Asignación de tareas para usuarios*/
export type AssignmentRecord = {
  id: string;
  assigned_at: string;
  task: {
    id: string;
    title: string;
    due_date: string | null;
    area: { name: string } | null;
    activity_type: { name: string } | null;
  };
  position_assignment: { period: { id: string; name: string } | null };
  submissions: SubmissionRecord[];
};

export type HistoryRow = {
  id: string;
  taskId: string;
  title: string;
  area: string | null;
  activity: string | null;
  periodName: string | null;
  dueDate: string | null;
  status: HistoryStatus;
  reportedHours: number | null;
  countedHours: number | null;
  workDate: string | null;
  comment: string | null;
  /** Para ordenar: lo más reciente primero. */
  lastActivity: string;
};

const toNumber = (value: number | string | null) =>
  value === null ? null : Number(value);

/**
 * Una fila por tarea asignada, según su última entrega real. Los borradores
 * (`assigned`) no cuentan: sin entrega enviada la tarea sigue "Asignada".
 */
export function buildHistory(records: AssignmentRecord[]): HistoryRow[] {
  return records
    .map((record): HistoryRow => {
      const latest = [...record.submissions]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .find((submission) => submission.status !== "assigned");

      return {
        id: record.id,
        taskId: record.task.id,
        title: record.task.title,
        area: record.task.area?.name ?? null,
        activity: record.task.activity_type?.name ?? null,
        periodName: record.position_assignment.period?.name ?? null,
        dueDate: record.task.due_date,
        status: latest?.status ?? "assigned",
        reportedHours: toNumber(latest?.reported_hours ?? null),
        countedHours:
          latest?.status === "approved" ? toNumber(latest.counted_hours) : null,
        workDate: latest?.work_date ?? null,
        comment: latest?.status === "rejected" ? latest.review_comment : null,
        lastActivity:
          latest?.submitted_at ?? latest?.created_at ?? record.assigned_at,
      };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

/** "2.5 h", sin ceros de sobra. */
export function formatHours(value: number) {
  return `${Number(value.toFixed(2))} h`;
}
