import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export const metadata: Metadata = { title: "Eventos" };

export default function EventosPage() {
  return (
    <Stub
      title={
        <>
          Nuestros próximos{" "}
          <GradientText gradient="fresh">eventos</GradientText>.
        </>
      }
    />
  );
}
