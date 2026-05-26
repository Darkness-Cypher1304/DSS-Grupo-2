# 🛡️ NeuroAlert · Documento de Seguridad

> Mapeo completo entre las **10 categorías de OWASP Top 10 (2025)** y las decisiones técnicas implementadas en NeuroAlert. Este documento es la referencia para la sustentación del eje de "implementación segura" en la rúbrica ABET.

---

## Filosofía de seguridad

NeuroAlert protege información sensible sobre menores de edad. Cada decisión técnica responde a tres principios:

1. **Defensa en profundidad** — múltiples capas, asumiendo que cualquiera puede fallar.
2. **Zero Trust** — el cliente nunca tiene la última palabra.
3. **Fail safe** — ante error, el sistema deniega; nunca permite por omisión.

---

## A01:2025 · Broken Access Control

**Riesgo:** un usuario accede a recursos que no le pertenecen.

**Implementación:**

- **Row-Level Security (RLS) en PostgreSQL** sobre las tablas críticas:
  - `mchat_screenings` — un padre solo ve sus propias evaluaciones
  - `questions` y `answers` — aislamiento entre familias
  - `audit_logs` — INSERT-ONLY (ni el desarrollador puede borrar evidencia)
  - `refresh_tokens` — solo el dueño puede consultarlos
  - `contents` — drafts privados; publicados visibles para todos

- **`runWithUserContext`** (`backend/src/prisma/prisma.service.ts`): cada query crítica ejecuta `SET LOCAL app.user_id` dentro de una transacción → activa las políticas RLS automáticamente. Si hubiera un bug en el código de aplicación, RLS lo bloquea a nivel de BD.

- **Guards en NestJS:**
  - `JwtAuthGuard` (global) — toda ruta requiere autenticación salvo `@Public()`
  - `RolesGuard` (global) — verifica `@Roles(UserRole.X)`
  - Anti mass-assignment: el `RegisterDto` **no acepta** el campo `role` (todos los registros públicos son siempre `PARENT`).

---

## A02:2025 · Cryptographic Failures

**Riesgo:** datos sensibles expuestos en tránsito o en reposo.

**Implementación:**

- **Contraseñas:** bcrypt con cost factor 12 (`backend/src/auth/auth.service.ts`).
- **Refresh tokens:** se almacenan **hasheados con SHA-256** en BD; el token plano nunca se persiste. Cada token tiene una `tokenFamily` para detectar reutilización.
- **JWT:** access tokens firmados con HS256, secret de **mínimo 32 bytes**, expiración de 15 min.
- **Cookies:**
  - `httpOnly: true` → JS no puede leerlas (defensa contra XSS)
  - `secure: true` en prod → solo HTTPS
  - `sameSite: 'strict'` → defensa contra CSRF
  - `signed: true` → protege contra tampering
- **Headers de seguridad** vía Helmet + Nginx: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

---

## A03:2025 · Injection

**Riesgo:** SQL injection, NoSQL injection, XSS.

**Implementación:**

- **Prisma ORM con queries parametrizadas** — nunca concatenamos SQL.
- **`class-validator`** valida todo input contra DTOs estrictos antes de llegar al servicio.
- **`ValidationPipe` global** con `whitelist: true, forbidNonWhitelisted: true` → cualquier campo no declarado se rechaza.
- **React** escapa contenido por defecto en JSX → defensa contra XSS reflejado.
- **`MailService.escapeHtml()`** sanea valores antes de inyectarlos en plantillas HTML de correo.

---

## A04:2025 · Insecure Design

**Riesgo:** falta de patrones seguros desde el diseño.

**Implementación:**

- **Modelo de roles explícito** (`PARENT | SPECIALIST | ADMIN`) con upgrade SOLO vía aprobación manual del admin.
- **Verificación de credenciales clínicas** — los especialistas envían colegiatura + especialidad y el admin valida en el CMP/CPsP antes de aprobar.
- **Flujo de contenido** `DRAFT → PENDING → PUBLISHED` con revisión humana obligatoria.
- **Cuestionario M-CHAT-R**: el cálculo del score se hace **siempre en el servidor**. El cliente envía las respuestas, el servidor decide el riesgo. El cliente no recibe las "respuestas esperadas" para que no pueda inferir el algoritmo.

---

## A05:2025 · Security Misconfiguration

**Riesgo:** configuraciones por defecto que abren superficie de ataque.

**Implementación:**

- **`X-Powered-By` deshabilitado** en Express y Next.js.
- **Modo `production`** activa optimizaciones y oculta stack traces.
- **Nginx** bloquea métodos HTTP no usados (`TRACE`, `OPTIONS` solo donde necesario), aplica rate limit por IP, y oculta su versión.
- **Docker:** contenedores corren con `security_opt: no-new-privileges`, en red privada bridge, con healthchecks.
- **Variables de entorno:** todas en `.env` (nunca commiteadas). El `.env.example` documenta cada una.

---

## A06:2025 · Vulnerable & Outdated Components

**Riesgo:** dependencias con CVEs conocidos.

**Implementación:**

- **`npm audit --audit-level=high`** corre en cada PR (`.github/workflows/ci.yml`).
- **Trivy** escanea filesystem y reporta al Security tab de GitHub (SARIF).
- **SBOM (CycloneDX)** generado automáticamente para backend y frontend.
- **Dependabot** se puede activar agregando `.github/dependabot.yml`.
- Versionado fijado en `package.json` con `^` para parches automáticos sin breaking changes.

---

## A07:2025 · Identification & Authentication Failures

**Riesgo:** brute force, credential stuffing, session hijacking.

**Implementación:**

- **Anti brute-force timing-safe:**
  - Contador de intentos fallidos por email en Redis con TTL.
  - Tras N intentos, la cuenta se bloquea por X minutos (configurable).
  - **Constant-time comparison**: aunque el email no exista, comparamos contra un hash dummy con el mismo costo computacional → previene user enumeration por timing.
- **Refresh token rotation con detección de reuso:**
  - Cada uso del refresh genera uno nuevo y revoca el anterior.
  - Si un token revocado se reutiliza, se invalida **toda la familia** → indica robo.
- **Política de contraseñas:** mínimo 12 caracteres, validada server y client-side.
- **Verificación de email** obligatoria antes de operaciones sensibles.

---

## A08:2025 · Software & Data Integrity Failures

**Riesgo:** archivos maliciosos subidos como avatar/recursos.

**Implementación:**

- **Validación de magic bytes** en `StorageService.validateUploadedFile()`:
  - El cliente declara el mimeType, pero el servidor lee los primeros 16 bytes y compara con la firma real (PDF empieza con `%PDF`, JPEG con `FFD8FF`, etc).
  - Si no coincide, el archivo se elimina inmediatamente.
- **SHA-256 hash** de cada archivo guardado → permite verificar integridad.
- **Lista blanca de mime types** (`PDF, JPEG, PNG, WebP`).
- **Sanitización de nombres** (sin tildes, sin caracteres especiales, máximo 100 chars).

---

## A09:2025 · Security Logging & Monitoring Failures

**Riesgo:** ataque sin rastro auditable.

**Implementación:**

- **Tabla `audit_logs` INSERT-ONLY** vía RLS — registra:
  - Logins exitosos y fallidos (con IP y user agent)
  - Cambios de rol y status
  - Verificaciones de especialistas
  - Publicación/eliminación de contenido
  - Submits de M-CHAT-R (sin las respuestas mismas, solo metadata)
- **Pino** para logging estructurado en JSON → fácil de ingerir en ELK/Loki.
- **`AllExceptionsFilter`** registra excepciones con request ID único; al cliente solo le devolvemos un mensaje genérico (no leak interno).

---

## A10:2025 · Server-Side Request Forgery (SSRF)

**Riesgo:** el servidor hace requests a URLs maliciosas controladas por el atacante.

**Implementación:**

- NeuroAlert no acepta URLs arbitrarias del cliente para fetch server-side.
- Las únicas requests salientes van a **Resend** (API key fija) y al usuario vía email.
- MinIO está en **red privada Docker**, sin exposición pública directa.
- En despliegue real, el outbound del backend se restringe vía firewall.

---

## Defensas adicionales

### Rate limiting (`@nestjs/throttler`)

| Endpoint | Límite |
|---|---|
| `POST /auth/login` | 10 / min / IP |
| `POST /auth/register` | 5 / min / IP |
| `POST /auth/forgot-password` | 3 / min / IP |
| `POST /auth/refresh` | 30 / min / IP |
| Resto | 60 / min / IP (por defecto) |

Adicionalmente, Nginx tiene su propia capa de rate limit.

### CSP (Content Security Policy)

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' fonts.googleapis.com;
font-src 'self' fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self' http://localhost:4000;
frame-ancestors 'none';
```

### CORS

Solo se permite el origen del frontend declarado en `FRONTEND_URL`. Wildcards prohibidos.

### Backups

Aunque no implementado en este MVP académico, el patrón recomendado para producción es:
- `pg_dump` diario con cifrado, retenido 30 días
- MinIO con bucket replication a un nodo secundario
- Recovery time objective (RTO) < 4 horas

---

## Cómo probar la seguridad

```bash
# Brute force
for i in {1..20}; do
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@neuroalert.pe","password":"wrong"}'
done
# → tras N intentos, recibirás 429 Too Many Requests

# Mass assignment
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"hacker@x.com","password":"Password2026!","fullName":"X","role":"ADMIN"}'
# → el campo role se ignora completamente; el usuario se crea como PARENT

# RLS — intentar leer evaluación de otro padre
# → devuelve null incluso si la query escapa al filtro de NestJS
```

---

> Cualquier vulnerabilidad encontrada se reporta a través de `github.com/<tu-usuario>/neuroalert/issues` con el tag `security`.
