"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { saveEvent } from "@/app/intranet/open-day/configuracion/actions";
import { Notice } from "@/components/open-day/Notice";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FieldError } from "@/components/ui/FieldError";
import {
  type EventConfigInput,
  type EventConfigValues,
  eventConfigSchema,
} from "@/lib/open-day/staff/config-schema";

type FieldName = keyof EventConfigInput;

const NUMBER_FIELDS: { name: FieldName; label: string; hint?: string }[] = [
  {
    name: "holdMinutes",
    label: "Minutos para elegir recorridos",
    hint: "Retención del cupo mientras eligen.",
  },
  {
    name: "reservationHours",
    label: "Horas para completar",
    hint: "Plazo para subir documentos tras reservar.",
  },
  { name: "maxFileMb", label: "Tamaño máximo del PDF (MB)" },
  { name: "studentsPerChaperone", label: "Escolares por acompañante" },
  {
    name: "maxVisitorsPerRegistration",
    label: "Máximo de visitantes por inscripción",
    hint: "Vacío: sin tope.",
  },
  {
    name: "maxAdultsPerRegistration",
    label: "Máximo de adultos por inscripción",
    hint: "Vacío: sin tope.",
  },
  { name: "maxDraftsPerEmail", label: "Inscripciones en curso por correo" },
  {
    name: "travelBufferMinutes",
    label: "Minutos de traslado entre recorridos",
  },
];

/** Configuración editable del evento (o creación del primero). */
export function EventConfigForm({
  eventId,
  defaults,
}: {
  eventId: string | null;
  defaults: EventConfigInput;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventConfigInput, unknown, EventConfigValues>({
    resolver: zodResolver(eventConfigSchema),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSaved(false);
    const result = await saveEvent(eventId, values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSaved(true);
    if (!eventId)
      router.push(
        `/intranet/open-day/configuracion?evento=${result.data}` as Route,
      );
  });

  const text = (
    name: FieldName,
    label: string,
    type = "text",
    hint?: string,
  ) => (
    <Field id={`cfg-${name}`} label={label} hint={hint}>
      <Input
        id={`cfg-${name}`}
        type={type}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={`cfg-${name}-error${hint ? ` cfg-${name}-hint` : ""}`}
        {...register(name)}
      />
      <FieldError id={`cfg-${name}-error`} message={errors[name]?.message} />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <div className="grid gap-5 md:grid-cols-2">
        {text("name", "Nombre del evento")}
        {text("eventDate", "Fecha del evento", "date")}
        {text("venue", "Lugar")}
        <label className="flex items-center gap-3 self-end pb-3 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-green"
            {...register("registrationOpen")}
          />
          Inscripción habilitada
        </label>
        {text("registrationOpensAt", "Abre la inscripción", "datetime-local")}
        {text(
          "registrationClosesAt",
          "Cierra la inscripción",
          "datetime-local",
        )}
        {text(
          "docsCloseAt",
          "Cierre de documentos",
          "datetime-local",
          "Vacío: cierre de inscripción + horas para completar.",
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {NUMBER_FIELDS.map((f) => (
          <div key={f.name}>{text(f.name, f.label, "number", f.hint)}</div>
        ))}
      </div>

      {serverError && <Notice tone="error">{serverError}</Notice>}
      {saved && <Notice tone="success">Configuración guardada.</Notice>}

      <div>
        <Button
          type="submit"
          bolt={!isSubmitting}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {eventId ? "Guardar configuración" : "Crear evento"}
        </Button>
      </div>
    </form>
  );
}
