import Link from "next/link";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { LoginForm } from "./LoginForm";

const DEFAULT_REDIRECT = "/intranet";

/** Solo acepta rutas internas bajo /intranet para evitar redirecciones abiertas. */
function safeRedirect(next: string | string[] | undefined) {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value) return DEFAULT_REDIRECT;
  const isIntranet = value === "/intranet" || value.startsWith("/intranet/");
  return isIntranet && !value.startsWith("//") ? value : DEFAULT_REDIRECT;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <section className="pt-14 pb-24">
      <div className="container-site flex max-w-md flex-col items-center text-center">
        <Heading variant="page">
          Hola de nuevo,{" "}
          <GradientText gradient="discover">voluntario</GradientText>.
        </Heading>
        <Text variant="muted" className="mt-4">
          Ingresa con tu cuenta para ver tus turnos, eventos y visitas.
        </Text>

        <div className="mt-10 w-full">
          <LoginForm redirectTo={safeRedirect(next)} />
        </div>

        <Text variant="muted" className="mt-8 text-sm">
          ¿Aún no eres voluntario?{" "}
          <Link
            href="/voluntariado"
            className="font-semibold text-magenta-deep underline-offset-4 hover:underline"
          >
            Conoce cómo unirte
          </Link>
          .
        </Text>
      </div>
    </section>
  );
}
