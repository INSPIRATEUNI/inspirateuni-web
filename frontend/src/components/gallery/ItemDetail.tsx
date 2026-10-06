import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { formatEventDate, type GalleryItem } from "@/lib/gallery";
import type { RelayColor } from "@/lib/relay";
import { ImageSlot } from "./ImageSlot";

type ItemDetailProps = {
  item: GalleryItem;
  tone: RelayColor;
};

/** Contenido del modal */
export function ItemDetail({ item, tone }: ItemDetailProps) {
  const date = item.date ? formatEventDate(item.date, item.allDay) : null;

  return (
    <div className="flex flex-col gap-4">
      <ImageSlot
        image={item.image}
        fallbackAlt={item.title}
        tone={tone}
        shape="wide"
      />
      {(item.category || date || item.location) && (
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
          {item.location && (
            <span className="text-sm font-semibold text-muted-foreground">
              {item.location}
            </span>
          )}
        </div>
      )}
      <Text>{item.description}</Text>
      {item.details && (
        <div className="text-base text-muted-foreground">{item.details}</div>
      )}
      {item.cta && (
        <div>
          <Button href={item.cta.href} bolt>
            {item.cta.label}
          </Button>
        </div>
      )}
    </div>
  );
}
