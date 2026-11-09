import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/open-day/MyRegistrationClient";
import { Notice } from "@/components/open-day/Notice";
import { PageIntro } from "@/components/open-day/PageIntro";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { OPEN_DAY_ROUTES, ROLE_LABELS } from "@/lib/open-day/constants";
import {
  fetchEvent,
  fetchMyRegistrations,
  fetchPasses,
} from "@/lib/open-day/data";
import { formatEventDate, formatGate, formatTime } from "@/lib/open-day/format";
import { getSessionUser } from "@/lib/open-day/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mis códigos · Open Day",
  robots: { index: false },
};

/** "AB12CD34" → "AB12 CD34" para leerlo y dictarlo sin errores. */
function groupCode(code: string) {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

export default async function CodigosPage({
  searchParams,
}: PageProps<"/provov/open-day/inscripcion/mi-inscripcion/codigos">) {
  const user = await getSessionUser();
  if (!user) redirect(OPEN_DAY_ROUTES.mine);

  const { id } = await searchParams;
  const supabase = await createClient();
  const registrations = (await fetchMyRegistrations(supabase, user.id)).filter(
    (r) => r.status === "confirmed" && (typeof id !== "string" || r.id === id),
  );

  const cards = await Promise.all(
    registrations.map(async (registration) => {
      const [event, passes] = await Promise.all([
        fetchEvent(supabase, registration.eventId),
        fetchPasses(supabase, registration),
      ]);
      const attendeeById = new Map(
        registration.attendees.map((a) => [a.participantId, a]),
      );
      return passes
        .map((pass) => ({
          pass,
          attendee: attendeeById.get(pass.participantId),
        }))
        .filter((item) => item.attendee)
        .sort((a, b) =>
          (a.attendee?.lastName ?? "").localeCompare(
            b.attendee?.lastName ?? "",
            "es",
          ),
        )
        .map((item) => ({ ...item, registration, event }));
    }),
  );
  const items = cards.flat();

  return (
    <>
      <PageIntro
        current="Mis códigos"
        parent={{ label: "Mi inscripción", href: OPEN_DAY_ROUTES.mine }}
        title={
          <>
            Tus códigos de{" "}
            <GradientText gradient="discover">acceso</GradientText>.
          </>
        }
        lead="Cada persona muestra su código al ingresar. Imprime esta página o guárdala en el celular."
      />

      {items.length === 0 ? (
        <div className="grid gap-5">
          <Notice title="Aún no hay códigos">
            Los códigos aparecen cuando confirmamos tu inscripción. Te
            avisaremos por correo.
          </Notice>
          <div>
            <Button href={OPEN_DAY_ROUTES.mine} variant="ghost">
              Volver a Mi inscripción
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="print:hidden">
            <PrintButton />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
            {items.map(({ pass, attendee, registration, event }) => (
              <li
                key={pass.id}
                className="grid gap-2 rounded-lg border-2 border-dashed border-border bg-surface p-5 break-inside-avoid print:rounded-none print:p-4"
              >
                <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                  {event?.name ?? "Open Day UNI"}
                  {event && ` · ${formatEventDate(event.eventDate)}`}
                </p>
                <p className="text-lg font-bold">
                  {attendee?.firstName} {attendee?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {attendee && ROLE_LABELS[attendee.role]}
                  {registration.school && ` · ${registration.school.name}`}
                </p>
                <p className="font-mono text-3xl font-bold tracking-[0.2em]">
                  <span className="sr-only">
                    Código {pass.accessCode.split("").join(" ")}
                  </span>
                  <span aria-hidden="true">{groupCode(pass.accessCode)}</span>
                </p>
                <p className="text-sm">
                  {formatGate(registration.gate)}
                  {registration.arrivalAt &&
                    ` · Llegada ${formatTime(registration.arrivalAt)}`}
                  {` · ${registration.referenceCode}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
