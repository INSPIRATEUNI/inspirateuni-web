/**
 * orden de colores de las letras del logo.
 * Los elementos repetidos toman `relayAt(i)`.
 * Las clases son estáticas para que Tailwind las detecte.
 */
export const RELAY = ["magenta", "orange", "blue", "green"] as const;

export type RelayColor = (typeof RELAY)[number];

export const relayClasses = {
  magenta: {
    soft: "bg-magenta-soft",
    text: "text-magenta",
    deep: "bg-magenta-deep",
    dot: "bg-magenta",
    hover: "hover:bg-magenta-soft hover:text-magenta",
    active: "bg-magenta-soft text-magenta",
  },
  orange: {
    soft: "bg-orange-soft",
    text: "text-orange-ink",
    deep: "bg-orange-deep",
    dot: "bg-orange",
    hover: "hover:bg-orange-soft hover:text-orange-ink",
    active: "bg-orange-soft text-orange-ink",
  },
  blue: {
    soft: "bg-blue-soft",
    text: "text-blue",
    deep: "bg-blue-deep",
    dot: "bg-blue",
    hover: "hover:bg-blue-soft hover:text-blue-deep",
    active: "bg-blue-soft text-blue-deep",
  },
  green: {
    soft: "bg-green-soft",
    text: "text-green-ink",
    deep: "bg-green-deep",
    dot: "bg-green",
    hover: "hover:bg-green-soft hover:text-green-ink",
    active: "bg-green-soft text-green-ink",
  },
} as const satisfies Record<RelayColor, Record<string, string>>;

export function relayAt(index: number): RelayColor {
  return RELAY[index % RELAY.length];
}
