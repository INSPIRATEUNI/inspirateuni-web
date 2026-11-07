"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/cn";
import {
  ensureSchool,
  type SchoolMatch,
  searchSchools,
} from "@/lib/open-day/rpc";
import { newSchoolSchema } from "@/lib/open-day/schemas";
import { Notice } from "./Notice";

export type PickedSchool = {
  id: string;
  name: string;
  district: string | null;
};

type SchoolPickerProps = {
  value: PickedSchool | null;
  onChange: (school: PickedSchool | null) => void;
  error?: string;
};

/**
 * Buscador de colegios (`search_schools`) con la opción de registrar uno que
 * no aparezca (`ensure_school`). Sigue el patrón de combobox de ARIA.
 */
export function SchoolPicker({ value, onChange, error }: SchoolPickerProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const result = await searchSchools(term);
      if (cancelled) return;
      setSearching(false);
      if (result.ok) {
        setResults(result.data);
        setSearchError(null);
      } else {
        setSearchError(result.error.message);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function pick(school: SchoolMatch) {
    onChange({ id: school.id, name: school.name, district: school.district });
    setOpen(false);
    setQuery("");
  }

  if (value) {
    return (
      <div className="grid gap-2 sm:col-span-2">
        <p className="font-semibold">Tu colegio</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-green/40 bg-tint-green px-4 py-3">
          <div>
            <p className="font-bold">{value.name}</p>
            {value.district && (
              <p className="text-sm text-muted-foreground">{value.district}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Cambiar
          </Button>
        </div>
      </div>
    );
  }

  if (adding) {
    return (
      <NewSchoolForm
        initialName={query}
        onCancel={() => setAdding(false)}
        onCreated={(school) => {
          setAdding(false);
          onChange(school);
        }}
      />
    );
  }

  const showList = open && query.trim().length >= 3;

  return (
    <div className="grid gap-2 sm:col-span-2">
      <Field id={`${id}-input`} label="¿Cómo se llama tu colegio?">
        <div className="relative">
          <Input
            id={`${id}-input`}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? `${listId}-${active}` : undefined
            }
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-hint ${id}-error`}
            autoComplete="off"
            placeholder="Escribe al menos 3 letras"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(event) => {
              if (!showList) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && active >= 0) {
                event.preventDefault();
                pick(results[active]);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {showList && (
            <div
              id={listId}
              role="listbox"
              aria-label="Colegios encontrados"
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border-2 border-border bg-surface py-1 shadow-soft"
            >
              {results.map((school, index) => (
                <div
                  key={school.id}
                  id={`${listId}-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === active}
                  // onMouseDown para elegir antes del blur del input
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(school);
                  }}
                  className={cn(
                    "cursor-pointer px-4 py-2.5",
                    index === active
                      ? "bg-magenta-soft"
                      : "hover:bg-tint-magenta",
                  )}
                >
                  <span className="font-semibold">{school.name}</span>
                  {(school.district || school.ugel) && (
                    <span className="block text-sm text-muted-foreground">
                      {[school.district, school.ugel]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </div>
              ))}
              {!searching && results.length === 0 && (
                <div className="px-4 py-2.5 text-sm text-muted-foreground">
                  No encontramos ese colegio.
                </div>
              )}
              {searching && results.length === 0 && (
                <div className="px-4 py-2.5 text-sm text-muted-foreground">
                  Buscando…
                </div>
              )}
            </div>
          )}
        </div>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          ¿No aparece?{" "}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="font-bold text-magenta underline-offset-4 hover:underline"
          >
            Registra tu colegio
          </button>
        </p>
        <FieldError id={`${id}-error`} message={error} />
      </Field>
      {searchError && <Notice tone="error">{searchError}</Notice>}
    </div>
  );
}

function NewSchoolForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (school: PickedSchool) => void;
}) {
  const [values, setValues] = useState({
    name: initialName,
    district: "",
    ugel: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // No es un <form>: vive dentro del formulario de datos y no debe enviarlo
  async function save() {
    const parsed = newSchoolSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setErrors({});
    setServerError(null);
    setSaving(true);
    const result = await ensureSchool(parsed.data);
    setSaving(false);
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    onCreated({
      id: result.data,
      name: parsed.data.name,
      district: parsed.data.district || null,
    });
  }

  return (
    <fieldset className="grid gap-5 rounded-lg border-2 border-dashed border-border p-5 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-2 font-bold">Registra tu colegio</legend>
      <Field
        id="new-school-name"
        label="Nombre del colegio"
        className="sm:col-span-2"
      >
        <Input
          id="new-school-name"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          placeholder="I.E. José Carlos Mariátegui"
          aria-invalid={Boolean(errors.name)}
          aria-describedby="new-school-name-error"
        />
        <FieldError id="new-school-name-error" message={errors.name} />
      </Field>
      <Field id="new-school-district" label="Distrito">
        <Input
          id="new-school-district"
          value={values.district}
          onChange={(e) => setValues({ ...values, district: e.target.value })}
          placeholder="San Martín de Porres"
        />
      </Field>
      <Field id="new-school-ugel" label="UGEL (opcional)">
        <Input
          id="new-school-ugel"
          value={values.ugel}
          onChange={(e) => setValues({ ...values, ugel: e.target.value })}
          placeholder="UGEL 02"
        />
      </Field>
      {serverError && (
        <Notice tone="error" className="sm:col-span-2">
          {serverError}
        </Notice>
      )}
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar colegio"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Volver a buscar
        </Button>
      </div>
    </fieldset>
  );
}
