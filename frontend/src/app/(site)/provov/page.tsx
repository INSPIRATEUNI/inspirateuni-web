import { ImageSlot } from "@/components/gallery/ImageSlot";
import { Bullets } from "@/components/programs/Bullets";
import { SparkleIcon } from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { lemas } from "@/data/organizacion";
import {
  componentes,
  ovpgs,
  ponencias,
  ponentesFrecuentes,
} from "@/data/provov";
import { cn } from "@/lib/cn";
import type { RelayColor } from "@/lib/relay";

const statClasses: Record<RelayColor, string> = {
  magenta: "text-magenta-deep",
  orange: "text-orange-deep",
  blue: "text-blue-deep",
  green: "text-green-deep",
};

export default function ProvovPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-14 pb-16">
        <div
          aria-hidden="true"
          className="blob -top-10 -right-20 size-80 bg-orange [animation-delay:-4s]"
        />
        <div className="container-site z-1 max-w-6xl">
          <div className="flex items-end justify-between gap-6">
            <div className="max-w-3xl">
              <Tag tone="orange">
                <SparkleIcon className="size-3.5" />
                Programa Vivencial de Orientaciones Vocacionales
              </Tag>
              <Heading variant="page" className="mt-4">
                PROVOV:{" "}
                <GradientText gradient="energy">{lemas.provov}</GradientText>.
              </Heading>
              <Text variant="lead" className="mt-5">
                Una iniciativa para encender la chispa de la vocación, conducida
                por universitarios para quienes sueñan con ingresar a la UNI.
                Nació como una experiencia de un día y hoy reúne programas,
                operaciones y proyectos durante todo el año.
              </Text>
            </div>
            <Mascot
              pose="pensando"
              preload
              className="hidden w-32 shrink-0 animate-mascot-float sm:block lg:w-40 motion-reduce:animate-none"
            />
          </div>
          <nav aria-label="Componentes del PROVOV" className="mt-8">
            <ul className="flex flex-wrap gap-2.5">
              {componentes.map((componente) => (
                <li key={componente.id}>
                  <a href={`#${componente.id}`} className="btn btn-ghost">
                    {componente.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {componentes.map((componente, index) => (
        <section
          key={componente.id}
          id={componente.id}
          className={cn(
            "scroll-mt-24 py-16",
            index % 2 === 0 ? "bg-tint-orange" : "bg-background",
          )}
        >
          <div className="container-site grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
            {componente.image ? (
              <ImageSlot
                image={componente.image}
                fallbackAlt={componente.name}
                tone={componente.tone}
                shape="landscape"
                className={cn(index % 2 === 1 && "md:order-2")}
              />
            ) : (
              <div
                className={cn(
                  "flex justify-center",
                  index % 2 === 1 && "md:order-2",
                )}
              >
                <Mascot
                  pose="sentado"
                  className="w-40 animate-mascot-float sm:w-52 motion-reduce:animate-none"
                />
              </div>
            )}
            <div>
              <Tag tone={componente.tone}>{componente.kind}</Tag>
              <Heading variant="section" className="mt-4">
                {componente.name}
              </Heading>
              <Text variant="muted" className="mt-4">
                {componente.description}
              </Text>
              <dl className="mt-6 grid grid-cols-2 gap-6">
                {componente.stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col-reverse">
                    <dt className="mt-1.5 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                      {stat.label}
                    </dt>
                    <dd
                      className={cn(
                        "font-display text-[2.25rem] leading-none font-bold",
                        statClasses[componente.tone],
                      )}
                    >
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <ComponenteExtra id={componente.id} />
              {componente.cta && (
                <Button href={componente.cta.href} bolt className="mt-7">
                  {componente.cta.label}
                </Button>
              )}
            </div>
          </div>
        </section>
      ))}

      <section className="relative overflow-hidden bg-tint-blue py-16">
        <div className="container-site z-1 flex max-w-4xl flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
          <Mascot
            pose="alegre"
            className="w-28 shrink-0 animate-mascot-float sm:w-36 motion-reduce:animate-none"
          />
          <div>
            <Heading variant="section">
              Detrás de todo, los{" "}
              <GradientText gradient="discover">embajadores</GradientText>.
            </Heading>
            <Text variant="lead" className="mt-4">
              PROEMIN forma a estudiantes que representan a su facultad: guían,
              preparan material y atienden las orientaciones virtuales.
            </Text>
            <Button href="/voluntariado" variant="ghost" className="mt-6">
              Quiero ser embajador
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function ComponenteExtra({ id }: { id: string }) {
  if (id === "ponencias") {
    return (
      <>
        <Bullets items={ponencias.proyectos} tone="magenta" className="mt-6" />
        <Text variant="eyebrow" className="mt-6">
          Han pasado por nuestras ponencias
        </Text>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ponentesFrecuentes.map((ponente) => (
            <li key={ponente}>
              <Tag variant="neutral">{ponente}</Tag>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (id === "ovpgs") {
    return (
      <Text className="mt-6 font-semibold">
        <time dateTime={ovpgs.inicio}>{ovpgs.description}</time>
      </Text>
    );
  }
  return null;
}
