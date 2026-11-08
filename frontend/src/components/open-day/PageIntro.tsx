import type { Route } from "next";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/programs/Breadcrumb";
import { SparkleIcon } from "@/components/site/Icons";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";

type PageIntroProps = {
  current: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Migas: por defecto vuelve al Open Day. */
  parent?: { label: string; href: Route };
};

/** Encabezado común de las páginas de inscripción. */
export function PageIntro({
  current,
  title,
  lead,
  parent = { label: "Open Day", href: "/provov/open-day" },
}: PageIntroProps) {
  return (
    <div className="mb-12 print:hidden">
      <Breadcrumb parent={parent} current={current} />
      <Tag tone="orange">
        <SparkleIcon className="size-3.5" />
        Inscripción Open Day
      </Tag>
      <Heading variant="page" className="mt-4">
        {title}
      </Heading>
      {lead && (
        <Text variant="lead" className="mt-5">
          {lead}
        </Text>
      )}
    </div>
  );
}
