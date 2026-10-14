import Image from "next/image";
import { cn } from "@/lib/cn";

/** Poses disponibles en /public/mascota, recortadas sin margen vacío. */
const poses = {
  hola: { width: 387, height: 640 },
  pensando: { width: 415, height: 552 },
  triste: { width: 480, height: 525 },
  alegre: { width: 470, height: 640 },
  sentado: { width: 426, height: 531 },
  microfono: { width: 450, height: 640 },
  durmiendo: { width: 640, height: 316 },
  risa: { width: 405, height: 540 },
  base: { width: 303, height: 640 },
  sorprendido: { width: 341, height: 537 },
} as const;

export type MascotPose = keyof typeof poses;

type MascotProps = {
  pose: MascotPose;
  className?: string;
  preload?: boolean;
};

/** El oso de anteojos de Inspírate UNI. */
export function Mascot({ pose, className, preload }: MascotProps) {
  const { width, height } = poses[pose];

  return (
    <Image
      src={`/mascota/${pose}.webp`}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      preload={preload}
      draggable={false}
      className={cn("pointer-events-none h-auto select-none", className)}
    />
  );
}
