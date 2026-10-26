"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createTask } from "@/app/intranet/tareas/nueva/actions";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/Button";
import { Field, fieldClasses, Input, Select } from "@/components/ui/Field";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import {
  type TaskFormValues,
  taskSchema,
  todayInLima,
} from "@/lib/intranet/task-schema";

export type TaskFormOption = { id: string; name: string };
export type TaskFormAssignee = TaskFormOption & { areaId: string };

type TaskFormProps = {
  areas: TaskFormOption[];
  activityTypes: TaskFormOption[];
  assignees: TaskFormAssignee[];
};

export function TaskForm({ areas, activityTypes, assignees }: TaskFormProps) {
  const singleArea = areas.length === 1 ? areas[0] : undefined;
  const emptyValues: TaskFormValues = {
    title: "",
    description: "",
    areaId: singleArea?.id ?? "",
    activityTypeId: "",
    dueDate: "",
    assigneeIds: [],
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: emptyValues,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const areaId = watch("areaId");
  const selected = watch("assigneeIds");
  const areaAssignees = assignees.filter((person) => person.areaId === areaId);

  function toggleAssignee(id: string) {
    const next = selected.includes(id)
      ? selected.filter((value) => value !== id)
      : [...selected, id];
    setValue("assigneeIds", next, { shouldValidate: isSubmitted });
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await createTask(values);
    if (result.ok) setCreated(true);
    else setServerError(result.error);
  });

  if (created) {
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
            ¡Tarea <GradientText gradient="fresh">creada</GradientText>!
          </Heading>
          <Text variant="lead" className="mt-3">
            Los voluntarios ya la tienen asignada.
          </Text>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            bolt
            onClick={() => {
              reset(emptyValues);
              setCreated(false);
            }}
          >
            Crear otra tarea
          </Button>
          <Button href="/intranet" variant="ghost">
            Ir al inicio
          </Button>
        </div>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <Text variant="muted">
        No tienes un área asignada en el período activo, así que todavía no
        puedes crear tareas.{" "}
        <Link href="/intranet" className="font-semibold underline">
          Volver al inicio
        </Link>
        .
      </Text>
    );
  }

  return (
    <form noValidate className="grid max-w-2xl gap-6" onSubmit={onSubmit}>
      <Field id="task-title" label="Título de la tarea">
        <Input
          id="task-title"
          autoComplete="off"
          placeholder="Diseñar el afiche del Open Day"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "task-title-error" : undefined}
          {...register("title")}
        />
        <FieldError id="task-title-error" message={errors.title?.message} />
      </Field>

      <Field
        id="task-description"
        label="Descripción"
        hint="Opcional. Explica qué se espera y cómo se entrega."
      >
        <textarea
          id="task-description"
          rows={4}
          className={fieldClasses}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={cn(
            "task-description-hint",
            errors.description && "task-description-error",
          )}
          {...register("description")}
        />
        <FieldError
          id="task-description-error"
          message={errors.description?.message}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        {singleArea ? (
          <div className="grid content-start gap-2">
            <span className="font-semibold">Área</span>
            <p className="rounded-lg border-2 border-border bg-background px-4 py-3">
              {singleArea.name}
            </p>
          </div>
        ) : (
          <Field id="task-area" label="Área">
            <Select
              id="task-area"
              aria-invalid={errors.areaId ? true : undefined}
              aria-describedby={errors.areaId ? "task-area-error" : undefined}
              {...register("areaId", {
                // Los voluntarios dependen del área: se limpia la selección
                onChange: () => setValue("assigneeIds", []),
              })}
            >
              <option value="">Elige un área</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
            <FieldError id="task-area-error" message={errors.areaId?.message} />
          </Field>
        )}

        <Field id="task-activity" label="Tipo de actividad">
          <Select
            id="task-activity"
            aria-invalid={errors.activityTypeId ? true : undefined}
            aria-describedby={
              errors.activityTypeId ? "task-activity-error" : undefined
            }
            {...register("activityTypeId")}
          >
            <option value="">Elige un tipo</option>
            {activityTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
          <FieldError
            id="task-activity-error"
            message={errors.activityTypeId?.message}
          />
        </Field>

        <Field
          id="task-due"
          label="Fecha límite"
          hint="Opcional."
          className="sm:col-span-1"
        >
          <Input
            type="date"
            id="task-due"
            min={todayInLima()}
            aria-invalid={errors.dueDate ? true : undefined}
            aria-describedby={cn(
              "task-due-hint",
              errors.dueDate && "task-due-error",
            )}
            {...register("dueDate")}
          />
          <FieldError id="task-due-error" message={errors.dueDate?.message} />
        </Field>
      </div>

      <fieldset
        className="grid gap-3"
        aria-describedby={
          errors.assigneeIds ? "task-assignees-error" : undefined
        }
      >
        <legend className="font-semibold">Voluntarios asignados</legend>
        {!areaId ? (
          <Text variant="muted" className="text-sm">
            Elige un área para ver a sus voluntarios.
          </Text>
        ) : areaAssignees.length === 0 ? (
          <Text variant="muted" className="text-sm">
            Esta área no tiene voluntarios activos en el período actual.
          </Text>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {areaAssignees.map((person) => (
              <li key={person.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-surface px-4 py-3 transition-colors has-checked:border-magenta has-checked:bg-magenta-soft">
                  <input
                    type="checkbox"
                    className="size-4 accent-magenta"
                    checked={selected.includes(person.id)}
                    onChange={() => toggleAssignee(person.id)}
                  />
                  <span className="font-semibold">{person.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <FieldError
          id="task-assignees-error"
          message={errors.assigneeIds?.message}
        />
      </fieldset>

      {serverError && <FieldError id="task-form-error" message={serverError} />}

      <Button
        type="submit"
        bolt={!isSubmitting}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="w-full justify-center sm:w-auto"
      >
        {isSubmitting ? "Creando tarea…" : "Crear tarea"}
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
