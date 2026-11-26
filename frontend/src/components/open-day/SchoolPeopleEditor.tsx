"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { PlusIcon } from "@/components/site/Icons";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DOC_TYPE_LABELS } from "@/lib/open-day/constants";
import { saveSchoolPeople } from "@/lib/open-day/rpc";
import {
  docTypes,
  emptyPerson,
  type PersonValues,
  type SchoolPeopleValues,
  schoolPeopleSchema,
} from "@/lib/open-day/schemas";
import type { OpenDayEvent, Registration } from "@/lib/open-day/types";
import { Notice } from "./Notice";
import { VisitorsCountControl } from "./PeopleEditor";

type SaveResult = { ok: true } | { ok: false; error: { message: string } };

type SchoolPeopleEditorProps = {
  event: OpenDayEvent;
  registration: Registration;
  onSaved: () => Promise<unknown>;
  /** Override del admin: guarda solo los tutores (el representante no se toca). */
  saveTutors?: (tutors: PersonValues[]) => Promise<SaveResult>;
  /** Si se pasa, se puede cambiar aquí la cantidad de escolares. */
  onVisitorsChanged?: () => Promise<unknown>;
};

const cellInput = cn(fieldClasses, "min-w-0 px-2.5 py-2 text-sm");
const labelClasses = "grid content-start gap-1 text-sm font-semibold";

function initialValues(registration: Registration): SchoolPeopleValues {
  const tutors = registration.attendees
    .filter((a) => a.role === "chaperone")
    .map(
      (a): PersonValues => ({
        docType: a.docType,
        docNumber: a.docNumber,
        firstName: a.firstName,
        lastName: a.lastName,
        birthDate: a.birthDate,
        grade: "",
        email: a.email ?? "",
        phone: a.phone ?? "",
        role: "chaperone",
        relationship: a.relationship ?? "",
      }),
    );
  return {
    representative: {
      role: registration.representativeRole ?? "",
      docType: registration.representativeDocType ?? "dni",
      docNumber: registration.representativeDocNumber ?? "",
      attends: registration.representativeAttends,
    },
    people: tutors,
  };
}

/**
 * Representante y tutores de un colegio. Los escolares no se registran: solo se
 * declara cuántos irán.
 */
export function SchoolPeopleEditor({
  event,
  registration,
  onSaved,
  saveTutors,
  onVisitorsChanged,
}: SchoolPeopleEditorProps) {
  const adminMode = Boolean(saveTutors);
  const schema = useMemo(
    () => schoolPeopleSchema(event.eventDate),
    [event.eventDate],
  );

  const defaults = initialValues(registration);
  // El admin no edita al representante: si la inscripción aún no tiene sus datos,
  // se completan con un valor que no bloquea la validación (no se envía)
  if (adminMode && !registration.representativeRole) {
    defaults.representative = {
      role: "—",
      docType: "other",
      docNumber: "SIN-DATO",
      attends: registration.representativeAttends,
    };
  }

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<SchoolPeopleValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "people" });
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const people = watch("people");
  const attends = watch("representative.attends");
  const tutors = people.length + (attends ? 1 : 0);

  const showErrors = () =>
    setTimeout(
      () =>
        document
          .getElementById("tutor-errors")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50,
    );

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSaved(false);
    const result = saveTutors
      ? await saveTutors(values.people)
      : await saveSchoolPeople(registration.id, values);
    if (!result.ok) {
      setServerError(result.error.message);
      showErrors();
      return;
    }
    reset(values);
    setSaved(true);
    await onSaved();
  }, showErrors);

  const listError =
    (
      errors.people as
        | { message?: string; root?: { message?: string } }
        | undefined
    )?.root?.message ??
    (errors.people as { message?: string } | undefined)?.message;

  const rowMessages = (
    Array.isArray(errors.people) ? errors.people : []
  ).flatMap((row, index) => {
    if (!row) return [];
    const messages = Object.values(row as Record<string, { message?: string }>)
      .map((e) => e?.message)
      .filter(Boolean);
    return messages.length > 0 ? [{ index, text: messages.join(" · ") }] : [];
  });

  const repErrors = errors.representative;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <p className="text-muted-foreground">
        No necesitas registrar a los escolares: solo indica cuántos irán y
        quiénes serán sus tutores. Los tutores deben ser mayores de edad el día
        del evento.
      </p>

      {onVisitorsChanged && (
        <VisitorsCountControl
          event={event}
          registration={registration}
          onChanged={onVisitorsChanged}
        />
      )}

      {!adminMode && (
        <fieldset className="grid gap-4 rounded-lg border-2 border-border bg-surface p-4">
          <legend className="px-1 font-bold">Representante del colegio</legend>
          <p className="text-sm">
            {registration.contactName} · {registration.contactEmail}
            {registration.contactPhone ? ` · ${registration.contactPhone}` : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClasses}>
              Cargo
              <input
                className={cellInput}
                placeholder="Director, coordinador, profesor…"
                aria-invalid={Boolean(repErrors?.role)}
                {...register("representative.role")}
              />
              {repErrors?.role && (
                <span className="text-magenta-deep">
                  {repErrors.role.message}
                </span>
              )}
            </label>
            <label className={labelClasses}>
              Tipo de documento
              <select
                className={cellInput}
                {...register("representative.docType")}
              >
                {docTypes.map((type) => (
                  <option key={type} value={type}>
                    {DOC_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClasses}>
              Número de documento
              <input
                className={cellInput}
                inputMode="numeric"
                aria-invalid={Boolean(repErrors?.docNumber)}
                {...register("representative.docNumber")}
              />
              {repErrors?.docNumber && (
                <span className="text-magenta-deep">
                  {repErrors.docNumber.message}
                </span>
              )}
            </label>
          </div>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-magenta"
              {...register("representative.attends")}
            />
            <span>
              <strong>Yo también asistiré</strong> (cuento como tutor; no te
              agregues en la lista de abajo).
            </span>
          </label>
        </fieldset>
      )}

      <p
        className={cn(
          "w-fit rounded-md border-2 px-3 py-2 text-sm",
          tutors >= 1
            ? "border-green/40 bg-tint-green"
            : "border-orange/40 bg-tint-orange",
        )}
      >
        <span className="font-semibold">Tutores:</span> {tutors} (mínimo 1) ·{" "}
        <span className="font-semibold">Escolares:</span>{" "}
        {registration.expectedVisitors}
      </p>

      {fields.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border-2 border-border">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Tutores</caption>
            <thead className="bg-tint-blue text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              <tr>
                {[
                  "#",
                  "Documento",
                  "Nombres",
                  "Apellidos",
                  "Nacimiento",
                  "Celular",
                ].map((label) => (
                  <th key={label} scope="col" className="px-2 py-2.5">
                    {label}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2.5">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const rowErrors = errors.people?.[index];
                const label = (name: string) => `${name}, tutor ${index + 1}`;
                return (
                  <tr
                    key={field.id}
                    className="border-t border-border align-top"
                  >
                    <th
                      scope="row"
                      className="px-2 py-2 font-display tabular-nums"
                    >
                      {index + 1}
                    </th>
                    <td className="grid gap-1.5 px-2 py-2">
                      <select
                        aria-label={label("Tipo de documento")}
                        className={cn(cellInput, "min-w-28")}
                        {...register(`people.${index}.docType`)}
                      >
                        {docTypes.map((type) => (
                          <option key={type} value={type}>
                            {DOC_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={label("Número de documento")}
                        aria-invalid={Boolean(rowErrors?.docNumber)}
                        inputMode="numeric"
                        className={cellInput}
                        {...register(`people.${index}.docNumber`)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={label("Nombres")}
                        aria-invalid={Boolean(rowErrors?.firstName)}
                        className={cellInput}
                        {...register(`people.${index}.firstName`)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={label("Apellidos")}
                        aria-invalid={Boolean(rowErrors?.lastName)}
                        className={cellInput}
                        {...register(`people.${index}.lastName`)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        aria-label={label("Fecha de nacimiento")}
                        aria-invalid={Boolean(rowErrors?.birthDate)}
                        className={cellInput}
                        {...register(`people.${index}.birthDate`)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="tel"
                        aria-label={label("Celular")}
                        aria-invalid={Boolean(rowErrors?.phone)}
                        className={cellInput}
                        {...register(`people.${index}.phone`)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="rounded-md px-2 py-2 text-sm font-bold text-magenta hover:bg-magenta-soft"
                        aria-label={`Quitar tutor ${index + 1}`}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Notice>Aún no agregas tutores.</Notice>
      )}

      <div id="tutor-errors" role="alert" className="grid gap-3 empty:hidden">
        {rowMessages.length > 0 && (
          <Notice tone="error" title="Revisa estas filas">
            <ul className="grid gap-1">
              {rowMessages.map((row) => (
                <li key={row.index}>
                  <strong>Tutor {row.index + 1}:</strong> {row.text}
                </li>
              ))}
            </ul>
          </Notice>
        )}
        {listError && <Notice tone="error">{listError}</Notice>}
        {serverError && <Notice tone="error">{serverError}</Notice>}
      </div>

      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => append(emptyPerson("chaperone"))}
        >
          <PlusIcon className="size-4" />
          Agregar tutor
        </Button>
      </div>

      {saved && !isDirty && (
        <Notice tone="success">Guardamos los datos.</Notice>
      )}

      <div>
        <Button type="submit" bolt disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar tutores"}
        </Button>
      </div>
    </form>
  );
}
