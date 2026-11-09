import type { Metadata, Route } from "next";
import {
  MyRegistrationLogin,
  ObservedDocuments,
  SignOutButton,
} from "@/components/open-day/MyRegistrationClient";
import { Notice } from "@/components/open-day/Notice";
import { PageIntro } from "@/components/open-day/PageIntro";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { getCachedAvailability } from "@/lib/open-day/availability";
import {
  DOCUMENT_LABELS,
  OPEN_DAY_ROUTES,
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
} from "@/lib/open-day/constants";
import { fetchEvent, fetchMyRegistrations } from "@/lib/open-day/data";
import {
  formatDateTime,
  formatEventDate,
  formatGate,
  formatTime,
  formatTimeRange,
} from "@/lib/open-day/format";
import { getSessionUser } from "@/lib/open-day/server";
import type {
  OpenDayEvent,
  Registration,
  RegistrationStatus,
  TourSession,
} from "@/lib/open-day/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mi inscripción · Open Day",
};

const CONTINUE_STATUSES = new Set<RegistrationStatus>([
  "draft",
  "held",
  "reserved",
  "needs_reassignment",
]);

export default async function MiInscripcionPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <PageIntro
          current="Mi inscripción"
          parent={{ label: "Inscripción", href: OPEN_DAY_ROUTES.selector }}
          title={
            <>
              Vuelve a tu{" "}
              <GradientText gradient="discover">inscripción</GradientText>.
            </>
          }
          lead="Revisa el avance, completa lo que falta o descarga tus códigos de acceso."
        />
        <MyRegistrationLogin />
      </>
    );
  }

  const supabase = await createClient();
  const registrations = await fetchMyRegistrations(supabase, user.id);
  const eventIds = [...new Set(registrations.map((r) => r.eventId))];
  const [events, availability] = await Promise.all([
    Promise.all(eventIds.map((id) => fetchEvent(supabase, id))),
    Promise.all(
      eventIds.map((id) => getCachedAvailability(id).catch(() => null)),
    ),
  ]);
  const eventById = new Map(
    events.filter((e): e is OpenDayEvent => e !== null).map((e) => [e.id, e]),
  );
  const sessionById = new Map(
    availability.flatMap((a) => a?.sessions ?? []).map((s) => [s.sessionId, s]),
  );

  return (
    <>
      <PageIntro
        current="Mi inscripción"
        parent={{ label: "Inscripción", href: OPEN_DAY_ROUTES.selector }}
        title={
          <>
            Tu <GradientText gradient="discover">inscripción</GradientText>.
          </>
        }
      />
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Text variant="muted">
          Ingresaste como{" "}
          <strong className="text-foreground">{user.email}</strong>.
        </Text>
        <SignOutButton />
      </div>

      {registrations.length === 0 ? (
        <div className="grid gap-5">
          <Notice title="No tienes inscripciones con este correo">
            Si te inscribiste con otro correo, sal e ingresa con ese.
          </Notice>
          <div>
            <Button href={OPEN_DAY_ROUTES.selector} bolt>
              Empezar una inscripción
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-8">
          {registrations.map((registration) => {
            const event = eventById.get(registration.eventId);
            return (
              <li key={registration.id}>
                {event && (
                  <RegistrationCard
                    registration={registration}
                    event={event}
                    sessionById={sessionById}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function RegistrationCard({
  registration,
  event,
  sessionById,
}: {
  registration: Registration;
  event: OpenDayEvent;
  sessionById: Map<string, TourSession>;
}) {
  const wizardRoute =
    registration.kind === "school"
      ? OPEN_DAY_ROUTES.schools
      : OPEN_DAY_ROUTES.individuals;
  const visitors = registration.attendees.filter(
    (a) => a.role === "visitor",
  ).length;
  const adults = registration.attendees.length - visitors;

  return (
    <article className="grid gap-6 rounded-lg border-2 border-border bg-surface p-6 shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            {event.name} · {formatEventDate(event.eventDate)}
          </p>
          <Heading variant="item" level={2} className="mt-1">
            {registration.school?.name ?? registration.contactName}
          </Heading>
          <p className="mt-1 font-display text-lg tracking-wide">
            {registration.referenceCode}
          </p>
        </div>
        <Tag tone={STATUS_TONES[registration.status]}>
          {STATUS_LABELS[registration.status]}
        </Tag>
      </header>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-semibold text-muted-foreground">
            Personas
          </dt>
          <dd>
            {visitors} de {registration.expectedVisitors}{" "}
            {registration.expectedVisitors === 1 ? "visitante" : "visitantes"}
            {adults > 0 && `, ${adults} ${adults === 1 ? "adulto" : "adultos"}`}
          </dd>
        </div>
        {registration.docsDeadline &&
          (registration.status === "reserved" ||
            registration.status === "docs_observed") && (
            <div>
              <dt className="text-sm font-semibold text-muted-foreground">
                Plazo
              </dt>
              <dd>{formatDateTime(registration.docsDeadline)}</dd>
            </div>
          )}
        {registration.status === "confirmed" && (
          <div>
            <dt className="text-sm font-semibold text-muted-foreground">
              Ingreso
            </dt>
            <dd>
              {formatGate(registration.gate)}
              {registration.arrivalAt &&
                ` · ${formatTime(registration.arrivalAt)}`}
            </dd>
          </div>
        )}
      </dl>

      {registration.enrollments.length > 0 && (
        <section aria-label="Recorridos" className="grid gap-2">
          <h3 className="font-bold">Recorridos</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {registration.enrollments.map((enrollment) => {
              const session = sessionById.get(enrollment.sessionId);
              return (
                <li
                  key={enrollment.sessionId}
                  className="rounded-md bg-tint-blue px-4 py-2"
                >
                  <span className="font-bold">
                    {session?.facultyName ?? "Recorrido"}
                  </span>
                  {session && (
                    <span className="block text-sm tabular-nums">
                      {formatTimeRange(session.startsAt, session.endsAt)}
                      {session.meetingPoint && ` · ${session.meetingPoint}`}
                    </span>
                  )}
                  {enrollment.status === "held" && (
                    <span className="block text-sm text-orange-ink">
                      Sin confirmar
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {registration.attendees.length > 0 && (
        <details>
          <summary className="cursor-pointer font-bold">
            Ver personas ({registration.attendees.length})
          </summary>
          <ul className="mt-3 grid gap-1 text-sm">
            {registration.attendees.map((a) => (
              <li key={a.participantId}>
                {a.firstName} {a.lastName} · {ROLE_LABELS[a.role]}
              </li>
            ))}
          </ul>
        </details>
      )}

      {registration.documents.length > 0 && (
        <section aria-label="Documentos" className="grid gap-2">
          <h3 className="font-bold">Documentos</h3>
          <ul className="grid gap-1 text-sm">
            {registration.documents.map((doc) => (
              <li key={doc.id}>
                {DOCUMENT_LABELS[doc.kind]}: {doc.fileName}
                {doc.verifiedAt
                  ? " · Verificado"
                  : doc.observation
                    ? ` · Observado: ${doc.observation}`
                    : " · En revisión"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {registration.status === "docs_observed" && (
        <ObservedDocuments event={event} registration={registration} />
      )}

      <div className="flex flex-wrap gap-3">
        {CONTINUE_STATUSES.has(registration.status) && (
          <Button href={`${wizardRoute}?id=${registration.id}` as Route} bolt>
            Continuar la inscripción
          </Button>
        )}
        {registration.status === "confirmed" && (
          <Button
            href={`${OPEN_DAY_ROUTES.codes}?id=${registration.id}` as Route}
            bolt
          >
            Ver e imprimir códigos
          </Button>
        )}
      </div>
    </article>
  );
}
