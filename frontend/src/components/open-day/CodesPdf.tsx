"use client";

import { type ReactNode, useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { getCredentialsPdfUrl } from "@/lib/storage";
import { Notice } from "./Notice";

type State =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "unavailable" };

/**
 * Muestra el PDF de códigos generado con la plantilla (una hoja por persona). Si todavía no existe
 * o no se puede leer, muestra `children` (las tarjetas de respaldo).
 */
export function CodesPdf({
  registrationId,
  referenceCode,
  children,
}: {
  registrationId: string;
  referenceCode: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getCredentialsPdfUrl(registrationId)
      .then((url) => {
        objectUrl = url;
        if (cancelled) URL.revokeObjectURL(url);
        else setState({ status: "ready", url });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [registrationId]);

  if (state.status === "loading") {
    return <p role="status">Cargando tus códigos…</p>;
  }

  if (state.status === "unavailable") {
    return (
      <div className="grid gap-4">
        <Notice title="Tu PDF de códigos aún no está listo">
          Te lo enviaremos por correo. Mientras tanto, puedes usar los códigos
          de abajo.
        </Notice>
        {children}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3 print:hidden">
        <a
          href={state.url}
          download={`codigos_${referenceCode}.pdf`}
          className={buttonClasses({ variant: "spark" })}
        >
          Descargar PDF
        </a>
        <a
          href={state.url}
          target="_blank"
          rel="noreferrer"
          className={buttonClasses({ variant: "ghost" })}
        >
          Abrir en una pestaña nueva
        </a>
      </div>
      <iframe
        src={state.url}
        title={`Códigos de la inscripción ${referenceCode}`}
        className="h-[80vh] w-full rounded-lg border-2 border-border"
      />
    </div>
  );
}
