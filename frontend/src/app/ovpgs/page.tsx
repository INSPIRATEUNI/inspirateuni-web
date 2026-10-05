import { Bullets } from "@/components/programs/Bullets";
import { SparkleIcon } from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { contact } from "@/components/site/navigation";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { VisitForm } from "./VisitForm";

/** Contenido del prototipo hasta tener las condiciones reales. */
const promises = [
  "Es gratis para colegios públicos y privados.",
  "Nos adaptamos a tu horario escolar.",
  "Te respondemos en menos de 48 horas.",
  "Vamos con voluntarios de distintas carreras.",
];

export default function OvpgsPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-14 pb-16">
        <div
          aria-hidden="true"
          className="blob -top-10 -right-20 size-80 bg-orange [animation-delay:-4s]"
        />
        <div className="container-site z-1 max-w-4xl">
          <div className="flex items-end justify-between gap-6">
            <div>
              <Tag tone="orange">
                <SparkleIcon className="size-3.5" />
                Visitas a colegios
              </Tag>
              <Heading variant="page" className="mt-4">
                Llevamos la UNI{" "}
                <GradientText gradient="energy">a tu colegio</GradientText>.
              </Heading>
              <Text variant="lead" className="mt-5">
                Agenda una charla de orientación vocacional con estudiantes de
                la UNI. Solo son tres pasos y nosotros nos encargamos del resto.
              </Text>
            </div>
            <Mascot
              pose="sentado"
              preload
              className="hidden w-32 shrink-0 animate-mascot-float sm:block lg:w-40 motion-reduce:animate-none"
            />
          </div>
        </div>
      </section>

      <section aria-label="Solicita tu visita" className="pb-20">
        <div className="container-site max-w-3xl">
          <VisitForm />
        </div>
      </section>

      <section className="relative overflow-hidden bg-tint-blue py-16">
        <div
          aria-hidden="true"
          className="blob -bottom-24 -left-16 size-72 bg-magenta [animation-delay:-9s]"
        />
        <div className="container-site z-1 grid max-w-4xl gap-10 md:grid-cols-2 md:items-center">
          <div>
            <Heading variant="section">
              Sin{" "}
              <GradientText gradient="discover">complicaciones</GradientText>.
            </Heading>
            <Text variant="muted" className="mt-4">
              ¿Tienes dudas antes de pedirla? Escríbenos a{" "}
              <a
                href={`mailto:${contact.email}`}
                className="font-semibold text-blue-deep underline-offset-4 hover:underline"
              >
                {contact.email}
              </a>{" "}
              o al{" "}
              <a
                href={contact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-deep underline-offset-4 hover:underline"
              >
                {contact.phone}
              </a>
              .
            </Text>
          </div>
          <Bullets items={promises} tone="green" />
        </div>
      </section>
    </>
  );
}
