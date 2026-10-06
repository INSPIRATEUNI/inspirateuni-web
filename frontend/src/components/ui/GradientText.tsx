import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * spectrum-head y spectrum-tail solo en el hero de inicio.
 */
export type Gradient =
  | "spectrum-head"
  | "spectrum-tail"
  | "energy"
  | "discover"
  | "fresh";

const gradientClasses: Record<Gradient, string> = {
  "spectrum-head": "text-gradient-spectrum-head",
  "spectrum-tail": "text-gradient-spectrum-tail",
  energy: "text-gradient-energy",
  discover: "text-gradient-discover",
  fresh: "text-gradient-fresh",
};

type GradientTextProps = ComponentProps<"span"> & { gradient?: Gradient };

export function GradientText({
  gradient = "energy",
  className,
  ...props
}: GradientTextProps) {
  return (
    <span className={cn(gradientClasses[gradient], className)} {...props} />
  );
}
