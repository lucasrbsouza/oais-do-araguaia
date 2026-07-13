import { cn } from "@/lib/utils";

/**
 * Tabela normal a partir de 1280px; abaixo disso cada linha vira um cartão
 * (regras de `data-stacked` em globals.css). Passe `label` em cada <Td> — é o
 * rótulo que aparece ao lado do valor no cartão. Célula sem `label` ocupa a
 * largura toda do cartão, que é o que queremos na coluna de ações.
 */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="xl:overflow-x-auto xl:rounded-md xl:border xl:border-hairline">
      <table data-stacked className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-hairline bg-surface-soft px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted",
        className,
      )}
      {...props}
    />
  );
}

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Rótulo do campo no cartão do celular/tablet. Omita na coluna de ações. */
  label?: string;
}

export function Td({ label, className, ...props }: TdProps) {
  return (
    <td
      data-label={label}
      className={cn("border-b border-hairline-soft px-4 py-3 text-body", className)}
      {...props}
    />
  );
}
