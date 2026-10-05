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
