import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <Stub
      title={
        <>
          Ingresa a <GradientText gradient="fresh">tu cuenta</GradientText>.
        </>
      }
    />
  );
}
