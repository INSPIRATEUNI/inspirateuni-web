"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/open-day/format";
import { sendRegistrationMessage, staffSendMessage } from "@/lib/open-day/rpc";
import { createClient } from "@/lib/supabase/client";
import { Notice } from "./Notice";

const MAX = 1000;
const POLL_MS = 20_000;

type Message = {
  id: string;
  sender: "owner" | "staff";
  body: string;
  created_at: string;
};

type ChatBoxProps = {
  registrationId: string;
  /** Quién mira el chat: define de qué lado van sus mensajes y los textos. */
  perspective: "owner" | "staff";
};

/** Chat entre quien se inscribe y el staff (mensajes en `registration_messages`). */
export function ChatBox({ registrationId, perspective }: ChatBoxProps) {
  const send =
    perspective === "owner" ? sendRegistrationMessage : staffSendMessage;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("registration_messages")
      .select("id, sender, body, created_at")
      .eq("registration_id", registrationId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
    setLoaded(true);
  }, [registrationId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const count = messages.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: baja al final cuando llega un mensaje
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [count]);

  async function submit() {
    const body = value.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    const result = await send(registrationId, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setValue("");
    await load();
  }

  const isOwner = perspective === "owner";

  return (
    <section
      aria-labelledby={`chat-${registrationId}`}
      className="grid gap-3 rounded-lg border-2 border-border bg-surface p-5"
    >
      <div>
        <h3
          id={`chat-${registrationId}`}
          className="font-display text-lg font-bold"
        >
          {isOwner ? "Mensajes con el equipo" : "Chat con quien se inscribió"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Si tuviste un problema o una duda, escríbenos aquí. Te respondemos por este chat y te avisamos por correo."
            : "Lo que escribas se envía por correo y aparece en su inscripción."}
        </p>
      </div>

      {loaded && messages.length === 0 ? (
        <p className="rounded-md bg-background px-3 py-4 text-center text-sm text-muted-foreground">
          Aún no hay mensajes.
        </p>
      ) : (
        <ul
          ref={listRef}
          aria-label="Mensajes"
          aria-live="polite"
          className="grid max-h-80 gap-2 overflow-y-auto rounded-md bg-background p-3"
        >
          {messages.map((m) => {
            const mine = m.sender === perspective;
            return (
              <li
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2",
                    mine ? "bg-tint-blue" : "bg-tint-orange",
                  )}
                >
                  <p className="text-xs font-bold text-muted-foreground">
                    {m.sender === "staff" ? "Equipo InspirateUNI" : "Inscrito"}
                    {" · "}
                    {formatDateTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX}
        rows={3}
        aria-label="Escribe un mensaje"
        className={fieldClasses}
        placeholder="Escribe un mensaje…"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={busy || value.trim() === ""}
        >
          {busy ? "Enviando…" : "Enviar mensaje"}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.length}/{MAX}
        </span>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
