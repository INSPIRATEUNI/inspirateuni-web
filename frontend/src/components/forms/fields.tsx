import type { ComponentProps, ReactNode } from "react";
import { Field, fieldClasses, Input, Select } from "@/components/ui/Field";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/cn";
import type { Option } from "@/lib/forms/schemas";

/**
 * Campos de los formularios públicos: etiqueta, control, pista y error ya
 * enlazados (aria-invalid y aria-describedby). Reciben `{...register("x")}`.
 */

type FieldBase = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
};

function a11y(id: string, hint: unknown, error: string | undefined) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  };
}

export function TextField({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: FieldBase & Omit<ComponentProps<"input">, "id" | "className">) {
  return (
    <Field id={id} label={label} hint={hint} className={className}>
      <Input id={id} {...a11y(id, hint, error)} {...props} />
      <FieldError id={`${id}-error`} message={error} />
    </Field>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  className,
  placeholder,
  options,
  ...props
}: FieldBase &
  Omit<ComponentProps<"select">, "id" | "className" | "children"> & {
    placeholder: string;
    options: readonly (string | Option)[];
  }) {
  return (
    <Field id={id} label={label} hint={hint} className={className}>
      <Select id={id} {...a11y(id, hint, error)} {...props}>
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const { value, label: text } =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </Select>
      <FieldError id={`${id}-error`} message={error} />
    </Field>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  className,
  rows = 4,
  ...props
}: FieldBase & Omit<ComponentProps<"textarea">, "id" | "className">) {
  return (
    <Field id={id} label={label} hint={hint} className={className}>
      <textarea
        id={id}
        rows={rows}
        className={cn(fieldClasses, "resize-y")}
        {...a11y(id, hint, error)}
        {...props}
      />
      <FieldError id={`${id}-error`} message={error} />
    </Field>
  );
}

/** Casilla obligatoria de uso de datos. */
export function ConsentField({
  id,
  error,
  className,
  ...props
}: { id: string; error?: string; className?: string } & Omit<
  ComponentProps<"input">,
  "id" | "className" | "type"
>) {
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-magenta"
          {...a11y(id, null, error)}
          {...props}
        />
        <span>Acepto que Inspírate UNI use mis datos para contactarme.</span>
      </label>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
