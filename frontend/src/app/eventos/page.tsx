import { GalleryTemplate } from "@/components/gallery/GalleryTemplate";
import { Mascot } from "@/components/site/Mascot";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { eventos } from "@/data/eventos";

export default function EventosPage() {
  return (
    <section className="relative overflow-hidden pt-14 pb-16">
      <div
        aria-hidden="true"
        className="blob -top-10 -right-20 size-80 bg-green"
      />
      <div className="container-site z-1 max-w-4xl">
        <div className="flex items-end justify-between gap-6">
          <div>
            <Heading variant="page">
              Nuestros próximos{" "}
              <GradientText gradient="fresh">eventos</GradientText>.
            </Heading>
            <Text variant="lead" className="mt-4">
              Convocatorias, orientaciones y el Open Day de PROVOV, Inspírate
              Girl y el voluntariado. Elige uno y mira todos los detalles.
            </Text>
          </div>
          <Mascot
            pose="microfono"
            preload
            className="hidden w-32 shrink-0 animate-mascot-float sm:block lg:w-40 motion-reduce:animate-none"
          />
        </div>
        <GalleryTemplate data={eventos} className="mt-10" />
      </div>
    </section>
  );
}
