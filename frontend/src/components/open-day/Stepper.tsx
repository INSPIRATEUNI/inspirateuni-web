"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { CheckCircleIcon } from "@/components/site/Icons";
import { cn } from "@/lib/cn";
import { relayAt, relayClasses } from "@/lib/relay";

export type StepStatus = "done" | "current" | "locked";

export type WizardStep = {
  id: string;
  title: string;
  icon: ReactNode;
  status: StepStatus;
  /** Resumen de un paso completado (y, si aplica, su botón "Editar"). */
  summary?: ReactNode;
  /** Contenido del paso actual. */
  content?: ReactNode;
  /** Texto bajo el título de un paso bloqueado. */
  lockedHint?: string;
};

/**
 * Formulario por pasos con el estilo de la maqueta (`VisitForm`): línea con
 * degradado y una insignia del relay por paso. Solo el paso actual muestra su
 * contenido; los completados muestran un resumen.
 */
export function Stepper({ steps }: { steps: WizardStep[] }) {
  const currentId = steps.find((step) => step.status === "current")?.id;
  const previousId = useRef(currentId);
  const listRef = useRef<HTMLOListElement>(null);

  // Al avanzar de paso, el contenido cambia de alto: lleva la vista al paso nuevo
  useEffect(() => {
    if (!currentId || previousId.current === currentId) return;
    previousId.current = currentId;
    const heading = listRef.current?.querySelector<HTMLElement>(
      `#step-${currentId}`,
    );
    if (!heading) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    heading.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [currentId]);

  return (
    <ol ref={listRef} className="relative grid gap-10">
      <span
        aria-hidden="true"
        className="absolute top-6 bottom-6 left-6 w-0.5 bg-linear-to-b from-magenta via-blue to-green opacity-40"
      />
      {steps.map((step, index) => (
        <li
          key={step.id}
          aria-current={step.status === "current" ? "step" : undefined}
          className="relative grid grid-cols-[3rem_1fr] gap-5"
        >
          <span
            aria-hidden="true"
            className={cn(
              "z-1 grid size-12 place-items-center rounded-full ring-8 ring-background transition-colors",
              step.status === "locked"
                ? "border-2 border-border bg-surface text-muted-foreground"
                : "text-white",
              step.status === "current" && relayClasses[relayAt(index)].deep,
              step.status === "done" && "bg-green-deep",
            )}
          >
            {step.status === "done" ? (
              <CheckCircleIcon className="size-6" />
            ) : (
              step.icon
            )}
          </span>
          <section
            aria-labelledby={`step-${step.id}`}
            className={cn("min-w-0", step.status === "locked" && "opacity-60")}
          >
            <h2
              id={`step-${step.id}`}
              className="text-h3-item scroll-mt-28 pt-2.5"
            >
              <span className="sr-only">
                Paso {index + 1}
                {step.status === "done"
                  ? " (completado)"
                  : step.status === "locked"
                    ? " (pendiente)"
                    : " (actual)"}
                :{" "}
              </span>
              {step.title}
            </h2>
            {step.status === "locked" && step.lockedHint && (
              <p className="mt-1 text-sm text-muted-foreground">
                {step.lockedHint}
              </p>
            )}
            {step.status === "done" && step.summary && (
              <div className="mt-2 text-sm text-muted-foreground">
                {step.summary}
              </div>
            )}
            {step.status === "current" && step.content && (
              <div className="mt-5">{step.content}</div>
            )}
          </section>
        </li>
      ))}
    </ol>
  );
}
