import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CodesPdf } from "@/components/open-day/CodesPdf";
import { Notice } from "@/components/open-day/Notice";
import { PageIntro } from "@/components/open-day/PageIntro";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { OPEN_DAY_ROUTES, ROLE_LABELS } from "@/lib/open-day/constants";
import {
  fetchEvent,
  fetchGroupPass,
  fetchMyRegistrations,
  fetchPasses,
} from "@/lib/open-day/data";
import { formatEventDate, formatGate, formatTime } from "@/lib/open-day/format";
import { tutorCount } from "@/lib/open-day/people";
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
      const event = await fetchEvent(supabase, registration.eventId);
      if (registration.kind === "school") {
        const pass = await fetchGroupPass(supabase, registration.id);
        if (!pass) return [];
        const tutors = tutorCount(registration);
        return [
          {
            key: registration.id,
            code: pass.accessCode,
            name: registration.school?.name ?? registration.contactName,
            detail: `Representante: ${registration.contactName} · ${registration.expectedVisitors} escolares · ${tutors} ${tutors === 1 ? "tutor" : "tutores"}`,
            registration,
            event,
          },
        ];
      }
      const passes = await fetchPasses(supabase, registration);
      const attendeeById = new Map(
        registration.attendees.map((a) => [a.participantId, a]),
      );
      return passes
        .flatMap((pass) => {
          const attendee = attendeeById.get(pass.participantId);
          return attendee ? [{ pass, attendee }] : [];
        })
        .sort((a, b) =>
          a.attendee.lastName.localeCompare(b.attendee.lastName, "es"),
        )
        .map(({ pass, attendee }) => ({
          key: pass.id,
          code: pass.accessCode,
          name: `${attendee.firstName} ${attendee.lastName}`,
          detail: ROLE_LABELS[attendee.role],
          registration,
          event,
        }));
    }),
  );
  const groups = registrations.map((registration, index) => ({
    registration,
    items: cards[index],
  }));
  const hasItems = groups.some((g) => g.items.length > 0);

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
        lead="Muestra el código al ingresar: el colegio tiene uno solo y cada persona libre el suyo. Descarga el PDF o guárdalo en el celular."
      />

      {!hasItems ? (
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
        <div className="grid gap-10">
          {groups
            .filter((g) => g.items.length > 0)
            .map(({ registration, items }) => (
              <CodesPdf
                key={registration.id}
                registrationId={registration.id}
                referenceCode={registration.referenceCode}
              >
                <ul className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
                  {items.map(
                    ({ key, code, name, detail, registration, event }) => (
                      <li
                        key={key}
                        className="grid gap-2 rounded-lg border-2 border-dashed border-border bg-surface p-5 break-inside-avoid print:rounded-none print:p-4"
                      >
                        <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                          {event?.name ?? "Open Day UNI"}
                          {event && ` · ${formatEventDate(event.eventDate)}`}
                        </p>
                        <p className="text-lg font-bold">{name}</p>
                        <p className="text-sm text-muted-foreground">
                          {detail}
                        </p>
                        <p className="font-mono text-3xl font-bold tracking-[0.2em]">
                          <span className="sr-only">
                            Código {code.split("").join(" ")}
                          </span>
                          <span aria-hidden="true">{groupCode(code)}</span>
                        </p>
                        <p className="text-sm">
                          {formatGate(registration.gate)}
                          {registration.arrivalAt &&
                            ` · Llegada ${formatTime(registration.arrivalAt)}`}
                          {` · ${registration.referenceCode}`}
                        </p>
                      </li>
                    ),
                  )}
                </ul>
              </CodesPdf>
            ))}
        </div>
      )}
    </>
  );
}
