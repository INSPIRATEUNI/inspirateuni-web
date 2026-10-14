import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Input de marca: borde sutil, sin caja pesada y anillo magenta al enfocar. */
export const fieldClasses =
  "w-full rounded-lg border-2 border-border bg-surface px-4 py-3 text-base text-foreground transition-colors placeholder:text-muted-foreground focus:border-magenta focus:ring-2 focus:ring-magenta/30 focus:outline-none";

type FieldProps = {
  /** id del control que acompaña la etiqueta. */
  id: string;
  label: ReactNode;
  /** Pista breve bajo el control; enlázala con aria-describedby={`${id}-hint`}. */
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Etiqueta conversacional sobre un input o select con el mismo id. */
export function Field({ id, label, hint, className, children }: FieldProps) {
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClasses, className)} {...props} />;
}
