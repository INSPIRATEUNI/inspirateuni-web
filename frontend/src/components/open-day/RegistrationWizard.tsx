"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  CalendarIcon,
  CampusIcon,
  ClipboardIcon,
  ClockIcon,
  UsersIcon,
} from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { conditionsFor } from "@/lib/open-day/conditions";
import {
  ACTIVE_STATUSES,
  OPEN_DAY_ROUTES,
  STATUS_LABELS,
  TIER_LABELS,
} from "@/lib/open-day/constants";
import { fetchMyRegistrations, isRegistrationOpen } from "@/lib/open-day/data";
import { formatDateTime, formatTimeRange } from "@/lib/open-day/format";
import {
  includesMinors,
  peopleComplete,
  tutorCount,
} from "@/lib/open-day/people";
import type {
  LogisticsOption,
  OpenDayEvent,
  Registration,
  RegistrationKind,
  TemplateKind,
} from "@/lib/open-day/types";
import { createClient } from "@/lib/supabase/client";
import { BringDocumentsNotice } from "./BringDocumentsNotice";
import { ChatBox } from "./ChatBox";
import { ConditionsStep } from "./ConditionsStep";
import { IndividualDetailsStep, SchoolDetailsStep } from "./DetailsStep";
import { useAvailability, useRegistration, useSessionUser } from "./hooks";
import { LogisticsStep } from "./LogisticsStep";
import { LateDocuments } from "./MyRegistrationClient";
import { Notice } from "./Notice";
import { OtpStep } from "./OtpStep";
import { PeopleEditor } from "./PeopleEditor";
import { SchoolPeopleEditor } from "./SchoolPeopleEditor";
import { Stepper, type StepStatus, type WizardStep } from "./Stepper";
import { SubmitStep } from "./SubmitStep";
import { TourPicker } from "./TourPicker";

type RegistrationWizardProps = {
  kind: RegistrationKind;
  event: OpenDayEvent;
  logisticsOptions: LogisticsOption[];
  /** `?id=` de la URL: permite recargar y retomar el trámite. */
  registrationId: string | null;
};

type ReservedPhase = "people" | "conditions" | "logistics" | "submit";

const SELECTION_STATUSES = new Set(["draft", "held", "needs_reassignment"]);
const FINAL_STATUSES = new Set(["submitted", "docs_observed", "confirmed"]);

/** Primer paso pendiente dentro de una inscripción reservada. */
function firstPendingPhase(registration: Registration): ReservedPhase {
  // Las declaraciones se aceptan en la misma sesión en que se envía
  return peopleComplete(registration) ? "conditions" : "people";
}

/**
 * Asistente de inscripción al Open Day (colegios y personas libres). El paso
 * actual se deriva del estado que guarda el servidor, así que se puede cerrar
 * la página y retomar desde "Mi inscripción" o con el mismo enlace.
 */
export function RegistrationWizard({
  kind,
  event,
  logisticsOptions,
  registrationId,
}: RegistrationWizardProps) {
  const router = useRouter();
  const user = useSessionUser();
  const signedIn = Boolean(user);
  const { registration, loading, notFound, reload } = useRegistration(
    registrationId,
    signedIn,
  );
  const [phase, setPhase] = useState<ReservedPhase | null>(null);
  const [accepted, setAccepted] = useState<TemplateKind[]>([]);
  const [existing, setExisting] = useState<Registration[]>([]);
  const route =
    kind === "school" ? OPEN_DAY_ROUTES.schools : OPEN_DAY_ROUTES.individuals;
  const isSchool = kind === "school";

  // Tras reservar, el paso inicial es el primero que falta
  useEffect(() => {
    if (registration?.status === "reserved") {
      setPhase((current) => current ?? firstPendingPhase(registration));
    } else {
      setPhase(null);
    }
  }, [registration]);

  // Inscripciones en curso del mismo tipo, para no crear una duplicada
  useEffect(() => {
    if (!user || registrationId) return;
    fetchMyRegistrations(createClient(), user.id).then((list) =>
      setExisting(
        list.filter(
          (r) =>
            r.eventId === event.id &&
            r.kind === kind &&
            ACTIVE_STATUSES.includes(r.status),
        ),
      ),
    );
  }, [user, registrationId, event.id, kind]);

  // Nombres y horarios de los recorridos para los resúmenes
  const showTourSummary = Boolean(
    registration && !SELECTION_STATUSES.has(registration.status),
  );

  if (
    user === undefined ||
    (registrationId && signedIn && loading && !registration)
  ) {
    return (
      <p className="text-muted-foreground" aria-live="polite">
        Cargando…
      </p>
    );
  }

  const status = registration?.status;
  const goTo = (id: string | null) =>
    router.replace((id ? `${route}?id=${id}` : route) as Route, {
      scroll: false,
    });

  async function signOut() {
    await createClient().auth.signOut();
    goTo(null);
    router.refresh();
  }

  if (registrationId && signedIn && notFound) {
    return (
      <Notice tone="error" title="No encontramos esta inscripción">
        Puede que hayas ingresado con otro correo.{" "}
        <a href={OPEN_DAY_ROUTES.mine} className="font-bold underline">
          Ve a Mi inscripción
        </a>{" "}
        o{" "}
        <button type="button" className="font-bold underline" onClick={signOut}>
          cambia de correo
        </button>
        .
      </Notice>
    );
  }

  if (registration && (status === "expired" || status === "cancelled")) {
    return (
      <div className="grid gap-5">
        <Notice
          tone="warning"
          title={`La inscripción ${registration.referenceCode} está ${STATUS_LABELS[registration.status].toLowerCase()}`}
        >
          {status === "expired"
            ? "Venció el plazo y liberamos los recorridos. Puedes empezar una nueva inscripción si aún hay cupos."
            : "Esta inscripción fue cancelada."}
        </Notice>
        {isRegistrationOpen(event) && (
          <div>
            <Button onClick={() => goTo(null)}>Empezar de nuevo</Button>
          </div>
        )}
        <ChatBox registrationId={registration.id} perspective="owner" />
      </div>
    );
  }

  if (registration && status && FINAL_STATUSES.has(status)) {
    return (
      <div className="grid gap-6">
        <SubmittedPanel registration={registration} />
        <BringDocumentsNotice kind={registration.kind} />
        <LateDocuments
          event={event}
          registration={registration}
          onChanged={reload}
        />
        <ChatBox registrationId={registration.id} perspective="owner" />
      </div>
    );
  }

  const stepStatus = (index: number, current: number): StepStatus =>
    index < current ? "done" : index === current ? "current" : "locked";

  // Índice del paso actual en la lista completa
  const order: string[] = [
    "access",
    "details",
    "tours",
    "people",
    "conditions",
    ...(isSchool ? ["logistics"] : []),
    "submit",
  ];
  const currentId = !signedIn
    ? "access"
    : !registration
      ? "details"
      : status && SELECTION_STATUSES.has(status)
        ? "tours"
        : (phase ?? "people");
  const current = order.indexOf(currentId);
  const editable = status === "reserved";

  const backButton = (target: ReservedPhase) =>
    editable ? (
      <Button variant="ghost" onClick={() => setPhase(target)}>
        Atrás
      </Button>
    ) : null;

  const editButton = (target: ReservedPhase) =>
    editable ? (
      <button
        type="button"
        onClick={() => setPhase(target)}
        className="mt-1 font-bold text-magenta hover:underline"
      >
        Editar
      </button>
    ) : null;

  const hasMinors = Boolean(
    registration && includesMinors(registration, event.eventDate),
  );
  const allAccepted = conditionsFor(kind, hasMinors).every((c) =>
    accepted.includes(c.template),
  );

  const visitors =
    registration?.attendees.filter((a) => a.role === "visitor").length ?? 0;
  const adults = (registration?.attendees.length ?? 0) - visitors;

  const steps: WizardStep[] = [
    {
      id: "access",
      title: "Ingresa con tu correo",
      icon: <ClipboardIcon />,
      status: stepStatus(0, current),
      content: <OtpStep onVerified={() => router.refresh()} />,
      summary: (
        <p>
          Ingresaste como{" "}
          <strong className="text-foreground">{user?.email}</strong>.{" "}
          <button
            type="button"
            className="font-bold text-magenta hover:underline"
            onClick={signOut}
          >
            Usar otro correo
          </button>
        </p>
      ),
    },
    {
      id: "details",
      title: isSchool ? "Datos del colegio y cantidad" : "Tus datos",
      icon: isSchool ? <CampusIcon className="size-5" /> : <UsersIcon />,
      status: stepStatus(1, current),
      lockedHint: "Primero ingresa con tu correo.",
      content: (
        <div className="grid gap-5">
          {existing.length > 0 && (
            <Notice tone="info" title="Ya tienes una inscripción en curso">
              <ul className="grid gap-1">
                {existing.map((r) => (
                  <li key={r.id}>
                    {r.referenceCode}
                    {r.school ? ` · ${r.school.name}` : ""} ·{" "}
                    {STATUS_LABELS[r.status]} ·{" "}
                    <button
                      type="button"
                      className="font-bold underline"
                      onClick={() => goTo(r.id)}
                    >
                      Continuar
                    </button>
                  </li>
                ))}
              </ul>
            </Notice>
          )}
          {isSchool ? (
            <SchoolDetailsStep
              event={event}
              defaultEmail={user?.email ?? ""}
              onStarted={goTo}
            />
          ) : (
            <IndividualDetailsStep
              event={event}
              defaultEmail={user?.email ?? ""}
              onStarted={goTo}
            />
          )}
        </div>
      ),
      summary: registration && (
        <p>
          Código{" "}
          <strong className="text-foreground">
            {registration.referenceCode}
          </strong>
          {registration.school && ` · ${registration.school.name}`} ·{" "}
          {registration.expectedVisitors}{" "}
          {registration.expectedVisitors === 1 ? "visitante" : "visitantes"}
        </p>
      ),
    },
    {
      id: "tours",
      title: "Elige los recorridos",
      icon: <ClockIcon />,
      status: stepStatus(2, current),
      lockedHint:
        "Elige un recorrido por nivel; separamos el cupo por unos minutos.",
      content: registration && (
        <TourPicker
          event={event}
          registration={registration}
          onChanged={reload}
        />
      ),
      summary: registration && showTourSummary && (
        <TourSummary event={event} registration={registration} />
      ),
    },
    {
      id: "people",
      title: isSchool ? "Representante y tutores" : "Visitantes",
      icon: <UsersIcon />,
      status: stepStatus(3, current),
      lockedHint: "Se habilita al confirmar los recorridos.",
      content:
        registration &&
        (isSchool ? (
          <SchoolPeopleEditor
            event={event}
            registration={registration}
            onVisitorsChanged={reload}
            onSaved={async () => {
              const fresh = await reload();
              setAccepted([]);
              if (fresh && peopleComplete(fresh)) setPhase("conditions");
            }}
          />
        ) : (
          <PeopleEditor
            event={event}
            registration={registration}
            onVisitorsChanged={reload}
            onSaved={async () => {
              const fresh = await reload();
              setAccepted([]);
              if (fresh && peopleComplete(fresh)) setPhase("conditions");
            }}
          />
        )),
      summary: registration && (
        <>
          <p>
            {isSchool
              ? `${registration.expectedVisitors} escolares y ${tutorCount(registration)} ${tutorCount(registration) === 1 ? "tutor" : "tutores"}.`
              : `${visitors} ${visitors === 1 ? "visitante" : "visitantes"} y ${adults} ${adults === 1 ? "adulto" : "adultos"}.`}
          </p>
          {editButton("people")}
        </>
      ),
    },
    {
      id: "conditions",
      title: "Acepta las condiciones",
      icon: <ClipboardIcon />,
      status: stepStatus(order.indexOf("conditions"), current),
      lockedHint: "Se habilita al registrar a las personas.",
      content: registration && (
        <div className="grid gap-5">
          <ConditionsStep
            kind={registration.kind}
            hasMinors={hasMinors}
            accepted={accepted}
            onChange={setAccepted}
          />
          <div className="flex flex-wrap gap-3">
            {backButton("people")}
            <Button
              disabled={!allAccepted}
              onClick={() => setPhase(isSchool ? "logistics" : "submit")}
            >
              Continuar
            </Button>
          </div>
        </div>
      ),
      summary: registration && (
        <>
          <p>Aceptaste las tres declaraciones.</p>
          {editButton("conditions")}
        </>
      ),
    },
    ...(isSchool
      ? [
          {
            id: "logistics",
            title: "Logística de llegada",
            icon: <CalendarIcon />,
            status: stepStatus(order.indexOf("logistics"), current),
            content: registration && (
              <div className="grid gap-5">
                <LogisticsStep
                  options={logisticsOptions}
                  registration={registration}
                  onSaved={async () => {
                    await reload();
                    setPhase("submit");
                  }}
                />
                <div>{backButton("conditions")}</div>
              </div>
            ),
            summary: registration && (
              <>
                <p>
                  {registration.logistics.length === 0
                    ? "Sin requerimientos."
                    : registration.logistics
                        .map(
                          (l) =>
                            `${logisticsOptions.find((o) => o.code === l.optionCode)?.label ?? l.optionCode}: ${l.quantity}`,
                        )
                        .join(" · ")}
                </p>
                {editButton("logistics")}
              </>
            ),
          } satisfies WizardStep,
        ]
      : []),
    {
      id: "submit",
      title: "Revisa y envía",
      icon: <CalendarIcon />,
      status: stepStatus(order.length - 1, current),
      content: registration && (
        <div className="grid gap-5">
          <SubmitStep
            registration={registration}
            canSubmit={allAccepted}
            onSubmitted={reload}
          />
          <div>{backButton(isSchool ? "logistics" : "conditions")}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-8">
      {registration?.status === "reserved" && registration.reopenReason && (
        <Notice tone="warning" title="Reabrimos tu inscripción">
          <span className="block font-bold">Observaciones del equipo</span>
          <span className="block whitespace-pre-line">
            {registration.reopenReason}
          </span>
        </Notice>
      )}
      {registration?.status === "reserved" && registration.docsDeadline && (
        <Notice tone="info">
          Tienes hasta el{" "}
          <strong>{formatDateTime(registration.docsDeadline)}</strong> para
          completar los datos y enviar. Puedes cerrar esta página y volver desde{" "}
          <a href={OPEN_DAY_ROUTES.mine} className="font-bold underline">
            Mi inscripción
          </a>
          .
        </Notice>
      )}
      <Stepper steps={steps} />
      {registration && (
        <ChatBox registrationId={registration.id} perspective="owner" />
      )}
    </div>
  );
}

function TourSummary({
  event,
  registration,
}: {
  event: OpenDayEvent;
  registration: Registration;
}) {
  const { sessions } = useAvailability(event.id, 60_000);
  const byId = new Map(sessions.map((s) => [s.sessionId, s]));
  return (
    <ul className="grid gap-1">
      {registration.enrollments.map((enrollment) => {
        const session = byId.get(enrollment.sessionId);
        return (
          <li key={enrollment.sessionId}>
            <strong className="text-foreground">
              {session?.facultyName ?? TIER_LABELS[enrollment.tier]}
            </strong>
            {session &&
              ` · ${formatTimeRange(session.startsAt, session.endsAt)}`}
          </li>
        );
      })}
    </ul>
  );
}

function SubmittedPanel({
  registration,
}: {
  registration: Registration;
}): ReactNode {
  const observed = registration.status === "docs_observed";
  const confirmed = registration.status === "confirmed";
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-6 py-6 text-center sm:flex-row sm:text-left"
    >
      <Mascot
        pose="alegre"
        className="w-28 shrink-0 animate-mascot-float sm:w-36 motion-reduce:animate-none"
      />
      <div>
        <Heading variant="section" level={2}>
          {confirmed ? (
            <>
              ¡Todo listo,{" "}
              <GradientText gradient="fresh">nos vemos</GradientText>!
            </>
          ) : observed ? (
            <>
              Revisa las{" "}
              <GradientText gradient="fresh">observaciones</GradientText>.
            </>
          ) : (
            <>
              Recibimos tu{" "}
              <GradientText gradient="fresh">inscripción</GradientText>.
            </>
          )}
        </Heading>
        <Text variant="lead" className="mt-3">
          {confirmed
            ? "Tu inscripción está confirmada. Ya puedes ver e imprimir los códigos de acceso."
            : observed
              ? "Tenemos observaciones sobre tu inscripción. Léelas en los mensajes y envíala de nuevo desde Mi inscripción."
              : `Código ${registration.referenceCode}. Revisaremos tu inscripción y te escribiremos a ${registration.contactEmail}.`}
        </Text>
        <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
          <Button href={OPEN_DAY_ROUTES.mine} bolt={observed}>
            Ir a Mi inscripción
          </Button>
          {confirmed && (
            <Button
              variant="ghost"
              href={`${OPEN_DAY_ROUTES.codes}?id=${registration.id}` as Route}
            >
              Ver mis códigos
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
