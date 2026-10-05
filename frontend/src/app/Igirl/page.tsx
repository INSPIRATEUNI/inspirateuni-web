import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export default function IgirlPage() {
  return (
    <Stub
      mascot="sorprendido"
      title={
        <>
          Mujeres que{" "}
          <GradientText gradient="discover">inspiran ciencia</GradientText>.
        </>
      }
    />
  );
}
