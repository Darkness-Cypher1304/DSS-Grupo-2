-- ============================================================================
-- NeuroAlert · Notificaciones in-app por polling — RF-34
-- ============================================================================
-- Crea la tabla notifications y le aplica RLS con el MISMO patrón que el resto
-- del esquema: ENABLE + NO FORCE.
-- La notificación se inserta a NIVEL SISTEMA (cuando ocurre el evento), y el
-- usuario solo lee/marca LAS SUYAS. El control de acceso REAL vive en la capa de
-- aplicación (NotificationsService filtra siempre por userId); estas políticas
-- son defensa en profundidad para conexiones de roles NO-dueños.
-- Las funciones helper current_app_user_id()/current_app_user_role() ya existen
-- (migración 20260628000000_rls_functions_policies_real).
-- ============================================================================

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- ----------------------------------------------------------------------------
-- Row-Level Security (ENABLE + NO FORCE, igual que las demás tablas)
-- ----------------------------------------------------------------------------
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" NO FORCE ROW LEVEL SECURITY;

-- SELECT: el destinatario ve SUS notificaciones; el ADMIN ve todo.
DROP POLICY IF EXISTS notifications_select ON "notifications";
CREATE POLICY notifications_select ON "notifications"
    FOR SELECT
    USING (
        current_app_user_role() = 'ADMIN'
        OR "userId" = current_app_user_id()
    );

-- INSERT: la crea el sistema (a nombre del destinatario) o el ADMIN.
DROP POLICY IF EXISTS notifications_insert ON "notifications";
CREATE POLICY notifications_insert ON "notifications"
    FOR INSERT
    WITH CHECK (
        current_app_user_role() = 'ADMIN'
        OR "userId" = current_app_user_id()
    );

-- UPDATE: solo el destinatario (marcar leída) o el ADMIN.
DROP POLICY IF EXISTS notifications_update ON "notifications";
CREATE POLICY notifications_update ON "notifications"
    FOR UPDATE
    USING (
        current_app_user_role() = 'ADMIN'
        OR "userId" = current_app_user_id()
    );

-- DELETE: el destinatario o el ADMIN.
DROP POLICY IF EXISTS notifications_delete ON "notifications";
CREATE POLICY notifications_delete ON "notifications"
    FOR DELETE
    USING (
        current_app_user_role() = 'ADMIN'
        OR "userId" = current_app_user_id()
    );
