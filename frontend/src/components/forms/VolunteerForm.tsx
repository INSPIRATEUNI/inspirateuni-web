"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { submitVolunteer } from "@/app/(site)/voluntariado/actions";
import { Notice } from "@/components/open-day/Notice";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { areasDeApoyo, facultades } from "@/data/voluntariado";
import {
  cycles,
  type VolunteerValues,
  volunteerSchema,
} from "@/lib/forms/schemas";
import { FormSuccess } from "./FormSuccess";
import { ConsentField, SelectField, TextAreaField, TextField } from "./fields";
import { CAPTCHA_MISSING, useAntispam } from "./useAntispam";

const emptyValues: VolunteerValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  studentCode: "",
  faculty: "",
  cycle: "",
  area: "",
  motivation: "",
  consent: false,
};

type VolunteerFormProps = {
  /** Convocatoria abierta: postulación. Cerrada: solo "avísame". */
  open: boolean;
};

export function VolunteerForm({ open }: VolunteerFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VolunteerValues>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: emptyValues,
  });
  const antispam = useAntispam();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (antispam.captchaMissing) {
      setServerError(CAPTCHA_MISSING);
      return;
    }
    const result = await submitVolunteer(values, antispam.meta());
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
          open ? (
            <>
              ¡Postulación <GradientText gradient="fresh">enviada</GradientText>
              !
            </>
          ) : (
            <>
              Listo, te <GradientText gradient="fresh">avisamos</GradientText>.
            </>
          )
        }
        action={
          <Button variant="ghost" onClick={() => setSent(false)}>
            Enviar otra respuesta
          </Button>
        }
      >
        {open
          ? "Revisaremos tus datos y te escribiremos a tu correo con los siguientes pasos."
          : "Guardamos tus datos. Te escribiremos apenas abra la próxima convocatoria."}
      </FormSuccess>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <TextField
        id="vol-first-name"
        label="Nombres"
        autoComplete="given-name"
        error={errors.firstName?.message}
        {...register("firstName")}
      />
      <TextField
        id="vol-last-name"
        label="Apellidos"
        autoComplete="family-name"
        error={errors.lastName?.message}
        {...register("lastName")}
      />
      <TextField
        id="vol-email"
        type="email"
        label="Correo"
        hint="De preferencia, tu correo UNI."
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        id="vol-phone"
        type="tel"
        label="Celular"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="9XX XXX XXX"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <TextField
        id="vol-code"
        label="Código UNI"
        autoComplete="off"
        placeholder="20231234A"
        maxLength={9}
        error={errors.studentCode?.message}
        {...register("studentCode")}
      />
      <SelectField
        id="vol-cycle"
        label="Ciclo"
        placeholder="Elige tu ciclo"
        options={cycles}
        error={errors.cycle?.message}
        {...register("cycle")}
      />
      <SelectField
        id="vol-faculty"
        label="Facultad"
        placeholder="Elige tu facultad"
        options={facultades}
        className="sm:col-span-2"
        error={errors.faculty?.message}
        {...register("faculty")}
      />
      <SelectField
        id="vol-area"
        label="¿Dónde te gustaría apoyar?"
        hint="Para ser embajador debes estar entre 5.º y 10.º ciclo."
        placeholder="Elige una opción"
        options={areasDeApoyo}
        className="sm:col-span-2"
        error={errors.area?.message}
        {...register("area")}
      />
      <TextAreaField
        id="vol-motivation"
        label="¿Por qué quieres ser voluntario?"
        hint="Entre 30 y 1000 caracteres."
        maxLength={1000}
        className="sm:col-span-2"
        error={errors.motivation?.message}
        {...register("motivation")}
      />
      <ConsentField
        id="vol-consent"
        className="sm:col-span-2"
        error={errors.consent?.message}
        {...register("consent")}
      />
      <div className="grid gap-5 sm:col-span-2">
        {antispam.fields}
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <div>
          <Button
            type="submit"
            bolt={!isSubmitting}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting
              ? "Enviando…"
              : open
                ? "Enviar postulación"
                : "Avísame"}
          </Button>
        </div>
      </div>
    </form>
  );
}
