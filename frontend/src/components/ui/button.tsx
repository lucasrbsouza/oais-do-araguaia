import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-colors rounded-sm disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white hover:bg-primary-active disabled:bg-primary-disabled",
        secondary:
          "bg-canvas text-ink border border-ink hover:bg-surface-soft disabled:opacity-50",
        ghost: "bg-transparent text-ink hover:bg-surface-soft disabled:opacity-50",
        destructive: "bg-error text-white hover:opacity-90 disabled:opacity-50",
      },
      size: {
        md: "h-12 px-6 text-base",
        sm: "h-9 px-4 text-sm",
        xs: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "sm" },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
