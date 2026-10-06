import type { Route } from "next";

export type NavItem = { label: string; href: Route; description?: string };

/** Ítem del menú; con `children` se muestra como submenú del programa. */
export type NavEntry = NavItem & { children?: NavItem[] };

/** Rutas principales del sitio, compartidas por NavBar y Footer. */
export const mainNav: NavEntry[] = [
  { label: "Inicio", href: "/" },
  {
    label: "PROVOV",
    href: "/provov",
    children: [
      {
        label: "Programa PROVOV",
        href: "/provov",
        description: "Orientación vocacional vivencial",
      },
      {
        label: "Open Day",
        href: "/provov/open-day",
        description: "Un día dentro de la UNI",
      },
      {
        label: "Visitas guiadas",
        href: "/provov/visitas-guiadas",
        description: "A la UNI o a tu colegio",
      },
    ],
  },
  { label: "Inspírate Girl", href: "/inspirate-girl" },
  { label: "Eventos", href: "/eventos" },
  { label: "Voluntariado", href: "/voluntariado" },
];

export const visitCta: NavItem = {
  label: "Pide una visita",
  href: "/provov/visitas-guiadas",
};

export const loginLink: NavItem = { label: "Ingresar", href: "/login" };

export const footerColumns: { title: string; links: NavItem[] }[] = [
  {
    title: "Programas",
    links: [
      { label: "PROVOV", href: "/provov" },
      { label: "Open Day UNI", href: "/provov/open-day" },
      { label: "Visitas guiadas", href: "/provov/visitas-guiadas" },
      { label: "Inspírate Girl", href: "/inspirate-girl" },
    ],
  },
  {
    title: "Organización",
    links: [
      { label: "Quiénes somos", href: "/#quienes-somos" },
      { label: "Eventos", href: "/eventos" },
      { label: "Voluntariado", href: "/voluntariado" },
      { label: "Ingresar", href: "/login" },
    ],
  },
];

export const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/inspirateuni/" },
  { label: "TikTok", href: "https://www.tiktok.com/@inspirateuni" },
  { label: "Facebook", href: "https://www.facebook.com/inspirateuni" },
];

export const contact = {
  email: "inspirateuni@uni.edu.pe",
  phone: "+51 935 903 055",
  whatsappUrl: "https://wa.me/51935903055",
  address: "Casita Inspírate",
  mapUrl: "https://maps.app.goo.gl/GSHoLbbBpBEKsY3c7",
};
