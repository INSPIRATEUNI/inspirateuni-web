"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { Mascot } from "@/components/site/Mascot";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

type FormSuccessProps = {
  title: ReactNode;
  children: ReactNode;
  /** Botón para volver a llenar el formulario. */
  action?: ReactNode;
  level?: 2 | 3;
};

/**
 * Pantalla de envío correcto. Toma el foco al aparecer para que el lector de
 * pantalla la anuncie y la vista no se quede donde estaba el formulario.
 */
export function FormSuccess({
  title,
  children,
  action,
  level = 3,
}: FormSuccessProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="flex flex-col items-center gap-6 py-10 text-center focus:outline-none sm:flex-row sm:text-left"
    >
      <Mascot
        pose="alegre"
        className="w-28 shrink-0 animate-mascot-float sm:w-36 motion-reduce:animate-none"
      />
      <div>
        <Heading variant="section" level={level}>
          {title}
        </Heading>
        <Text variant="lead" className="mt-3">
          {children}
        </Text>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
