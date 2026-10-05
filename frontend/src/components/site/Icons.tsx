import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function BoltIcon({ className = "size-4", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M13.2 2 4.5 13.4h6.3L9.9 22l8.6-11.6h-6.3L13.2 2z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SparkleIcon({ className = "size-4", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M11 2c.6 4.8 2.4 6.7 7.2 7.3-4.8.6-6.6 2.5-7.2 7.3-.6-4.8-2.4-6.7-7.2-7.3C8.6 8.7 10.4 6.8 11 2z"
        fill="currentColor"
      />
      <path
        d="M19 14.5c.3 2.1 1.1 2.9 3 3.2-1.9.3-2.7 1.1-3 3.3-.3-2.2-1.1-3-3-3.3 1.9-.3 2.7-1.1 3-3.2z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MenuIcon({ className = "size-6", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M4 7h16M4 12h16M4 17h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon({ className = "size-6", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Cámara de contorno: placeholders de foto */
export function CameraIcon({ className = "size-6", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="13"
        r="3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/** Edificio con columnas: Open Day (campus) */
export function CampusIcon({ className = "size-6", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M3.5 9 12 4.2 20.5 9zM6 11.5v6M10 11.5v6M14 11.5v6M18 11.5v6M3.5 20.5h17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Silueta de mujer: Inspírate Girl.
 * Material Symbols "woman_2" (Google, Apache 2.0), variante rounded rellena.
 * El viewBox recorta el margen del original para igualar el tamaño visual.
 */
export function GirlIcon({ className = "size-6", ...props }: IconProps) {
  return (
    <svg
      viewBox="60 -900 840 840"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M420-120v-200h-81q-21 0-33-17.5t-4-37.5l100-253q10-24 31-38t47-14q26 0 47 14t31 38l100 253q8 20-4 37.5T621-320h-81v200q0 17-11.5 28.5T500-80h-40q-17 0-28.5-11.5T420-120Zm60-600q-33 0-56.5-23.5T400-800q0-33 23.5-56.5T480-880q33 0 56.5 23.5T560-800q0 33-23.5 56.5T480-720Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Pin de mapa: visitas guiadas */
export function PinIcon({ className = "size-6", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M12 21s-6.2-5.6-6.2-10.6a6.2 6.2 0 0 1 12.4 0C18.2 15.4 12 21 12 21z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.4" r="2.3" fill="currentColor" />
    </svg>
  );
}

/** Corazón: voluntariado */
export function HeartIcon({ className = "size-6", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M12 20.2S3.8 15.3 3.8 9.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.2 2.2c0 5.9-8.2 10.8-8.2 10.8z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Flecha de avance de las filas de elección */
export function ChevronRightIcon({
  className = "size-6",
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="m9 5 7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Foco azul: logo */
export function LogoBulbIcon({ className = "size-12", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M12 1.8a7.2 7.2 0 0 0-4.3 13c.7.6 1.2 1.4 1.2 2.3v.7h6.2v-.7c0-.9.5-1.7 1.2-2.3A7.2 7.2 0 0 0 12 1.8z"
        className="fill-blue"
      />
      <path
        d="M13 4.9 9.5 10.4h2.6l-1 4.3 3.6-5.6h-2.6l.9-4.2z"
        className="fill-surface"
      />
      <path
        d="M9.4 19.6h5.2M9.9 21.6h4.2"
        fill="none"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="stroke-bulb-grey"
      />
    </svg>
  );
}
