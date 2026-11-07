/** Marco de las páginas de inscripción del Open Day. */
export default function InscripcionLayout({
  children,
}: LayoutProps<"/provov/open-day/inscripcion">) {
  return (
    <section className="relative overflow-hidden pt-14 pb-24 print:p-0">
      <div
        aria-hidden="true"
        className="blob top-24 -right-28 size-88 bg-orange [animation-delay:-2s] print:hidden"
      />
      <div
        aria-hidden="true"
        className="blob bottom-32 -left-20 size-64 bg-green [animation-delay:-10s] print:hidden"
      />
      <div className="container-site z-1 max-w-5xl">{children}</div>
    </section>
  );
}
