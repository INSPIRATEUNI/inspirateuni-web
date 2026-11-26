"use client";

import { useEffect, useState } from "react";
import { ClipboardIcon } from "@/components/site/Icons";
import { templateLabel, templatesFor } from "@/lib/open-day/conditions";
import { driveDownloadUrl } from "@/lib/open-day/constants";
import { fetchTemplates } from "@/lib/open-day/data";
import type { DocumentTemplate, RegistrationKind } from "@/lib/open-day/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Se muestra una vez enviada la inscripción (colegios y personas libres): descargar
 * los documentos y llevarlos impresos, completos y firmados el día del evento.
 */
export function BringDocumentsNotice({
  kind,
  hasMinors,
}: {
  kind: RegistrationKind;
  hasMinors: boolean;
}) {
  const [all, setTemplates] = useState<DocumentTemplate[]>([]);
  const templates = templatesFor(kind, hasMinors, all);

  useEffect(() => {
    fetchTemplates(createClient(), kind).then(setTemplates);
  }, [kind]);

  return (
    <section
      aria-labelledby="bring-docs-title"
      className="grid gap-3 rounded-lg border-2 border-orange bg-tint-orange p-5 shadow-soft"
    >
      <p className="text-xs font-extrabold uppercase tracking-widest text-orange-ink">
        Importante
      </p>
      <h3 id="bring-docs-title" className="font-display text-xl font-bold">
        Descarga estos documentos y llévalos el día del Open Day
      </h3>
      <p className="font-semibold">
        Imprímelos, complétalos y fírmalos.{" "}
        <span className="text-orange-ink">
          Se revisan en la puerta: sin ellos no se permite el ingreso.
        </span>
      </p>
      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Los documentos aún no están disponibles. Revisa Mi inscripción más
          adelante o escríbenos por el chat.
        </p>
      )}
      {templates.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {templates.map((template) => (
            <li key={template.kind}>
              <a
                href={driveDownloadUrl(template.driveFileId)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-spark"
              >
                <ClipboardIcon className="size-5" />
                Descargar {templateLabel(kind, template.kind).toLowerCase()}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
