import { SiteShell } from "@/components/site/SiteShell";
import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export default function NotFound() {
  return (
    <SiteShell>
      <Stub
        mascot="triste"
        tag="Error 404"
        title={
          <>
            Esta página{" "}
            <GradientText gradient="discover">no existe</GradientText>.
          </>
        }
        description="Puede que el enlace haya cambiado. Vuelve al inicio y sigue explorando."
      />
    </SiteShell>
  );
}
