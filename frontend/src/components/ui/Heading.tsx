import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type HeadingVariant = "hero" | "page" | "section" | "feature" | "item";

const variantClasses: Record<HeadingVariant, string> = {
  hero: "text-display-1",
  page: "text-h1",
  section: "text-h2",
  feature: "text-h3-feature",
  item: "text-h3-item",
};

/** Nivel semántico por defecto de cada estilo. */
const defaultLevel: Record<HeadingVariant, 1 | 2 | 3> = {
  hero: 1,
  page: 1,
  section: 2,
  feature: 3,
  item: 3,
};

type HeadingProps = ComponentProps<"h1"> & {
  variant?: HeadingVariant;
  /** Sobrescribe la etiqueta (h1 a h4) sin cambiar el estilo. */
  level?: 1 | 2 | 3 | 4;
};

/**
 * Títulos: frase simple, una palabra clave con GradientText y el punto
 * fuera del gradiente.
 */
export function Heading({
  variant = "section",
  level,
  className,
  ...props
}: HeadingProps) {
  const Tag = `h${level ?? defaultLevel[variant]}` as const;
  return <Tag className={cn(variantClasses[variant], className)} {...props} />;
}
