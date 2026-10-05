import Image from "next/image";
import { CameraIcon } from "@/components/site/Icons";
import { cn } from "@/lib/cn";
import type { GalleryImage } from "@/lib/gallery";
import { type RelayColor, relayClasses } from "@/lib/relay";

type ImageSlotShape = "leaf" | "wide" | "landscape" | "portrait";

const shapeClasses: Record<ImageSlotShape, string> = {
  leaf: "size-20 rounded-leaf-sm sm:size-24",
  wide: "aspect-[16/9] w-full rounded-leaf",
  landscape: "aspect-[5/4] w-full rounded-leaf",
  portrait: "aspect-[4/5] w-full rounded-leaf",
};

const sizes: Record<ImageSlotShape, string> = {
  leaf: "96px",
  wide: "(max-width: 640px) 100vw, 576px",
  landscape: "(max-width: 1024px) 100vw, 640px",
  portrait: "(max-width: 768px) 50vw, 280px",
};

const stripeClasses: Record<RelayColor, string> = {
  magenta:
    "bg-[repeating-linear-gradient(135deg,transparent_0_10px,var(--color-magenta)_10px_11px)]",
  orange:
    "bg-[repeating-linear-gradient(135deg,transparent_0_10px,var(--color-orange)_10px_11px)]",
  blue: "bg-[repeating-linear-gradient(135deg,transparent_0_10px,var(--color-blue)_10px_11px)]",
  green:
    "bg-[repeating-linear-gradient(135deg,transparent_0_10px,var(--color-green)_10px_11px)]",
};

type ImageSlotProps = {
  image?: GalleryImage;
  /** Texto de respaldo cuando no hay imagen ni alt. */
  fallbackAlt: string;
  tone: RelayColor;
  shape?: ImageSlotShape;
  className?: string;
};

/**
 * Foto real o placeholder con la misma máscara.
 */
export function ImageSlot({
  image,
  fallbackAlt,
  tone,
  shape = "leaf",
  className,
}: ImageSlotProps) {
  const alt = image?.alt ?? fallbackAlt;
  const base = cn(
    "relative shrink-0 overflow-hidden",
    shapeClasses[shape],
    className,
  );

  if (image?.src) {
    return (
      <div className={base}>
        <Image
          src={image.src}
          alt={alt}
          fill
          sizes={sizes[shape]}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Foto: ${alt}`}
      className={cn(base, relayClasses[tone].soft, relayClasses[tone].text)}
    >
      <div
        aria-hidden="true"
        className={cn("absolute inset-0 opacity-15", stripeClasses[tone])}
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
        <CameraIcon className={shape === "leaf" ? "size-6" : "size-8"} />
        {shape !== "leaf" && (
          <span className="text-sm font-bold">Foto: {alt}</span>
        )}
      </div>
    </div>
  );
}
