import { cn } from "@/lib/utils";
import type { ChaletStatus, EventStatus, PaymentStatus } from "@/lib/types";
import {
  CHALET_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/types";

const tones = {
  neutral: "bg-surface-strong text-body",
  success: "bg-green-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-error",
} as const;

type Tone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone: Tone = status === "PAID" ? "success" : status === "PARTIAL" ? "warning" : "danger";
  return <Badge tone={tone}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function ChaletStatusBadge({ status }: { status: ChaletStatus }) {
  const tone: Tone = status === "FREE" ? "success" : status === "RESERVED" ? "warning" : "danger";
  return <Badge tone={tone}>{CHALET_STATUS_LABELS[status]}</Badge>;
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge tone={status === "OPEN" ? "success" : "neutral"}>
      {status === "OPEN" ? "Aberto" : "Encerrado"}
    </Badge>
  );
}
