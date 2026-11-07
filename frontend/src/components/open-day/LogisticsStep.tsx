"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FieldError } from "@/components/ui/FieldError";
import { setLogistics } from "@/lib/open-day/rpc";
import { type LogisticsValues, logisticsSchema } from "@/lib/open-day/schemas";
import type { LogisticsOption, Registration } from "@/lib/open-day/types";
import { Notice } from "./Notice";

type LogisticsStepProps = {
  options: LogisticsOption[];
  registration: Registration;
  onSaved: () => void;
};

/** Cómo llega el colegio (bus, estacionamiento...). Se guarda con `set_logistics`. */
export function LogisticsStep({
  options,
  registration,
  onSaved,
}: LogisticsStepProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LogisticsValues>({
    resolver: zodResolver(logisticsSchema),
    defaultValues: {
      items: options.map((option) => {
        const saved = registration.logistics.find(
          (l) => l.optionCode === option.code,
        );
        return {
          optionCode: option.code,
          selected: Boolean(saved),
          quantity: saved?.quantity ?? 1,
          notes: saved?.notes ?? "",
        };
      }),
    },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const items = watch("items");

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await setLogistics(
      registration.id,
      values.items
        .filter((item) => item.selected)
        .map((item) => ({
          option_code: item.optionCode,
          quantity: item.quantity,
          notes: item.notes || null,
        })),
    );
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    onSaved();
  });

  if (options.length === 0) {
    return (
      <div className="grid gap-4">
        <p className="text-muted-foreground">
          No hay opciones de logística para este evento.
        </p>
        <div>
          <Button onClick={onSaved}>Continuar</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <p className="text-muted-foreground">
        Cuéntanos cómo llegarán para coordinar el ingreso. Si no necesitan nada,
        deja todo sin marcar y continúa.
      </p>
      <ul className="grid gap-4">
        {options.map((option, index) => {
          const selected = items[index]?.selected;
          const error = errors.items?.[index]?.quantity?.message;
          return (
            <li
              key={option.code}
              className="grid gap-3 rounded-lg border-2 border-border p-4"
            >
              <label className="flex items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-magenta"
                  {...register(`items.${index}.selected`)}
                />
                {option.label}
              </label>
              {selected && (
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <div className="grid gap-1.5">
                    <label
                      htmlFor={`log-${option.code}-qty`}
                      className="text-sm font-semibold"
                    >
                      Cantidad
                    </label>
                    <Input
                      id={`log-${option.code}-qty`}
                      type="number"
                      min={1}
                      aria-invalid={Boolean(error)}
                      aria-describedby={`log-${option.code}-error`}
                      {...register(`items.${index}.quantity`, {
                        valueAsNumber: true,
                      })}
                    />
                    <FieldError
                      id={`log-${option.code}-error`}
                      message={error}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      htmlFor={`log-${option.code}-notes`}
                      className="text-sm font-semibold"
                    >
                      Detalles (opcional)
                    </label>
                    <Input
                      id={`log-${option.code}-notes`}
                      placeholder="Placa, hora estimada de llegada…"
                      {...register(`items.${index}.notes`)}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <div>
        <Button type="submit" bolt disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar y continuar"}
        </Button>
      </div>
    </form>
  );
}
