# Oaís do Araguaia — Gestão de Condomínio de Chalés

Aplicação web que substitui as planilhas de administração de um condomínio de 11 chalés:
reservas por final de semana (**Eventos**), compras com comprovantes, **rateio automático
de despesas**, pagamentos por chalé, relatórios e histórico completo.

## Regras de negócio principais

| Regra | Detalhe |
|---|---|
| Rateio comum | Proporcional ao peso dos hóspedes: **adulto (8+) = 1,0** · **criança (<8) = 0,5** |
| Bebidas alcoólicas | Divididas **apenas entre as pessoas marcadas como consumidoras** em cada reserva |
| Arredondamento | Centavos distribuídos pelo método do maior resto — a soma **sempre** fecha com o total |
| Evento encerrado | Rateio congelado; reservas e compras bloqueadas; reabertura somente por administrador (auditada) |
| Pagamento | Status derivado: Pendente → Parcial → Pago |

## Stack

- **Backend**: NestJS · TypeScript · Prisma · PostgreSQL · Redis — Clean Architecture por módulo
- **Frontend**: Next.js (App Router) · TailwindCSS · TanStack Query · React Hook Form · Zod · Zustand
- **Infra**: Docker Compose (dev e prod) · Nginx (prod)

## Como executar

Pré-requisito: Docker + Docker Compose.

```bash
cp .env.example .env      # ajuste os segredos (JWT_SECRET, senhas)
docker compose up -d      # sobe postgres, redis, backend, frontend e adminer
docker compose exec backend npx prisma db seed   # admin + 11 chalés
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3100 |
| API | http://localhost:3101/api |
| Swagger | http://localhost:3101/api/docs |
| Health check | http://localhost:3101/health |
| Adminer | http://localhost:8081 |

Login inicial (defina em `.env` antes do seed): `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(padrão `admin@oaisdoaraguaia.com.br` / `Admin@123` — **troque em produção**).

Comandos úteis:

```bash
docker compose logs -f                                  # logs
docker compose exec backend npm run prisma:migrate      # nova migration (dev)
docker compose down                                     # derruba o ambiente
```

### Desenvolvimento sem Docker (opcional)

```bash
docker compose up -d postgres redis
cd backend && npm install && npx prisma migrate dev && npx prisma db seed && npm run start:dev
cd frontend && npm install && npm run dev
```

## Testes

```bash
cd backend
npm test          # unitários (domínio e casos de uso)
npm run test:cov  # cobertura
npm run test:e2e  # fluxo completo — requer postgres/redis de dev ativos e seed aplicado
```

Os testes de domínio cobrem os casos críticos do rateio: arredondamento com soma exata,
chalés sem consumidores de álcool, eventos sem compras e validações de bloqueio.

## Estrutura de pastas

```
├── docker-compose.yml        # ambiente de desenvolvimento
├── docker-compose.prod.yml   # produção (nginx + builds otimizados)
├── nginx/                    # reverse proxy (HTTPS, gzip, cache)
├── docs/                     # arquitetura e decisões
├── backend/
│   ├── prisma/               # schema, migrations, seed
│   └── src/
│       ├── shared/           # kernel: Money, erros de domínio, Prisma, guards, filtros
│       └── modules/          # auth, users, chalets, events, reservations,
│                             # purchases, settlement (rateio), payments,
│                             # reports, dashboard, audit, health
└── frontend/
    └── src/
        ├── app/(auth)/login  # autenticação
        ├── app/(app)/        # dashboard, calendário, eventos, reservas, chalés, usuários
        ├── components/       # UI (design system em DESIGN.md)
        ├── lib/              # api client (refresh automático), tipos, formatação
        └── stores/           # sessão (zustand)
```

Cada módulo do backend segue Clean Architecture:
`domain/` (regras e contratos) → `application/` (casos de uso) →
`infrastructure/` (Prisma) → `presentation/` (controllers finos).
O cálculo do rateio usa **Strategy Pattern** (`ExpenseSharingStrategy`) e o value object
`Money` (centavos inteiros — nunca float).

## Segurança

- JWT de acesso (15 min) + refresh token rotativo em cookie httpOnly (com detecção de reuso)
- Senhas com **Argon2id**; RBAC (`ADMIN` / `OWNER`) com escopo por proprietário nos casos de uso
- Helmet + CSP, CORS configurável, rate limiting (login: 5/min), validação e sanitização de todas as entradas
- Auditoria de todas as mutações (usuário, ação, data, IP) — sem corpo de requisição nos logs
- Logs estruturados (pino) com correlation id; segredos apenas via variáveis de ambiente

## Protótipo para o cliente (GitHub Pages)

Demo clicável em **https://lucasrbsouza.github.io/oais-do-araguaia/** — frontend
estático com backend **simulado no navegador** (dados fictícios no localStorage,
mesma regra de rateio). Logins: `admin@demo.com` / `demo1234` e
`dono@demo.com` / `demo1234`. Não é o deploy oficial.

Para republicar o protótipo após mudanças:

```bash
cd frontend
NEXT_PUBLIC_DEMO=1 NEXT_PUBLIC_BASE_PATH=/oais-do-araguaia npm run build
cd out && touch .nojekyll && git init -b gh-pages && git add -A \
  && git commit -m "deploy: protótipo" \
  && git push -f https://github.com/lucasrbsouza/oais-do-araguaia.git gh-pages \
  && rm -rf .git
```

(Automação via Actions está pronta em `.github/workflows-disabled/deploy-pages.yml`;
para ativá-la, rode `gh auth refresh -s workflow` e mova o arquivo para
`.github/workflows/`.)

## Deploy em produção

```bash
cp .env.example .env               # segredos fortes + NODE_ENV=production
# coloque os certificados TLS em nginx/certs/ (fullchain.pem e privkey.pem)
docker compose -f docker-compose.prod.yml up -d --build
```

O Nginx faz HTTPS, gzip, cache de assets e proxy para frontend/backend na rede interna.
As migrations rodam automaticamente no start do backend (`prisma migrate deploy`).

## Documentação

- `docs/ARCHITECTURE.md` — arquitetura, modelagem e decisões
- Swagger em `/api/docs` — contrato completo da API
- `DESIGN.md` — design system do frontend
