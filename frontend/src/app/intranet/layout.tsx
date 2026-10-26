import { redirect } from "next/navigation";
import { IntranetSidebar } from "@/components/intranet/IntranetSidebar";
import { formatRole, getCurrentUser } from "@/lib/intranet/user";

export default async function IntranetLayout({
  children,
}: LayoutProps<"/intranet">) {
  const user = await getCurrentUser();
  // El proxy ya filtra por sesión; esto cubre una sesión que expiró en el camino.
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <IntranetSidebar
        name={user.fullName}
        role={formatRole(user.primaryRole)}
        isBoard={user.isBoard}
      />
      <main
        id="contenido"
        className="min-w-0 flex-1 px-5 py-10 sm:px-8 lg:px-12"
      >
        {children}
      </main>
    </div>
  );
}
