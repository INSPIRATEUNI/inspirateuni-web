import Image from "next/image";
import { GalleryTemplate } from "@/components/gallery/GalleryTemplate";
import { ImageSlot } from "@/components/gallery/ImageSlot";
import { MascotVideo } from "@/components/home/MascotVideo";
import { WelcomeCarousel } from "@/components/home/WelcomeCarousel";
import { Bullets } from "@/components/programs/Bullets";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { eventos } from "@/data/eventos";
import { slides } from "@/data/inicio";
import {
  asiri,
  cifras,
  lemas,
  mision,
  programas,
  valores,
  vision,
} from "@/data/organizacion";
import { cn } from "@/lib/cn";
import { upcoming } from "@/lib/gallery";
import { type RelayColor, relayAt, relayClasses } from "@/lib/relay";

const statClasses: Record<RelayColor, string> = {
  magenta: "text-magenta-deep",
  orange: "text-orange-deep",
  blue: "text-blue-deep",
  green: "text-green-deep",
};

export default function Home() {
  const proximos = upcoming(eventos, 3);

  return (
    <>
      <Hero />

      <section className="pb-20">
        <div className="container-site max-w-6xl">
          <Heading variant="section">
            Así se vive <GradientText gradient="energy">Inspírate</GradientText>
            .
          </Heading>
          <WelcomeCarousel slides={slides} className="mt-8" />
        </div>
      </section>

      <QuienesSomos />

      <section aria-label="Nuestro impacto" className="bg-tint-blue py-14">
        <dl className="container-site grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-0">
          {cifras.map((stat, index) => (
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

      <section className="py-20">
        <div className="container-site max-w-6xl">
          <Heading variant="section">
            Nuestros <GradientText gradient="discover">programas</GradientText>.
          </Heading>
          <Text variant="lead" className="mt-4 max-w-2xl">
            Dos líneas de acción para acompañarte mientras eliges tu carrera.
          </Text>
          <div className="mt-12 grid gap-16">
            {programas.map((programa, index) => (
              <article
                key={programa.id}
                className="grid items-center gap-8 md:grid-cols-2 md:gap-14"
              >
                <ImageSlot
                  image={programa.image}
                  fallbackAlt={programa.name}
                  tone={programa.tone}
                  shape="landscape"
                  className={cn(index % 2 === 1 && "md:order-2")}
                />
                <div>
                  <Tag tone={programa.tone}>{programa.fullName}</Tag>
                  <Heading variant="feature" level={3} className="mt-4">
                    {programa.name}
                  </Heading>
                  <Text variant="muted" className="mt-3">
                    {programa.description}
                  </Text>
                  <Button href={programa.href} bolt className="mt-6">
                    {programa.cta}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-tint-green py-16">
        <div className="container-site grid max-w-4xl gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <Tag tone="green">Ayuda social</Tag>
            <Heading variant="section" className="mt-4">
              {asiri.name}:{" "}
              <GradientText gradient="fresh">{asiri.lema}</GradientText>.
            </Heading>
            <Text variant="muted" className="mt-4">
              {asiri.description}
            </Text>
          </div>
          <Bullets items={asiri.acciones} tone="green" />
        </div>
      </section>

      {proximos.length > 0 && (
        <section className="py-16">
          <div className="container-site max-w-4xl">
            <Heading variant="section">
              Lo que <GradientText gradient="fresh">se viene</GradientText>.
            </Heading>
            <GalleryTemplate data={proximos} className="mt-6" />
            <Button href="/eventos" variant="ghost" className="mt-6">
              Ver todos los eventos
            </Button>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden bg-tint-magenta py-16">
        <div
          aria-hidden="true"
          className="blob -bottom-24 -left-16 size-80 bg-magenta"
        />
        <div className="container-site z-1 flex max-w-4xl flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
          <Mascot
            pose="risa"
            className="w-32 shrink-0 animate-mascot-float sm:w-40 motion-reduce:animate-none"
          />
          <div>
            <Heading variant="section">
              ¿Ya estás en la <GradientText gradient="energy">UNI</GradientText>
              ?
            </Heading>
            <Text variant="lead" className="mt-4">
              Conviértete en agente de cambio y ayuda a otros escolares a
              encontrar su camino, como alguien hizo contigo.
            </Text>
            <Button href="/voluntariado" bolt className="mt-6">
              Quiero ser voluntario
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-14 pb-24">
      <div
        aria-hidden="true"
        className="blob top-20 -left-24 size-88 bg-green [animation-delay:-3s]"
      />
      <div
        aria-hidden="true"
        className="blob -right-32 bottom-6 size-96 bg-blue [animation-delay:-9s]"
      />

      <div className="container-site z-1 grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_auto]">
        <div className="max-w-4xl">
          <Tag
            variant="leaf"
            className="animate-rise-in motion-reduce:animate-none"
          >
            Asociación estudiantil de la UNI
          </Tag>
          <Heading
            variant="hero"
            className="mt-6 animate-rise-in [animation-delay:0.1s] motion-reduce:animate-none"
          >
            Elige tu carrera{" "}
            <GradientText gradient="spectrum-head">
              viviéndola desde
            </GradientText>{" "}
            <GradientText gradient="spectrum-tail">adentro</GradientText>.
          </Heading>
          <Text
            variant="lead"
            className="mt-6 max-w-xl animate-rise-in [animation-delay:0.2s] motion-reduce:animate-none"
          >
            Somos una organización voluntaria y sin fines de lucro de
            estudiantes de la Universidad Nacional de Ingeniería. Mejoramos la
            educación con orientación vocacional vivencial.
          </Text>
          <div className="mt-8 flex flex-wrap gap-3 animate-rise-in [animation-delay:0.3s] motion-reduce:animate-none">
            <Button href="/provov/open-day" bolt>
              Conoce el Open Day
            </Button>
            <Button href="/eventos" variant="ghost">
              Mira los próximos eventos
            </Button>
          </div>
          <p className="mt-7 flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <Image
              src="/marca/foco.png"
              alt=""
              width={250}
              height={380}
              className="h-5 w-auto"
            />
            {lemas.principal}.
          </p>
        </div>

        <div className="relative mx-auto w-48 animate-rise-in [animation-delay:0.4s] sm:w-56 lg:w-72 motion-reduce:animate-none">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-3/4 rounded-blob bg-magenta-soft"
          />
          {/* Flotación y vaivén con ritmos distintos para que no se vea mecánico */}
          <div className="relative animate-mascot-float motion-reduce:animate-none">
            <MascotVideo />
          </div>
        </div>
      </div>
    </section>
  );
}

function QuienesSomos() {
  return (
    <section
      id="quienes-somos"
      className="relative scroll-mt-24 overflow-hidden pb-20"
    >
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
            image={{
              src: "/fotos/voluntariado/equipo-con-mascota.webp",
              alt: "Equipo de voluntarios de Inspírate UNI con la mascota en el jardín del campus",
            }}
            fallbackAlt="equipo de voluntarios en el campus"
            tone="blue"
            shape="landscape"
            className="relative"
          />
        </div>

        <div>
          <Tag tone="green">Quiénes somos</Tag>
          <Heading variant="section" className="mt-4">
            Estudiantes que{" "}
            <GradientText gradient="fresh">abren la puerta</GradientText> de la
            UNI.
          </Heading>
          <dl className="mt-6 grid gap-4">
            <div>
              <dt className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                Misión
              </dt>
              <dd className="mt-1">{mision}</dd>
            </div>
            <div>
              <dt className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                Visión
              </dt>
              <dd className="mt-1">{vision}</dd>
            </div>
          </dl>
          <ul aria-label="Nuestros valores" className="mt-8 grid gap-3">
            {valores.map((valor, index) => (
              <li key={valor.name} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-2 size-2.5 shrink-0 rounded-full",
                    relayClasses[relayAt(index)].dot,
                  )}
                />
                <span>
                  <span className="font-extrabold">{valor.name}.</span>{" "}
                  <span className="text-muted-foreground">
                    {valor.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
