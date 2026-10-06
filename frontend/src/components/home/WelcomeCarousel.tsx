"use client";

import { useReducedMotion } from "motion/react";
import Image from "next/image";
import { type KeyboardEvent, useEffect, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/site/Icons";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import type { Slide } from "@/data/inicio";
import { cn } from "@/lib/cn";
import { relayClasses } from "@/lib/relay";

const INTERVAL_MS = 6000;

const controlClasses =
  "grid size-11 place-items-center rounded-full bg-white/90 text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * Fundido encadenado: la foto que entra aparece encima y la que sale espera
 * a que termine para apagarse, así nunca se ve el fondo a medio cambio.
 */
function fadeClasses(shown: boolean) {
  return cn(
    "transition-[opacity,visibility] duration-700 ease-in-out motion-reduce:transition-none",
    shown ? "z-2 opacity-100" : "invisible z-1 opacity-0 delay-700",
  );
}

type WelcomeCarouselProps = {
  slides: Slide[];
  className?: string;
};

/**
 * Carrusel de bienvenida. Todas las diapositivas salen en el HTML del
 * servidor y solo cambia cuál es visible
 */
export function WelcomeCarousel({ slides, className }: WelcomeCarouselProps) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reducedMotion = useReducedMotion();

  const autoplay = playing && !reducedMotion;
  const running = autoplay && !held && !hidden;
  const count = slides.length;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!running || count < 2) return;
    const next = (active + 1) % count;
    const id = setTimeout(() => setActive(next), INTERVAL_MS);
    return () => clearTimeout(id);
  }, [running, count, active]);

  const go = (index: number) => setActive((index + count) % count);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") go(active - 1);
    else if (event.key === "ArrowRight") go(active + 1);
    else return;
    event.preventDefault();
  };

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Así se vive Inspírate UNI"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
      className={cn(
        "relative aspect-4/5 overflow-hidden rounded-leaf bg-foreground sm:aspect-video",
        className,
      )}
    >
      <div aria-live={autoplay ? "off" : "polite"} className="absolute inset-0">
        {slides.map((slide, index) => {
          const current = index === active;
          // Patrón de carrusel del APG: cada diapositiva es un group.
          return (
            // biome-ignore lint/a11y/useSemanticElements: fieldset no aplica fuera de formularios
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} de ${count}`}
              aria-hidden={!current}
              inert={!current}
              className={cn("absolute inset-0", fadeClasses(current))}
            >
              <Image
                src={slide.image.src}
                alt={slide.image.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 1152px"
                loading={index === 0 ? "eager" : "lazy"}
                className="object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent"
              />
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 p-6 pb-20 text-white transition-[opacity,translate] duration-500 sm:max-w-2xl sm:p-10 sm:pb-24 motion-reduce:transition-none",
                  // El texto entra cuando la foto ya terminó de aparecer
                  current ? "delay-500" : "translate-y-3 opacity-0",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-1.5 w-12 rounded-full",
                    relayClasses[slide.tone].dot,
                  )}
                />
                <Heading
                  variant="feature"
                  level={3}
                  className="mt-4 text-white"
                >
                  {slide.title}
                </Heading>
                <p className="mt-2 text-base text-white/85 sm:text-lg">
                  {slide.description}
                </p>
                {slide.cta && (
                  <Button href={slide.cta.href} bolt className="mt-5">
                    {slide.cta.label}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-3 flex items-center justify-between gap-4 p-6 sm:px-10">
        <div className="flex items-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => go(index)}
              aria-label={`Ir a la diapositiva ${index + 1}`}
              aria-current={index === active}
              className="grid h-11 place-items-center px-1 focus-visible:outline-2 focus-visible:outline-white"
            >
              <span
                className={cn(
                  "block h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                  index === active
                    ? cn("w-8", relayClasses[slide.tone].dot)
                    : "w-2.5 bg-white/60",
                )}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={
                playing ? "Pausar el carrusel" : "Reproducir el carrusel"
              }
              className={controlClasses}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}
          <button
            type="button"
            onClick={() => go(active - 1)}
            aria-label="Diapositiva anterior"
            className={controlClasses}
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(active + 1)}
            aria-label="Diapositiva siguiente"
            className={controlClasses}
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
