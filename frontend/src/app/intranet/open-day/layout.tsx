import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OpenDayTabs } from "@/components/intranet/open-day/OpenDayTabs";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { getCurrentUser } from "@/lib/intranet/user";

export default async function OpenDayStaffLayout({
  children,
}: LayoutProps<"/intranet/open-day">) {
  const user = await getCurrentUser();
  // Backoffice del staff: al resto no se le revela la ruta
  if (!user?.isBoard) notFound();

  return (
    <div className="grid gap-8">
      <Heading variant="page" className="print:hidden">
        Open Day: <GradientText gradient="discover">backoffice</GradientText>.
      </Heading>
      <Suspense fallback={<div className="h-11 border-b-2 border-border" />}>
        <OpenDayTabs isAdmin={user.isAdmin} />
      </Suspense>
      {children}
    </div>
  );
}
