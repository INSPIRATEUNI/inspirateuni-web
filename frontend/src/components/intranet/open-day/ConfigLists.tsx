"use client";

import { useState, useTransition } from "react";
import {
  activateTemplate,
  addEventFaculty,
  addTemplate,
  removeEventFaculty,
  saveLogisticsOption,
  updateEventFaculty,
} from "@/app/intranet/open-day/configuracion/actions";
import { Notice } from "@/components/open-day/Notice";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import {
  DOCUMENT_LABELS,
  driveDownloadUrl,
  TIER_LABELS,
  TIERS,
} from "@/lib/open-day/constants";
import type { Tier } from "@/lib/open-day/types";

type Result = { ok: boolean; error?: string };

/** Estado común: una acción a la vez y su error. */
function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<Result>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) after?.();
      else setError(result.error ?? "No pudimos guardar el cambio.");
    });
  };
  return { pending, error, run };
}

const small = cn(fieldClasses, "w-auto py-2 text-sm");

export function FacultiesEditor({
  eventId,
  eventFaculties,
  catalog,
}: {
  eventId: string;
  eventFaculties: { id: string; facultyId: string; name: string; tier: Tier }[];
  catalog: { id: string; name: string }[];
}) {
  const { pending, error, run } = useAction();
  const [facultyId, setFacultyId] = useState("");
  const [tier, setTier] = useState<Tier>("mid");
  const available = catalog.filter(
    (f) => !eventFaculties.some((e) => e.facultyId === f.id),
  );

  return (
    <div className="grid gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      {eventFaculties.length === 0 ? (
        <p className="text-muted-foreground">
          Aún no hay facultades en el evento.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border-2 border-border">
          {eventFaculties.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="font-semibold">{f.name}</span>
              <span className="flex items-center gap-2">
                <select
                  aria-label={`Nivel de ${f.name}`}
                  className={small}
                  value={f.tier}
                  disabled={pending}
                  onChange={(e) =>
                    run(() =>
                      updateEventFaculty({ id: f.id, tier: e.target.value }),
                    )
                  }
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABELS[t]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm font-bold text-magenta-deep hover:bg-magenta-soft disabled:opacity-60"
                  disabled={pending}
                  onClick={() => run(() => removeEventFaculty({ id: f.id }))}
                >
                  Quitar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-semibold">
            Facultad
            <select
              className={small}
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
            >
              <option value="">Elige una facultad</option>
              {available.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Nivel
            <select
              className={small}
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending || !facultyId}
            onClick={() =>
              run(
                () => addEventFaculty({ eventId, facultyId, tier }),
                () => setFacultyId(""),
              )
            }
          >
            Agregar
          </Button>
        </div>
      )}
    </div>
  );
}

type TemplateKind = "consent" | "guardian_declaration" | "commitment_letter";
const TEMPLATE_KINDS: TemplateKind[] = [
  "consent",
  "guardian_declaration",
  "commitment_letter",
];

export function TemplatesEditor({
  templates,
}: {
  templates: {
    id: string;
    kind: TemplateKind;
    version: number;
    driveFileId: string;
    active: boolean;
  }[];
}) {
  const { pending, error, run } = useAction();
  const [kind, setKind] = useState<TemplateKind>("consent");
  const [link, setLink] = useState("");

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Sube el PDF a Drive y compártelo como "Cualquier persona con el enlace".
        Las personas descargan la versión activa.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <ul className="grid gap-3">
        {TEMPLATE_KINDS.map((k) => {
          const versions = templates
            .filter((t) => t.kind === k)
            .sort((a, b) => b.version - a.version);
          return (
            <li key={k} className="rounded-md border-2 border-border px-4 py-3">
              <p className="font-semibold">{DOCUMENT_LABELS[k]}</p>
              {versions.length === 0 ? (
                <p className="text-sm text-magenta-deep">Sin plantilla.</p>
              ) : (
                <ul className="mt-1 grid gap-1 text-sm">
                  {versions.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span>Versión {t.version}</span>
                      <a
                        href={driveDownloadUrl(t.driveFileId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link"
                      >
                        probar descarga
                      </a>
                      {t.active ? (
                        <span className="font-bold text-green-ink">activa</span>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md px-2 py-0.5 font-bold text-blue-deep hover:bg-blue-soft disabled:opacity-60"
                          disabled={pending}
                          onClick={() =>
                            run(() => activateTemplate({ id: t.id, kind: k }))
                          }
                        >
                          Activar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-semibold">
          Tipo
          <select
            className={small}
            value={kind}
            onChange={(e) => setKind(e.target.value as TemplateKind)}
          >
            {TEMPLATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {DOCUMENT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid flex-1 gap-1 text-sm font-semibold sm:min-w-72">
          Enlace del archivo en Drive
          <input
            className={cn(fieldClasses, "py-2 text-sm")}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://drive.google.com/file/d/…/view"
          />
        </label>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending || link.trim().length < 10}
          onClick={() =>
            run(
              () => addTemplate({ kind, driveFile: link, activate: true }),
              () => setLink(""),
            )
          }
        >
          Agregar y activar
        </Button>
      </div>
    </div>
  );
}

export function LogisticsEditor({
  options,
}: {
  options: { code: string; label: string; active: boolean }[];
}) {
  const { pending, error, run } = useAction();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");

  return (
    <div className="grid gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      <ul className="divide-y divide-border rounded-md border-2 border-border">
        {options.map((o) => (
          <li
            key={o.code}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
          >
            <span>
              <span className="font-semibold">{o.label}</span>{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {o.code}
              </span>
            </span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-green"
                checked={o.active}
                disabled={pending}
                onChange={(e) =>
                  run(() =>
                    saveLogisticsOption({
                      code: o.code,
                      label: o.label,
                      active: e.target.checked,
                    }),
                  )
                }
              />
              Visible en el formulario
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-semibold">
          Código
          <input
            className={small}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="movilidad"
          />
        </label>
        <label className="grid flex-1 gap-1 text-sm font-semibold sm:min-w-56">
          Nombre
          <input
            className={cn(fieldClasses, "py-2 text-sm")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Movilidad propia"
          />
        </label>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending || !code.trim() || !label.trim()}
          onClick={() =>
            run(
              () => saveLogisticsOption({ code, label, active: true }),
              () => {
                setCode("");
                setLabel("");
              },
            )
          }
        >
          Agregar
        </Button>
      </div>
    </div>
  );
}
