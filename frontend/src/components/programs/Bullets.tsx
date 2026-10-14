import { BoltIcon } from "@/components/site/Icons";
import { cn } from "@/lib/cn";
import type { RelayColor } from "@/lib/relay";

const bulletClasses: Record<RelayColor, string> = {
  magenta: "bg-magenta-deep",
  orange: "bg-orange-deep",
  blue: "bg-blue-deep",
  green: "bg-green-deep",
};

type BulletsProps = {
  items: string[];
  tone: RelayColor;
  className?: string;
};

/** Lista corta de beneficios */
export function Bullets({ items, tone, className }: BulletsProps) {
  return (
    <ul className={cn("grid gap-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 font-semibold">
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white",
              bulletClasses[tone],
            )}
          >
            <BoltIcon className="size-3" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
