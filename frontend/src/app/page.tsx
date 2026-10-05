import { GalleryTemplate } from "@/components/gallery/GalleryTemplate";
import { WelcomeCarousel } from "@/components/home/WelcomeCarousel";
import { SparkleIcon } from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { eventos, programas } from "@/data/eventos";
import { slides } from "@/data/inicio";
import { upcoming } from "@/lib/gallery";

export default function Home() {
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

      <section className="bg-tint-blue py-16">
        <div className="container-site max-w-4xl">
          <Heading variant="section">
            Elige por dónde{" "}
            <GradientText gradient="discover">empezar</GradientText>.
          </Heading>
          <Text variant="lead" className="mt-4">
            Cada programa te acompaña en un momento distinto de tu elección.
          </Text>
          <GalleryTemplate data={programas} layout="choices" className="mt-8" />
        </div>
      </section>

      <section className="py-16">
        <div className="container-site max-w-4xl">
          <Heading variant="section">
            Lo que <GradientText gradient="fresh">se viene</GradientText>.
          </Heading>
          <Text variant="lead" className="mt-4">
            Charlas, talleres y visitas para conocer la UNI desde adentro.
          </Text>
          <GalleryTemplate data={upcoming(eventos, 3)} className="mt-6" />
          <Button href="/eventos" variant="ghost" className="mt-6">
            Ver todos los eventos
          </Button>
        </div>
      </section>

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
              Súmate al voluntariado y ayuda a otros escolares a encontrar su
              camino, como alguien hizo contigo.
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
            Voluntariado estudiantil UNI
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
            Somos estudiantes de la Universidad Nacional de Ingeniería. Te
            abrimos las puertas del campus, de los laboratorios y de nuestras
            historias para que descubras qué quieres estudiar, sin presión.
          </Text>
          <div className="mt-8 flex flex-wrap gap-3 animate-rise-in [animation-delay:0.3s] motion-reduce:animate-none">
            <Button href="/OpenDay" bolt>
              Quiero ir al Open Day
            </Button>
            <Button href="/eventos" variant="ghost">
              Mira los próximos eventos
            </Button>
          </div>
          <p className="mt-7 flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <SparkleIcon className="size-4 text-orange" />
            No hay decisiones equivocadas aquí.
          </p>
        </div>

        <div className="relative mx-auto w-48 animate-rise-in [animation-delay:0.4s] sm:w-56 lg:w-72 motion-reduce:animate-none">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-3/4 rounded-blob bg-magenta-soft"
          />
          {/* Flotación y vaivén con ritmos distintos para que no se vea mecánico */}
          <div className="relative animate-mascot-float motion-reduce:animate-none">
            <Mascot
              pose="hola"
              preload
              className="w-full origin-bottom animate-mascot-sway motion-reduce:animate-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
