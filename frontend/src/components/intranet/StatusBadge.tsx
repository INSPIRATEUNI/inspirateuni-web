import { Tag } from "@/components/ui/Tag";
import type { HistoryStatus } from "@/lib/intranet/history";

const STATUS = {
  assigned: { label: "Asignada", tone: "blue" },
  submitted: { label: "Enviada", tone: "orange" },
  approved: { label: "Aprobada", tone: "green" },
  rejected: { label: "Rechazada", tone: "magenta" },
} as const;

/** Estado de una tarea del voluntario, con el color de su etapa. */
export function StatusBadge({ status }: { status: HistoryStatus }) {
  const { label, tone } = STATUS[status];
  return <Tag tone={tone}>{label}</Tag>;
}
