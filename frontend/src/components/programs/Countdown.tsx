"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** Degradados del relay, uno por casilla. */
const tileClasses = [
  "bg-linear-110 from-magenta-deep to-orange-deep",
  "bg-linear-110 from-orange-deep to-blue-deep",
  "bg-linear-110 from-blue-deep to-green-deep",
  "bg-linear-110 from-green-deep to-magenta-deep",
];

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function partsUntil(target: number, now: number): Parts {
  const s = Math.max(0, Math.floor((target - now) / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

type CountdownProps = {
  target: string;
  label: string;
  className?: string;
};

export function Countdown({ target, label, className }: CountdownProps) {
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    const end = Date.parse(target);
    const tick = () => setParts(partsUntil(end, Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const tiles = [
    { label: "Días", value: parts && String(parts.days) },
    { label: "Horas", value: parts && pad(parts.hours) },
    { label: "Minutos", value: parts && pad(parts.minutes) },
    { label: "Segundos", value: parts && pad(parts.seconds) },
  ];

  return (
    <div
      role="timer"
      aria-label={label}
      className={cn("grid grid-cols-4 gap-2 sm:gap-3", className)}
    >
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className={cn(
            "grid justify-items-center gap-1.5 rounded-leaf px-1 py-4 text-center text-white sm:px-2 sm:py-6",
            tileClasses[index],
          )}
        >
          <span className="font-display text-[clamp(1.9rem,1.2rem+3vw,3.5rem)] font-bold leading-none tabular-nums">
            {tile.value ?? "--"}
          </span>
          <span className="text-[0.6rem] font-extrabold uppercase tracking-wide sm:text-xs sm:tracking-widest">
            {tile.label}
          </span>
        </div>
      ))}
    </div>
  );
}
