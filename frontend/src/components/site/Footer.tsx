import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { relayAt } from "@/lib/relay";
import { PinIcon } from "./Icons";
import { Mascot } from "./Mascot";
import { contact, footerColumns, socialLinks } from "./navigation";

const socialClasses = {
  magenta: "bg-magenta-deep/12 text-magenta-deep hover:bg-magenta-deep",
  orange: "bg-orange-deep/12 text-orange-deep hover:bg-orange-deep",
  blue: "bg-blue-deep/12 text-blue-deep hover:bg-blue-deep",
  green: "bg-green-deep/12 text-green-deep hover:bg-green-deep",
} as const;

const titleClasses =
  "mb-4 font-sans text-sm font-extrabold uppercase tracking-wider text-foreground/70";
const linkClasses =
  "font-semibold text-foreground/78 transition-colors duration-250 hover:text-magenta";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-linear-to-b from-background via-tint-blue via-60% to-tint-green pt-16 pb-8">
      <div className="container-site">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-12">
          <div>
            <Link href="/" className="group inline-flex">
              <Image
                src="/logo.png"
                alt="Inspírate UNI, volver al inicio"
                width={1600}
                height={434}
                className="h-11 w-auto transition-transform duration-250 group-hover:-rotate-2"
              />
            </Link>
            <p className="mt-4 max-w-sm text-muted-foreground">
              Voluntariado estudiantil de la Universidad Nacional de Ingeniería.
              Orientación vocacional vivencial, de estudiante a estudiante.
            </p>
            <ul
              aria-label="Redes sociales"
              className="mt-5 flex flex-wrap gap-2"
            >
              {socialLinks.map((social, index) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex rounded-leaf-xs px-3.5 py-1.5 text-[0.85rem] font-extrabold transition-colors duration-250 hover:text-surface",
                      socialClasses[relayAt(index)],
                    )}
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={contact.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(linkClasses, "mt-5 inline-flex items-center gap-2")}
            >
              <PinIcon className="size-5 shrink-0 text-magenta-deep" />
              {contact.address}
            </a>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className={titleClasses}>{column.title}</h2>
              <ul className="grid gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className={linkClasses}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className={titleClasses}>Contacto</h2>
            <ul className="grid gap-2.5">
              <li>
                <a href={`mailto:${contact.email}`} className={linkClasses}>
                  {contact.email}
                </a>
              </li>
              <li>
                <a
                  href={contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClasses}
                >
                  {contact.phone}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex items-end justify-between gap-6">
          <div aria-hidden="true" className="spectrum-rule" />
          <Mascot pose="durmiendo" className="-mb-1 w-36 sm:w-44" />
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-x-8 gap-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            © {year} Inspírate UNI. Hecho por estudiantes de la UNI, para ti.
          </p>
          <p>Universidad Nacional de Ingeniería, Lima, Perú</p>
        </div>
      </div>
    </footer>
  );
}
