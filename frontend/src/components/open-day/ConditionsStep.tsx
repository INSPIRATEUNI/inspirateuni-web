"use client";

import { conditionsFor } from "@/lib/open-day/conditions";
import type { RegistrationKind, TemplateKind } from "@/lib/open-day/types";

/** Las declaraciones que se aceptan una por una antes de seguir. */
export function ConditionsStep({
  kind,
  hasMinors,
  accepted,
  onChange,
}: {
  kind: RegistrationKind;
  /** Si en la inscripción hay menores de edad (cambia los textos de personas libres). */
  hasMinors: boolean;
  accepted: TemplateKind[];
  onChange: (accepted: TemplateKind[]) => void;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground">
        Lee y acepta las tres declaraciones para continuar.
      </p>
      {conditionsFor(kind, hasMinors).map((condition) => {
        const checked = accepted.includes(condition.template);
        return (
          <section
            key={condition.template}
            aria-labelledby={`cond-${condition.template}`}
            className="grid gap-3 rounded-lg border-2 border-border bg-surface p-5"
          >
            <h3
              id={`cond-${condition.template}`}
              className="font-display text-lg font-bold"
            >
              {condition.title}
            </h3>
            <p>{condition.intro}</p>
            {condition.items.length > 0 && (
              <ul className="grid gap-1.5">
                {condition.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-green-ink">
                      ✔
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {condition.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <label className="flex items-start gap-3 font-bold">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-magenta"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? accepted.filter((t) => t !== condition.template)
                      : [...accepted, condition.template],
                  )
                }
              />
              <span>
                Acepto
                <span className="sr-only">: {condition.title}</span>
              </span>
            </label>
          </section>
        );
      })}
    </div>
  );
}
