# Arquitetura — Oásis do Araguaia

## Visão geral

Monorepo com dois aplicativos independentes orquestrados por Docker Compose:

```
Next.js (frontend) ──HTTP──▶ NestJS (backend) ──▶ PostgreSQL
                                   │
                                   └──▶ Redis (health/cache/futuras filas)
```

Em produção, o Nginx é a única porta de entrada (HTTPS, gzip, cache de assets) e faz
proxy para os dois serviços na rede interna do Docker.

## Backend — Clean Architecture

Cada módulo em `backend/src/modules/<nome>/` tem quatro camadas, com dependências
apontando sempre para dentro:

```
presentation/    controllers finos + DTOs (class-validator) — sem regra de negócio
application/     casos de uso (um por operação) + mappers
domain/          entidades, value objects, estratégias, contratos de repositório
infrastructure/  implementações Prisma dos repositórios, storage de arquivos
```

A injeção de dependência usa classes abstratas como tokens
(`{ provide: UserRepository, useClass: PrismaUserRepository }`), o que mantém o domínio
sem referência ao Prisma e permite fakes em memória nos testes.

Consultas de leitura (relatórios, dashboard) usam *query services* diretos no Prisma —
CQRS-light: mutações passam pelo domínio; leituras agregadas não precisam dele.

### Rateio (módulo `settlement`)

Coração do sistema. Regras isoladas no domínio:

- `Money` (shared kernel): valores em **centavos inteiros**; `allocateByWeights` divide
  proporcionalmente pelo **método do maior resto** — a soma das partes fecha exatamente
  com o total (propriedade coberta por testes).
- `ExpenseSharingStrategy` (Strategy Pattern): contrato para regras de rateio.
  A implementação padrão `WeightedExpenseSharingStrategy`:
  - despesas comuns → peso `adultos × 10 + crianças × 5` (base 10 evita float);
  - bebidas alcoólicas → divididas igualmente entre `alcoholConsumers` das reservas.
- Recalculável enquanto o evento está aberto; congelado no fechamento
  (`CloseEventUseCase` roda o cálculo e persiste na mesma transação).

### Ciclo de vida do evento

```
OPEN ──(admin fecha: calcula + congela rateio)──▶ CLOSED
  ▲                                                  │
  └────────(admin reabre: auditado)──────────────────┘
```

Invariantes garantidas nos casos de uso: 1 reserva ativa por chalé por evento
(+ unique no banco), estadia dentro do período do evento, compras/reservas só com
evento aberto, eventos não se sobrepõem.

## Modelagem do banco

Tabelas: `users`, `refresh_tokens`, `chalets`, `events`, `reservations`, `purchases`,
`settlements`, `settlement_items`, `payments`, `audit_logs`.
Dinheiro em centavos (`Int`). Status de pagamento do chalé é **derivado**
(soma dos pagamentos × total do rateio), nunca coluna.

```
User 1─N Chalet · User 1─N Reservation (responsável)
Event 1─N Reservation N─1 Chalet
Event 1─N Purchase · Event 1─1 Settlement 1─N SettlementItem N─1 Chalet
Event 1─N Payment N─1 Chalet · User 1─N AuditLog · User 1─N RefreshToken
```

## Autenticação e autorização

- Access token JWT (15 min) no header; refresh token **opaco** (48 bytes aleatórios),
  armazenado como HMAC-SHA256 no banco, entregue em cookie httpOnly/sameSite=strict
  restrito a `/api/auth`. Rotação a cada refresh; reuso de token rotacionado revoga
  todas as sessões do usuário.
- RBAC: guards globais (`JwtAuthGuard` + `RolesGuard`) com decorators `@Public()` e
  `@Roles()`. O escopo de proprietário (OWNER só acessa o próprio chalé) é validado
  nos **casos de uso**, não nos guards.
- Auditoria: interceptor global grava toda mutação (usuário, rota, IP) em `audit_logs`;
  eventos críticos (fechar/reabrir) registram entradas explícitas. O corpo das
  requisições nunca é logado.

## Observabilidade

- Logs estruturados com `nestjs-pino`; `x-correlation-id` propagado e devolvido.
- Filtro global de exceções mapeia erros de domínio → HTTP
  (Validation→422, NotFound→404, Conflict→409, Forbidden→403, Unauthorized→401).
- `/health` verifica PostgreSQL e Redis; usado nos healthchecks do Compose.

## Frontend

- App Router com dois grupos: `(auth)` (login) e `(app)` (shell autenticado com sidebar).
- Sessão em Zustand (token em memória); ao carregar, tenta `POST /auth/refresh` via
  cookie. O api client renova o token automaticamente em 401 e repete a chamada.
- TanStack Query para dados de servidor; React Hook Form + Zod nos formulários.
- Design tokens do `DESIGN.md` aplicados via Tailwind v4 `@theme` (Rausch #ff385c,
  ink #222, hairlines, radius 8/14px, sombra única).
- UX: skeletons, empty states, mensagens de erro da API em pt-BR, confirmação para
  ações destrutivas (encerrar evento, excluir compra, cancelar reserva).

## Decisões registradas

| Decisão | Motivo |
|---|---|
| Prisma 6 (não 7) | v7 mudou config/adapters recentemente; v6 é estável e suficiente |
| Refresh token opaco em vez de JWT | Revogável por sessão, detecção de reuso, sem estado no cliente |
| Pesos em base 10 (10/5) | Elimina float no cálculo do rateio |
| Status de pagamento derivado | Uma fonte de verdade (pagamentos); impossível dessincronizar |
| `FileStorage` abstrato | Trocar disco local por S3 sem tocar nos casos de uso |
| Portas host 3100/3101/8081 | 3000/3001 já ocupadas na máquina de desenvolvimento |
