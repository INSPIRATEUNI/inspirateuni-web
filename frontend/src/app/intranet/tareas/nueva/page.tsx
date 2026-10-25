import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskForm } from "@/components/intranet/TaskForm";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nueva tarea - Inspírate UNI" };

type NamedRow = { id: string; name: string };

type AssigneeRow = {
  id: string;
  area_id: string;
  profile: { first_name: string | null; last_name: string | null } | null;
};

export default async function NewTaskPage() {
  const user = await getCurrentUser();
  // La directiva es la única que ve esta página; al resto no se le revela la ruta.
  if (!user?.isBoard) notFound();

  const supabase = await createClient();

  // Directores: solo su área. Presidente, vice y admin: cualquiera (RLS lo aplica).
  const ownAreaIds = [
    ...new Set(
      user.roles
        .filter((role) => role.accessLevel === "board" && role.areaId)
        .map((role) => role.areaId as string),
    ),
  ];
  const areasQuery = supabase.from("areas").select("id, name").order("name");
  const [areasResult, typesResult] = await Promise.all([
    user.canManageAllAreas ? areasQuery : areasQuery.in("id", ownAreaIds),
    supabase
      .from("activity_types")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);
  const areas = (areasResult.data ?? []) as NamedRow[];
  const activityTypes = (typesResult.data ?? []) as NamedRow[];

  const { data: assigneeRows } = areas.length
    ? await supabase
        .from("position_assignments")
        .select(
          "id, area_id, profile:profiles(first_name, last_name), role:organizational_roles!inner(access_level), period:management_periods!inner(status)",
        )
        .eq("status", "active")
        .eq("role.access_level", "volunteer")
        .eq("period.status", "active")
        .in(
          "area_id",
          areas.map((area) => area.id),
        )
    : { data: [] };

  const assignees = ((assigneeRows ?? []) as unknown as AssigneeRow[])
    .map((row) => ({
      id: row.id,
      areaId: row.area_id,
      name:
        [row.profile?.first_name, row.profile?.last_name]
          .filter(Boolean)
          .join(" ") || "Sin nombre",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <section>
      <Heading variant="page">
        Nueva <GradientText gradient="discover">tarea</GradientText>.
      </Heading>
      <Text variant="lead" className="mt-4 mb-10 max-w-2xl">
        Asigna una tarea a los voluntarios de tu área. Ellos reportarán sus
        horas cuando la terminen.
      </Text>
      <TaskForm
        areas={areas}
        activityTypes={activityTypes}
        assignees={assignees}
      />
    </section>
  );
}
