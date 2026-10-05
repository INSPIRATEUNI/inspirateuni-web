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
import { cn } from "@/lib/cn";
import { type RelayColor, relayAt } from "@/lib/relay";

const careerClasses: Record<RelayColor, string> = {
  magenta: "text-magenta",
  orange: "text-orange-ink",
  blue: "text-blue",
  green: "text-green-ink",
};

/** Contenido del prototipo hasta tener los testimonios reales. */
const referents = [
  { name: "Valeria Quispe", career: "Ingeniería Mecatrónica" },
  { name: "Lucía Mendoza", career: "Ingeniería de Sistemas" },
  { name: "Andrea Huamán", career: "Física" },
  { name: "Sofía Paredes", career: "Ingeniería Civil" },
];

export default function IgirlPage() {
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
              La ingeniería también es para ti. En Inspírate Girl conoces a
              estudiantes que eligieron carreras STEM, pruebas proyectos reales
              y descubres que tu curiosidad tiene lugar aquí.
            </Text>
            <Bullets
              tone="magenta"
              className="mt-6"
              items={[
                "Mentoría uno a uno durante un ciclo",
                "Talleres prácticos los sábados",
                "Una comunidad que te acompaña",
              ]}
            />
            <a
              href={`mailto:${contact.email}?subject=Quiero participar en Inspírate Girl`}
              className={buttonClasses({ className: "mt-8" })}
            >
              Quiero participar
              <BoltIcon />
            </a>
          </div>

          <figure className="relative pt-14">
            <span
              aria-hidden="true"
              className="absolute -top-6 -left-1 font-display text-[9rem] leading-none font-bold text-magenta/30"
            >
              “
            </span>
            <blockquote className="font-display text-[clamp(1.35rem,1.15rem+0.8vw,1.75rem)] leading-snug font-semibold">
              Yo pensaba que la ingeniería no era para mí. En un taller armé mi
              primer circuito y entendí que solo me faltaba probar. Hoy estudio
              Ingeniería Electrónica.
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3.5">
              <span
                role="img"
                aria-label="Espacio para foto de perfil"
                className="size-13 shrink-0 rounded-full bg-magenta-soft"
              />
              <span>
                <span className="block font-extrabold">Camila Rojas</span>
                <span className="block text-sm text-muted-foreground">
                  Egresada de Inspírate Girl 2022
                </span>
              </span>
            </figcaption>
          </figure>
        </div>

        <div className="mt-16">
          <div className="flex items-end justify-between gap-6">
            <Text variant="eyebrow">Referentes que te cuentan su camino</Text>
            <Mascot
              pose="sorprendido"
              className="w-24 shrink-0 animate-mascot-float sm:w-32 motion-reduce:animate-none"
            />
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
            {referents.map((referent, index) => {
              const tone = relayAt(index);
              return (
                <li key={referent.name}>
                  <ImageSlot
                    fallbackAlt={`foto de ${referent.name}`}
                    tone={tone}
                    shape="portrait"
                  />
                  <Heading variant="item" level={3} className="mt-3.5">
                    {referent.name}
                  </Heading>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-bold",
                      careerClasses[tone],
                    )}
                  >
                    {referent.career}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
