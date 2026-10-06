"use client";

import { MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { Mascot } from "@/components/site/Mascot";
import { Dialog } from "@/components/ui/Dialog";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import type { GalleryItem, GalleryLayout } from "@/lib/gallery";
import { type RelayColor, relayAt } from "@/lib/relay";
import { ChoiceRow } from "./ChoiceRow";
import { EventRow } from "./EventRow";
import { ItemDetail } from "./ItemDetail";

const layoutClasses: Record<GalleryLayout, string> = {
  list: "divide-y divide-border",
  choices: "grid gap-3 sm:grid-cols-2",
};

type GalleryTemplateProps = {
  data: GalleryItem[];
  layout?: GalleryLayout;
  emptyMessage?: string;
  className?: string;
};

/** Sin categoría, el color sigue el relay por posición. */
function toneOf(item: GalleryItem, index: number): RelayColor {
  return item.category?.tone ?? relayAt(index);
}

/**
 * Galería única para eventos, programas y cualquier colección similar:
 * cada tipo es solo un arreglo de datos, no una vista nueva.
 */
export function GalleryTemplate({
  data,
  layout = "list",
  emptyMessage = "Aún no hay nada por aquí. Vuelve pronto.",
  className,
}: GalleryTemplateProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Se conserva el elemento al cerrar para que la salida no quede vacía.
  const [open, setOpen] = useState(false);

  if (data.length === 0) {
    return (
      <Text variant="muted" className={className}>
        {emptyMessage}
      </Text>
    );
  }

  const selectedIndex = data.findIndex((item) => item.id === selectedId);
  const selected = selectedIndex >= 0 ? data[selectedIndex] : null;
  const Row = layout === "list" ? EventRow : ChoiceRow;

  return (
    <MotionConfig reducedMotion="user">
      <ul className={cn(layoutClasses[layout], className)}>
        {data.map((item, index) => (
          <motion.li
            key={item.id}
            // Su entrada animada no debe servir de ancla de scroll.
            className="[overflow-anchor:none]"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: index * 0.06, ease: "easeOut" }}
          >
            <Row
              item={item}
              tone={toneOf(item, index)}
              onOpen={() => {
                setSelectedId(item.id);
                setOpen(true);
              }}
            />
          </motion.li>
        ))}
      </ul>
      <Dialog
        open={open && selected !== null}
        onClose={() => setOpen(false)}
        title={selected?.title ?? ""}
        aside={<Mascot pose="alegre" className="w-full -scale-x-100" />}
      >
        {selected && (
          <ItemDetail item={selected} tone={toneOf(selected, selectedIndex)} />
        )}
      </Dialog>
    </MotionConfig>
  );
}
