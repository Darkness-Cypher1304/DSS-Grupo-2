# Row-Level Security (RLS) — decisión arquitectónica por tabla

> Documento de seguridad de NeuroAlert. Explica el estado de RLS en PostgreSQL,
> por qué algunas tablas usan `FORCE ROW LEVEL SECURITY` y por qué otras se
> mantienen en `NO FORCE` **de forma deliberada**. Fuente de verdad para no
> re-activar `FORCE` a ciegas (es un campo minado: ya causó un 500 en login).

## 1. Contexto

Las tablas sensibles tienen RLS **`ENABLE`d** con políticas que aíslan por
usuario (`current_app_user_id()` / `current_app_user_role()`, leídas de las
variables de sesión que `PrismaService.runWithUserContext()` fija por request).

El matiz decisivo es **cómo conecta la aplicación a la base**:

- En **Render**, la app conecta como **dueño** de las tablas (no superusuario).
  Con RLS `ENABLE` pero `NO FORCE`, **el dueño BYPASSA las políticas**. Por eso,
  hoy, RLS es *inerte en runtime* para la app: la protección real de acceso vive
  en la **capa de aplicación** (p. ej. `mchat.service.getOne` devuelve 404 si el
  recurso no es del solicitante → cierra IDOR / OWASP A01).
- En **local**, la app conecta como **superusuario** → también bypassa RLS
  (aunque exista `FORCE`). **Consecuencia crítica:** el efecto de `FORCE`
  **no se puede validar en local**; solo se observa en Render (dueño no-superusuario).

`FORCE ROW LEVEL SECURITY` somete **también al dueño** a las políticas. Es
**defensa en profundidad**: si un bug de la capa app olvidara filtrar por
usuario, la base seguiría bloqueando las filas ajenas.

## 2. Criterio de decisión

Se activa `FORCE` en una tabla **solo si** se cumplen TODAS:

1. **El modelo de seguridad de la tabla es aislamiento por dueño** (no "posesión
   de un secreto único" ni datos públicos).
2. **Todas las consultas de la app a esa tabla ya corren con contexto**
   (`runWithUserContext`) **o** su política permite explícitamente la operación
   sin contexto (`WITH CHECK (true)` para escrituras de sistema).
3. **Ninguna ruta rompe con `FORCE`**: servicios, `prisma db seed` (corre como
   dueño en el entrypoint), crons/tareas de mantenimiento, health checks.
4. El beneficio de seguridad **supera** el riesgo operativo (recordar: no se
   valida en local y `main` despliega dev **y** prod a la vez).

Si no se cumplen, la tabla queda **`NO FORCE` deliberado** y se documenta aquí.

## 3. Veredicto por tabla

### ✅ Con `FORCE` (migración `20260702000000_rls_force_mchat_audit`)

| Tabla | Justificación |
|---|---|
| **`mchat_screenings`** | Datos clínicos del menor (lo más sensible). `MchatService` corre **100% en `runWithUserContext`** (submit/getMyHistory/getOne). La política `mchat_parent_isolation` es `FOR ALL USING (role=ADMIN OR parentId=uid)`; en una política `FOR ALL` sin `WITH CHECK` explícito, Postgres usa la expresión `USING` también como `WITH CHECK` del INSERT → el INSERT del padre pasa. El seed **no** inserta screenings. Cumple **RNF-01** (la BD aísla aunque falle la app). |
| **`audit_logs`** | Bitácora **append-only inmutable** (**RNF-19**). INSERT con política `WITH CHECK (true)` → las escrituras de sistema (a veces `userId` NULL, el cron de anonimización, etc.) siguen funcionando bajo `FORCE`. SELECT restringido a ADMIN y ya envuelto en `runWithUserContext`. Las políticas `no_update`/`no_delete` (`USING (false)`) bajo `FORCE` aplican **también al dueño** → inmutabilidad real (con `NO FORCE`, el dueño podía alterar el log). Verificado: **cero** `auditLog.update/delete/upsert` en todo el código; el seed no inserta audit_logs. |

Verificado **e2e en Render** (dev y prod): login (padre/admin), submit M-CHAT,
history, getOne propio, 404 en ajeno, lectura de auditoría por admin (200, con
eventos `MCHAT_COMPLETED`) y 403 para el padre. Sin regresiones.

**Rollback de emergencia** (si un flujo se rompiera):
```sql
ALTER TABLE mchat_screenings NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       NO FORCE ROW LEVEL SECURITY;
```

### 🔒 `NO FORCE` deliberado

| Tabla | Por qué NO `FORCE` |
|---|---|
| **`refresh_tokens`** | Su modelo de seguridad es **posesión de un secreto único** (SHA-256 del refresh JWT, indexado `@unique`, no enumerable), **no** aislamiento por fila de usuario. El acceso primario (`refresh`/`logout`) es un *lookup por clave única* → no hay superficie de IDOR (nadie conoce el hash de otro). Forzar RLS obligaría a reestructurar la ruta de auth más crítica (login/refresh/`issueTokens`, con transacciones anidadas), que **no se puede validar en local** y **ya causó un 500** (el INSERT del refresh en login). Beneficio marginal, riesgo alto → `NO FORCE`. La gestión de sesiones (`listSessions`/`revokeSession`) ya tiene checks de ownership explícitos en la capa app. |
| **`notifications`** | El INSERT es **cross-usuario a nivel sistema**: cuando un especialista responde, el sistema crea la notificación a nombre del **padre**. Bajo `FORCE`, `WITH CHECK (role=ADMIN OR userId=uid)` rechazaría ese INSERT (el contexto sería el del especialista). Habilitarlo exigiría degradar la política a `WITH CHECK (true)`, lo que anula su propio beneficio. |
| **`medical_applications`** | INSERT **público/anónimo** (postulación sin cuenta): `WITH CHECK (true)`. El flujo de aprobación crea el `User` y depende de operar como dueño (documentado en su migración). Aislamiento de lectura ya garantizado por política `SELECT` solo-ADMIN + capa app. |
| **`file_objects`** | Igual que `medical_applications`: subida en postulación anónima + descarga por token firmado a nivel sistema. |
| **`specialist_leave_requests`** | Contextualizable, pero tabla de bajo tráfico/valor; el beneficio de `FORCE` no supera el costo del ciclo migración+deploy+e2e (criterio 4). Reevaluable si se endurece todo el módulo. |

## 4. Ruta futura (Fase 2b, opcional)

Candidatas viables con trabajo previo (cada una = migración → **pedir luz verde**
→ e2e en Render → rollback listo):

- **`questions` / `answers`**: envueltas salvo un *gap*: dos `findUnique` fuera de
  contexto que leen el `author` para notificar al padre (RF-31/RF-34). Bajo
  `FORCE` ingenuo esas notificaciones se romperían **en silencio**. Fix limpio:
  mover ese `select { author }` dentro de la transacción `runWithUserContext`
  ya existente. Requiere e2e de "responder/tomar consulta".
- **`contents`**: 14 consultas **sin** envolver **y** el seed hace `content.upsert`
  (corre como dueño) → `FORCE` rompería el arranque del contenedor. Requiere
  refactor completo a `runWithUserContext` + adaptar el seed + manejar el caso
  de visitante anónimo (las lecturas públicas de artículos `PUBLISHED` deben
  seguir funcionando sin contexto: la política ya lo permite con `status='PUBLISHED'`).

## 5. Resumen

RLS es **defensa en profundidad**, no la única capa: la protección de acceso
efectiva hoy la da la **capa de aplicación** (cierra IDOR). `FORCE` se aplica
**donde es demostrablemente seguro y de alto valor** (datos clínicos e
inmutabilidad de auditoría) y se **evita deliberadamente** donde añadiría
fragilidad sin seguridad real. Máxima seguridad **sin** romper funcionalidades.
