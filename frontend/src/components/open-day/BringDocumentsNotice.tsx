"use client";

import { useEffect, useState } from "react";
import { ClipboardIcon } from "@/components/site/Icons";
import { DOCUMENT_LABELS, driveDownloadUrl } from "@/lib/open-day/constants";
import { fetchTemplates } from "@/lib/open-day/data";
import type { DocumentTemplate } from "@/lib/open-day/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Aviso para los colegios: los documentos firmados no se suben, se llevan impresos el día
 * del evento. Sin ellos no se permite el ingreso.
 */
export function BringDocumentsNotice() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  useEffect(() => {
    fetchTemplates(createClient()).then(setTemplates);
  }, []);

  return (
    <section
      aria-labelledby="bring-docs-title"
      className="grid gap-3 rounded-lg border-2 border-orange bg-tint-orange p-5 shadow-soft"
    >
      <p className="text-xs font-extrabold uppercase tracking-widest text-orange-ink">
        Importante
      </p>
      <h3 id="bring-docs-title" className="font-display text-xl font-bold">
        Lleva los documentos firmados el día del evento
      </h3>
      <p className="font-semibold">
        No los subas aquí: imprímelos, fírmalos y llévalos en físico.{" "}
        <span className="text-orange-ink">
          Los escolares no podrán ingresar sin los documentos firmados.
        </span>
      </p>
      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Las plantillas se están cargando. Si no aparecen, escríbenos y te las
          enviamos.
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
                Descargar {DOCUMENT_LABELS[template.kind].toLowerCase()}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
