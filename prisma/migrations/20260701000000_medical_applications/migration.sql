-- ============================================================================
-- NeuroAlert · Postulación de especialista (MedicalApplication)
-- ============================================================================
-- El especialista POSTULA (no se registra): esta tabla guarda la solicitud SIN
-- crear ningún User. La cuenta se crea solo cuando el ADMIN aprueba.
-- RLS con el MISMO patrón del resto del esquema: ENABLE + NO FORCE.
--   - INSERT público (la postulación es anónima, sin sesión).
--   - SELECT/UPDATE/DELETE solo ADMIN (defensa en profundidad; la app conecta
--     como dueño y bypassa RLS — el control REAL vive en la capa de aplicación).
-- Las funciones helper current_app_user_id()/current_app_user_role() ya existen
-- (migración 20260628000000_rls_functions_policies_real).
-- ============================================================================

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "medical_applications" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "cvFileId" TEXT NOT NULL,
    "cvSha256" TEXT NOT NULL,
    "dniFileId" TEXT NOT NULL,
    "dniSha256" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "yearsOfExperience" INTEGER NOT NULL DEFAULT 0,
    "availability" TEXT NOT NULL,
    "motivationLetter" TEXT NOT NULL,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "submittedIp" TEXT NOT NULL,
    "submittedUserAgent" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "checklist" JSONB,
    "createdUserId" TEXT,
    "activationToken" TEXT,
    "activationExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medical_applications_createdUserId_key" ON "medical_applications"("createdUserId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_applications_activationToken_key" ON "medical_applications"("activationToken");

-- CreateIndex
CREATE INDEX "medical_applications_status_createdAt_idx" ON "medical_applications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "medical_applications_email_idx" ON "medical_applications"("email");

-- CreateIndex
CREATE INDEX "medical_applications_licenseNumber_idx" ON "medical_applications"("licenseNumber");

-- ----------------------------------------------------------------------------
-- Row-Level Security (ENABLE + NO FORCE, igual que las demás tablas)
-- ----------------------------------------------------------------------------
ALTER TABLE "medical_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_applications" NO FORCE ROW LEVEL SECURITY;

-- SELECT: solo el ADMIN lista/lee las postulaciones.
DROP POLICY IF EXISTS medical_applications_select ON "medical_applications";
CREATE POLICY medical_applications_select ON "medical_applications"
    FOR SELECT
    USING (current_app_user_role() = 'ADMIN');

-- INSERT: público (la postulación es anónima, sin cuenta). La validación real
-- (magic-bytes, tamaño, consentimiento, duplicados) vive en la capa app.
DROP POLICY IF EXISTS medical_applications_insert ON "medical_applications";
CREATE POLICY medical_applications_insert ON "medical_applications"
    FOR INSERT
    WITH CHECK (true);

-- UPDATE: solo el ADMIN (aprobar/rechazar). La activación de la cuenta corre
-- como dueño de la BD (bypassa RLS por NO FORCE), igual que el resto del sistema.
DROP POLICY IF EXISTS medical_applications_update ON "medical_applications";
CREATE POLICY medical_applications_update ON "medical_applications"
    FOR UPDATE
    USING (current_app_user_role() = 'ADMIN');

-- DELETE: solo el ADMIN.
DROP POLICY IF EXISTS medical_applications_delete ON "medical_applications";
CREATE POLICY medical_applications_delete ON "medical_applications"
    FOR DELETE
    USING (current_app_user_role() = 'ADMIN');
