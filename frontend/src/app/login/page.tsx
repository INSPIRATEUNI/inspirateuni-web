import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export default function LoginPage() {
  return (
    <Stub
      mascot="base"
      title={
        <>
          Ingresa a <GradientText gradient="fresh">tu cuenta</GradientText>.
        </>
      }
    />
  );
}
