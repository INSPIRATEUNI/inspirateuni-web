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

export const loginLink: NavItem = { label: "Ingresar", href: "/login" };

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
