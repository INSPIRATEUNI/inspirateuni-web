import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type NoticeTone = "info" | "warning" | "error" | "success";

const toneClasses: Record<NoticeTone, string> = {
  info: "border-blue/30 bg-tint-blue text-foreground",
  warning: "border-orange/40 bg-tint-orange text-foreground",
  error: "border-magenta/40 bg-tint-magenta text-magenta-deep",
  success: "border-green/40 bg-tint-green text-foreground",
};

type NoticeProps = {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Aviso en línea. Los errores se anuncian de inmediato (role="alert"). */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border-2 px-4 py-3 text-sm",
        toneClasses[tone],
        className,
      )}
    >
      {title && <p className="font-bold">{title}</p>}
      {children && (
        <div className={cn(Boolean(title) && "mt-1")}>{children}</div>
      )}
    </div>
  );
}
