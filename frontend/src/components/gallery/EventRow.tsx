import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { formatEventDate, type GalleryItem } from "@/lib/gallery";
import type { RelayColor } from "@/lib/relay";
import { ImageSlot } from "./ImageSlot";

/** Bloque de fecha en el color de la categoría, atenuado. */
const dateClasses: Record<RelayColor, string> = {
  magenta: "text-magenta/55",
  orange: "text-orange/55",
  blue: "text-blue/55",
  green: "text-green/55",
};

type EventRowProps = {
  item: GalleryItem;
  tone: RelayColor;
  onOpen: () => void;
};

/**
 * Fila de evento: miniatura de hoja, datos y fecha. El título es el botón
 * y su área de clic se extiende a toda la fila.
 */
export function EventRow({ item, tone, onOpen }: EventRowProps) {
  const date = item.date ? formatEventDate(item.date) : null;

  return (
    <article className="group relative grid grid-cols-[auto_1fr] items-center gap-4 py-5 sm:grid-cols-[auto_1fr_auto] sm:gap-6">
      <ImageSlot image={item.image} fallbackAlt={item.title} tone={tone} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.category && <Tag tone={tone}>{item.category.label}</Tag>}
          {date && (
            <time
              dateTime={item.date}
              className="text-sm font-semibold text-muted-foreground first-letter:uppercase"
            >
              {date.long}
            </time>
          )}
        </div>
        <Heading variant="item" className="mt-2">
          <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            className="text-left transition-colors group-hover:text-magenta after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:rounded-lg after:focus-visible:outline-2 after:focus-visible:outline-ring"
          >
            {item.title}
          </button>
        </Heading>
        <Text variant="muted" className="mt-1 line-clamp-2">
          {item.description}
        </Text>
      </div>
      {date && (
        <div
          aria-hidden="true"
          className={cn(
            "hidden flex-col items-center leading-none sm:flex",
            dateClasses[tone],
          )}
        >
          <span className="text-4xl font-black">{date.day}</span>
          <span className="mt-1 text-sm font-extrabold uppercase">
            {date.month}
          </span>
        </div>
      )}
    </article>
  );
}
