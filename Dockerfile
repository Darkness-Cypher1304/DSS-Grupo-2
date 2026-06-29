# ============================================================================
# NeuroAlert · Backend · Dockerfile PRODUCCIÓN (multi-stage)
# ============================================================================
# Stage 1: builder — instala deps y compila TypeScript
# Stage 2: runner  — imagen mínima solo con lo necesario para correr
# ============================================================================

# --------------------------------------------------------------------------
# STAGE 1: Builder
# --------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Dependencias del sistema para Prisma + bcrypt
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copiar solo lo necesario para instalar (mejor cache de capas)
COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODAS las dependencias (incluidas devDependencies para compilar)
RUN npm ci

# Generar Prisma Client
RUN npx prisma generate

# Copiar fuente y compilar
COPY . .
RUN npm run build


# --------------------------------------------------------------------------
# STAGE 2: Runner — imagen mínima
# --------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Usuario sin privilegios (principio de mínimo privilegio)
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

# Copiar solo artefactos necesarios del builder
COPY --from=builder --chown=nestjs:nodejs /app/dist        ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma      ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/docker-entrypoint.sh ./

USER nestjs

EXPOSE 4000

# Migraciones (con manejo de P3005) + seed idempotente + arranque.
# La lógica vive en docker-entrypoint.sh (legible y mantenible).
CMD ["sh", "./docker-entrypoint.sh"]
