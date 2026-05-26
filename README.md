<div align="center">

# 🧠 NeuroAlert

### Plataforma de detección temprana del Trastorno del Espectro Autista para el Perú

*Curso de Desarrollo de Software Seguro — Universidad Peruana de Ciencias Aplicadas — Mayo 2026*

[![CI](https://img.shields.io/badge/CI-passing-2c6966?style=flat-square)](./.github/workflows/ci.yml)
[![Security](https://img.shields.io/badge/Security-OWASP%20Top%2010%202025-2c6966?style=flat-square)](./docs/SECURITY.md)
[![License](https://img.shields.io/badge/License-Academic-e35a3e?style=flat-square)](#)
[![Made in](https://img.shields.io/badge/Made%20in-Lima%20%F0%9F%87%B5%F0%9F%87%AA-e35a3e?style=flat-square)](#)

</div>

---

## El problema

> **El 97.4% de las personas con TEA en Perú no están diagnosticadas.**
> *La OMS estima 204,000 casos; el MINSA registra 5,328.*

La ventana crítica de intervención del TEA está entre los 18 meses y los 3 años. En el Perú, el diagnóstico promedio llega a los **5-6 años de edad** — cuando las intervenciones tempranas ya han perdido su mayor potencial. Las brechas se amplifican por género (sub-detección en niñas) y por desconocimiento docente.

NeuroAlert atiende este problema con **tres herramientas integradas**:

1. **M-CHAT-R completo** — el cuestionario de tamizaje validado internacionalmente (Robins, Fein & Barton, 2009), con cálculo de riesgo en el servidor y recomendaciones según nivel.
2. **Consultas con especialistas verificados** — pediatras y psicólogos con colegiatura validada por nuestro equipo, sin barrera económica.
3. **Contenido educativo curado** — artículos escritos por especialistas peruanos y revisados antes de publicarse.

---

## Stack

```
Backend:  TypeScript · NestJS 11 · Prisma · PostgreSQL 16 (RLS) · Redis · MinIO
Frontend: TypeScript · Next.js 15 · React 19 · TailwindCSS · TanStack Query
Infra:    Docker Compose · Nginx hardened · GitHub Actions · Trivy · CycloneDX
```

> Stack completamente **open source** y gratuito. Sin SaaS de pago. Corre en cualquier laptop.

---

## Documentación

| Documento | Para qué |
|---|---|
| 📖 [`docs/SETUP.md`](./docs/SETUP.md) | **Empieza aquí.** Guía paso a paso para correr el proyecto desde cero (asume Windows, sin nada instalado). |
| 🛡️ [`docs/SECURITY.md`](./docs/SECURITY.md) | Mapeo OWASP Top 10 (2025) ↔ implementaciones concretas. Para la sustentación. |
| 🏛️ [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Diagramas, modelo de datos, decisiones técnicas. |

---

## Quickstart (para impacientes)

```bash
# 1. Clonar
git clone https://github.com/<tu-usuario>/neuroalert.git
cd neuroalert

# 2. Configurar variables (copia .env.example → .env y rellena los SECRETs)
cp .env.example .env
# ...edita .env con tus secretos...

# 3. Levantar
docker compose -f infra/docker-compose.dev.yml up --build

# 4. Migrar y sembrar (en otra terminal)
docker compose -f infra/docker-compose.dev.yml exec backend npx prisma migrate deploy
docker compose -f infra/docker-compose.dev.yml exec backend npx prisma db seed

# 5. Abrir
# → http://localhost:3000
```

**Cuentas de prueba** (todas con contraseña `Password2026!`):
- Admin: `admin@neuroalert.pe`
- Especialista: `pediatra@neuroalert.pe`
- Padre: `padre@neuroalert.pe`

---

## Roles y capacidades

| Rol | Puede |
|---|---|
| **PARENT** (padre/cuidador) | Tomar M-CHAT-R, ver historial, hacer consultas, leer artículos, descargar recursos |
| **SPECIALIST** (pediatra/psicólogo verificado) | Bandeja de consultas, responder, escribir artículos (sujetos a aprobación) |
| **ADMIN** | Verificar especialistas, aprobar/rechazar contenido, gestionar usuarios, ver audit logs |

El upgrade de PARENT → SPECIALIST requiere validación manual de colegiatura por parte del admin.

---

## Estructura del repositorio

```
neuroalert/
├── backend/                     NestJS API
│   ├── src/
│   │   ├── auth/                JWT, refresh rotation, anti-bruteforce
│   │   ├── mchat/               El cuestionario M-CHAT-R con scoring server-side
│   │   ├── content/             Artículos educativos (DRAFT → PENDING → PUBLISHED)
│   │   ├── questions/           Consultas padre→especialista (con RLS)
│   │   ├── users/               Perfiles + verificación de especialistas
│   │   ├── storage/             MinIO con validación de magic bytes
│   │   ├── audit/               Log INSERT-only para trazabilidad
│   │   ├── mail/                Resend con fallback a consola
│   │   └── prisma/              Servicio con runWithUserContext para RLS
│   └── prisma/
│       ├── schema.prisma        Modelo de datos completo
│       ├── migrations/          Incluye políticas RLS
│       └── seed.ts              Datos de ejemplo
│
├── frontend/                    Next.js App Router
│   └── src/app/
│       ├── (auth)/              Login, registro
│       ├── (parent)/            Dashboard padres + M-CHAT-R + consultas
│       ├── (specialist)/        Bandeja consultas + gestión de contenido
│       ├── (admin)/             Verificación + revisión editorial
│       └── articles/            Artículos públicos
│
├── infra/                       Docker, Nginx, init SQL
├── .github/workflows/           CI (test, audit, SBOM, Trivy) + Deploy
└── docs/                        SETUP · SECURITY · ARCHITECTURE
```

---

## Seguridad — destacados técnicos

NeuroAlert implementa defensas concretas para los 10 ítems de OWASP Top 10 (2025). Algunos destacados:

- **Row-Level Security en PostgreSQL** — el aislamiento entre usuarios se garantiza a nivel de base de datos, no solo de aplicación. Aunque haya un bug en el código, la BD bloquea accesos cruzados.
- **Refresh token rotation con detección de reuso** — si un token revocado se reutiliza, se invalida toda la familia (señal de robo).
- **Anti-bruteforce timing-safe** — comparación constant-time aunque el email no exista, previene user enumeration por timing attacks.
- **Validación de magic bytes en uploads** — el servidor verifica los primeros bytes del archivo, no confía en el mimeType del cliente.
- **M-CHAT-R server-side** — el cliente nunca conoce el algoritmo de scoring, solo recibe el resultado.
- **Audit log INSERT-only por RLS** — ni el desarrollador puede borrar evidencia.

Detalles completos en [`docs/SECURITY.md`](./docs/SECURITY.md).

---

## CI/CD

Cada PR ejecuta automáticamente:

- ✅ Type-check con TypeScript estricto
- ✅ ESLint
- ✅ Tests con BD y Redis ephemeral
- ✅ `npm audit` (alta severidad)
- ✅ Build de imágenes Docker
- ✅ Trivy filesystem scan (CVEs)
- ✅ SBOM CycloneDX (backend + frontend)

Ver [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

---

## Equipo y agradecimientos

- 👨‍💻 Yeremi y equipo · UPC · Curso Desarrollo de Software Seguro
- 🎓 Profesor del curso por la rigurosidad de la rúbrica ABET
- 📚 Robins, Fein & Barton — autores del M-CHAT-R (CC, uso académico)
- 🏥 Pediatras y psicólogos peruanos cuya labor inspiró el proyecto

---

## Licencia

Proyecto académico con fines educativos. Para uso comercial o redistribución, contactar al equipo.

El cuestionario M-CHAT-R es propiedad de sus autores originales y se usa bajo los términos de Creative Commons para uso clínico y educativo no comercial.

---

<div align="center">

**Made with ❤️ in Lima, Perú · 2026**

*Tu hijo merece una oportunidad temprana.*

</div>
