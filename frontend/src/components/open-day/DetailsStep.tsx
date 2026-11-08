"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FieldError } from "@/components/ui/FieldError";
import { startRegistration } from "@/lib/open-day/rpc";
import {
  type IndividualDetailsValues,
  individualDetailsSchema,
  type SchoolDetailsValues,
  schoolDetailsSchema,
} from "@/lib/open-day/schemas";
import type { OpenDayEvent } from "@/lib/open-day/types";
import { Notice } from "./Notice";
import { type PickedSchool, SchoolPicker } from "./SchoolPicker";

type DetailsProps = {
  event: OpenDayEvent;
  defaultEmail: string;
  onStarted: (registrationId: string) => void;
};

/** Paso "Datos y cantidades" del colegio: crea la inscripción en borrador. */
export function SchoolDetailsStep({
  event,
  defaultEmail,
  onStarted,
}: DetailsProps) {
  const schema = useMemo(
    () => schoolDetailsSchema(event.maxVisitorsPerRegistration),
    [event.maxVisitorsPerRegistration],
  );
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SchoolDetailsValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      schoolId: "",
      contactName: "",
      contactEmail: defaultEmail,
      expectedVisitors: Number.NaN,
    },
  });
  const [school, setSchool] = useState<PickedSchool | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await startRegistration({
      eventId: event.id,
      kind: "school",
      schoolId: values.schoolId,
      expectedVisitors: values.expectedVisitors,
      contactName: values.contactName,
      contactEmail: values.contactEmail,
    });
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    onStarted(result.data.id);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Controller
        control={control}
        name="schoolId"
        render={({ field, fieldState }) => (
          <SchoolPicker
            value={school}
            error={fieldState.error?.message}
            onChange={(picked) => {
              setSchool(picked);
              field.onChange(picked?.id ?? "");
            }}
          />
        )}
      />
      <Field
        id="school-visitors"
        label="¿Cuántos escolares irán?"
        hint={
          event.maxVisitorsPerRegistration
            ? `Hasta ${event.maxVisitorsPerRegistration} por colegio. Luego no podrás cambiar la cantidad.`
            : "Luego no podrás cambiar la cantidad."
        }
      >
        <Input
          id="school-visitors"
          type="number"
          inputMode="numeric"
          min={1}
          max={event.maxVisitorsPerRegistration ?? undefined}
          aria-invalid={Boolean(errors.expectedVisitors)}
          aria-describedby="school-visitors-hint school-visitors-error"
          {...register("expectedVisitors", { valueAsNumber: true })}
        />
        <FieldError
          id="school-visitors-error"
          message={errors.expectedVisitors?.message}
        />
      </Field>
      <div className="hidden sm:block" />
      <Field id="school-contact-name" label="Tu nombre (responsable)">
        <Input
          id="school-contact-name"
          autoComplete="name"
          aria-invalid={Boolean(errors.contactName)}
          aria-describedby="school-contact-name-error"
          {...register("contactName")}
        />
        <FieldError
          id="school-contact-name-error"
          message={errors.contactName?.message}
        />
      </Field>
      <Field id="school-contact-email" label="Correo de contacto">
        <Input
          id="school-contact-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.contactEmail)}
          aria-describedby="school-contact-email-error"
          {...register("contactEmail")}
        />
        <FieldError
          id="school-contact-email-error"
          message={errors.contactEmail?.message}
        />
      </Field>
      {serverError && (
        <Notice tone="error" className="sm:col-span-2">
          {serverError}
        </Notice>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" bolt disabled={isSubmitting}>
          {isSubmitting ? "Creando…" : "Continuar a los recorridos"}
        </Button>
      </div>
    </form>
  );
}

/** Paso "Tus datos" de una persona libre (un solo visitante). */
export function IndividualDetailsStep({
  event,
  defaultEmail,
  onStarted,
}: DetailsProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IndividualDetailsValues>({
    resolver: zodResolver(individualDetailsSchema),
    defaultValues: { contactName: "", contactEmail: defaultEmail },
  });
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await startRegistration({
      eventId: event.id,
      kind: "individual",
      schoolId: null,
      expectedVisitors: 1,
      contactName: values.contactName,
      contactEmail: values.contactEmail,
    });
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    onStarted(result.data.id);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field
        id="ind-contact-name"
        label="Tu nombre completo"
        hint="Si eres menor de edad, puede inscribirte tu madre, padre o apoderado."
      >
        <Input
          id="ind-contact-name"
          autoComplete="name"
          aria-invalid={Boolean(errors.contactName)}
          aria-describedby="ind-contact-name-hint ind-contact-name-error"
          {...register("contactName")}
        />
        <FieldError
          id="ind-contact-name-error"
          message={errors.contactName?.message}
        />
      </Field>
      <Field id="ind-contact-email" label="Correo de contacto">
        <Input
          id="ind-contact-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.contactEmail)}
          aria-describedby="ind-contact-email-error"
          {...register("contactEmail")}
        />
        <FieldError
          id="ind-contact-email-error"
          message={errors.contactEmail?.message}
        />
      </Field>
      {serverError && (
        <Notice tone="error" className="sm:col-span-2">
          {serverError}
        </Notice>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" bolt disabled={isSubmitting}>
          {isSubmitting ? "Creando…" : "Continuar a los recorridos"}
        </Button>
      </div>
    </form>
  );
}
