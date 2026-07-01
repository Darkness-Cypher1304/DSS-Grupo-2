-- ============================================================================
-- NeuroAlert · Ciclo de vida de cuentas (Etapa 3) — autoeliminación híbrida
-- ============================================================================
-- Añade estados de cuenta, campos de baja en users y la tabla de solicitudes de
-- baja del especialista. Migración ADITIVA (bajo riesgo).
-- Nota PG16: `ALTER TYPE ... ADD VALUE` es válido dentro de la transacción de la
-- migración porque los valores nuevos NO se usan en esta misma migración.
-- ============================================================================

-- AlterEnum: nuevos estados del ciclo de vida de la cuenta
ALTER TYPE "UserStatus" ADD VALUE 'INACTIVE';
ALTER TYPE "UserStatus" ADD VALUE 'DISABLED';
ALTER TYPE "UserStatus" ADD VALUE 'PENDING_DELETION';

-- CreateEnum: estado de la solicitud de baja
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: campos de baja / anonimización en users
ALTER TABLE "users"
    ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
    ADD COLUMN "deletionReason" TEXT,
    ADD COLUMN "anonymizedAt" TIMESTAMP(3);

-- CreateTable: solicitud de baja del especialista
CREATE TABLE "specialist_leave_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comments" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialist_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "specialist_leave_requests_userId_key" ON "specialist_leave_requests"("userId");

-- CreateIndex
CREATE INDEX "specialist_leave_requests_status_createdAt_idx" ON "specialist_leave_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "specialist_leave_requests"
    ADD CONSTRAINT "specialist_leave_requests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Row-Level Security (ENABLE + NO FORCE, igual que el resto del esquema)
-- El dueño ve/crea SU solicitud; el ADMIN gestiona todas. El control real vive
-- en la capa de app (la conexión es dueña de la BD y bypassa RLS por NO FORCE).
-- ----------------------------------------------------------------------------
ALTER TABLE "specialist_leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "specialist_leave_requests" NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS specialist_leave_requests_select ON "specialist_leave_requests";
CREATE POLICY specialist_leave_requests_select ON "specialist_leave_requests"
    FOR SELECT
    USING (current_app_user_role() = 'ADMIN' OR "userId" = current_app_user_id());

DROP POLICY IF EXISTS specialist_leave_requests_insert ON "specialist_leave_requests";
CREATE POLICY specialist_leave_requests_insert ON "specialist_leave_requests"
    FOR INSERT
    WITH CHECK (current_app_user_role() = 'ADMIN' OR "userId" = current_app_user_id());

DROP POLICY IF EXISTS specialist_leave_requests_update ON "specialist_leave_requests";
CREATE POLICY specialist_leave_requests_update ON "specialist_leave_requests"
    FOR UPDATE
    USING (current_app_user_role() = 'ADMIN' OR "userId" = current_app_user_id());

DROP POLICY IF EXISTS specialist_leave_requests_delete ON "specialist_leave_requests";
CREATE POLICY specialist_leave_requests_delete ON "specialist_leave_requests"
    FOR DELETE
    USING (current_app_user_role() = 'ADMIN');
