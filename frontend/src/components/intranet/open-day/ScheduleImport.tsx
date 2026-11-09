"use client";

import { useState, useTransition } from "react";
import {
  applyImport,
  type ImportRow,
  previewImport,
} from "@/app/intranet/open-day/horarios/actions";
import { Notice } from "@/components/open-day/Notice";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatTimeRange } from "@/lib/open-day/format";
import type { RelayColor } from "@/lib/relay";

const ACTION_LABELS: Record<
  ImportRow["action"],
  { label: string; tone: RelayColor }
> = {
  insert: { label: "Nuevo", tone: "green" },
  update: { label: "Cambia", tone: "blue" },
  unchanged: { label: "Igual", tone: "orange" },
  error: { label: "Error", tone: "magenta" },
};

/**
 * Carga de horarios por CSV: siempre primero la vista previa; "Aplicar" solo
 * se habilita si no hay filas con error (la BD aplica todo o nada).
 */
export function ScheduleImport({
  eventId,
  eventDate,
  faculties,
}: {
  eventId: string;
  eventDate: string;
  faculties: string[];
}) {
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errors = rows?.filter((r) => r.action === "error").length ?? 0;
  const changes =
    rows?.filter((r) => r.action === "insert" || r.action === "update")
      .length ?? 0;

  function downloadTemplate() {
    const names = faculties.length > 0 ? faculties : ["Facultad de Ciencias"];
    downloadCsv(
      "plantilla-horarios-open-day.csv",
      toCsv([
        ["facultad", "inicio", "fin", "cupo", "punto_encuentro"],
        ...names.map((name) => [
          name,
          `${eventDate} 09:00`,
          `${eventDate} 10:00`,
          40,
          "",
        ]),
      ]),
    );
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setCsv(await file.text());
    setRows(null);
    setApplied(null);
  }

  function preview() {
    setError(null);
    setApplied(null);
    startTransition(async () => {
      const result = await previewImport({ eventId, csv });
      if (result.ok) setRows(result.data);
      else {
        setRows(null);
        setError(result.error);
      }
    });
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await applyImport({ eventId, csv });
      if (result.ok) {
        setApplied(
          changes === 1
            ? "Listo: se aplicó 1 cambio."
            : `Listo: se aplicaron ${changes} cambios.`,
        );
        setRows(null);
        setCsv("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section className="grid gap-4 rounded-lg border-2 border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">
            Cargar horarios por CSV
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Columnas: <code>facultad;inicio;fin;cupo;punto_encuentro</code>.
            Horas de Lima (<code>{eventDate} 09:30</code>). Una fila nueva crea
            el recorrido y una existente (misma facultad e inicio) actualiza
            fin, cupo y punto de encuentro. Nada se borra.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          Descargar plantilla
        </Button>
      </div>

      <label className="grid gap-1 text-sm font-semibold">
        Archivo CSV
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => {
            readFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        O pégalo aquí
        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setRows(null);
          }}
          rows={6}
          spellCheck={false}
          className={cn(fieldClasses, "font-mono text-sm")}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="ghost"
          onClick={preview}
          disabled={pending || !csv.trim()}
          aria-busy={pending}
        >
          Ver vista previa
        </Button>
        <Button
          bolt={!pending}
          onClick={apply}
          disabled={pending || !rows || errors > 0 || changes === 0}
          aria-busy={pending}
        >
          Aplicar cambios
        </Button>
      </div>

      {applied && <Notice tone="success">{applied}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {rows && (
        <Notice tone={errors > 0 ? "warning" : "info"}>
          {errors > 0
            ? `Hay ${errors} fila(s) con error. Corrígelas para poder aplicar.`
            : changes === 0
              ? "No hay cambios que aplicar."
              : `${changes} cambio(s) listos para aplicar.`}
        </Notice>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border-2 border-border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">Vista previa del CSV</caption>
            <thead className="bg-background">
              <tr>
                {[
                  "Fila",
                  "Acción",
                  "Facultad",
                  "Horario",
                  "Cupo",
                  "Detalle",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-3 py-2 text-left font-extrabold"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.line}>
                  <td className="px-3 py-2 tabular-nums">{row.line}</td>
                  <td className="px-3 py-2">
                    <Tag tone={ACTION_LABELS[row.action].tone}>
                      {ACTION_LABELS[row.action].label}
                    </Tag>
                  </td>
                  <td className="px-3 py-2">{row.faculty ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {row.startsAt && row.endsAt
                      ? formatTimeRange(row.startsAt, row.endsAt)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.capacity ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.message ?? row.meetingPoint ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
