import type { ReactNode } from "react";
import { ImageSlot } from "@/components/gallery/ImageSlot";
import { Countdown } from "@/components/programs/Countdown";
import {
  BoltIcon,
  CalendarIcon,
  ClockIcon,
  PinIcon,
  SparkleIcon,
  UsersIcon,
} from "@/components/site/Icons";
import { contact } from "@/components/site/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { eventos } from "@/data/eventos";
import { cn } from "@/lib/cn";

const openDay = eventos.find((evento) => evento.id === "open-day-2026");
const OPEN_DAY_DATE = openDay?.date ?? "2026-11-14T09:00:00-05:00";

const details: { icon: ReactNode; label: string; value: string }[] = [
  {
    icon: <CalendarIcon />,
    label: "Fecha",
    value: "Sábado 14 de noviembre de 2026",
  },
  { icon: <ClockIcon />, label: "Horario", value: "De 9:00 a 14:00" },
  {
    icon: <PinIcon className="size-5" />,
    label: "Lugar",
    value: "Campus UNI, Av. Túpac Amaru 210, Rímac",
  },
  {
    icon: <UsersIcon />,
    label: "Para",
    value: "Escolares de 4.° y 5.° de secundaria y preuniversitarios",
  },
];

const steps = [
  {
    time: "9:00",
    title: "Bienvenida",
    text: "Te recibimos en la puerta, te damos tu mapa y armamos grupos por intereses.",
  },
  {
    time: "10:00",
    title: "Recorrido por el campus",
    text: "Caminamos por las facultades con voluntarios de cada carrera.",
  },
  {
    time: "11:30",
    title: "Laboratorios abiertos",
    text: "Robótica, química, estructuras y más. Mira cómo se trabaja de verdad.",
  },
  {
    time: "13:00",
    title: "Conoce las especialidades",
    text: "Charlas cortas y preguntas libres con estudiantes de cada especialidad.",
  },
];

/** Color del relay por paso, con su brillo. */
const badgeClasses = [
  "bg-magenta-deep shadow-[0_14px_40px_-18px_var(--color-magenta)]",
  "bg-orange-deep shadow-[0_14px_40px_-18px_var(--color-orange)]",
  "bg-blue-deep shadow-[0_14px_40px_-18px_var(--color-blue)]",
  "bg-green-deep shadow-[0_14px_40px_-18px_var(--color-green)]",
];

export default function OpenDayPage() {
  return (
    <section className="relative overflow-hidden pt-14 pb-24">
      <div
        aria-hidden="true"
        className="blob top-24 -right-28 size-88 bg-orange [animation-delay:-2s]"
      />
      <div
        aria-hidden="true"
        className="blob bottom-32 -left-20 size-64 bg-green [animation-delay:-10s]"
      />

      <div className="container-site z-1 max-w-6xl">
        <div className="grid items-start gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div>
            <Tag tone="orange">
              <SparkleIcon className="size-3.5" />
              Open Day UNI 2026
            </Tag>
            <Heading variant="page" className="mt-4">
              Ven a conocer{" "}
              <GradientText gradient="discover">
                el campus por dentro
              </GradientText>
              .
            </Heading>
            <Text variant="lead" className="mt-5">
              Un sábado entero para caminar la UNI, entrar a los laboratorios y
              preguntarle todo a quienes ya estudian aquí.
            </Text>
            <dl className="mt-8 grid gap-4">
              {details.map((detail) => (
                <div key={detail.label} className="flex items-center gap-3.5">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-leaf-xs bg-orange-soft text-orange-ink"
                  >
                    {detail.icon}
                  </span>
                  <div>
                    <dt className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                      {detail.label}
                    </dt>
                    <dd className="font-bold">{detail.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <a
              href={`mailto:${contact.email}?subject=Inscripción al Open Day UNI 2026`}
              className={buttonClasses({ className: "mt-8" })}
            >
              Inscríbete gratis
              <BoltIcon />
            </a>
          </div>

          <div>
            <Text variant="eyebrow">Faltan</Text>
            <Countdown
              target={OPEN_DAY_DATE}
              label="Cuenta regresiva para el Open Day UNI"
              className="mt-3"
            />
            <div className="relative mt-10 pb-12">
              <ImageSlot
                fallbackAlt="patio central durante el Open Day"
                tone="orange"
                shape="landscape"
              />
              <div className="absolute bottom-0 left-0 w-[42%] rounded-leaf ring-6 ring-background">
                <ImageSlot
                  fallbackAlt="demo en laboratorio"
                  tone="blue"
                  shape="landscape"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <Heading variant="feature" level={2}>
            Así será tu día.
          </Heading>
          <div className="relative mt-10 md:pt-[150px]">
            <svg
              viewBox="0 0 1000 120"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="absolute inset-x-0 top-0 hidden h-[120px] w-full overflow-visible md:block"
            >
              <defs>
                <linearGradient id="timeline-spectrum" x1="0" x2="1">
                  <stop offset="0" stopColor="var(--color-magenta)" />
                  <stop offset="0.33" stopColor="var(--color-orange)" />
                  <stop offset="0.66" stopColor="var(--color-blue)" />
                  <stop offset="1" stopColor="var(--color-green)" />
                </linearGradient>
              </defs>
              <path
                d="M0,80 C50,40 80,30 125,30 C220,30 280,90 375,90 C470,90 530,30 625,30 C720,30 780,90 875,90 C920,90 960,75 1000,60"
                fill="none"
                stroke="url(#timeline-spectrum)"
                strokeOpacity="0.55"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="2 10"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <ol className="ml-7 grid gap-9 border-l-2 border-dashed border-blue/40 pl-11 md:m-0 md:grid-cols-4 md:gap-0 md:border-0 md:p-0 md:text-center">
              {steps.map((step, index) => {
                const up = index % 2 === 0;
                return (
                  <li key={step.time} className="relative min-h-14 md:px-4">
                    {/* Conector entre la curva y el texto */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-1/2 hidden w-px bg-magenta/30 md:block",
                        up ? "-top-[88px]" : "-top-[28px]",
                        "bottom-[calc(100%+0.75rem)]",
                      )}
                    />
                    <span
                      className={cn(
                        "absolute -top-1 -left-11 grid size-14 -translate-x-[calc(50%+1px)] place-items-center rounded-full font-display text-[0.95rem] font-bold text-white",
                        "md:left-1/2 md:size-16 md:-translate-x-1/2 md:-translate-y-1/2 md:text-base",
                        up ? "md:-top-[120px]" : "md:-top-[60px]",
                        badgeClasses[index % badgeClasses.length],
                      )}
                    >
                      {step.time}
                    </span>
                    <Heading variant="item" level={3}>
                      {step.title}
                    </Heading>
                    <Text variant="muted" className="mt-1.5">
                      {step.text}
                    </Text>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
