# NeuroAlert · Backend (API)

API de **NeuroAlert**, plataforma para la **detección temprana de señales del
Trastorno del Espectro Autista (TEA)** en niños, que conecta a las familias con
especialistas médicos. Construido con **NestJS + Prisma + PostgreSQL** y
desplegado en **Render** vía Docker, con pipeline **CI/CD** en GitHub Actions.

> **Rama `main` = fuente de verdad.** Este repositorio contiene únicamente el
> backend (movido a la raíz). El frontend (Next.js) vive en el repositorio
> `DSS-Grupo-2-Frontend`. La antigua rama `develop` (monorepo backend + frontend
> + infra) quedó **obsoleta** y no se utiliza.

---

## Tecnologías

- **Node.js 20** · **NestJS 11** · TypeScript
- **Prisma ORM** · **PostgreSQL**
- Autenticación: **JWT (access + refresh)** con Passport · **bcryptjs** · cookies HttpOnly
- Seguridad: **Helmet** (CSP, HSTS) · CORS · **@nestjs/throttler** · `ValidationPipe` global
- Observabilidad: logging estructurado con **Pino**
- Correo: **Brevo** (API HTTP en producción) · Nodemailer/Resend (fallback)
- Documentación de API: **Swagger / OpenAPI** (solo en desarrollo)
- Docker (multi-stage) · GitHub Actions · Render
- Testing: **Jest** · **ts-jest** · **Supertest** · **jest-mock-extended** (unit + integración con Prisma mockeado)
- Calidad/seguridad CI: **type-check + lint** · **Coverage Gate 85%** · **CodeQL** (SAST) · **OWASP ZAP** (DAST) · **Trivy + SBOM**

---

## Estructura del proyecto

```
src/
  auth/            Registro, login, JWT, refresh, sesiones, guards, estrategias
  users/           Perfil, gestión admin, ciclo de vida de cuentas, bajas
  applications/    Postulación de especialistas (sin cuenta hasta aprobar)
  mchat/           Cuestionario M-CHAT-R (scoring en servidor)
  questions/       Consultas padre → especialista y respuestas
  content/         Artículos educativos con moderación
  notifications/   Notificaciones in-app (polling)
  storage/         Archivos guardados en PostgreSQL (bytea)
  audit/           Bitácora de auditoría (append-only)
  mail/            Envío de correos (Brevo / SMTP / Resend)
  health/          Health check
  prisma/          PrismaService (+ contexto de usuario para RLS)
  config/          RedisService (opcional; degrada a memoria)
  common/          Decorators, filtros, interceptores transversales
  main.ts          Entrypoint: defensas globales (Helmet, CORS, pipes, etc.)
tests/             Pruebas (carpeta HERMANA de src/, ver "Testing")
  unit/            Unidades aisladas (Prisma/Mail/Redis mockeados)
  integration/     Nest testing + Supertest, Prisma mockeado (sin DB real)
  e2e/             Reservado (app real + Postgres + migraciones)
  mocks/ fixtures/ helpers/ setup/   Utilidades de test reutilizables
prisma/
  schema.prisma    Modelo de datos (14 modelos)
  migrations/      Migraciones (incluye políticas RLS)
  seed.ts          Datos de demo para desarrollo
docs/              Documentación de seguridad (RLS, dependencias)
```

---

## API (resumen)

Todos los endpoints cuelgan de **`/api`** (salvo `/health`). Autenticación por
JWT (guard global). Grupos principales:

| Recurso | Rutas |
|---|---|
| `auth` | register, login, refresh, logout, verify-email, forgot/reset-password, activate-specialist, change-password, sessions |
| `users` | perfil (`me`), gestión admin, verificación de especialistas, ciclo de vida (bajas/eliminación) |
| `applications` | postulación de especialista + aprobación/rechazo (admin) |
| `mchat` | preguntas, envío del cuestionario, historial |
| `questions` | crear/listar consultas, tomar, responder, cerrar |
| `content` | artículos: crear, enviar a revisión, publicar (admin) |
| `notifications` | listar, contador de no leídas, marcar leídas |
| `storage` | subida y descarga de archivos (token firmado) |
| `audit` | consulta de auditoría (admin) |

La documentación interactiva (Swagger) está disponible en **`/api/docs`** cuando
`NODE_ENV` ≠ `production`.

---

## Puesta en marcha (local)

Requisitos: Node.js 20 y una base de datos PostgreSQL accesible.

```bash
npm install                 # instalar dependencias
cp .env.example .env        # copiar plantilla y rellenar valores (ver abajo)
npm run prisma:generate     # generar el cliente de Prisma
npm run prisma:migrate      # aplicar migraciones (crea el esquema)
npm run prisma:seed         # (opcional) poblar con datos de demo
npm run start:dev           # API en modo desarrollo (watch)
```

### Variables de entorno

Todas las variables que el backend lee están documentadas en
[`.env.example`](./.env.example). Las imprescindibles para arrancar son
`DATABASE_URL`, `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`; el resto tiene valor
por defecto o habilita funcionalidades concretas (correo, Redis, cron de bajas).
**Nunca** subas tu `.env` (está en `.gitignore`).

### Base de datos (Prisma)

- El esquema vive en `prisma/schema.prisma`; los cambios se aplican con
  **migraciones** (`npm run prisma:migrate`).
- Algunas tablas usan **Row-Level Security**; antes de tocar políticas, lee
  [`docs/SECURITY-RLS.md`](./docs/SECURITY-RLS.md).
- El seed crea usuarios de demo para desarrollo (ver `prisma/seed.ts`).

---

## Scripts útiles

| Script | Descripción |
|---|---|
| `npm run start:dev` | API en desarrollo (watch) |
| `npm run build` / `npm run start:prod` | Compilar y ejecutar en producción |
| `npm run lint` · `npm run type-check` · `npm run format` | Calidad de código |
| `npm test` · `npm run test:unit` · `npm run test:integration` | Pruebas (Jest): todas / unit / integración |
| `npm run test:coverage` | Cobertura + Coverage Gate 85% (falla si no se cumple) |
| `npm run prisma:generate` · `prisma:migrate` · `prisma:studio` · `prisma:seed` | Prisma / BD |
| `npm run audit` | Auditoría de dependencias (`npm audit`) |

---

## Testing

Las pruebas viven en **`tests/`** (carpeta **hermana** de `src/`, no anidada),
siguiendo la pirámide de testing:

- **`tests/unit/`** — unidades aisladas (services, guards, strategy, pipes,
  interceptores, filtro, decoradores, scoring del M-CHAT, `RedisService`…), con
  **Prisma, Mail y Redis mockeados** (`jest-mock-extended`). Sin DB ni HTTP.
- **`tests/integration/`** — la app NestJS **real** con los mismos globales que
  `main.ts` (ValidationPipe, ClassSerializerInterceptor, guard global, filtro),
  ejercitada con **Supertest** y **Prisma mockeado** (sin base de datos real).
  Es el equivalente del enfoque MSW del frontend: se mockea la frontera (Prisma).
- **`tests/e2e/`** — **reservado** (app completa + **Postgres real** + migraciones,
  donde vive RLS). Ver [`tests/e2e/README.md`](./tests/e2e/README.md).

**Coverage Gate:** `npm run test:coverage` aplica el umbral del **85% en las 4
métricas** (statements/branches/functions/lines) sobre la suite **combinada**
(`coverageThreshold` de Jest → **falla** si no se cumple). La configuración de
Jest está en [`jest.config.js`](./jest.config.js); el entorno de test en
`tests/setup/`.

```bash
npm run test:unit          # solo unit
npm run test:integration   # solo integración
npm run test:coverage      # combinada + gate 85%
```

Las exclusiones de cobertura son mínimas y justificadas (glue sin lógica):
`*.module.ts`, `main.ts` y `*.d.ts`. **No** se excluyen DTOs con `@Transform`,
los decoradores, el scoring ni `redis.service.ts` (tienen comportamiento propio).

## CI/CD (`.github/workflows/ci.yml`)

En cada `push`/`pull_request` a `main`:

1. **quality** — `type-check` (tsc) + `lint` (ESLint).
2. **unit-tests ∥ integration-tests** — jobs **separados y en paralelo**; publican
   su resumen (suites/tests/duración) en `$GITHUB_STEP_SUMMARY`. Ninguno necesita
   Postgres (la integración mockea Prisma).
3. **coverage-gate** — corre la suite **combinada** con cobertura y aplica el
   **85% en las 4 métricas** (falla el job si no se cumple). Publica un **reporte
   multivista** (global, por tipo con huella + % Total, *patch coverage*, focos,
   distribución, detalle por archivo, glosario). **Sin Codecov.**
4. **codeql** (SAST) ∥ **supply-chain** (Trivy + SBOM) ∥ **dependency-scan**
   (`npm audit --omit=dev`) — en paralelo.
5. **build** — compila (`nest build`).
6. **deploy-dev → smoke-test → (🔒 e2e reservado) → dast (ZAP) → security-gate →
   deploy-prod** — cadena de despliegue a Render (dev→prod). El **security-gate**
   bloquea el deploy si ZAP reporta HIGH o vulnerabilidades de la lista crítica
   (SQLi/XSS/CSRF).

Además, un workflow **programado** (`lifecycle-cron.yml`) invoca a diario el
endpoint que procesa las bajas de cuentas vencidas (inerte si no está configurado).

### Despliegue (Render)

- **Desarrollo:** `https://miapp-dev.onrender.com`
- **Producción:** `https://miapp-6ex5.onrender.com`

Ambos ambientes se despliegan desde `main` mediante *deploy hooks*.

---

## Flujo de trabajo (ramas)

La rama `main` está **protegida**. No se hace commit ni push directo a `main`.

1. Partir de `main` actualizada (`git pull`).
2. Crear una rama con nombre descriptivo (`feat/…`, `fix/…`, `chore/…`, `docs/…`).
3. Hacer los cambios y validarlos (`type-check`, `lint`, `test`).
4. `push` de la rama y abrir un **Pull Request** hacia `main`.
5. La revisión y el *merge* los realiza otra persona (no se aprueba el propio PR).

Al mergear, la rama se elimina para mantener el repositorio limpio.

---

## Seguridad

- No se comitean secretos ni archivos `.env`.
- No se modifican las reglas de protección de ramas ni la configuración de seguridad.
- Documentación de seguridad: [`docs/SECURITY-RLS.md`](./docs/SECURITY-RLS.md) y
  [`docs/SECURITY-DEPENDENCIES.md`](./docs/SECURITY-DEPENDENCIES.md).
