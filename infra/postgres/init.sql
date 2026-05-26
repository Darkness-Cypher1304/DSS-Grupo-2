-- ============================================================================
-- NeuroAlert · PostgreSQL · Inicialización de Seguridad
-- ============================================================================
-- Este script se ejecuta UNA SOLA VEZ cuando el contenedor de Postgres se crea.
-- Configura:
--   1. Usuario de SOLO LECTURA (Least Privilege para reportes/auditoría)
--   2. Extensiones útiles
--   3. La función RLS que se usará en las migraciones de Prisma
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONES
-- ----------------------------------------------------------------------------
-- pgcrypto: para gen_random_uuid() (generación de UUIDs criptográficamente seguros)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- citext: para emails case-insensitive sin perder la capitalización original
CREATE EXTENSION IF NOT EXISTS "citext";

-- ----------------------------------------------------------------------------
-- 2. USUARIO DE SOLO LECTURA — para dashboards y reportes (Least Privilege)
-- ----------------------------------------------------------------------------
-- Este usuario JAMÁS puede modificar datos. Si un atacante compromete las
-- credenciales del dashboard de reportes, no puede causar daño en la BD.
DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'neuroalert_ro') THEN
      CREATE ROLE neuroalert_ro WITH LOGIN PASSWORD 'readonly_dev_2026';
   END IF;
END
$$;

-- Permisos: solo SELECT en tablas existentes y futuras
GRANT CONNECT ON DATABASE neuroalert TO neuroalert_ro;
GRANT USAGE ON SCHEMA public TO neuroalert_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO neuroalert_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO neuroalert_ro;

-- ----------------------------------------------------------------------------
-- 3. CONFIGURACIÓN DE SEGURIDAD A NIVEL DE BASE DE DATOS
-- ----------------------------------------------------------------------------
-- Logging de conexiones para auditoría (en producción esto va a un SIEM)
ALTER DATABASE neuroalert SET log_statement = 'mod';     -- log INSERT/UPDATE/DELETE
ALTER DATABASE neuroalert SET log_connections = 'on';
ALTER DATABASE neuroalert SET log_disconnections = 'on';

-- ----------------------------------------------------------------------------
-- 4. FUNCIÓN HELPER PARA RLS
-- ----------------------------------------------------------------------------
-- Esta función obtiene el ID del usuario actual desde una variable de sesión
-- que la aplicación setea en cada request: SET LOCAL app.current_user_id = '...'
-- Si no está seteada, retorna NULL (lo que hace que NINGUNA fila sea visible
-- bajo políticas RLS — esto es Fail-Safe Defaults).
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION current_app_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_role', TRUE), '');
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. MENSAJE FINAL
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '✅ NeuroAlert DB inicializada correctamente';
    RAISE NOTICE '   - Extensiones: pgcrypto, citext';
    RAISE NOTICE '   - Usuario read-only: neuroalert_ro';
    RAISE NOTICE '   - Funciones RLS: current_app_user_id(), current_app_user_role()';
    RAISE NOTICE '   - Las políticas RLS específicas se crean en migraciones de Prisma';
END $$;
