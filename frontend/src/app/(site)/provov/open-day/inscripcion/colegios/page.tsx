import type { Metadata } from "next";
import { ClosedNotice } from "@/components/open-day/ClosedNotice";
import { PageIntro } from "@/components/open-day/PageIntro";
import { RegistrationWizard } from "@/components/open-day/RegistrationWizard";
import { GradientText } from "@/components/ui/GradientText";
import { OPEN_DAY_ROUTES } from "@/lib/open-day/constants";
import { getLogisticsOptions, getWizardEvent } from "@/lib/open-day/server";

export const metadata: Metadata = {
  title: "Inscripción de colegios · Open Day",
};

export default async function ColegiosPage({
  searchParams,
}: PageProps<"/provov/open-day/inscripcion/colegios">) {
  const { id } = await searchParams;
  const registrationId = typeof id === "string" ? id : null;
  const [{ event, available }, logisticsOptions] = await Promise.all([
    getWizardEvent(registrationId),
    getLogisticsOptions(),
  ]);

  return (
    <>
      <PageIntro
        current="Colegios"
        parent={{ label: "Inscripción", href: OPEN_DAY_ROUTES.selector }}
        title={
          <>
            Inscribe a tu{" "}
            <GradientText gradient="discover">colegio</GradientText>.
          </>
        }
        lead="Completa los pasos en orden. Puedes cerrar la página y volver más tarde: guardamos tu avance."
      />
      {event && available ? (
        <RegistrationWizard
          kind="school"
          event={event}
          logisticsOptions={logisticsOptions}
          registrationId={registrationId}
        />
      ) : (
        <ClosedNotice event={event} />
      )}
    </>
  );
}
