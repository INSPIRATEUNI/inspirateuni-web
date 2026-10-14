import type { ComponentType, SVGProps } from "react";
import {
  CampusIcon,
  ChevronRightIcon,
  GirlIcon,
  HeartIcon,
  PinIcon,
  SparkleIcon,
} from "@/components/site/Icons";
import { cn } from "@/lib/cn";
import type { GalleryIcon, GalleryItem } from "@/lib/gallery";
import type { RelayColor } from "@/lib/relay";

/**
 * Gradiente Hover
 */
const gradientClasses: Record<RelayColor, string> = {
  magenta: "from-magenta-deep via-orange-deep to-blue-deep",
  orange: "from-orange-deep via-blue-deep to-green-deep",
  blue: "from-blue-deep via-green-deep to-magenta-deep",
  green: "from-green-deep via-magenta-deep to-orange-deep",
};

const icons: Record<GalleryIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  campus: CampusIcon,
  girl: GirlIcon,
  pin: PinIcon,
  heart: HeartIcon,
};

type ChoiceRowProps = {
  item: GalleryItem;
  tone: RelayColor;
  onOpen: () => void;
};

/** Fila de elección */
export function ChoiceRow({ item, tone, onOpen }: ChoiceRowProps) {
  const Icon = item.icon ? icons[item.icon] : SparkleIcon;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={cn(
        "group flex w-full items-center gap-4 rounded-lg bg-linear-to-r bg-size-[200%_100%] bg-left px-5 py-4 text-left text-white transition-[background-position,translate] duration-600 ease-out hover:-translate-y-0.5 hover:bg-right focus-visible:bg-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        gradientClasses[tone],
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icon className="size-6" />
      </span>
      <span className="flex-1 font-extrabold">{item.title}</span>
      <ChevronRightIcon className="size-7 shrink-0 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
    </button>
  );
}
