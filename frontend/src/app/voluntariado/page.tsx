import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export default function VoluntariadoPage() {
  return (
    <Stub
      mascot="risa"
      title={
        <>
          Súmate al{" "}
          <GradientText gradient="discover">voluntariado</GradientText>.
        </>
      }
    />
  );
}
