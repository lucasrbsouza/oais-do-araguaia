"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { IS_DEMO, login } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha tem no mínimo 8 caracteres."),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await login(data.email, data.password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-soft p-4">
      <div className="w-full max-w-md rounded-md bg-canvas p-8 shadow-float">
        <h1 className="text-2xl font-bold text-ink">Oaís do Araguaia</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Gestão do condomínio de chalés
        </p>
        {IS_DEMO && (
          <div className="mb-4 rounded-sm border border-warning/30 bg-amber-50 px-4 py-3 text-sm text-warning">
            <p className="font-semibold">Protótipo de demonstração</p>
            <p className="mt-1">
              Administrador: <strong>admin@demo.com</strong> / <strong>demo1234</strong>
              <br />
              Proprietário: <strong>dono@demo.com</strong> / <strong>demo1234</strong>
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <ErrorState message={error} />}
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Field
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Button type="submit" size="md" className="w-full" loading={isSubmitting}>
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
