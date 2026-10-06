import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import type { RelayColor } from "@/lib/relay";

const toneClasses: Record<RelayColor, string> = {
  magenta: "bg-magenta-soft text-magenta-deep",
  orange: "bg-orange-soft text-orange-ink",
  blue: "bg-blue-soft text-blue-deep",
  green: "bg-green-soft text-green-ink",
};

type TagProps = ComponentProps<"span"> &
  (
    | { variant?: "tone"; tone?: RelayColor }
    | { variant: "leaf" | "neutral"; tone?: never }
  );

/**
 * tone: tag de categoría con color del relay.
 * leaf: etiqueta destacada con gradiente (hero, PageHero).
 * neutral: tag blanco con borde (valores).
 */
export function Tag({
  variant = "tone",
  tone = "magenta",
  className,
  ...props
}: TagProps) {
  const classes =
    variant === "leaf"
      ? "tag-leaf"
      : variant === "neutral"
        ? "tag border-[1.5px] border-border bg-surface text-foreground"
        : cn("tag", toneClasses[tone]);
  return <span className={cn(classes, className)} {...props} />;
}
