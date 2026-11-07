import type { Metadata } from "next";
import Link from "next/link";
import { ClosedNotice } from "@/components/open-day/ClosedNotice";
import { PageIntro } from "@/components/open-day/PageIntro";
import {
  CalendarIcon,
  CampusIcon,
  ChevronRightIcon,
  UsersIcon,
} from "@/components/site/Icons";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { OPEN_DAY_ROUTES } from "@/lib/open-day/constants";
import { isRegistrationOpen } from "@/lib/open-day/data";
import { formatDateTime, formatEventDate } from "@/lib/open-day/format";
import { getUpcomingEvent } from "@/lib/open-day/server";

export const metadata: Metadata = {
  title: "Inscripción al Open Day",
  description:
    "Inscribe a tu colegio o inscríbete como persona libre para visitar la UNI en el Open Day.",
};

const options = [
  {
    href: OPEN_DAY_ROUTES.schools,
    title: "Soy de un colegio",
    text: "Un docente o responsable inscribe a su grupo de escolares y a los profesores que los acompañan.",
    icon: <CampusIcon className="size-6" />,
    tone: "bg-magenta-deep",
  },
  {
    href: OPEN_DAY_ROUTES.individuals,
    title: "Voy por mi cuenta",
    text: "Para un solo visitante. Si eres menor de edad, te acompaña un adulto que también se registra.",
    icon: <UsersIcon className="size-6" />,
    tone: "bg-blue-deep",
  },
] as const;

export default async function InscripcionPage() {
  const event = await getUpcomingEvent();
  const open = event ? isRegistrationOpen(event) : false;

  return (
    <>
      <PageIntro
        current="Inscripción"
        title={
          <>
            ¿Cómo vienes al{" "}
            <GradientText gradient="discover">Open Day</GradientText>?
          </>
        }
        lead={
          event
            ? `${event.name}: ${formatEventDate(event.eventDate)}${event.venue ? `, ${event.venue}` : ""}.`
            : undefined
        }
      />

      {open && event ? (
        <div className="grid gap-10">
          <ul className="grid gap-5 md:grid-cols-2">
            {options.map((option) => (
              <li key={option.href}>
                <Link
                  href={option.href}
                  className="group grid h-full gap-4 rounded-lg border-2 border-border bg-surface p-6 shadow-soft transition-colors hover:border-magenta focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-12 place-items-center rounded-full text-white",
                      option.tone,
                    )}
                  >
                    {option.icon}
                  </span>
                  <Heading variant="item" level={2}>
                    {option.title}
                  </Heading>
                  <Text variant="muted">{option.text}</Text>
                  <span className="inline-flex items-center gap-1 font-bold text-magenta">
                    Empezar
                    <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarIcon className="size-4" />
              Inscripciones hasta el{" "}
              {formatDateTime(event.registrationClosesAt)}
            </span>
            <span>
              ¿Ya empezaste?{" "}
              <Link
                href={OPEN_DAY_ROUTES.mine}
                className="font-bold text-magenta hover:underline"
              >
                Ve a Mi inscripción
              </Link>
            </span>
          </div>
        </div>
      ) : (
        <ClosedNotice event={event} />
      )}
    </>
  );
}
