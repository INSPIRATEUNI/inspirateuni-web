"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { submitIgirl } from "@/app/(site)/inspirate-girl/actions";
import { Notice } from "@/components/open-day/Notice";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";
import { Text } from "@/components/ui/Text";
import {
  type IgirlValues,
  igirlInterests,
  igirlSchema,
} from "@/lib/forms/schemas";
import { FormSuccess } from "./FormSuccess";
import { ConsentField, SelectField, TextAreaField, TextField } from "./fields";
import { CAPTCHA_MISSING, useAntispam } from "./useAntispam";

const emptyValues: IgirlValues = {
  interest: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  institution: "",
  grade: "",
  message: "",
  consent: false,
};

export function IgirlForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IgirlValues>({
    resolver: zodResolver(igirlSchema),
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
    const result = await submitIgirl(values, antispam.meta());
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
            ¡Gracias por{" "}
            <GradientText gradient="energy">escribirnos</GradientText>!
          </>
        }
        action={
          <Button variant="ghost" onClick={() => setSent(false)}>
            Enviar otra respuesta
          </Button>
        }
      >
        Te escribiremos pronto para contarte de nuestras próximas actividades.
      </FormSuccess>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <SelectField
        id="igirl-interest"
        label="¿Cómo quieres participar?"
        placeholder="Elige una opción"
        options={igirlInterests}
        className="sm:col-span-2"
        error={errors.interest?.message}
        {...register("interest")}
      />
      <TextField
        id="igirl-first-name"
        label="Nombres"
        autoComplete="given-name"
        error={errors.firstName?.message}
        {...register("firstName")}
      />
      <TextField
        id="igirl-last-name"
        label="Apellidos"
        autoComplete="family-name"
        error={errors.lastName?.message}
        {...register("lastName")}
      />
      <TextField
        id="igirl-email"
        type="email"
        label="Correo"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        id="igirl-phone"
        type="tel"
        label="Celular"
        hint="Opcional."
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="9XX XXX XXX"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <TextField
        id="igirl-institution"
        label="Colegio, universidad u organización"
        autoComplete="organization"
        error={errors.institution?.message}
        {...register("institution")}
      />
      <TextField
        id="igirl-grade"
        label="Grado o ciclo"
        hint="Opcional. Por ejemplo, 4.º de secundaria."
        error={errors.grade?.message}
        {...register("grade")}
      />
      <TextAreaField
        id="igirl-message"
        label="¿Algo que quieras contarnos?"
        hint="Opcional."
        rows={3}
        maxLength={500}
        className="sm:col-span-2"
        error={errors.message?.message}
        {...register("message")}
      />
      <ConsentField
        id="igirl-consent"
        className="sm:col-span-2"
        error={errors.consent?.message}
        {...register("consent")}
      />
      <div className="grid gap-5 sm:col-span-2">
        {antispam.fields}
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            bolt={!isSubmitting}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Enviando…" : "Quiero participar"}
          </Button>
          <Text variant="muted" className="text-sm">
            Si eres menor de edad, llénalo con tu mamá, papá o apoderado.
          </Text>
        </div>
      </div>
    </form>
  );
}
