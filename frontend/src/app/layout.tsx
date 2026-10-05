import type { Metadata } from "next";
import { Nunito, Quicksand } from "next/font/google";
import { Footer } from "@/components/site/Footer";
import { NavBar } from "@/components/site/NavBar";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Inspírate UNI",
    template: "%s | Inspírate UNI",
  },
  description:
    "Voluntariado estudiantil de la Universidad Nacional de Ingeniería. Orientación vocacional vivencial para escolares y preuniversitarios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${nunito.variable} ${quicksand.variable}`}
    >
      <body className="flex min-h-dvh flex-col overflow-x-hidden">
        <a
          href="#contenido"
          className="sr-only rounded-leaf-xs bg-surface font-extrabold text-magenta shadow-soft focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-4 focus:py-2.5"
        >
          Saltar al contenido
        </a>
        <NavBar />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
