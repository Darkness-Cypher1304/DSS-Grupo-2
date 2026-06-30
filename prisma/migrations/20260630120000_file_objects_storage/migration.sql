-- ============================================================================
-- NeuroAlert · Storage en PostgreSQL (reemplaza MinIO) — RF-25..28
-- ============================================================================
-- Crea la tabla file_objects (binario en bytea + metadatos verificados) y le
-- aplica RLS con el MISMO patrón que el resto del esquema: ENABLE + NO FORCE.
-- El control de acceso REAL vive en la capa de aplicación (StorageController);
-- estas políticas son defensa en profundidad para conexiones de roles NO-dueños.
-- Las funciones helper current_app_user_id()/current_app_user_role() ya existen
-- (migración 20260628000000_rls_functions_policies_real).
-- ============================================================================

-- CreateTable
CREATE TABLE "file_objects" (
    "id" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_objects_ownerId_idx" ON "file_objects"("ownerId");

-- CreateIndex
CREATE INDEX "file_objects_folder_idx" ON "file_objects"("folder");

-- ----------------------------------------------------------------------------
-- Row-Level Security (ENABLE + NO FORCE, igual que las demás tablas)
-- ----------------------------------------------------------------------------
ALTER TABLE "file_objects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_objects" NO FORCE ROW LEVEL SECURITY;

-- SELECT: el dueño ve sus archivos; el ADMIN ve todo; los de la carpeta
-- 'resources' son públicos (contenido educativo descargable).
DROP POLICY IF EXISTS file_objects_select ON "file_objects";
CREATE POLICY file_objects_select ON "file_objects"
    FOR SELECT
    USING (
        current_app_user_role() = 'ADMIN'
        OR "ownerId" = current_app_user_id()
        OR folder = 'resources'
    );

-- INSERT: solo se puede crear un archivo a nombre propio (o el ADMIN).
DROP POLICY IF EXISTS file_objects_insert ON "file_objects";
CREATE POLICY file_objects_insert ON "file_objects"
    FOR INSERT
    WITH CHECK (
        current_app_user_role() = 'ADMIN'
        OR "ownerId" = current_app_user_id()
    );

-- DELETE: el dueño o el ADMIN.
DROP POLICY IF EXISTS file_objects_delete ON "file_objects";
CREATE POLICY file_objects_delete ON "file_objects"
    FOR DELETE
    USING (
        current_app_user_role() = 'ADMIN'
        OR "ownerId" = current_app_user_id()
    );
