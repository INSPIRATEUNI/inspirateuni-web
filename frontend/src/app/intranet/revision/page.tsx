import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewCard, type ReviewItem } from "@/components/intranet/ReviewCard";
import { Mascot } from "@/components/site/Mascot";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { getCurrentUser } from "@/lib/intranet/user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Revisión - Inspírate UNI" };

type SubmissionRow = {
  id: string;
  reported_hours: number;
  work_date: string | null;
  notes: string | null;
  submitted_at: string | null;
  evidences: {
    id: string;
    drive_file_id: string;
    file_name: string;
    size_bytes: number | null;
  }[];
  task_assignment: {
    task: {
      title: string;
      area: { name: string } | null;
      activity_type: { name: string; weight: number } | null;
    };
    position_assignment: {
      profile_id: string;
      profile: { first_name: string | null; last_name: string | null } | null;
    };
  };
};

export default async function ReviewPage() {
  const user = await getCurrentUser();
  // Solo la directiva revisa; al resto no se le revela la ruta.
  if (!user?.isBoard) notFound();

  const supabase = await createClient();

  // RLS devuelve solo las entregas de las áreas que el usuario gestiona.
  const { data } = await supabase
    .from("task_submissions")
    .select(
      "id, reported_hours, work_date, notes, submitted_at, evidences:submission_evidences(id, drive_file_id, file_name, size_bytes), task_assignment:task_assignments!inner(task:tasks!inner(title, area:areas(name), activity_type:activity_types(name, weight)), position_assignment:position_assignments!inner(profile_id, profile:profiles(first_name, last_name)))",
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });
  const rows = (data ?? []) as unknown as SubmissionRow[];

  const items: ReviewItem[] = rows
    // Un director no revisa sus propias entregas
    .filter(
      (row) => row.task_assignment.position_assignment.profile_id !== user.id,
    )
    .map((row) => {
      const { task, position_assignment: person } = row.task_assignment;
      return {
        id: row.id,
        volunteer:
          [person.profile?.first_name, person.profile?.last_name]
            .filter(Boolean)
            .join(" ") || "Sin nombre",
        task: task.title,
        area: task.area?.name ?? null,
        activity: task.activity_type?.name ?? null,
        weight: Number(task.activity_type?.weight ?? 1),
        reportedHours: Number(row.reported_hours),
        workDate: row.work_date,
        submittedAt: row.submitted_at,
        notes: row.notes,
        evidences: row.evidences.map((file) => ({
          id: file.id,
          path: file.drive_file_id,
          name: file.file_name,
          size: file.size_bytes,
        })),
      };
    });

  return (
    <section>
      <Heading variant="page">
        Revisión de <GradientText gradient="discover">entregas</GradientText>.
      </Heading>
      <Text variant="lead" className="mt-4 mb-10 max-w-2xl">
        Aprueba o rechaza los reportes de horas de tu área, de la más antigua a
        la más reciente.
      </Text>

      {items.length === 0 ? (
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <Mascot pose="durmiendo" className="w-40" />
          <Text variant="muted">
            No hay entregas por revisar. ¡Todo al día!
          </Text>
        </div>
      ) : (
        <div className="grid gap-8">
          <Text variant="muted" className="text-sm">
            {items.length === 1
              ? "1 entrega pendiente"
              : `${items.length} entregas pendientes`}
          </Text>
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
