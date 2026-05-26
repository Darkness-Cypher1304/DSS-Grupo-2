# ============================================================================
# NeuroAlert · Frontend · Dockerfile PRODUCCIÓN (multi-stage + standalone)
# ============================================================================
# Requiere next.config.js con: output: 'standalone'
# Stage 1: deps      — instala dependencias
# Stage 2: builder   — compila Next.js
# Stage 3: runner    — imagen mínima con el servidor standalone
# ============================================================================

# --------------------------------------------------------------------------
# STAGE 1: Dependencias
# --------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm ci

# --------------------------------------------------------------------------
# STAGE 2: Builder
# --------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# La URL del API se inyecta en build-time (NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_API_URL=https://neuroalert-backend-prod.onrender.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_APP_NAME=NeuroAlert
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# Deshabilitar telemetría de Next.js
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --------------------------------------------------------------------------
# STAGE 3: Runner
# --------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copiar artefactos del modo standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
