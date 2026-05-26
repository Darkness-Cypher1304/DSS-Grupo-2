# 🏛️ NeuroAlert · Arquitectura Técnica

> Documento de diseño de alto nivel. Para detalles de seguridad, ver [`SECURITY.md`](./SECURITY.md). Para correr el proyecto, ver [`SETUP.md`](./SETUP.md).

---

## Visión general

NeuroAlert es una **plataforma web full-stack** organizada como **monorepo** con dos aplicaciones independientes (`backend` y `frontend`) y una capa de infraestructura compartida (`infra`).

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USUARIO (navegador)                         │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │  HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NGINX (gateway, puerto 80)                      │
│  · Headers de seguridad OWASP                                        │
│  · Rate limiting                                                     │
│  · Reverse proxy                                                     │
└─────┬───────────────────────────────────────────────┬───────────────┘
      │ /                                             │ /api/
      ▼                                               ▼
┌──────────────────┐                          ┌──────────────────────┐
│   NEXT.JS 15     │                          │   NESTJS 11          │
│   (puerto 3000)  │                          │   (puerto 4000)      │
│                  │                          │                      │
│  · App Router    │                          │  · REST API          │
│  · React 19      │       fetch / axios      │  · JWT auth          │
│  · Tailwind      │ ─────────────────────────►  · Guards globales   │
│  · TanStack Q.   │                          │  · ValidationPipe    │
└──────────────────┘                          └──────┬───────────────┘
                                                     │
                          ┌──────────────────────────┼─────────────────┐
                          ▼                          ▼                 ▼
                  ┌───────────────┐         ┌───────────────┐ ┌──────────────┐
                  │ POSTGRESQL 16 │         │   REDIS 7     │ │   MINIO      │
                  │  (puerto 5432)│         │  (puerto 6379)│ │ (puerto 9000)│
                  │               │         │               │ │              │
                  │ · RLS policies│         │ · JWT denylist│ │ · Presigned  │
                  │ · Migrations  │         │ · Rate limit  │ │   URLs       │
                  │ · Audit log   │         │ · Mail tokens │ │ · Magic bytes│
                  └───────────────┘         └───────────────┘ └──────────────┘
```

Todo orquestado con **Docker Compose** en una red privada bridge.

---

## Stack tecnológico

### Backend

| Componente | Decisión | Por qué |
|---|---|---|
| Lenguaje | **TypeScript estricto** | Type safety, autocomplete, refactor seguro |
| Framework | **NestJS 11** | Arquitectura modular, DI, decoradores, ecosistema maduro |
| ORM | **Prisma 5** | Schema declarativo, type-safe queries, migraciones automáticas |
| BD | **PostgreSQL 16** | RLS nativo, JSON binario, ACID, robusto |
| Cache | **Redis 7** | JWT denylist, rate limit, tokens efímeros |
| Auth | **Passport + JWT** | Stateless, refresh con rotación, cookies HttpOnly |
| Storage | **MinIO** | S3-compatible, on-premise, gratis |
| Email | **Resend** | API moderna, free tier 3k correos/mes, fallback a consola |
| Logger | **Pino** | Logging estructurado JSON, alto rendimiento |
| Validación | **class-validator + zod** | DTOs declarativos, errores claros |

### Frontend

| Componente | Decisión | Por qué |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | SSR, RSC, optimizado para SEO |
| UI | **React 19** | Última versión, Server Actions |
| Estilos | **Tailwind CSS 3** | Utility-first, paleta personalizada |
| Forms | **react-hook-form + zod** | Performance, validación schema-driven |
| Server state | **TanStack Query** | Caché, refetch, mutations |
| HTTP | **axios** | Interceptores para refresh automático |
| Iconos | **lucide-react** | Set consistente, ligero |
| Markdown | **react-markdown** | Render seguro de contenido |
| Tipografía | **Fraunces + Geist** | Display serif editorial + sans moderno |

### Infraestructura

| Componente | Decisión |
|---|---|
| Containers | **Docker Compose** (dev) |
| Gateway | **Nginx hardened** |
| CI/CD | **GitHub Actions** (lint, test, audit, SBOM, Trivy scan) |
| Observabilidad | Pino logs estructurados (preparado para Loki/Grafana) |

---

## Modelo de datos

```
User ──┬─< MchatScreening
       ├─< Question (author) >── Answer (specialist)
       ├─< Question (assignedTo)
       ├─< Content (author)
       ├─< RefreshToken
       ├─< AuditLog
       └─< SpecialistProfile (1:1 opcional)

Content (DRAFT → PENDING → PUBLISHED → ARCHIVED)
SpecialistProfile (PENDING → APPROVED / REJECTED)
```

### Entidades principales

| Tabla | Propósito | RLS |
|---|---|---|
| `users` | Cuentas (PARENT, SPECIALIST, ADMIN) | No (gestionada por roles + queries explícitas) |
| `specialist_profiles` | Datos clínicos verificables (colegiatura, especialidad) | No |
| `mchat_screenings` | Resultados de cuestionarios | **Sí** — solo el padre dueño |
| `questions` | Consultas de padres a especialistas | **Sí** — autor, asignado, admin |
| `answers` | Respuestas de especialistas | **Sí** — visibilidad ligada a question |
| `contents` | Artículos educativos | **Sí** — drafts privados, publicados públicos |
| `resources` | PDFs descargables (vía MinIO) | No |
| `refresh_tokens` | Tokens de sesión persistentes | **Sí** — solo el dueño |
| `failed_login_attempts` | Anti-bruteforce | No |
| `audit_logs` | Trazabilidad de acciones | **INSERT-ONLY** vía RLS |

---

## Flujos clave

### 1. Cuestionario M-CHAT-R

```
┌──────────────┐                ┌────────────────┐                ┌──────────────┐
│   FRONTEND   │   GET /mchat   │    BACKEND     │                │ POSTGRES     │
│              │   /questions   │                │                │              │
│   1. Pide    │ ─────────────► │ 2. Devuelve 20 │                │              │
│   preguntas  │                │ preguntas SIN  │                │              │
│              │                │ expectedAnswer │                │              │
│              │                │                │                │              │
│ 3. Usuario   │                │                │                │              │
│ responde     │                │                │                │              │
│              │                │                │                │              │
│ 4. Submit    │  POST /mchat   │                │                │              │
│ {responses}  │ ─────────────► │ 5. Calcula     │                │              │
│              │                │ riskLevel      │                │              │
│              │                │ SERVER-SIDE    │                │              │
│              │                │                │  SET LOCAL     │              │
│              │                │ 6. Persiste    │  app.user_id   │              │
│              │                │ con RLS        │ ─────────────► │ 7. RLS valida│
│              │                │                │                │ y guarda     │
│              │                │ 8. Devuelve    │                │              │
│              │ ◄───────────── │ resultado +    │                │              │
│              │                │ recomendacion  │                │              │
└──────────────┘                └────────────────┘                └──────────────┘
```

**Punto crítico:** el cliente nunca conoce el algoritmo de scoring. Aunque inspeccione el JS o intercepte el tráfico, no puede manipular el resultado.

### 2. Refresh token rotation con detección de reuso

```
1. Login → emite (accessToken, refreshToken_v1)
   refreshToken_v1 se guarda en BD con tokenFamily=F1

2. Cliente usa refreshToken_v1 para renovar
   → backend invalida v1, emite refreshToken_v2 (mismo tokenFamily F1)

3. Si alguien intenta usar refreshToken_v1 OTRA VEZ:
   → backend detecta reuso
   → invalida TODA la familia F1
   → todos los devices de ese usuario son deslogueados
   → posible robo de token detectado
```

### 3. Verificación de archivos

```
1. Cliente solicita presigned URL
2. Backend genera URL TTL=15 min
3. Cliente sube directo a MinIO (no pasa por backend)
4. Cliente notifica al backend "subí esto"
5. Backend descarga primeros 16 bytes de MinIO
6. Compara magic bytes contra el mimeType declarado
7. Si NO coincide:
   - Elimina el archivo
   - Devuelve 400 Bad Request
8. Si coincide:
   - Calcula SHA-256 completo
   - Persiste el registro con hash
```

---

## Decisiones notables

### Por qué monorepo
- Un solo `git clone` levanta todo.
- Tipos compartibles (en futuro `packages/shared`).
- Versionado conjunto frontend ↔ backend.

### Por qué RLS en lugar de filtrar solo en código
- **Defensa en profundidad.** Aunque haya un bug en el servicio (ej: olvidar `where: { userId }`), la BD bloquea el acceso.
- Auditable: las políticas son explícitas en SQL.
- Performance: PostgreSQL aplica el filtro en el plan de ejecución.

### Por qué refresh tokens en cookies y access en memoria
- Cookies HttpOnly resisten XSS (JS no puede leerlas).
- Tokens en memoria mueren al cerrar pestaña → menos persistencia de credenciales.
- Refresh va en cookie con `path=/api/auth` → no se envía en cada request.

### Por qué Resend con fallback a consola
- En desarrollo local, no necesitas API key — los correos salen en stdout.
- En producción, Resend free tier basta para el volumen estudiantil.
- Si Resend cae, el fallback evita romper el registro.

### Por qué Pino en lugar de console.log
- 5x más rápido que console.log.
- JSON estructurado → ingestable por Loki/CloudWatch/Datadog.
- Niveles de severidad estandarizados.

---

## Roadmap (post-MVP)

- [ ] Tests E2E con Playwright
- [ ] Suite completa de tests unitarios (>70% cobertura)
- [ ] Internacionalización (quechua, aymara)
- [ ] App móvil con React Native
- [ ] Notificaciones push para especialistas
- [ ] Dashboard analítico para admin (métricas de uso)
- [ ] Integración con MINSA/CONADIS
- [ ] Modo offline para zonas con baja conectividad
- [ ] Encrypted at rest (pgcrypto column-level)

---

## Glosario

| Término | Significado |
|---|---|
| **TEA** | Trastorno del Espectro Autista |
| **M-CHAT-R** | Modified Checklist for Autism in Toddlers, Revised |
| **RLS** | Row-Level Security — políticas de fila en PostgreSQL |
| **DTO** | Data Transfer Object — clase con validaciones para input |
| **JWT** | JSON Web Token |
| **SBOM** | Software Bill of Materials — inventario de dependencias |
| **CVE** | Common Vulnerabilities and Exposures |
| **CMP** | Colegio Médico del Perú |
| **CPsP** | Colegio de Psicólogos del Perú |
