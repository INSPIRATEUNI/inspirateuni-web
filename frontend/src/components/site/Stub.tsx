import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { LogoBulbIcon, SparkleIcon } from "./Icons";

type StubProps = {
  title: ReactNode;
  description?: ReactNode;
  tag?: string;
};

/** Página provisional compartida por las rutas que aún no tienen contenido. */
export function Stub({
  title,
  description = "Estamos preparando esta sección. Vuelve pronto para conocer todo lo que tenemos para ti.",
  tag = "Próximamente",
}: StubProps) {
  return (
    <section className="relative overflow-hidden py-24">
      <div
        aria-hidden="true"
        className="blob top-10 left-1/2 size-80 -translate-x-1/2 bg-blue"
      />
      <div className="container-site z-1 flex max-w-2xl flex-col items-center text-center">
        <LogoBulbIcon className="size-16 animate-pulse-bulb motion-reduce:animate-none" />
        <Tag tone="orange" className="mt-6">
          <SparkleIcon className="size-3.5" />
          {tag}
        </Tag>
        <Heading variant="page" className="mt-4">
          {title}
        </Heading>
        <Text variant="lead" className="mt-5">
          {description}
        </Text>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/" variant="ghost">
            Volver al inicio
          </Button>
        </div>
      </div>
    </section>
  );
}
