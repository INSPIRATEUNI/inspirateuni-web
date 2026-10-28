import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { formatBytes } from "@/lib/intranet/evidence";

export type SubmissionView = {
  status: "submitted" | "approved" | "rejected";
  reportedHours: number | null;
  approvedHours: number | null;
  workDate: string | null;
  notes: string | null;
  evidences: { id: string; name: string; size: number | null }[];
};

const STATUS_LABEL = {
  submitted: { label: "En revisión", tone: "blue" },
  approved: { label: "Aprobada", tone: "green" },
  rejected: { label: "Rechazada", tone: "orange" },
} as const;

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-PE", {
    dateStyle: "long",
  });
}

/** Entrega ya enviada: solo lectura. */
export function SubmissionSummary({
  submission,
}: {
  submission: SubmissionView;
}) {
  const status = STATUS_LABEL[submission.status];

  return (
    <div className="grid max-w-2xl gap-6 rounded-lg border-2 border-border bg-surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Tag tone={status.tone}>{status.label}</Tag>
        {submission.status === "submitted" && (
          <Text variant="muted" className="text-sm">
            Un director de tu área la revisará pronto. Mientras tanto no puedes
            modificarla.
          </Text>
        )}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Item label="Horas reportadas">
          {submission.reportedHours ?? "—"} h
        </Item>
        {submission.status === "approved" && (
          <Item label="Horas aprobadas">
            {submission.approvedHours ?? "—"} h
          </Item>
        )}
        <Item label="Fecha del trabajo">
          {submission.workDate ? formatDate(submission.workDate) : "—"}
        </Item>
      </dl>

      {submission.notes && (
        <div>
          <p className="font-semibold">Notas</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">
            {submission.notes}
          </p>
        </div>
      )}

      <div>
        <p className="font-semibold">Evidencias</p>
        {submission.evidences.length === 0 ? (
          <p className="mt-1 text-muted-foreground">Sin archivos.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {submission.evidences.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-md bg-background px-4 py-2.5 text-sm"
              >
                <span className="truncate font-semibold">{file.name}</span>
                {file.size ? (
                  <span className="shrink-0 text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-extrabold">{children}</dd>
    </div>
  );
}
