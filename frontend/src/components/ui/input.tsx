"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Field({ label, error, className, id, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "h-11 rounded-sm border border-hairline px-3 text-base text-ink placeholder:text-muted-soft focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink",
          error && "border-error",
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

/** Campo de senha com botão "ver senha". */
export function PasswordField({ label, error, className, id, ...props }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className={cn(
            "h-11 w-full rounded-sm border border-hairline px-3 pr-11 text-base text-ink placeholder:text-muted-soft focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink",
            error && "border-error",
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Ver senha"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

/** Formata dígitos no padrão brasileiro: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX. */
export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const len = digits.length;
  if (len === 0) return "";
  if (len <= 2) return `(${digits}`;
  if (len <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Campo de telefone com máscara automática (XX) XXXXX-XXXX. */
export function PhoneField({ label, error, className, id, onChange, ...props }: FieldProps) {
  const inputId = id ?? props.name;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = formatPhoneBR(e.target.value);
    onChange?.(e);
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        placeholder="(99) 99999-9999"
        {...props}
        type="tel"
        maxLength={15}
        className={cn(
          "h-11 rounded-sm border border-hairline px-3 text-base text-ink placeholder:text-muted-soft focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink",
          error && "border-error",
          className,
        )}
        aria-invalid={Boolean(error)}
        onChange={handleChange}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export function SelectField({ label, error, className, id, children, ...props }: SelectFieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-muted">
        {label}
      </label>
      <select
        id={inputId}
        className={cn(
          "h-11 rounded-sm border border-hairline bg-canvas px-3 text-base text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink",
          error && "border-error",
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
