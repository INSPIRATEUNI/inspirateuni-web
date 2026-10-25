import type { Metadata } from "next";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Tag } from "@/components/ui/Tag";
import { Text } from "@/components/ui/Text";
import { formatRole, getCurrentUser } from "@/lib/intranet/user";

export const metadata: Metadata = { title: "Intranet - Inspírate UNI" };

export default async function IntranetPage() {
  // Misma consulta que el layout: `getCurrentUser` está cacheado por petición.
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <section>
      <Heading variant="page">
        Hola, <GradientText gradient="discover">{user.firstName}</GradientText>.
      </Heading>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Tag tone="blue">{formatRole(user.primaryRole)}</Tag>
        {user.roles.length > 1 && (
          <Text variant="muted" className="text-sm">
            También: {user.roles.slice(1).map(formatRole).join(", ")}
          </Text>
        )}
      </div>
      <Text variant="lead" className="mt-6 max-w-2xl">
        Aquí verás tus tareas, tus horas y, si eres de la directiva, las
        entregas por revisar.
      </Text>
    </section>
  );
}
