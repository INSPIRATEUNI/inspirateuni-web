"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { reviewSubmission } from "@/app/intranet/revision/actions";
import { Button } from "@/components/ui/Button";
import { Field, fieldClasses, Input } from "@/components/ui/Field";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/intranet/evidence";
import {
  type ReviewFormValues,
  reviewFormSchema,
} from "@/lib/intranet/review-schema";
import { getEvidenceUrl } from "@/lib/storage";

export type ReviewItem = {
  id: string;
  volunteer: string;
  task: string;
  area: string | null;
  activity: string | null;
  /** Multiplicador de la actividad; las horas contadas serán aprobadas × peso. */
  weight: number;
  reportedHours: number;
  workDate: string | null;
  submittedAt: string | null;
  notes: string | null;
  evidences: { id: string; path: string; name: string; size: number | null }[];
};

function formatDate(value: string) {
  return new Date(
    value.length === 10 ? `${value}T00:00:00` : value,
  ).toLocaleDateString("es-PE", { dateStyle: "long" });
}

export function ReviewCard({ item }: { item: ReviewItem }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema(item.reportedHours)),
    defaultValues: {
      decision: "approve",
      approvedHours: item.reportedHours,
      comment: "",
    },
  });
  const decision = watch("decision");
  const approvedHours = watch("approvedHours");
  const counted =
    Number.isFinite(approvedHours) && approvedHours > 0
      ? Math.round(approvedHours * item.weight * 100) / 100
      : null;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await reviewSubmission({ submissionId: item.id, ...values });
    if (!result.ok) setServerError(result.error);
  });

  async function openEvidence(path: string) {
    setFileError(null);
    // Se abre la pestaña antes del await para que el navegador no la bloquee
    const tab = window.open("", "_blank");
    try {
      const url = await getEvidenceUrl(path);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (error) {
      tab?.close();
      setFileError(
        error instanceof Error ? error.message : "No pudimos abrir el archivo.",
      );
    }
  }

  const id = `review-${item.id}`;

  return (
    <article className="grid max-w-3xl gap-6 rounded-lg border-2 border-border bg-surface p-6">
      <header className="grid gap-2">
        <Heading variant="item" level={2}>
          {item.task}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          {item.area && <Tag tone="blue">{item.area}</Tag>}
          {item.activity && <Tag tone="green">{item.activity}</Tag>}
          <span className="text-sm text-muted-foreground">
            {item.volunteer}
            {item.submittedAt &&
              ` · enviada el ${formatDate(item.submittedAt)}`}
          </span>
        </div>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Horas reportadas</dt>
          <dd className="font-extrabold">{item.reportedHours} h</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Fecha del trabajo</dt>
          <dd className="font-extrabold">
            {item.workDate ? formatDate(item.workDate) : "—"}
          </dd>
        </div>
      </dl>

      {item.notes && (
        <div>
          <p className="font-semibold">Notas del voluntario</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">
            {item.notes}
          </p>
        </div>
      )}

      <div>
        <p className="font-semibold">Evidencias</p>
        {item.evidences.length === 0 ? (
          <p className="mt-1 text-muted-foreground">Sin archivos.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {item.evidences.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-md bg-background px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate font-semibold">
                  {file.name}
                  {file.size ? (
                    <span className="ml-2 font-normal text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => openEvidence(file.path)}
                  className="shrink-0 rounded-md px-2 py-1 font-bold text-blue-deep hover:bg-blue-soft focus-visible:outline-2 focus-visible:outline-blue"
                >
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        )}
        <FieldError id={`${id}-file-error`} message={fileError ?? undefined} />
      </div>

      <form
        noValidate
        className="grid gap-5 border-t border-border pt-6"
        onSubmit={onSubmit}
      >
        <fieldset className="grid gap-2">
          <legend className="font-semibold">Tu decisión</legend>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ["approve", "Aprobar"],
                ["reject", "Rechazar"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border-2 border-border bg-surface px-4 py-2.5 font-bold transition-colors",
                  value === "approve"
                    ? "has-checked:border-green has-checked:bg-green-soft"
                    : "has-checked:border-magenta has-checked:bg-magenta-soft",
                )}
              >
                <input
                  type="radio"
                  value={value}
                  className="size-4 accent-magenta"
                  {...register("decision")}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {decision === "approve" && (
          <Field
            id={`${id}-hours`}
            label="Horas a aprobar"
            hint={
              counted === null
                ? `Hasta ${item.reportedHours} h, lo que reportó el voluntario.`
                : `Contarán ${counted} h${item.weight === 1 ? "" : ` (peso ×${item.weight})`}.`
            }
            className="max-w-xs"
          >
            <Input
              type="number"
              id={`${id}-hours`}
              inputMode="decimal"
              step="any"
              min="0"
              max={item.reportedHours}
              aria-invalid={errors.approvedHours ? true : undefined}
              aria-describedby={cn(
                `${id}-hours-hint`,
                errors.approvedHours && `${id}-hours-error`,
              )}
              {...register("approvedHours", { valueAsNumber: true })}
            />
            <FieldError
              id={`${id}-hours-error`}
              message={errors.approvedHours?.message}
            />
          </Field>
        )}

        <Field
          id={`${id}-comment`}
          label="Comentario"
          hint={
            decision === "reject"
              ? "Obligatorio: el voluntario lo verá al corregir su entrega."
              : "Opcional."
          }
        >
          <textarea
            id={`${id}-comment`}
            rows={3}
            className={fieldClasses}
            aria-invalid={errors.comment ? true : undefined}
            aria-describedby={cn(
              `${id}-comment-hint`,
              errors.comment && `${id}-comment-error`,
            )}
            {...register("comment")}
          />
          <FieldError
            id={`${id}-comment-error`}
            message={errors.comment?.message}
          />
        </Field>

        {serverError && (
          <FieldError id={`${id}-form-error`} message={serverError} />
        )}

        <div>
          <Button
            type="submit"
            bolt={!isSubmitting}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting
              ? "Guardando…"
              : decision === "approve"
                ? "Aprobar entrega"
                : "Rechazar entrega"}
          </Button>
        </div>
      </form>
    </article>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm font-semibold text-magenta-deep">
      {message}
    </p>
  );
}
