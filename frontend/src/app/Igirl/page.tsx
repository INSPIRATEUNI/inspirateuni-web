import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";
import { GradientText } from "@/components/ui/GradientText";

export const metadata: Metadata = { title: "Inspírate Girl" };

export default function IgirlPage() {
  return (
    <Stub
      title={
        <>
          Mujeres que{" "}
          <GradientText gradient="discover">inspiran ciencia</GradientText>.
        </>
      }
    />
  );
}
