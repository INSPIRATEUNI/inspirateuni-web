import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { BoltIcon } from "@/components/site/Icons";
import { cn } from "@/lib/cn";

export type ButtonVariant = "spark" | "ghost";
export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  spark: "btn-spark",
  ghost: "btn-ghost",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
};

type StyleProps = {
  /** spark es la acción principal: uno por bloque. */
  variant?: ButtonVariant;
  /** sm en la barra de navegación, md en el contenido. */
  size?: ButtonSize;
  /** Muestra el rayo después del texto (acciones principales). */
  bolt?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = StyleProps &
  Omit<ComponentProps<"button">, keyof StyleProps> & { href?: undefined };

type ButtonAsLink = StyleProps &
  Omit<ComponentProps<typeof Link>, keyof StyleProps>;

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function buttonClasses({
  variant = "spark",
  size = "md",
  className,
}: Pick<StyleProps, "variant" | "size" | "className"> = {}) {
  return cn("btn", variantClasses[variant], sizeClasses[size], className);
}

export function Button(props: ButtonProps) {
  const { variant, size, bolt, className, children, ...rest } = props;
  const classes = buttonClasses({ variant, size, className });
  const content = (
    <>
      {children}
      {bolt && <BoltIcon />}
    </>
  );

  if (rest.href !== undefined) {
    return (
      <Link
        className={classes}
        {...(rest as Omit<ButtonAsLink, keyof StyleProps>)}
      >
        {content}
      </Link>
    );
  }

  const { type = "button", ...buttonRest } = rest as Omit<
    ButtonAsButton,
    keyof StyleProps
  >;
  return (
    <button type={type} className={classes} {...buttonRest}>
      {content}
    </button>
  );
}
