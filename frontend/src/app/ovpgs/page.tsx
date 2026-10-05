import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export default function OvpgsPage() {
  return (
    <Stub
      mascot="sentado"
      title={
        <>
          Agenda una{" "}
          <GradientText gradient="energy">visita guiada</GradientText>.
        </>
      }
    />
  );
}
