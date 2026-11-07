import type { Metadata } from "next";
import { ClosedNotice } from "@/components/open-day/ClosedNotice";
import { PageIntro } from "@/components/open-day/PageIntro";
import { RegistrationWizard } from "@/components/open-day/RegistrationWizard";
import { GradientText } from "@/components/ui/GradientText";
import { OPEN_DAY_ROUTES } from "@/lib/open-day/constants";
import { getWizardEvent } from "@/lib/open-day/server";

export const metadata: Metadata = {
  title: "Inscripción individual · Open Day",
};

export default async function LibresPage({
  searchParams,
}: PageProps<"/provov/open-day/inscripcion/libres">) {
  const { id } = await searchParams;
  const registrationId = typeof id === "string" ? id : null;
  const { event, available } = await getWizardEvent(registrationId);

  return (
    <>
      <PageIntro
        current="Por mi cuenta"
        parent={{ label: "Inscripción", href: OPEN_DAY_ROUTES.selector }}
        title={
          <>
            Inscríbete{" "}
            <GradientText gradient="discover">por tu cuenta</GradientText>.
          </>
        }
        lead="Para un solo visitante. Puedes cerrar la página y volver más tarde: guardamos tu avance."
      />
      {event && available ? (
        <RegistrationWizard
          kind="individual"
          event={event}
          logisticsOptions={[]}
          registrationId={registrationId}
        />
      ) : (
        <ClosedNotice event={event} />
      )}
    </>
  );
}
