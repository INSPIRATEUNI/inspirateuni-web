"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { submitReport } from "@/app/intranet/tareas/[id]/reportar/actions";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/Button";
import { Field, fieldClasses, Input } from "@/components/ui/Field";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import {
  EVIDENCE_ACCEPT,
  type EvidenceMeta,
  formatBytes,
  MAX_EVIDENCE_FILES,
  MAX_EVIDENCE_MB,
} from "@/lib/intranet/evidence";
import {
  type ReportFormValues,
  reportFormSchema,
} from "@/lib/intranet/report-schema";
import { todayInLima } from "@/lib/intranet/task-schema";
import { removeEvidence, uploadEvidence } from "@/lib/storage";

type ReportFormProps = {
  taskId: string;
  userId: string;
  /** Valores de una entrega rechazada, para corregirla. */
  defaults?: {
    reportedHours: number | null;
    workDate: string | null;
    notes: string | null;
  };
};

const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

export function ReportForm({ taskId, userId, defaults }: ReportFormProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      reportedHours: defaults?.reportedHours ?? Number.NaN,
      workDate: defaults?.workDate ?? "",
      notes: defaults?.notes ?? "",
      files: [],
    },
  });
  const files = watch("files");

  function setFiles(next: File[]) {
    setValue("files", next, { shouldValidate: isSubmitted });
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const merged = [...getValues("files")];
    for (const file of Array.from(list)) {
      if (!merged.some((current) => sameFile(current, file))) merged.push(file);
    }
    setFiles(merged);
    // Permite volver a elegir el mismo archivo después de quitarlo
    if (fileInput.current) fileInput.current.value = "";
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const uploaded: EvidenceMeta[] = [];
    try {
      for (const file of values.files) {
        uploaded.push(await uploadEvidence(file, userId));
      }
    } catch (error) {
      await removeEvidence(uploaded.map((file) => file.path));
      setServerError(
        error instanceof Error
          ? error.message
          : "No pudimos subir tus evidencias. Inténtalo de nuevo.",
      );
      return;
    }

    const result = await submitReport({
      taskId,
      reportedHours: values.reportedHours,
      workDate: values.workDate,
      notes: values.notes,
      evidences: uploaded,
    });
    if (!result.ok) {
      await removeEvidence(uploaded.map((file) => file.path));
      setServerError(result.error);
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-6 text-center"
      >
        <Mascot
          pose="alegre"
          className="w-28 animate-mascot-float motion-reduce:animate-none"
        />
        <div>
          <Heading variant="section" level={2}>
            ¡Reporte <GradientText gradient="fresh">enviado</GradientText>!
          </Heading>
          <Text variant="lead" className="mt-3">
            Un director de tu área lo revisará pronto.
          </Text>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button bolt onClick={() => router.refresh()}>
            Ver mi entrega
          </Button>
          <Button href="/intranet" variant="ghost">
            Ir al inicio
          </Button>
        </div>
      </div>
    );
  }

  const fileErrors = Array.isArray(errors.files)
    ? errors.files.flatMap((item) => (item?.message ? [item.message] : []))
    : [];
  const filesMessage = errors.files?.message ?? errors.files?.root?.message;

  return (
    <form noValidate className="grid max-w-2xl gap-6" onSubmit={onSubmit}>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="report-hours"
          label="Horas dedicadas"
          hint="Puedes usar decimales, por ejemplo 2.5."
        >
          <Input
            type="number"
            id="report-hours"
            inputMode="decimal"
            step="any"
            min="0"
            aria-invalid={errors.reportedHours ? true : undefined}
            aria-describedby={cn(
              "report-hours-hint",
              errors.reportedHours && "report-hours-error",
            )}
            {...register("reportedHours", { valueAsNumber: true })}
          />
          <FieldError
            id="report-hours-error"
            message={errors.reportedHours?.message}
          />
        </Field>

        <Field id="report-date" label="Fecha del trabajo">
          <Input
            type="date"
            id="report-date"
            max={todayInLima()}
            aria-invalid={errors.workDate ? true : undefined}
            aria-describedby={errors.workDate ? "report-date-error" : undefined}
            {...register("workDate")}
          />
          <FieldError
            id="report-date-error"
            message={errors.workDate?.message}
          />
        </Field>
      </div>

      <Field
        id="report-notes"
        label="Notas"
        hint="Opcional. Cuéntale al director qué hiciste."
      >
        <textarea
          id="report-notes"
          rows={4}
          className={fieldClasses}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={cn(
            "report-notes-hint",
            errors.notes && "report-notes-error",
          )}
          {...register("notes")}
        />
        <FieldError id="report-notes-error" message={errors.notes?.message} />
      </Field>

      <fieldset className="grid gap-3">
        <legend className="font-semibold">Evidencias</legend>
        <Text variant="muted" className="text-sm">
          Entre 1 y {MAX_EVIDENCE_FILES} archivos: imágenes (PNG, JPG, WebP) o
          PDF, de hasta {MAX_EVIDENCE_MB} MB cada uno.
        </Text>
        <input
          ref={fileInput}
          type="file"
          id="report-files"
          multiple
          accept={EVIDENCE_ACCEPT}
          className="sr-only"
          onChange={(event) => addFiles(event.target.files)}
        />
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSubmitting || files.length >= MAX_EVIDENCE_FILES}
            onClick={() => fileInput.current?.click()}
          >
            Agregar archivos
          </Button>
        </div>

        {files.length > 0 && (
          <ul className="grid gap-2">
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-3 rounded-md bg-background px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate font-semibold">
                  {file.name}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setFiles(getValues("files").filter((item) => item !== file))
                  }
                  aria-label={`Quitar ${file.name}`}
                  className="shrink-0 rounded-md px-2 py-1 font-bold text-magenta-deep hover:bg-magenta-soft focus-visible:outline-2 focus-visible:outline-magenta"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <FieldError id="report-files-error" message={filesMessage} />
        {fileErrors.map((message) => (
          <FieldError
            key={message}
            id={`report-file-${message}`}
            message={message}
          />
        ))}
      </fieldset>

      {serverError && (
        <FieldError id="report-form-error" message={serverError} />
      )}

      <Button
        type="submit"
        bolt={!isSubmitting}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="w-full justify-center sm:w-auto"
      >
        {isSubmitting ? "Enviando reporte…" : "Enviar reporte"}
      </Button>
    </form>
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
