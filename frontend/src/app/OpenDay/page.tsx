import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export default function OpenDayPage() {
  return (
    <Stub
      mascot="alegre"
      title={
        <>
          Vive el <GradientText gradient="energy">Open Day UNI</GradientText>.
        </>
      }
    />
  );
}
