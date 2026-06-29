# DSS-Grupo-2 · Backend (NestJS)

## Descripción

Backend de **NeuroAlert** (plataforma de detección temprana del TEA), construido con
NestJS + Prisma + PostgreSQL. Esta rama `main` contiene el backend que se despliega en
**Render** vía Docker, con pipeline CI/CD automatizado en GitHub Actions.

> El frontend (Next.js) vive en el repositorio `DSS-Grupo-2-Frontend`. El código de
> desarrollo del monorepo (backend + frontend + infra) está en la rama `develop`.

---

## Tecnologías

- Node.js 20 · NestJS 11 · TypeScript
- Prisma ORM · PostgreSQL 16
- Docker (multi-stage) · GitHub Actions · Render
- Jest (tests) · OWASP ZAP (DAST) · CodeQL (SAST)

---

## Pipeline CI/CD (`.github/workflows/ci.yml`)

Flujo en cada push a `main`:

1. **test** — instala dependencias, aplica migraciones a una BD de prueba, corre los
   tests (Jest) con cobertura (subida a Codecov) y un análisis de dependencias (`npm audit`).
2. **codeql** — análisis estático de seguridad (SAST) sobre TypeScript y los workflows.
3. **deploy-dev** — dispara el deploy a Desarrollo en Render (deploy hook).
4. **smoke-test** — verifica que `…/health` responda 200 tras el deploy.
5. **dast** — escaneo dinámico OWASP ZAP contra el ambiente de Desarrollo.
6. **security-gate** — evalúa el reporte de ZAP (bloquea si hay HIGH / XSS / SQLi / CSRF).
7. **deploy-prod** — si todo lo anterior pasa, dispara el deploy a Producción.

---

## Variables de entorno

Ver `.env.example` (en la rama `develop`). En Render se configuran como variables del
servicio: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`,
`FRONTEND_URL`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `NODE_ENV`. El backend funciona solo
con PostgreSQL (Redis es opcional — usa un almacén en memoria si no está configurado).

## Ejecutar local

El stack completo (con Docker Compose) está en la rama `develop`, carpeta `infra/`.
