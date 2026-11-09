import type { Metadata } from "next";
import { CheckInClient } from "@/components/intranet/open-day/CheckInClient";
import { EventBar, NoEvent } from "@/components/intranet/open-day/EventBar";
import { getCurrentUser } from "@/lib/intranet/user";
import { resolveStaffEvent } from "@/lib/open-day/staff/event";
import { fetchCheckInCount } from "@/lib/open-day/staff/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Check-in del Open Day - Inspírate UNI",
};

export default async function CheckInPage({
  searchParams,
}: PageProps<"/intranet/open-day/check-in">) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { events, selected } = await resolveStaffEvent(
    supabase,
    (await searchParams).evento,
  );
  if (!selected) return <NoEvent isAdmin={Boolean(user?.isAdmin)} />;

  const count = await fetchCheckInCount(supabase, selected.id);

  return (
    <div className="grid gap-6">
      <EventBar events={events} selected={selected} />
      <p className="text-sm text-muted-foreground">
        <span className="font-bold text-foreground tabular-nums">
          {count.checkedIn}
        </span>{" "}
        de <span className="tabular-nums">{count.active}</span> personas ya
        ingresaron. Solo entran las inscripciones confirmadas.
      </p>
      <CheckInClient eventId={selected.id} />
    </div>
  );
}
