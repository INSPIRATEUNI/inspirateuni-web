import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export const metadata: Metadata = { title: "Pide una visita" };

export default function OvpgsPage() {
  return (
    <Stub
      title={
        <>
          Agenda una{" "}
          <GradientText gradient="energy">visita guiada</GradientText>.
        </>
      }
    />
  );
}
