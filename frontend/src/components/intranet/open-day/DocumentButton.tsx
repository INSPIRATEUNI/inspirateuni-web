"use client";

import { useState } from "react";
import { messageFor } from "@/lib/open-day/errors";
import { getRegistrationDocumentUrl, StorageError } from "@/lib/storage";

/** Abre el PDF en otra pestaña; la Edge Function comprueba el rol y deja la lectura en la bitácora. */
export function DocumentButton({
  documentId,
  label = "Ver PDF",
}: {
  documentId: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setBusy(true);
    // Se abre la pestaña antes del await para que el navegador no la bloquee
    const tab = window.open("", "_blank");
    try {
      const url = await getRegistrationDocumentUrl(documentId);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (cause) {
      tab?.close();
      setError(
        cause instanceof StorageError
          ? messageFor(cause.code, cause.message)
          : "No pudimos abrir el documento.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        aria-busy={busy}
        className="rounded-md px-2 py-1 text-sm font-bold text-blue-deep hover:bg-blue-soft focus-visible:outline-2 focus-visible:outline-blue disabled:opacity-60"
      >
        {busy ? "Abriendo…" : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-magenta-deep">
          {error}
        </span>
      )}
    </span>
  );
}
