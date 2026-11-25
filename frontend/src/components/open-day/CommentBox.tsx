"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { setRegistrationComment } from "@/lib/open-day/rpc";
import { Notice } from "./Notice";

const MAX = 1000;

type CommentBoxProps = {
  registrationId: string;
  initial: string | null;
  onSaved?: () => Promise<unknown>;
};

/** Comentario para el equipo: si algo falla o hay dudas, lo vemos en el backoffice y te contactamos. */
export function CommentBox({
  registrationId,
  initial,
  onSaved,
}: CommentBoxProps) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setDone(false);
    const result = await setRegistrationComment(registrationId, value);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSaved(value.trim());
    setDone(true);
    await onSaved?.();
  }

  const dirty = value.trim() !== saved;

  return (
    <section
      aria-labelledby={`comment-${registrationId}`}
      className="grid gap-3 rounded-lg border-2 border-border bg-surface p-5"
    >
      <div>
        <h3
          id={`comment-${registrationId}`}
          className="font-display text-lg font-bold"
        >
          ¿Tuviste un problema o una duda?
        </h3>
        <p className="text-sm text-muted-foreground">
          Cuéntanos qué pasó (un error, un dato que no te deja continuar, etc.).
          Lo verá nuestro equipo y te escribiremos al correo o celular que
          registraste.
        </p>
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDone(false);
        }}
        maxLength={MAX}
        rows={4}
        aria-label="Comentario para el equipo"
        className={fieldClasses}
        placeholder="Escribe aquí tu comentario…"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={busy || !dirty}
        >
          {busy
            ? "Enviando…"
            : saved
              ? "Actualizar comentario"
              : "Enviar comentario"}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value.length}/{MAX}
        </span>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {done && !dirty && (
        <Notice tone="success">
          Recibimos tu comentario. Te contactaremos pronto.
        </Notice>
      )}
    </section>
  );
}
