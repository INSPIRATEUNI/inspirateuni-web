import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Intranet - Inspírate UNI" };

export default async function IntranetPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims.email;

  return (
    <section className="pt-14 pb-24">
      <div className="container-site flex max-w-md flex-col items-center text-center">
        <Heading variant="page">Intranet</Heading>
        <Text variant="lead" className="mt-4">
          Sesión iniciada{email ? ` como ${email}` : ""}. Tus turnos, eventos y
          horas llegarán pronto.
        </Text>
        <form action={signOut} className="mt-8">
          <Button type="submit" variant="ghost">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </section>
  );
}
