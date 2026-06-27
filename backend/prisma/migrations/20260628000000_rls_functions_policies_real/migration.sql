-- ============================================================================
-- NeuroAlert · Migración: RLS REAL Y REPRODUCIBLE
-- ============================================================================
-- Contexto: las funciones helper de RLS (current_app_user_id / _role) y las
-- extensiones vivían SOLO en infra/postgres/init.sql, que se ejecuta únicamente
-- vía el entrypoint de Docker en la primera creación del contenedor. Por eso:
--   - En cualquier BD que no se cree con ese init.sql (p.ej. Render), las
--     políticas RLS de la migración anterior NO podían crearse (función ausente).
--   - En la BD de desarrollo actual, las políticas terminaron NO existiendo.
--
-- Esta migración deja el RLS autocontenido en el historial de Prisma:
-- crea extensiones + funciones helper + (re)crea todas las políticas y activa
-- RLS. Es IDEMPOTENTE (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS)
-- para poder aplicarse sobre una BD limpia o sobre una ya parcialmente migrada.
--
-- NOTA: para que el RLS se APLIQUE en tiempo de ejecución, la aplicación debe
-- conectarse con un rol SIN superuser y SIN BYPASSRLS (ver SECURITY.md, "Fase 2").
-- Con un superusuario las políticas existen pero se omiten por diseño de Postgres.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONES (las usa el schema: citext en email, pgcrypto para UUIDs)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ----------------------------------------------------------------------------
-- 2. FUNCIONES HELPER DE RLS
-- Leen las variables de sesión que la app setea por request:
--   SET LOCAL app.current_user_id  = '<cuid>'
--   SET LOCAL app.current_user_role = '<PARENT|SPECIALIST|ADMIN>'
-- Si no están seteadas, retornan NULL → ninguna fila visible (Fail-Safe).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', TRUE), '');
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
-- 3. mchat_screenings — el padre dueño ve lo suyo; admin ve todo.
-- ----------------------------------------------------------------------------
ALTER TABLE mchat_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mchat_screenings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mchat_parent_isolation ON mchat_screenings;
CREATE POLICY mchat_parent_isolation ON mchat_screenings
    FOR ALL
    USING (
        current_app_user_role() = 'ADMIN'
        OR "parentId" = current_app_user_id()
    );

-- ----------------------------------------------------------------------------
-- 4. questions
-- ----------------------------------------------------------------------------
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS questions_visibility ON questions;
CREATE POLICY questions_visibility ON questions
    FOR SELECT
    USING (
        current_app_user_role() = 'ADMIN'
        OR (
            current_app_user_role() = 'PARENT'
            AND "authorId" = current_app_user_id()
        )
        OR (
            current_app_user_role() = 'SPECIALIST'
            AND (
                "assignedToId" = current_app_user_id()
                OR ("assignedToId" IS NULL AND status = 'OPEN')
            )
        )
    );

DROP POLICY IF EXISTS questions_insert ON questions;
CREATE POLICY questions_insert ON questions
    FOR INSERT
    WITH CHECK (
        current_app_user_role() = 'PARENT'
        AND "authorId" = current_app_user_id()
    );

DROP POLICY IF EXISTS questions_update ON questions;
CREATE POLICY questions_update ON questions
    FOR UPDATE
    USING (
        current_app_user_role() = 'ADMIN'
        OR (
            current_app_user_role() = 'PARENT'
            AND "authorId" = current_app_user_id()
        )
        OR (
            current_app_user_role() = 'SPECIALIST'
            AND "assignedToId" = current_app_user_id()
        )
    );

-- ----------------------------------------------------------------------------
-- 5. answers
-- ----------------------------------------------------------------------------
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS answers_visibility ON answers;
CREATE POLICY answers_visibility ON answers
    FOR SELECT
    USING (
        current_app_user_role() = 'ADMIN'
        OR EXISTS (
            SELECT 1 FROM questions q
            WHERE q.id = answers."questionId"
            AND (
                q."authorId" = current_app_user_id()
                OR q."assignedToId" = current_app_user_id()
            )
        )
        OR answers."specialistId" = current_app_user_id()
    );

DROP POLICY IF EXISTS answers_insert ON answers;
CREATE POLICY answers_insert ON answers
    FOR INSERT
    WITH CHECK (
        current_app_user_role() = 'SPECIALIST'
        AND "specialistId" = current_app_user_id()
    );

-- ----------------------------------------------------------------------------
-- 6. audit_logs — INSERT para todos, SELECT solo admin, sin UPDATE/DELETE.
-- ----------------------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_admin_read_only ON audit_logs;
CREATE POLICY audit_logs_admin_read_only ON audit_logs
    FOR SELECT
    USING (current_app_user_role() = 'ADMIN');

DROP POLICY IF EXISTS audit_logs_insert_anyone ON audit_logs;
CREATE POLICY audit_logs_insert_anyone ON audit_logs
    FOR INSERT
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS audit_logs_no_update ON audit_logs;
CREATE POLICY audit_logs_no_update ON audit_logs
    FOR UPDATE
    USING (FALSE);

DROP POLICY IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE POLICY audit_logs_no_delete ON audit_logs
    FOR DELETE
    USING (FALSE);

-- ----------------------------------------------------------------------------
-- 7. refresh_tokens — solo el dueño o admin.
-- ----------------------------------------------------------------------------
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refresh_tokens_owner_only ON refresh_tokens;
CREATE POLICY refresh_tokens_owner_only ON refresh_tokens
    FOR ALL
    USING (
        current_app_user_role() = 'ADMIN'
        OR "userId" = current_app_user_id()
    );

-- ----------------------------------------------------------------------------
-- 8. contents — publicado visible para todos; borradores solo autor/admin.
-- ----------------------------------------------------------------------------
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contents_visibility ON contents;
CREATE POLICY contents_visibility ON contents
    FOR SELECT
    USING (
        status = 'PUBLISHED'
        OR current_app_user_role() = 'ADMIN'
        OR (
            current_app_user_role() = 'SPECIALIST'
            AND "authorId" = current_app_user_id()
        )
    );

DROP POLICY IF EXISTS contents_specialist_create ON contents;
CREATE POLICY contents_specialist_create ON contents
    FOR INSERT
    WITH CHECK (
        current_app_user_role() IN ('SPECIALIST', 'ADMIN')
        AND "authorId" = current_app_user_id()
    );

DROP POLICY IF EXISTS contents_author_update ON contents;
CREATE POLICY contents_author_update ON contents
    FOR UPDATE
    USING (
        current_app_user_role() = 'ADMIN'
        OR (
            current_app_user_role() = 'SPECIALIST'
            AND "authorId" = current_app_user_id()
        )
    );
