import { VolunteerForm } from "@/components/forms/VolunteerForm";
import { ImageSlot } from "@/components/gallery/ImageSlot";
import { Bullets } from "@/components/programs/Bullets";
import { BoltIcon, CalendarIcon, SparkleIcon } from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { socialLinks } from "@/components/site/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import {
  beneficios,
  capacitacion,
  convocatoria,
  embajadores,
  funciones,
} from "@/data/voluntariado";
import { cn } from "@/lib/cn";
import {
  type ConvocatoriaStatus,
  convocatoriaStatus,
  convocatoriaYear,
} from "@/lib/forms/convocatoria";
import { type RelayColor, relayAt } from "@/lib/relay";

// La página es estática: se regenera cada hora para que abrir o cerrar la
// convocatoria cambie el texto sin un nuevo build.
export const revalidate = 3600;

const statClasses: Record<RelayColor, string> = {
  magenta: "text-magenta-deep",
  orange: "text-orange-deep",
  blue: "text-blue-deep",
  green: "text-green-deep",
};

const borderClasses: Record<RelayColor, string> = {
  magenta: "border-magenta",
  orange: "border-orange",
  blue: "border-blue",
  green: "border-green",
};

/** Textos de la sección #postula según el estado de la convocatoria. */
const postulaCopy: Record<
  ConvocatoriaStatus,
  { tag: string; title: string; keyword: string; lead: string }
> = {
  upcoming: {
    tag: "Próxima convocatoria",
    title: "Te avisamos cuando",
    keyword: "abra",
    lead: `La convocatoria ${convocatoriaYear} va ${convocatoria.label.toLowerCase()}. Déjanos tus datos y te avisamos cuando abra.`,
  },
  open: {
    tag: "Convocatoria abierta",
    title: "Postula al",
    keyword: "voluntariado",
    lead: `Convocatoria ${convocatoriaYear}: ${convocatoria.label.toLowerCase()}. Revisaremos tus datos y te escribiremos con los siguientes pasos.`,
  },
  closed: {
    tag: "Convocatoria cerrada",
    title: "Te avisamos en la",
    keyword: "próxima",
    lead: `La convocatoria ${convocatoriaYear} ya cerró. Déjanos tus datos y te avisamos en la próxima.`,
  },
};

export default function VoluntariadoPage() {
  const status = convocatoriaStatus();
  const copy = postulaCopy[status];

  return (
    <>
      <section className="relative overflow-hidden pt-14 pb-20">
        <div
          aria-hidden="true"
          className="blob top-24 -right-20 size-72 bg-green [animation-delay:-6s]"
        />
        <div className="container-site z-1 grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <Tag tone="green">
              <SparkleIcon className="size-3.5" />
              Voluntariado
            </Tag>
            <Heading variant="page" className="mt-4">
              Conviértete en{" "}
              <GradientText gradient="fresh">agente de cambio</GradientText>.
            </Heading>
            <Text variant="lead" className="mt-6">
              Si estudias en la UNI y te mueve orientar a otros jóvenes, súmate
              al equipo que hace posible el Open Day y los programas de
              Inspírate.
            </Text>
            <p className="mt-6 flex items-center gap-3 font-bold">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-leaf-xs bg-green-soft text-green-ink"
              >
                <CalendarIcon />
              </span>
              <span>
                <span className="block text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                  Convocatoria 2026
                </span>
                <time dateTime={convocatoria.start}>{convocatoria.label}</time>
              </span>
            </p>
            <a href="#postula" className={buttonClasses({ className: "mt-8" })}>
              Quiero ser voluntario
              <BoltIcon />
            </a>
          </div>

          <div className="relative mx-auto w-56 sm:w-64 lg:w-80">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-3/4 rounded-blob bg-green-soft"
            />
            <div className="relative animate-mascot-float motion-reduce:animate-none">
              <Mascot
                pose="alegre"
                preload
                className="w-full origin-bottom animate-mascot-sway motion-reduce:animate-none"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-tint-green py-16">
        <div className="container-site grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <Heading variant="section">
              Lo que <GradientText gradient="fresh">harás</GradientText>.
            </Heading>
            <Bullets items={funciones} tone="green" className="mt-6" />
          </div>
          <div>
            <Heading variant="section">
              Lo que <GradientText gradient="energy">te llevas</GradientText>.
            </Heading>
            <Bullets items={beneficios} tone="magenta" className="mt-6" />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container-site max-w-6xl">
          <Heading variant="section">
            Te <GradientText gradient="discover">preparamos</GradientText>.
          </Heading>
          <ul className="mt-8 grid gap-8 md:grid-cols-3">
            {capacitacion.map((item, index) => (
              <li
                key={item.title}
                className={cn("border-t-4 pt-4", borderClasses[relayAt(index)])}
              >
                <Heading variant="item" level={3}>
                  {item.title}
                </Heading>
                <Text variant="muted" className="mt-1.5">
                  {item.text}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-tint-blue py-16">
        <div className="container-site grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
          <ImageSlot
            image={{
              src: "/fotos/voluntariado/marco-equipo.webp",
              alt: "Tres voluntarios de Inspírate UNI posan dentro del marco del logo",
            }}
            fallbackAlt="embajadores de Inspírate UNI"
            tone="blue"
            shape="landscape"
          />
          <div>
            <Tag tone="blue">PROEMIN</Tag>
            <Heading variant="section" className="mt-4">
              Embajadores que{" "}
              <GradientText gradient="discover">inspiran</GradientText>.
            </Heading>
            <Text variant="muted" className="mt-4">
              Representa a tu facultad y a tus especialidades: prepara guías y
              material, mapea egresados destacados y atiende orientaciones
              virtuales. {embajadores.requisito}
            </Text>
            <ul className="mt-5 flex flex-wrap gap-2">
              {embajadores.cargos.map((cargo) => (
                <li key={cargo}>
                  <Tag variant="neutral">{cargo}</Tag>
                </li>
              ))}
            </ul>
            <dl className="mt-7 grid grid-cols-3 gap-4">
              {embajadores.stats.map((stat, index) => (
                <div key={stat.label} className="flex flex-col-reverse">
                  <dt className="mt-1.5 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                    {stat.label}
                  </dt>
                  <dd
                    className={cn(
                      "font-display text-[2rem] leading-none font-bold",
                      statClasses[relayAt(index)],
                    )}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section
        id="postula"
        aria-labelledby="postula-title"
        className="scroll-mt-24 bg-tint-green py-16"
      >
        <div className="container-site grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <Tag tone="green">{copy.tag}</Tag>
            <Heading id="postula-title" variant="section" className="mt-4">
              {copy.title}{" "}
              <GradientText gradient="fresh">{copy.keyword}</GradientText>.
            </Heading>
            <Text variant="lead" className="mt-4">
              {copy.lead}
            </Text>
          </div>
          <div className="rounded-lg border-2 border-border bg-surface p-6 shadow-soft sm:p-8">
            <VolunteerForm open={status === "open"} />
          </div>
        </div>
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
              Entérate de la{" "}
              <GradientText gradient="energy">
                próxima convocatoria
              </GradientText>
              .
            </Heading>
            <Text variant="lead" className="mt-4">
              Publicamos cada convocatoria en nuestras redes. Síguenos para no
              perdértela.
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
