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
import {
  type ImportResult,
  parsePeople,
  peopleTemplateCsv,
} from "@/lib/open-day/people-import";
import { setAttendees } from "@/lib/open-day/rpc";
import {
  docTypes,
  emptyPerson,
  type PeopleValues,
  type PersonValues,
  peopleSchema,
} from "@/lib/open-day/schemas";
import type { OpenDayEvent, Registration } from "@/lib/open-day/types";
import { Notice } from "./Notice";

type PeopleEditorProps = {
  event: OpenDayEvent;
  registration: Registration;
  onSaved: () => Promise<unknown>;
};

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
 * Lista de personas de la inscripción: formulario por fila o pegado desde
 * Excel/CSV. Se guarda completa con `set_attendees`, que reemplaza la lista.
 */
export function PeopleEditor({
  event,
  registration,
  onSaved,
}: PeopleEditorProps) {
  const isSchool = registration.kind === "school";
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
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "people",
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const people = watch("people");
  const visitors = people.filter((p) => p.role === "visitor").length;
  const chaperones = people.filter((p) => p.role === "chaperone").length;
  const adults = people.filter((p) => p.role !== "visitor").length;
  // El mínimo se calcula sobre lo declarado, como `submit_registration`
  const minChaperones = Math.ceil(
    Math.max(visitors, registration.expectedVisitors) /
      event.studentsPerChaperone,
  );
  const minorVisitor = people.some(
    (p) =>
      p.role === "visitor" &&
      /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) &&
      isMinorOn(p.birthDate, event.eventDate),
  );

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSaved(false);
    const result = await setAttendees(registration.id, values.people);
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    reset(values);
    setSaved(true);
    await onSaved();
  });

  const counters = isSchool
    ? [
        {
          label: "Escolares",
          value: `${visitors} de ${registration.expectedVisitors}`,
          ok: visitors === registration.expectedVisitors,
        },
        {
          label: "Acompañantes",
          value: `${chaperones} (mínimo ${minChaperones})`,
          ok: chaperones >= minChaperones,
        },
        ...(event.maxAdultsPerRegistration
          ? [
              {
                label: "Adultos",
                value: `${adults} de ${event.maxAdultsPerRegistration} como máximo`,
                ok: adults <= event.maxAdultsPerRegistration,
              },
            ]
          : []),
      ]
    : [
        { label: "Visitante", value: `${visitors} de 1`, ok: visitors === 1 },
        ...(minorVisitor
          ? [
              {
                label: "Adulto acompañante",
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
        {isSchool
          ? `Registra a los ${registration.expectedVisitors} escolares y a los profesores que los acompañan (al menos uno por cada ${event.studentsPerChaperone} escolares). Los adultos deben ser mayores de edad el día del evento.`
          : "Registra tus datos. Si eres menor de edad el día del evento, agrega a un adulto que te acompañe."}
      </p>

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

      {isSchool && (
        <ImportPanel
          kind={registration.kind}
          onImport={(imported, mode) => {
            if (mode === "replace") replace(imported);
            else append(imported);
          }}
        />
      )}

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
                  Correo y celular
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
                        {isSchool ? (
                          <option value="chaperone">Acompañante</option>
                        ) : (
                          <option value="guardian">
                            {ROLE_LABELS.guardian}
                          </option>
                        )}
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
                          aria-label={label(isSchool ? "Cargo" : "Parentesco")}
                          aria-invalid={Boolean(rowErrors?.relationship)}
                          placeholder={isSchool ? "Profesor" : "Madre"}
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

      <RowErrors errors={errors.people} />
      {listError && <Notice tone="error">{listError}</Notice>}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => append(emptyPerson("visitor"))}
          disabled={!isSchool && visitors >= 1}
        >
          <PlusIcon className="size-4" />
          {isSchool ? "Agregar escolar" : "Agregar visitante"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            append(emptyPerson(isSchool ? "chaperone" : "guardian"))
          }
        >
          <PlusIcon className="size-4" />
          {isSchool ? "Agregar acompañante" : "Agregar adulto acompañante"}
        </Button>
      </div>

      {serverError && <Notice tone="error">{serverError}</Notice>}
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
function RowErrors({ errors }: { errors: unknown }) {
  if (!Array.isArray(errors)) return null;
  const items = errors
    .map((row, index) => {
      if (!row) return null;
      const messages = Object.values(
        row as Record<string, { message?: string }>,
      )
        .map((e) => e?.message)
        .filter(Boolean);
      return messages.length > 0 ? { index, text: messages.join(" ") } : null;
    })
    .filter((item): item is { index: number; text: string } => item !== null);
  if (items.length === 0) return null;
  return (
    <Notice tone="error" title="Revisa estas filas">
      <ul className="grid gap-1">
        {items.slice(0, 12).map((item) => (
          <li key={item.index}>
            Fila {item.index + 1}: {item.text}
          </li>
        ))}
        {items.length > 12 && <li>Y {items.length - 12} filas más.</li>}
      </ul>
    </Notice>
  );
}

function ImportPanel({
  kind,
  onImport,
}: {
  kind: Registration["kind"];
  onImport: (people: PersonValues[], mode: "append" | "replace") => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  function downloadTemplate() {
    const blob = new Blob([peopleTemplateCsv(kind)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-personas-open-day.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function apply(mode: "append" | "replace") {
    if (!result || result.people.length === 0) return;
    onImport(result.people, mode);
    setText("");
    setResult(null);
  }

  return (
    <details className="rounded-lg border-2 border-dashed border-border p-4">
      <summary className="cursor-pointer font-bold">
        Pegar desde Excel o subir un CSV
      </summary>
      <div className="mt-4 grid gap-4">
        <p className="text-sm text-muted-foreground">
          Descarga la plantilla, llénala en Excel y copia las filas (con los
          encabezados) para pegarlas aquí. También puedes subir el archivo CSV.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            Descargar plantilla CSV
          </Button>
          <label className="btn btn-ghost btn-sm cursor-pointer">
            Subir CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const content = await file.text();
                setText(content);
                setResult(parsePeople(content));
              }}
            />
          </label>
        </div>
        <label htmlFor="people-paste" className="font-semibold">
          Filas copiadas
        </label>
        <textarea
          id="people-paste"
          rows={5}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setResult(null);
          }}
          placeholder={
            "Rol\tTipo de documento\tNúmero de documento\tNombres\tApellidos\tFecha de nacimiento…"
          }
          className={cn(fieldClasses, "font-mono text-xs")}
        />
        <div>
          <Button
            variant="ghost"
            size="sm"
            disabled={text.trim() === ""}
            onClick={() => setResult(parsePeople(text))}
          >
            Revisar filas
          </Button>
        </div>
        {result && (
          <div className="grid gap-3">
            {result.errors.length > 0 && (
              <Notice
                tone="error"
                title={
                  result.errors.length === 1
                    ? "1 fila con problemas (no se importa)"
                    : `${result.errors.length} filas con problemas (no se importan)`
                }
              >
                <ul className="grid gap-1">
                  {result.errors.slice(0, 10).map((error) => (
                    <li key={`${error.line}-${error.message}`}>
                      Línea {error.line}: {error.message}
                    </li>
                  ))}
                </ul>
              </Notice>
            )}
            {result.people.length > 0 && (
              <>
                <Notice tone="success">
                  {result.people.length === 1
                    ? "1 persona lista para importar."
                    : `${result.people.length} personas listas para importar.`}
                </Notice>
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" onClick={() => apply("replace")}>
                    Reemplazar la lista
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => apply("append")}
                  >
                    Agregar a la lista
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
