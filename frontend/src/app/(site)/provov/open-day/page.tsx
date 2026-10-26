import type { ReactNode } from "react";
import { ImageSlot } from "@/components/gallery/ImageSlot";
import { Breadcrumb } from "@/components/programs/Breadcrumb";
import {
  BoltIcon,
  CalendarIcon,
  CampusIcon,
  PinIcon,
  SparkleIcon,
  UsersIcon,
} from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { contact } from "@/components/site/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { ediciones } from "@/data/organizacion";
import { galeriaOpenDay, openDay } from "@/data/provov";
import { cn } from "@/lib/cn";
import { relayAt } from "@/lib/relay";

const details: { icon: ReactNode; label: string; value: string }[] = [
  {
    icon: <CalendarIcon />,
    label: "Fecha",
    value: `Por anunciar. Síguenos con ${openDay.hashtag}`,
  },
  {
    icon: <PinIcon className="size-5" />,
    label: "Lugar",
    value: openDay.place,
  },
  { icon: <UsersIcon />, label: "Para", value: openDay.audience },
  {
    icon: <CampusIcon className="size-5" />,
    label: "Alcance",
    value: "Hasta 6000 jóvenes en la edición 2023",
  },
];

/** Icono de cada actividad en la línea del día. */
const activityIcons = [
  <CampusIcon key="tour" className="size-6" />,
  <SparkleIcon key="feria" className="size-6" />,
  <BoltIcon key="taller" className="size-6" />,
  <UsersIcon key="charla" className="size-6" />,
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
            <Breadcrumb
              parent={{ label: "PROVOV", href: "/provov" }}
              current="Open Day"
            />
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
              {openDay.description}
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
              href={`mailto:${contact.email}?subject=Quiero ir al Open Day UNI 2026`}
              className={buttonClasses({ className: "mt-8" })}
            >
              Avísame cuando abra la inscripción
              <BoltIcon />
            </a>
          </div>

          <div className="relative pb-12">
            <ImageSlot
              image={{
                src: "/fotos/open-day/fc-quimica-demostracion.webp",
                alt: "Escolares y padres frente al stand de Química en la feria de carreras",
              }}
              fallbackAlt="feria de carreras durante el Open Day"
              tone="orange"
              shape="landscape"
            />
            <div className="absolute bottom-0 left-0 w-[42%] rounded-leaf ring-6 ring-background">
              <ImageSlot
                image={{
                  src: "/fotos/open-day/fiee-demo-circuito.webp",
                  alt: "Escolares prueban un circuito junto a estudiantes de la FIEE",
                }}
                fallbackAlt="demo en laboratorio"
                tone="blue"
                shape="landscape"
              />
            </div>
          </div>
        </div>

        <div className="mt-16">
          <div className="flex items-end justify-between gap-6">
            <Heading variant="feature" level={2}>
              Así se vive el día.
            </Heading>
            <Mascot
              pose="alegre"
              className="w-24 shrink-0 animate-mascot-float sm:w-32 motion-reduce:animate-none"
            />
          </div>
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
              {openDay.actividades.map((step, index) => {
                const up = index % 2 === 0;
                return (
                  <li key={step.title} className="relative min-h-14 md:px-4">
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
                        "absolute -top-1 -left-11 grid size-14 -translate-x-[calc(50%+1px)] place-items-center rounded-full text-white",
                        "md:left-1/2 md:size-16 md:-translate-x-1/2 md:-translate-y-1/2",
                        up ? "md:-top-[120px]" : "md:-top-[60px]",
                        badgeClasses[index % badgeClasses.length],
                      )}
                    >
                      {activityIcons[index]}
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

        <div className="mt-20">
          <Heading variant="feature" level={2}>
            Así fue el Open Day 2019.
          </Heading>
          <Text variant="muted" className="mt-2">
            Más de 6500 escolares y 358 voluntarios recorrieron la UNI en
            nuestra edición récord.
          </Text>
          <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
            {galeriaOpenDay.map((foto, index) => (
              <li key={foto.src}>
                <ImageSlot
                  image={foto}
                  fallbackAlt={foto.alt}
                  tone={relayAt(index)}
                  shape="portrait"
                />
                <p className="mt-2.5 text-sm font-bold text-muted-foreground">
                  {foto.faculty}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-20">
          <Heading variant="feature" level={2}>
            Ediciones anteriores.
          </Heading>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-md text-left">
              <thead className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th scope="col" className="py-3 pr-4">
                    Año
                  </th>
                  <th scope="col" className="py-3 pr-4">
                    Modalidad
                  </th>
                  <th scope="col" className="py-3 pr-4">
                    Escolares
                  </th>
                  <th scope="col" className="py-3">
                    Voluntarios
                  </th>
                </tr>
              </thead>
              <tbody>
                {ediciones.map((edicion) => (
                  <tr
                    key={edicion.year}
                    className="border-b border-border/70 align-top"
                  >
                    <th scope="row" className="py-3 pr-4 font-display text-lg">
                      {edicion.year}
                    </th>
                    <td className="py-3 pr-4">
                      {edicion.mode}
                      {edicion.note && (
                        <span className="block text-sm text-muted-foreground">
                          {edicion.note}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-bold">{edicion.students}</td>
                    <td className="py-3 font-bold">{edicion.volunteers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
