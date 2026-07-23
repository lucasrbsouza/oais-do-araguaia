"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export interface NewCredentials {
  name: string;
  email: string;
  password: string;
}

const SITE_URL = "https://oasisaraguaia.com.br";

export function CredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: NewCredentials;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const message =
    `Olá, ${credentials.name}! Seu acesso ao sistema do condomínio Oásis do Araguaia está pronto.\n\n` +
    `Site: ${SITE_URL}\n` +
    `E-mail: ${credentials.email}\n` +
    `Senha provisória: ${credentials.password}\n\n` +
    "Ao entrar pela primeira vez, o sistema vai pedir para você criar uma nova senha.";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Alguns navegadores bloqueiam a Clipboard API fora de HTTPS ou gesto
    }
  }

  return (
    <Dialog open onClose={onClose} title="Usuário criado com sucesso">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-md bg-success/10 p-3 text-sm text-body">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          <p>
            Envie os dados de acesso abaixo para <strong>{credentials.name}</strong>.
            A senha é provisória: será trocada no primeiro acesso.
          </p>
        </div>

        <dl className="space-y-2">
          <CredentialRow label="Site" value={SITE_URL} />
          <CredentialRow label="E-mail" value={credentials.email} />
          <CredentialRow label="Senha provisória" value={credentials.password} />
        </dl>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Concluir
          </Button>
          <Button onClick={copy}>
            {copied ? (
              <>
                <Check className="size-4" aria-hidden /> Copiado!
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden /> Copiar informações
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-hairline bg-surface-soft px-3 py-2">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-sm text-ink">{value}</dd>
    </div>
  );
}
