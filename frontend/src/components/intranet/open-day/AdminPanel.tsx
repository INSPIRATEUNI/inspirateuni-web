"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import {
  cancelRegistration,
  overrideLimits,
  reopenRegistration,
  setAttendeesAsAdmin,
} from "@/app/intranet/open-day/inscripciones/[id]/actions";
import { Notice } from "@/components/open-day/Notice";
import { PeopleEditor } from "@/components/open-day/PeopleEditor";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import { Heading } from "@/components/ui/Heading";
import { cn } from "@/lib/cn";
import type { OpenDayEvent, Registration } from "@/lib/open-day/types";

type Result = { ok: boolean; error?: string };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-md border-2 border-border">
      <summary className="cursor-pointer list-none px-4 py-3 font-bold marker:hidden">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {title}
      </summary>
      <div className="grid gap-3 border-t-2 border-border p-4">{children}</div>
    </details>
  );
}

function ReasonField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      Motivo (queda en la bitácora)
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        maxLength={500}
        className={cn(fieldClasses, "py-2 text-sm")}
      />
    </label>
  );
}

/** Overrides de admin: cada uno pide un motivo y queda en `registration_events`. */
export function AdminPanel({
  event,
  registration,
}: {
  event: OpenDayEvent;
  registration: Registration;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenDeadline, setReopenDeadline] = useState("");
  const [visitors, setVisitors] = useState(
    String(registration.expectedVisitors),
  );
  const [raiseCapacity, setRaiseCapacity] = useState(false);
  const [limitsReason, setLimitsReason] = useState("");
  const [peopleReason, setPeopleReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelArmed, setCancelArmed] = useState(false);

  const status = registration.status;
  const closed = status === "cancelled" || status === "expired";
  const canReopen = ["submitted", "docs_observed", "confirmed"].includes(
    status,
  );
  const canEdit = [
    "reserved",
    "submitted",
    "docs_observed",
    "confirmed",
  ].includes(status);

  function run(
    action: () => Promise<Result>,
    success: string,
    after?: () => void,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage({ tone: "success", text: success });
        after?.();
      } else {
        setMessage({
          tone: "error",
          text: result.error ?? "No pudimos guardar el cambio.",
        });
      }
    });
  }

  return (
    <section
      aria-labelledby="overrides"
      className="grid gap-4 rounded-lg border-2 border-orange/40 bg-surface p-5 sm:p-6"
    >
      <div>
        <Heading id="overrides" variant="item" level={2}>
          Overrides de admin
        </Heading>
        <p className="mt-1 text-sm text-muted-foreground">
          Saltan las reglas normales. Úsalos solo cuando haga falta.
        </p>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {closed && (
        <Notice tone="info">
          La inscripción está cerrada; no admite overrides.
        </Notice>
      )}

      {canReopen && (
        <Section title="Reabrir para corregir">
          <p className="text-sm text-muted-foreground">
            Vuelve a "reservada" para que quien se inscribió corrija y reenvíe.
            Mientras tanto, sus códigos no sirven para ingresar.
          </p>
          <ReasonField value={reopenReason} onChange={setReopenReason} />
          <label className="grid gap-1 text-sm font-semibold">
            Nuevo plazo (opcional; por defecto {event.reservationHours} h)
            <input
              type="datetime-local"
              value={reopenDeadline}
              onChange={(e) => setReopenDeadline(e.target.value)}
              className={cn(fieldClasses, "py-2")}
            />
          </label>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  reopenRegistration({
                    registrationId: registration.id,
                    reason: reopenReason,
                    deadline: reopenDeadline,
                  }),
                "Inscripción reabierta.",
                () => setReopenReason(""),
              )
            }
          >
            Reabrir
          </Button>
        </Section>
      )}

      {canEdit && (
        <Section title="Ajustar cantidad de visitantes">
          <label className="grid gap-1 text-sm font-semibold">
            Visitantes esperados
            <input
              type="number"
              min={1}
              value={visitors}
              onChange={(e) => setVisitors(e.target.value)}
              className={cn(fieldClasses, "w-32 py-2")}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-orange"
              checked={raiseCapacity}
              onChange={(e) => setRaiseCapacity(e.target.checked)}
            />
            Subir el cupo de los recorridos si no alcanza
          </label>
          <ReasonField value={limitsReason} onChange={setLimitsReason} />
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  overrideLimits({
                    registrationId: registration.id,
                    expectedVisitors: Number(visitors),
                    reason: limitsReason,
                    raiseCapacity,
                  }),
                "Cantidad actualizada.",
                () => setLimitsReason(""),
              )
            }
          >
            Guardar cantidad
          </Button>
        </Section>
      )}

      {canEdit && (
        <Section title="Editar la lista de personas">
          <p className="text-sm text-muted-foreground">
            Si ya estaba confirmada, se emiten o revocan los códigos y se
            reenvían por correo.
          </p>
          <ReasonField value={peopleReason} onChange={setPeopleReason} />
          <PeopleEditor
            event={event}
            registration={registration}
            onSaved={async () => {
              setPeopleReason("");
              router.refresh();
            }}
            save={(people) =>
              setAttendeesAsAdmin({
                registrationId: registration.id,
                people,
                reason: peopleReason,
              })
            }
          />
        </Section>
      )}

      {!closed && (
        <Section title="Cancelar la inscripción">
          <p className="text-sm text-muted-foreground">
            Libera los recorridos, revoca los códigos y avisa por correo. No se
            puede deshacer.
          </p>
          <ReasonField value={cancelReason} onChange={setCancelReason} />
          {cancelArmed ? (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      cancelRegistration({
                        registrationId: registration.id,
                        reason: cancelReason,
                      }),
                    "Inscripción cancelada.",
                    () => setCancelArmed(false),
                  )
                }
              >
                Sí, cancelar
              </Button>
              <Button variant="ghost" onClick={() => setCancelArmed(false)}>
                No
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setCancelArmed(true)}>
              Cancelar inscripción
            </Button>
          )}
        </Section>
      )}
    </section>
  );
}
