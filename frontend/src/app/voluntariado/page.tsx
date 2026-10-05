import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export const metadata: Metadata = { title: "Voluntariado" };

export default function VoluntariadoPage() {
  return (
    <Stub
      title={
        <>
          Súmate al{" "}
          <GradientText gradient="discover">voluntariado</GradientText>.
        </>
      }
    />
  );
}
