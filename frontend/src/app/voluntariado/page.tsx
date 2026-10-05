import { ImageSlot } from "@/components/gallery/ImageSlot";
import { SparkleIcon } from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { socialLinks } from "@/components/site/navigation";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { type RelayColor, relayAt, relayClasses } from "@/lib/relay";

const statClasses: Record<RelayColor, string> = {
  magenta: "text-magenta-deep",
  orange: "text-orange-deep",
  blue: "text-blue-deep",
  green: "text-green-deep",
};

/** Cifras del prototipo hasta tener las reales. */
const stats = [
  { value: "+120", label: "Colegios visitados" },
  { value: "+8 500", label: "Escolares orientados" },
  { value: "150", label: "Voluntarios activos" },
  { value: "6", label: "Ediciones de Open Day" },
];

const values = ["Vocación", "Cercanía", "Curiosidad", "Equidad"];

export default function VoluntariadoPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-14 pb-20">
        <div
          aria-hidden="true"
          className="blob top-24 -right-20 size-72 bg-magenta [animation-delay:-6s]"
        />
        <div className="container-site z-1 grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="relative mx-auto w-full max-w-lg">
            <div
              aria-hidden="true"
              className="absolute -inset-4 -rotate-3 rounded-blob bg-green-soft"
            />
            <ImageSlot
              fallbackAlt="equipo de voluntarios en el campus"
              tone="blue"
              shape="landscape"
              className="relative"
            />
          </div>

          <div>
            <Tag tone="green">
              <SparkleIcon className="size-3.5" />
              Quiénes somos
            </Tag>
            <Heading variant="page" className="mt-4">
              Estudiantes que{" "}
              <GradientText gradient="fresh">abren la puerta</GradientText> de
              la UNI.
            </Heading>
            <Text variant="lead" className="mt-6">
              Inspírate UNI es un voluntariado de estudiantes de la Universidad
              Nacional de Ingeniería. Desde 2018 acompañamos a escolares y
              preuniversitarios a elegir su carrera de la mejor forma que
              conocemos: viviéndola.
            </Text>
            <Text variant="muted" className="mt-4">
              Creemos que nadie debería decidir su futuro solo con un folleto.
              Por eso organizamos recorridos, abrimos laboratorios, visitamos
              colegios y contamos cómo es de verdad estudiar ingeniería,
              ciencias y arquitectura.
            </Text>
            <ul
              aria-label="Nuestros valores"
              className="mt-8 flex flex-wrap gap-2.5"
            >
              {values.map((value, index) => (
                <li key={value}>
                  <Tag variant="neutral">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 rounded-full",
                        relayClasses[relayAt(index)].dot,
                      )}
                    />
                    {value}
                  </Tag>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-label="Nuestro impacto" className="bg-tint-blue py-14">
        <dl className="container-site grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-0">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="flex flex-col-reverse text-center md:[&+&]:border-l md:[&+&]:border-border"
            >
              <dt className="mt-2.5 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                {stat.label}
              </dt>
              <dd
                className={cn(
                  "font-display text-[clamp(2.25rem,1.8rem+1.6vw,3rem)] leading-none font-bold",
                  statClasses[relayAt(index)],
                )}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="relative overflow-hidden py-20">
        <div
          aria-hidden="true"
          className="blob -bottom-20 -left-16 size-72 bg-orange [animation-delay:-9s]"
        />
        <div className="container-site z-1 flex max-w-4xl flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
          <Mascot
            pose="risa"
            className="w-32 shrink-0 animate-mascot-float sm:w-40 motion-reduce:animate-none"
          />
          <div>
            <Heading variant="section">
              ¿Cómo me hago{" "}
              <GradientText gradient="energy">voluntario</GradientText>?
            </Heading>
            <Text variant="lead" className="mt-4">
              Si estudias en la UNI, abrimos convocatoria dos veces al año.
              Síguenos en redes para enterarte de la próxima.
            </Text>
            <ul className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
              {socialLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
