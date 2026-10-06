"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/site/Icons";
import { cn } from "@/lib/cn";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** Título accesible del diálogo (se muestra como encabezado). */
  title: string;
  children: ReactNode;
  /** Decoración en la esquina inferior derecha, montada sobre el borde del panel. */
  aside?: ReactNode;
  className?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const subscribe = () => () => {};

/** Solo en el cliente existe document.body para el portal. */
function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  aside,
  className,
}: DialogProps) {
  const isClient = useIsClient();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onEscape = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [open]);

  if (!isClient) return null;

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 16, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.98 },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-foreground/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-xl"
            {...panelMotion}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div
              className={cn(
                "relative max-h-[85vh] overflow-y-auto rounded-lg bg-surface p-6 shadow-soft sm:p-8",
                className,
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 id={titleId} className="text-h3-feature">
                  {title}
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="-mt-1 -mr-2 rounded-leaf-xs p-2 text-muted-foreground transition-colors hover:bg-magenta-soft hover:text-magenta focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>
              <div className="mt-4">{children}</div>
            </div>
            {aside && (
              // Va después del panel para quedar encima: mitad dentro, mitad fuera.
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -bottom-10 hidden w-32 -rotate-6 md:block"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
              >
                {aside}
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
