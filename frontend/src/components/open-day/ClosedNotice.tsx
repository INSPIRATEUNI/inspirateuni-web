import { Notice } from "@/components/open-day/Notice";
import { buttonClasses } from "@/components/ui/Button";
import { OPEN_DAY_ROUTES } from "@/lib/open-day/constants";
import { formatDateTime } from "@/lib/open-day/format";
import type { OpenDayEvent } from "@/lib/open-day/types";

/** Estado cuando no hay un evento con la inscripción abierta. */
export function ClosedNotice({ event }: { event: OpenDayEvent | null }) {
  const now = Date.now();
  const upcoming = event && now < Date.parse(event.registrationOpensAt);
  return (
    <div className="grid gap-5">
      <Notice
        tone="warning"
        title={
          !event
            ? "Aún no hay un Open Day programado"
            : upcoming
              ? "La inscripción todavía no abre"
              : "La inscripción está cerrada"
        }
      >
        {!event
          ? "Síguenos en redes para enterarte cuando anunciemos la fecha."
          : upcoming
            ? `Abre el ${formatDateTime(event.registrationOpensAt)}.`
            : event.registrationOpen
              ? `Cerró el ${formatDateTime(event.registrationClosesAt)}.`
              : "Por ahora no estamos recibiendo inscripciones."}
      </Notice>
      <p>
        Si ya empezaste una inscripción, puedes continuarla desde{" "}
        <a
          href={OPEN_DAY_ROUTES.mine}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          Mi inscripción
        </a>
      </p>
    </div>
  );
}
