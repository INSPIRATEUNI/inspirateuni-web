"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { PlusIcon } from "@/components/site/Icons";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DOC_TYPE_LABELS, ROLE_LABELS } from "@/lib/open-day/constants";
import { isMinorOn } from "@/lib/open-day/format";
import { setAttendees, setExpectedVisitors } from "@/lib/open-day/rpc";
import {
  docTypes,
  emptyPerson,
  type PeopleValues,
  type PersonValues,
  peopleSchema,
} from "@/lib/open-day/schemas";
import type { OpenDayEvent, Registration } from "@/lib/open-day/types";
import { Notice } from "./Notice";

type SaveResult = { ok: true } | { ok: false; error: { message: string } };

type PeopleEditorProps = {
  event: OpenDayEvent;
  registration: Registration;
  onSaved: () => Promise<unknown>;
  /** Cómo se guarda la lista; por defecto `set_attendees` del dueño (el staff usa el override de admin). */
  save?: (people: PersonValues[]) => Promise<SaveResult>;
  /** Si se pasa, el dueño puede cambiar aquí la cantidad de visitantes; se llama al guardarla. */
  onVisitorsChanged?: () => Promise<unknown>;
};

/** Cambia la cantidad de visitantes declarados sin volver al primer paso. */
export function VisitorsCountControl({
  event,
  registration,
  onChanged,
}: {
  event: OpenDayEvent;
  registration: Registration;
  onChanged: () => Promise<unknown>;
}) {
  const max =
    registration.kind === "school"
      ? event.maxVisitorsPerRegistration
      : event.maxVisitorsIndividual;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(registration.expectedVisitors));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const valid =
    Number.isInteger(parsed) && parsed >= 1 && (max === null || parsed <= max);

  async function apply() {
    setBusy(true);
    setError(null);
    const result = await setExpectedVisitors(registration.id, parsed);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    await onChanged();
  }

  if (!open) {
    return (
      <p className="text-sm">
        ¿Cambió la cantidad de{" "}
        {registration.kind === "school" ? "escolares" : "visitantes"}?{" "}
        <button
          type="button"
          onClick={() => {
            setValue(String(registration.expectedVisitors));
            setError(null);
            setOpen(true);
          }}
          className="font-bold text-magenta hover:underline"
        >
          Cambiar cantidad
        </button>
      </p>
    );
  }

  return (
    <div className="grid gap-3 rounded-md border-2 border-border bg-surface p-4">
      <label className="grid gap-1 text-sm font-semibold" htmlFor="new-count">
        Nueva cantidad{max ? ` (hasta ${max})` : ""}
        <input
          id="new-count"
          type="number"
          inputMode="numeric"
          min={1}
          max={max ?? undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={cn(fieldClasses, "max-w-32")}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Se ajustan los cupos de tus recorridos. Si alguno no tiene lugar para la
        nueva cantidad, no se hace el cambio.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={apply} disabled={!valid || busy}>
          {busy ? "Guardando…" : "Guardar cantidad"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

const cellInput = cn(fieldClasses, "min-w-0 px-2.5 py-2 text-sm");

function initialPeople(registration: Registration): PersonValues[] {
  if (registration.attendees.length > 0) {
    return registration.attendees.map((a) => ({
      docType: a.docType,
      docNumber: a.docNumber,
      firstName: a.firstName,
      lastName: a.lastName,
      birthDate: a.birthDate,
      grade: a.grade ?? "",
      email: a.email ?? "",
      phone: a.phone ?? "",
      role: a.role,
      relationship: a.relationship ?? "",
    }));
  }
  return registration.kind === "individual" ? [emptyPerson("visitor")] : [];
}

/**
 * Lista de personas de una inscripción individual, una fila por persona. Se guarda
 * completa con `set_attendees`. Los colegios usan `SchoolPeopleEditor`.
 */
export function PeopleEditor({
  event,
  registration,
  onSaved,
  save = (people) => setAttendees(registration.id, people),
  onVisitorsChanged,
}: PeopleEditorProps) {
  const schema = useMemo(
    () =>
      peopleSchema({
        eventDate: event.eventDate,
        kind: registration.kind,
        expectedVisitors: registration.expectedVisitors,
      }),
    [event.eventDate, registration.kind, registration.expectedVisitors],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<PeopleValues>({
    resolver: zodResolver(schema),
    defaultValues: { people: initialPeople(registration) },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "people",
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const people = watch("people");
  const visitors = people.filter((p) => p.role === "visitor").length;
  const adults = people.filter((p) => p.role !== "visitor").length;
  const minorVisitor = people.some(
    (p) =>
      p.role === "visitor" &&
      /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) &&
      isMinorOn(p.birthDate, event.eventDate),
  );

  const showErrors = () =>
    setTimeout(
      () =>
        document
          .getElementById("people-errors")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50,
    );

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSaved(false);
    const result = await save(values.people);
    if (!result.ok) {
      setServerError(result.error.message);
      showErrors();
      return;
    }
    reset(values);
    setSaved(true);
    await onSaved();
  }, showErrors);

  const counters = [
    {
      label: visitors === 1 ? "Visitante" : "Visitantes",
      value: `${visitors} de ${registration.expectedVisitors}`,
      ok: visitors === registration.expectedVisitors,
    },
    ...(minorVisitor
      ? [
          {
            label: "Acompañante o tutor",
            value: adults > 0 ? "Registrado" : "Obligatorio para menores",
            ok: adults > 0,
          },
        ]
      : []),
  ];

  const listError =
    (
      errors.people as
        | { message?: string; root?: { message?: string } }
        | undefined
    )?.root?.message ??
    (errors.people as { message?: string } | undefined)?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <p className="text-muted-foreground">
        {registration.expectedVisitors === 1
          ? "Registra tus datos. Si eres menor de edad el día del evento, agrega a un acompañante o tutor mayor de edad."
          : `Registra a las ${registration.expectedVisitors} personas que asistirán. Si alguna es menor de edad el día del evento, agrega a un acompañante o tutor mayor de edad; los acompañantes y tutores no cuentan como visitantes.`}
      </p>

      {onVisitorsChanged && (
        <VisitorsCountControl
          event={event}
          registration={registration}
          onChanged={onVisitorsChanged}
        />
      )}

      <ul className="flex flex-wrap gap-3" aria-label="Resumen de la lista">
        {counters.map((counter) => (
          <li
            key={counter.label}
            className={cn(
              "rounded-md border-2 px-3 py-2 text-sm",
              counter.ok
                ? "border-green/40 bg-tint-green"
                : "border-orange/40 bg-tint-orange",
            )}
          >
            <span className="font-semibold">{counter.label}:</span>{" "}
            {counter.value}
          </li>
        ))}
      </ul>

      {fields.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border-2 border-border">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <caption className="sr-only">Personas de la inscripción</caption>
            <thead className="bg-tint-blue text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-2.5">
                  #
                </th>
                <th scope="col" className="px-2 py-2.5">
                  Rol
                </th>
                <th scope="col" className="px-2 py-2.5">
                  Documento
                </th>
                <th scope="col" className="px-2 py-2.5">
                  Nombres
                </th>
                <th scope="col" className="px-2 py-2.5">
                  Apellidos
                </th>
                <th scope="col" className="px-2 py-2.5">
                  Nacimiento
                </th>
                <th scope="col" className="px-2 py-2.5">
                  Grado / parentesco
                </th>
                <th scope="col" className="px-2 py-2.5">
                  Correo y celular (opcionales)
                </th>
                <th scope="col" className="px-2 py-2.5">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const rowErrors = errors.people?.[index];
                const role = people[index]?.role;
                const label = (name: string) => `${name}, fila ${index + 1}`;
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
                    <td className="px-2 py-2">
                      <select
                        aria-label={label("Rol")}
                        className={cn(cellInput, "min-w-32")}
                        {...register(`people.${index}.role`)}
                      >
                        <option value="visitor">{ROLE_LABELS.visitor}</option>
                        <option value="guardian">{ROLE_LABELS.guardian}</option>
                      </select>
                    </td>
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
                      {role === "visitor" ? (
                        <input
                          aria-label={label("Grado")}
                          placeholder="5.° secundaria"
                          className={cellInput}
                          {...register(`people.${index}.grade`)}
                        />
                      ) : (
                        <input
                          aria-label={label("Parentesco")}
                          aria-invalid={Boolean(rowErrors?.relationship)}
                          placeholder="Madre"
                          className={cellInput}
                          {...register(`people.${index}.relationship`)}
                        />
                      )}
                    </td>
                    <td className="grid gap-1.5 px-2 py-2">
                      <input
                        type="email"
                        aria-label={label("Correo")}
                        aria-invalid={Boolean(rowErrors?.email)}
                        placeholder="Correo (opcional)"
                        className={cellInput}
                        {...register(`people.${index}.email`)}
                      />
                      <input
                        type="tel"
                        aria-label={label("Celular")}
                        aria-invalid={Boolean(rowErrors?.phone)}
                        placeholder="Celular (opcional)"
                        className={cellInput}
                        {...register(`people.${index}.phone`)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="rounded-md px-2 py-2 text-sm font-bold text-magenta hover:bg-magenta-soft"
                        aria-label={`Quitar fila ${index + 1}`}
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
        <Notice>Aún no hay personas en la lista.</Notice>
      )}

      <div id="people-errors" role="alert" className="grid gap-3 empty:hidden">
        <RowErrors errors={errors.people} people={people} />
        {listError && <Notice tone="error">{listError}</Notice>}
        {serverError && <Notice tone="error">{serverError}</Notice>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => append(emptyPerson("visitor"))}
          disabled={visitors >= registration.expectedVisitors}
        >
          <PlusIcon className="size-4" />
          Agregar visitante
        </Button>
        {(minorVisitor || adults > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => append(emptyPerson("guardian"))}
          >
            <PlusIcon className="size-4" />
            Agregar adulto acompañante
          </Button>
        )}
      </div>

      {saved && !isDirty && (
        <Notice tone="success">Guardamos la lista de personas.</Notice>
      )}

      <div>
        <Button type="submit" bolt disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar personas"}
        </Button>
      </div>
    </form>
  );
}

/** Lista legible de los errores por fila (la tabla solo marca los campos). */
const FIELD_LABELS: Record<string, string> = {
  docType: "Tipo de documento",
  docNumber: "Documento",
  firstName: "Nombres",
  lastName: "Apellidos",
  birthDate: "Fecha de nacimiento",
  email: "Correo",
  phone: "Celular",
  relationship: "Cargo o parentesco",
  role: "Rol",
};

function RowErrors({
  errors,
  people,
}: {
  errors: unknown;
  people: PersonValues[];
}) {
  if (!Array.isArray(errors)) return null;
  const items = errors
    .map((row, index) => {
      if (!row) return null;
      const messages = Object.entries(
        row as Record<string, { message?: string }>,
      )
        .filter(([, e]) => e?.message)
        .map(([key, e]) => `${FIELD_LABELS[key] ?? key}: ${e.message}`);
      const person = people[index];
      const who = [person?.firstName, person?.lastName]
        .filter(Boolean)
        .join(" ");
      return messages.length > 0
        ? {
            index,
            text: messages.join(" · "),
            who: who || person?.docNumber || "",
          }
        : null;
    })
    .filter(
      (item): item is { index: number; text: string; who: string } =>
        item !== null,
    );
  if (items.length === 0) return null;
  return (
    <Notice tone="error" title="Revisa estas filas">
      <ul className="grid gap-1">
        {items.slice(0, 12).map((item) => (
          <li key={item.index}>
            <strong>
              Fila {item.index + 1}
              {item.who && ` (${item.who})`}:
            </strong>{" "}
            {item.text}
          </li>
        ))}
        {items.length > 12 && <li>Y {items.length - 12} filas más.</li>}
      </ul>
    </Notice>
  );
}
