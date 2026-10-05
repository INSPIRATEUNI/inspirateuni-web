import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export const metadata: Metadata = { title: "Open Day" };

export default function OpenDayPage() {
  return (
    <Stub
      title={
        <>
          Vive el <GradientText gradient="energy">Open Day UNI</GradientText>.
        </>
      }
    />
  );
}
