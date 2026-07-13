"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { IS_DEMO, login } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, PasswordField } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { LOGO_SRC } from "@/lib/assets";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha tem no mínimo 8 caracteres."),
});

type FormData = z.infer<typeof schema>;

const BACKGROUND_ROWS = [
  {
    offset: "-translate-x-16",
    cards: [
      { label: "Oasis Do Araguaia", color: "from-teal-400 to-teal-500" },
      { label: "Pará", color: "from-blue-400 to-blue-500" },
      { label: "Araguaia", color: "from-emerald-400 to-emerald-500" },
      { label: "Rio", color: "from-amber-400 to-amber-500" },
      { label: "Oasis Do Araguaia", color: "from-rose-400 to-rose-500" },
      { label: "Pará", color: "from-indigo-400 to-indigo-500" },
    ],
  },
  {
    offset: "translate-x-8",
    cards: [
      { label: "Pará", color: "from-rose-400 to-rose-500" },
      { label: "Rio", color: "from-orange-400 to-orange-500" },
      { label: "Oasis Do Araguaia", color: "from-teal-400 to-teal-500" },
      { label: "Araguaia", color: "from-cyan-400 to-cyan-500" },
      { label: "Pará", color: "from-blue-400 to-blue-500" },
      { label: "Rio", color: "from-amber-400 to-amber-500" },
    ],
  },
  {
    offset: "-translate-x-8",
    cards: [
      { label: "Araguaia", color: "from-emerald-400 to-emerald-500" },
      { label: "Oasis Do Araguaia", color: "from-indigo-400 to-indigo-500" },
      { label: "Rio", color: "from-orange-400 to-orange-500" },
      { label: "Pará", color: "from-rose-400 to-rose-500" },
      { label: "Oasis Do Araguaia", color: "from-teal-400 to-teal-500" },
      { label: "Araguaia", color: "from-cyan-400 to-cyan-500" },
    ],
  },
  {
    offset: "translate-x-16",
    cards: [
      { label: "Rio", color: "from-amber-400 to-amber-500" },
      { label: "Pará", color: "from-blue-400 to-blue-500" },
      { label: "Oasis Do Araguaia", color: "from-rose-400 to-rose-500" },
      { label: "Araguaia", color: "from-emerald-400 to-emerald-500" },
      { label: "Rio", color: "from-orange-400 to-orange-500" },
      { label: "Pará", color: "from-indigo-400 to-indigo-500" },
    ],
  },
];

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
    <main className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
      {/* Fundo decorativo inspirado no Airbnb */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-[#e8e7e3] flex flex-col justify-center gap-6 p-4">
        <div className="absolute inset-0 flex flex-col justify-center gap-6 pointer-events-none scale-105 select-none blur-[1.5px] opacity-95">
          {BACKGROUND_ROWS.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className={`flex flex-row gap-6 justify-center ${row.offset}`}
            >
              {row.cards.map((card, cardIdx) => (
                <div
                  key={cardIdx}
                  className={`w-40 sm:w-48 md:w-56 shrink-0 flex flex-col justify-between p-5 rounded-2xl border border-hairline/15 bg-gradient-to-b ${card.color} h-56 sm:h-64 shadow-md`}
                >
                  <div className="flex-1 flex items-center justify-center">
                    <img
                      src={LOGO_SRC}
                      alt=""
                      className="h-16 sm:h-20 object-contain opacity-100"
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-black text-ink tracking-widest text-center block uppercase">
                    {card.label}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-[#e8e7e3]/5 backdrop-blur-[0.2px]" />
      </div>

      <div className="w-full max-w-md rounded-md bg-canvas p-8 shadow-float z-10">
        <div className="flex items-center gap-3 mb-6">
          <img
            src={LOGO_SRC}
            alt="Logo Oasís do Araguaia"
            className="size-12 object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-ink leading-tight">Oasís do Araguaia</h1>
            <p className="text-xs text-muted">
              Gestão do condomínio de chalés
            </p>
          </div>
        </div>
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
          <PasswordField
            label="Senha"
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
