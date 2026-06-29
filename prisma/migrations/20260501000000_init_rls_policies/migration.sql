-- ============================================================================
-- NeuroAlert · Migración: ACTIVAR ROW-LEVEL SECURITY
-- ============================================================================
-- Esta migración se ejecuta DESPUÉS de que Prisma haya creado las tablas.
-- Activa RLS y crea políticas que aplican aislamiento de datos a nivel de BD.
--
-- Cómo funciona:
--   La aplicación (NestJS) hace al iniciar cada request transaccional:
--     SET LOCAL app.current_user_id = '<uuid del usuario>';
--     SET LOCAL app.current_user_role = '<PARENT|SPECIALIST|ADMIN>';
--   Las políticas RLS leen estas variables y filtran filas automáticamente.
--
-- Beneficio: aunque haya un bug en el backend que olvide filtrar por usuario,
-- la BD GARANTIZA que un padre nunca vea datos de otro padre.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLA: mchat_screenings
-- Solo el padre dueño puede ver sus propias evaluaciones.
-- Los admins pueden verlas todas. Los especialistas pueden ver las que
-- el padre les compartió a través de una pregunta de seguimiento.
-- ----------------------------------------------------------------------------
ALTER TABLE mchat_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mchat_screenings FORCE ROW LEVEL SECURITY;

CREATE POLICY mchat_parent_isolation ON mchat_screenings
    FOR ALL
    USING (
        -- Admin ve todo
        current_app_user_role() = 'ADMIN'
        OR
        -- El padre dueño ve lo suyo
        "parentId" = current_app_user_id()::text
    );

-- ----------------------------------------------------------------------------
-- TABLA: questions
-- El padre ve solo las que él creó.
-- El especialista ve las que tiene asignadas, las abiertas (sin asignar), y
-- las respondidas por él.
-- Admin ve todo.
-- ----------------------------------------------------------------------------
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions FORCE ROW LEVEL SECURITY;

CREATE POLICY questions_visibility ON questions
    FOR SELECT
    USING (
        current_app_user_role() = 'ADMIN'
        OR (
            current_app_user_role() = 'PARENT'
            AND "authorId" = current_app_user_id()::text
        )
        OR (
            current_app_user_role() = 'SPECIALIST'
            AND (
                "assignedToId" = current_app_user_id()::text
                OR ("assignedToId" IS NULL AND status = 'OPEN')
            )
        )
    );

CREATE POLICY questions_insert ON questions
    FOR INSERT
    WITH CHECK (
        current_app_user_role() = 'PARENT'
        AND "authorId" = current_app_user_id()::text
    );

CREATE POLICY questions_update ON questions
    FOR UPDATE
    USING (
        current_app_user_role() = 'ADMIN'
        OR (
            current_app_user_role() = 'PARENT'
            AND "authorId" = current_app_user_id()::text
        )
        OR (
            current_app_user_role() = 'SPECIALIST'
            AND "assignedToId" = current_app_user_id()::text
        )
    );

-- ----------------------------------------------------------------------------
-- TABLA: answers
-- Las respuestas son visibles para el dueño de la pregunta y para
-- el especialista que respondió. Admin ve todo.
-- ----------------------------------------------------------------------------
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers FORCE ROW LEVEL SECURITY;

CREATE POLICY answers_visibility ON answers
    FOR SELECT
    USING (
        current_app_user_role() = 'ADMIN'
        OR EXISTS (
            SELECT 1 FROM questions q
            WHERE q.id = answers."questionId"
            AND (
                q."authorId" = current_app_user_id()::text
                OR q."assignedToId" = current_app_user_id()::text
            )
        )
        OR answers."specialistId" = current_app_user_id()::text
    );

CREATE POLICY answers_insert ON answers
    FOR INSERT
    WITH CHECK (
        current_app_user_role() = 'SPECIALIST'
        AND "specialistId" = current_app_user_id()::text
    );

-- ----------------------------------------------------------------------------
-- TABLA: audit_logs
-- INSERT-ONLY para todos. Solo ADMIN puede leer. Nadie puede UPDATE/DELETE.
-- ----------------------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_admin_read_only ON audit_logs
    FOR SELECT
    USING (current_app_user_role() = 'ADMIN');

CREATE POLICY audit_logs_insert_anyone ON audit_logs
    FOR INSERT
    WITH CHECK (TRUE);

-- BLOQUEAR UPDATE y DELETE en audit_logs explícitamente
-- (Los CREATE POLICY solo de SELECT/INSERT cierran las otras operaciones)
CREATE POLICY audit_logs_no_update ON audit_logs
    FOR UPDATE
    USING (FALSE);

CREATE POLICY audit_logs_no_delete ON audit_logs
    FOR DELETE
    USING (FALSE);

-- ----------------------------------------------------------------------------
-- TABLA: refresh_tokens
-- Solo el dueño del token o admin pueden verlos.
-- ----------------------------------------------------------------------------
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_owner_only ON refresh_tokens
    FOR ALL
    USING (
        current_app_user_role() = 'ADMIN'
        OR "userId" = current_app_user_id()::text
    );

-- ----------------------------------------------------------------------------
-- TABLA: contents
-- Contenido publicado visible para todos.
-- Borradores solo para el autor y admin.
-- ----------------------------------------------------------------------------
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contents FORCE ROW LEVEL SECURITY;

CREATE POLICY contents_visibility ON contents
    FOR SELECT
    USING (
        status = 'PUBLISHED'
        OR current_app_user_role() = 'ADMIN'
        OR (
            current_app_user_role() = 'SPECIALIST'
            AND "authorId" = current_app_user_id()::text
        )
    );

CREATE POLICY contents_specialist_create ON contents
    FOR INSERT
    WITH CHECK (
        current_app_user_role() IN ('SPECIALIST', 'ADMIN')
        AND "authorId" = current_app_user_id()::text
    );

CREATE POLICY contents_author_update ON contents
    FOR UPDATE
    USING (
        current_app_user_role() = 'ADMIN'
        OR (
            current_app_user_role() = 'SPECIALIST'
            AND "authorId" = current_app_user_id()::text
        )
    );

-- ----------------------------------------------------------------------------
-- BYPASS RLS para usuario de aplicación (NestJS)
-- ----------------------------------------------------------------------------
-- El usuario neuroalert (que usa NestJS) DEBE tener BYPASSRLS desactivado
-- para que las políticas se apliquen. Pero el usuario debe poder modificar
-- las variables de sesión.
-- Ya está configurado por defecto al crear el rol sin SUPERUSER ni BYPASSRLS.

-- Mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Row-Level Security activado en todas las tablas críticas';
    RAISE NOTICE '   - mchat_screenings, questions, answers, audit_logs, refresh_tokens, contents';
    RAISE NOTICE '   - audit_logs es INSERT-ONLY incluso para admins (separación)';
END $$;
