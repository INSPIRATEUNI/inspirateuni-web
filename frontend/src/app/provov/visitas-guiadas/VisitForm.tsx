"use client";

import { type ReactNode, useState } from "react";
import { CalendarIcon, CampusIcon, UsersIcon } from "@/components/site/Icons";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { GradientText } from "@/components/ui/GradientText";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { relayAt, relayClasses } from "@/lib/relay";

type Step = {
  title: string;
  icon: ReactNode;
  fields: ReactNode;
};

const steps: Step[] = [
  {
    title: "Cuéntanos de tu colegio",
    icon: <CampusIcon className="size-5" />,
    fields: (
      <>
        <Field
          id="visit-school"
          label="¿Cómo se llama tu colegio?"
          className="sm:col-span-2"
        >
          <Input
            id="visit-school"
            name="school"
            placeholder="I.E. José Carlos Mariátegui"
            required
          />
        </Field>
        <Field id="visit-district" label="¿En qué distrito está?">
          <Input
            id="visit-district"
            name="district"
            placeholder="San Martín de Porres"
            required
          />
        </Field>
        <Field
          id="visit-students"
          label="¿Cuántos escolares serán?"
          hint="Un aproximado está bien."
        >
          <Input
            type="number"
            id="visit-students"
            name="students"
            aria-describedby="visit-students-hint"
            min={10}
            step={5}
            placeholder="60"
            required
          />
        </Field>
      </>
    ),
  },
  {
    title: "Elige la fecha",
    icon: <CalendarIcon />,
    fields: (
      <>
        <Field
          id="visit-mode"
          label="¿Dónde será la visita?"
          className="sm:col-span-2"
        >
          <Select id="visit-mode" name="mode" defaultValue="" required>
            <option value="" disabled>
              Elige una modalidad
            </option>
            <option value="uni">Vamos a la UNI</option>
            <option value="colegio">Vengan a nuestro colegio</option>
          </Select>
        </Field>
        <Field id="visit-date" label="¿Qué día te acomoda?">
          <Input type="date" id="visit-date" name="date" required />
        </Field>
        <Field id="visit-shift" label="¿En qué turno?">
          <Select id="visit-shift" name="shift" defaultValue="" required>
            <option value="" disabled>
              Elige un turno
            </option>
            <option value="manana">Mañana</option>
            <option value="tarde">Tarde</option>
          </Select>
        </Field>
      </>
    ),
  },
  {
    title: "¿Cómo te contactamos?",
    icon: <UsersIcon />,
    fields: (
      <>
        <Field id="visit-name" label="Tu nombre" className="sm:col-span-2">
          <Input id="visit-name" name="name" autoComplete="name" required />
        </Field>
        <Field id="visit-email" label="Tu correo">
          <Input
            type="email"
            id="visit-email"
            name="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field id="visit-phone" label="Tu celular">
          <Input
            type="tel"
            id="visit-phone"
            name="phone"
            autoComplete="tel"
            placeholder="9XX XXX XXX"
          />
        </Field>
      </>
    ),
  },
];

export function VisitForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-6 py-10 text-center sm:flex-row sm:text-left"
      >
        <Mascot
          pose="alegre"
          className="w-28 shrink-0 animate-mascot-float sm:w-36 motion-reduce:animate-none"
        />
        <div>
          <Heading variant="section" level={3}>
            Listo,{" "}
            <GradientText gradient="fresh">nos vemos pronto</GradientText>.
          </Heading>
          <Text variant="lead" className="mt-3">
            Recibimos tu solicitud. Te escribiremos en las próximas 48 horas
            para confirmar la fecha.
          </Text>
          <Button
            variant="ghost"
            className="mt-6"
            onClick={() => setSent(false)}
          >
            Pedir otra visita
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      }}
    >
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
      <div className="mt-12 flex flex-col items-start gap-3 pl-17 sm:flex-row sm:items-center">
        <Button type="submit" bolt>
          Solicitar visita
        </Button>
        <Text variant="muted" className="text-sm">
          Es gratis y sin compromiso.
        </Text>
      </div>
    </form>
  );
}
