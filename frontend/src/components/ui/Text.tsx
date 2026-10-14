import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type TextVariant = "lead" | "eyebrow" | "body" | "muted";

const variantClasses: Record<TextVariant, string> = {
  lead: "text-lead",
  eyebrow: "text-eyebrow",
  body: "text-base",
  muted: "text-base text-muted-foreground",
};

type TextProps = ComponentProps<"p"> & { variant?: TextVariant };

export function Text({ variant = "body", className, ...props }: TextProps) {
  return <p className={cn(variantClasses[variant], className)} {...props} />;
}
