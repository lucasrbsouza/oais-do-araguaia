# ── Dependências ──────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ── Desenvolvimento (hot reload) ──────────────────────────────────
FROM node:22-alpine AS development
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
  && mkdir -p /app/uploads \
  && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]

# ── Build de produção ─────────────────────────────────────────────
# O seed é compilado à parte porque o `nest build` só olha para `src/`.
# Sem isso o seed em produção dependeria de ts-node, que o prune remove.
# A ordem importa: `nest build` limpa o dist antes de escrever.
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
  && npm run build \
  && npx tsc prisma/seed.ts \
       --outDir dist/prisma \
       --module nodenext \
       --moduleResolution nodenext \
       --target ES2023 \
       --esModuleInterop \
       --skipLibCheck \
  && npm prune --omit=dev

# ── Produção ──────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 3001
# `prisma` está em dependencies, então o CLI sobrevive ao prune e o npx
# resolve o binário local — sem baixar nada da internet a cada boot.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
