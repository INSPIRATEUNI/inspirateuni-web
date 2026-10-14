"use client";

import { useState } from "react";
import { Mascot } from "@/components/site/Mascot";

/** Mascota del hero: un click la cambia por su video y otro la regresa. */
export function MascotVideo() {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setPlaying((value) => !value)}
      aria-label={playing ? "Volver a la mascota" : "Ver video de la mascota"}
      aria-pressed={playing}
      className="block w-full cursor-pointer rounded-blob transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      {playing ? (
        // biome-ignore lint/a11y/useMediaCaption: aún no hay archivo de subtítulos para este video
        <video
          src="/videos/mascota.mp4"
          autoPlay
          loop
          playsInline
          className="pointer-events-none w-full rounded-lg"
        />
      ) : (
        <Mascot
          pose="hola"
          preload
          className="w-full origin-bottom animate-mascot-sway motion-reduce:animate-none"
        />
      )}
    </button>
  );
}
