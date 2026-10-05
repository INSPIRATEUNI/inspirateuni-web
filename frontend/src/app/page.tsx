import { SparkleIcon } from "@/components/site/Icons";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";

export default function Home() {
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

      <div className="container-site z-1 max-w-4xl">
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
          <GradientText gradient="spectrum-head">viviéndola desde</GradientText>{" "}
          <GradientText gradient="spectrum-tail">adentro</GradientText>.
        </Heading>
        <Text
          variant="lead"
          className="mt-6 max-w-xl animate-rise-in [animation-delay:0.2s] motion-reduce:animate-none"
        >
          Somos estudiantes de la Universidad Nacional de Ingeniería. Te abrimos
          las puertas del campus, de los laboratorios y de nuestras historias
          para que descubras qué quieres estudiar, sin presión.
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
    </section>
  );
}
