import { ImageSlot } from "@/components/gallery/ImageSlot";
import { Breadcrumb } from "@/components/programs/Breadcrumb";
import { Bullets } from "@/components/programs/Bullets";
import { SparkleIcon } from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { contact } from "@/components/site/navigation";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { VisitForm } from "./VisitForm";

/** Las dos modalidades del programa, con su impacto en 2023. */
const modalidades = [
  {
    title: "Visitas guiadas en la UNI",
    text: "Tu colegio, academia o grupo de estudio recorre el campus con voluntarios: conocen la infraestructura y los servicios, resuelven dudas y participan en dinámicas.",
    stats:
      "5 visitas, +450 participantes y 8 a 10 voluntarios por visita en 2023.",
    tone: "blue",
    image: {
      src: "/fotos/open-day/fiee-dinamica-patio.webp",
      alt: "Escolares participan en una dinámica en el patio techado de la FIEE",
    },
  },
  {
    title: "Visitas inspiradas a tu colegio",
    text: "Llevamos la orientación vocacional fuera de la UNI: estudiantes de distintas carreras van a tu institución a contar cómo es estudiar ingeniería, ciencias y arquitectura.",
    stats: "+12 colegios visitados, +360 alumnos y +30 voluntarios en 2023.",
    tone: "orange",
    image: {
      src: "/fotos/open-day/faua-charla-maquetas.webp",
      alt: "Escolares escuchan a estudiantes de Arquitectura junto a sus maquetas",
    },
  },
] as const;

const promises = [
  "Lo organizamos estudiantes voluntarios, sin fines de lucro.",
  "Vamos con estudiantes de distintas carreras.",
  "Coordinamos contigo la fecha y el turno.",
];

export default function VisitasGuiadasPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-14 pb-16">
        <div
          aria-hidden="true"
          className="blob -top-10 -right-20 size-80 bg-orange [animation-delay:-4s]"
        />
        <div className="container-site z-1 max-w-4xl">
          <Breadcrumb
            parent={{ label: "PROVOV", href: "/provov" }}
            current="Visitas guiadas"
          />
          <div className="flex items-end justify-between gap-6">
            <div>
              <Tag tone="orange">
                <SparkleIcon className="size-3.5" />
                Visitas guiadas
              </Tag>
              <Heading variant="page" className="mt-4">
                Ven a la UNI o{" "}
                <GradientText gradient="energy">la llevamos a ti</GradientText>.
              </Heading>
              <Text variant="lead" className="mt-5">
                Agenda una orientación vocacional vivencial con estudiantes de
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

      <section aria-label="Modalidades" className="pb-16">
        <div className="container-site grid max-w-6xl gap-12 md:grid-cols-2">
          {modalidades.map((modalidad) => (
            <article key={modalidad.title}>
              <ImageSlot
                image={modalidad.image}
                fallbackAlt={modalidad.title}
                tone={modalidad.tone}
                shape="wide"
              />
              <Heading variant="feature" level={2} className="mt-6">
                {modalidad.title}
              </Heading>
              <Text variant="muted" className="mt-3">
                {modalidad.text}
              </Text>
              <p className="mt-3 text-sm font-bold">{modalidad.stats}</p>
            </article>
          ))}
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
