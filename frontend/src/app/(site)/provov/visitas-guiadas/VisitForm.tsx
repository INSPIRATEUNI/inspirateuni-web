"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormSuccess } from "@/components/forms/FormSuccess";
import {
  ConsentField,
  SelectField,
  TextField,
} from "@/components/forms/fields";
import { CAPTCHA_MISSING, useAntispam } from "@/components/forms/useAntispam";
import { Notice } from "@/components/open-day/Notice";
import { CalendarIcon, CampusIcon, UsersIcon } from "@/components/site/Icons";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import {
  limaDate,
  type VisitValues,
  visitModes,
  visitSchema,
  visitShifts,
} from "@/lib/forms/schemas";
import { relayAt, relayClasses } from "@/lib/relay";
import { submitVisit } from "./actions";

type Step = {
  title: string;
  icon: ReactNode;
  fields: ReactNode;
};

const emptyValues: VisitValues = {
  school: "",
  district: "",
  students: Number.NaN,
  mode: "",
  date: "",
  shift: "",
  name: "",
  email: "",
  phone: "",
  consent: false,
};

export function VisitForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VisitValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: emptyValues,
  });
  const antispam = useAntispam();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // En el cliente: la página es estática y la fecha del build quedaría vieja
  const [minDate, setMinDate] = useState<string>();
  useEffect(() => {
    setMinDate(limaDate(1));
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (antispam.captchaMissing) {
      setServerError(CAPTCHA_MISSING);
      return;
    }
    const result = await submitVisit(values, antispam.meta());
    antispam.afterSubmit(result.ok);
    if (result.ok) {
      reset(emptyValues);
      setSent(true);
    } else {
      setServerError(result.error);
    }
  });

  if (sent) {
    return (
      <FormSuccess
        title={
          <>
            Listo,{" "}
            <GradientText gradient="fresh">nos vemos pronto</GradientText>.
          </>
        }
        action={
          <Button variant="ghost" onClick={() => setSent(false)}>
            Pedir otra visita
          </Button>
        }
      >
        Recibimos tu solicitud. Te escribiremos en las próximas 48 horas para
        confirmar la fecha.
      </FormSuccess>
    );
  }

  const steps: Step[] = [
    {
      title: "Cuéntanos de tu colegio",
      icon: <CampusIcon className="size-5" />,
      fields: (
        <>
          <TextField
            id="visit-school"
            label="¿Cómo se llama tu colegio?"
            placeholder="I.E. José Carlos Mariátegui"
            className="sm:col-span-2"
            error={errors.school?.message}
            {...register("school")}
          />
          <TextField
            id="visit-district"
            label="¿En qué distrito está?"
            placeholder="San Martín de Porres"
            error={errors.district?.message}
            {...register("district")}
          />
          <TextField
            id="visit-students"
            type="number"
            inputMode="numeric"
            label="¿Cuántos escolares serán?"
            hint="Un aproximado está bien."
            min={10}
            step={5}
            placeholder="60"
            error={errors.students?.message}
            {...register("students", { valueAsNumber: true })}
          />
        </>
      ),
    },
    {
      title: "Elige la fecha",
      icon: <CalendarIcon />,
      fields: (
        <>
          <SelectField
            id="visit-mode"
            label="¿Dónde será la visita?"
            placeholder="Elige una modalidad"
            options={visitModes}
            className="sm:col-span-2"
            error={errors.mode?.message}
            {...register("mode")}
          />
          <TextField
            id="visit-date"
            type="date"
            label="¿Qué día te acomoda?"
            min={minDate}
            error={errors.date?.message}
            {...register("date")}
          />
          <SelectField
            id="visit-shift"
            label="¿En qué turno?"
            placeholder="Elige un turno"
            options={visitShifts}
            error={errors.shift?.message}
            {...register("shift")}
          />
        </>
      ),
    },
    {
      title: "¿Cómo te contactamos?",
      icon: <UsersIcon />,
      fields: (
        <>
          <TextField
            id="visit-name"
            label="Tu nombre"
            autoComplete="name"
            className="sm:col-span-2"
            error={errors.name?.message}
            {...register("name")}
          />
          <TextField
            id="visit-email"
            type="email"
            label="Tu correo"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <TextField
            id="visit-phone"
            type="tel"
            label="Tu celular"
            hint="Opcional."
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="9XX XXX XXX"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <ConsentField
            id="visit-consent"
            className="sm:col-span-2"
            error={errors.consent?.message}
            {...register("consent")}
          />
        </>
      ),
    },
  ];

  return (
    <form noValidate onSubmit={onSubmit}>
      <ol className="relative grid gap-12">
        <span
          aria-hidden="true"
          className="absolute top-6 bottom-6 left-6 w-0.5 bg-linear-to-b from-magenta via-blue to-green opacity-40"
        />
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="relative grid grid-cols-[3rem_1fr] gap-5"
          >
            <span
              aria-hidden="true"
              className={cn(
                "z-1 grid size-12 place-items-center rounded-full text-white ring-8 ring-background",
                relayClasses[relayAt(index)].deep,
              )}
            >
              {step.icon}
            </span>
            <fieldset className="min-w-0">
              <legend className="text-h3-item pt-2.5">{step.title}</legend>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {step.fields}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="mt-12 grid gap-5 pl-17">
        {antispam.fields}
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            bolt={!isSubmitting}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Enviando…" : "Solicitar visita"}
          </Button>
          <Text variant="muted" className="text-sm">
            Es gratis y sin compromiso.
          </Text>
        </div>
      </div>
    </form>
  );
}
