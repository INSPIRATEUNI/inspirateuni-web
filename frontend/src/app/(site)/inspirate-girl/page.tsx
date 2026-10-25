import { ImageSlot } from "@/components/gallery/ImageSlot";
import { Bullets } from "@/components/programs/Bullets";
import { BoltIcon, SparkleIcon } from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { contact } from "@/components/site/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { igirlInstagram, mensaje, objetivos, proyectos } from "@/data/igirl";
import { lemas } from "@/data/organizacion";
import { cn } from "@/lib/cn";
import { type RelayColor, relayAt } from "@/lib/relay";

const nameClasses: Record<RelayColor, string> = {
  magenta: "text-magenta-deep",
  orange: "text-orange-ink",
  blue: "text-blue-deep",
  green: "text-green-ink",
};

export default function InspirateGirlPage() {
  return (
    <section className="relative overflow-hidden bg-tint-magenta pt-14 pb-24">
      <div
        aria-hidden="true"
        className="blob top-24 -left-32 size-96 bg-magenta [animation-delay:-5s]"
      />
      <div
        aria-hidden="true"
        className="blob -right-16 bottom-24 size-64 bg-blue [animation-delay:-14s]"
      />

      <div className="container-site z-1 max-w-6xl">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <Tag tone="magenta">
              <SparkleIcon className="size-3.5" />
              Inspírate Girl
            </Tag>
            <Heading variant="page" className="mt-4">
              Más chicas{" "}
              <GradientText gradient="energy">creando el futuro</GradientText>{" "}
              con ciencia.
            </Heading>
            <Text variant="lead" className="mt-5">
              Inspiramos a niñas, adolescentes y jóvenes a incursionar en
              ciencia, tecnología, ingeniería y matemáticas. Nacimos porque en
              2019 solo alrededor del 15 % de estudiantes de la UNI eran
              mujeres.
            </Text>
            <Bullets tone="magenta" className="mt-6" items={objetivos} />
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={igirlInstagram}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses()}
              >
                Síguenos en Instagram
                <BoltIcon />
              </a>
              <a
                href={`mailto:${contact.email}?subject=Quiero participar en Inspírate Girl`}
                className={buttonClasses({ variant: "ghost" })}
              >
                Quiero participar
              </a>
            </div>
          </div>

          <figure className="relative">
            <ImageSlot
              image={{
                src: "/fotos/voluntariado/marco-voluntarias.webp",
                alt: "Cuatro voluntarias de Inspírate UNI posan dentro del marco del logo",
              }}
              fallbackAlt="voluntarias de Inspírate UNI"
              tone="magenta"
              shape="landscape"
            />
            <blockquote className="mt-8 font-display text-[clamp(1.35rem,1.15rem+0.8vw,1.75rem)] leading-snug font-semibold">
              “{mensaje}”
            </blockquote>
          </figure>
        </div>

        <div className="mt-20">
          <div className="flex items-end justify-between gap-6">
            <Heading variant="section">
              Nuestros <GradientText gradient="energy">proyectos</GradientText>.
            </Heading>
            <Mascot
              pose="sorprendido"
              className="w-24 shrink-0 animate-mascot-float sm:w-32 motion-reduce:animate-none"
            />
          </div>
          <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {proyectos.map((proyecto, index) => (
              <li key={proyecto.name}>
                <Heading
                  variant="item"
                  level={3}
                  className={nameClasses[relayAt(index)]}
                >
                  {proyecto.name}
                </Heading>
                <Text variant="muted" className="mt-1.5">
                  {proyecto.description}
                </Text>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-20 grid items-center gap-10 md:grid-cols-2">
          <ImageSlot
            image={{
              src: "/fotos/open-day/escolares-clase-quimica.webp",
              alt: "Escolares atienden la explicación de un estudiante en un laboratorio de Química",
            }}
            fallbackAlt="escolares en un laboratorio"
            tone="blue"
            shape="landscape"
          />
          <div>
            <Text variant="eyebrow">Día de la Niña</Text>
            <Heading variant="section" className="mt-3">
              Tú eliges qué carreras{" "}
              <GradientText gradient="discover">conocer</GradientText>.
            </Heading>
            <Text variant="muted" className="mt-4">
              Cada 11 de octubre abrimos la UNI para niñas y adolescentes:
              presentación en el museo, visitas guiadas por las facultades y
              talleres para probar con tus manos.
            </Text>
            <p
              className={cn(
                "mt-6 font-display text-lg font-semibold",
                nameClasses.magenta,
              )}
            >
              {lemas.igirl}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
