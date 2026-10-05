import type { Route } from "next";

export type NavItem = { label: string; href: Route };

/** Rutas principales del sitio, compartidas por NavBar y Footer. */
export const mainNav: NavItem[] = [
  { label: "Inicio", href: "/" },
  { label: "Open Day", href: "/OpenDay" },
  { label: "Inspírate Girl", href: "/Igirl" },
  { label: "Eventos", href: "/eventos" },
  { label: "Voluntariado", href: "/voluntariado" },
];

export const visitCta: NavItem = { label: "Pide una visita", href: "/ovpgs" };

export const loginLink: NavItem = { label: "Ingresar", href: "/Login" };

export const footerColumns: { title: string; links: NavItem[] }[] = [
  {
    title: "Programas",
    links: [
      { label: "Open Day UNI", href: "/OpenDay" },
      { label: "Inspírate Girl", href: "/Igirl" },
      { label: "Pide una visita", href: "/ovpgs" },
    ],
  },
  {
    title: "Organización",
    links: [
      { label: "Eventos", href: "/eventos" },
      { label: "Voluntariado", href: "/voluntariado" },
      { label: "Ingresar", href: "/Login" },
    ],
  },
];

export const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/" },
  { label: "TikTok", href: "https://www.tiktok.com/" },
  { label: "Facebook", href: "https://www.facebook.com/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/" },
];

export const contact = {
  email: "hola@inspirateuni.org",
  address: "Av. Túpac Amaru 210, Rímac, Lima",
};
