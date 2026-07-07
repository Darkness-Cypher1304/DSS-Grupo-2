// ============================================================================
// Validación de variables de entorno al ARRANCAR (fail-fast) — H8
// ============================================================================
// El ConfigModule no validaba: una variable crítica ausente fallaba en runtime
// (al primer uso) en vez de al arrancar, con un error opaco. Aquí validamos con
// class-validator (ya presente; sin dependencias nuevas) SOLO las variables
// imprescindibles para que la app funcione. El resto queda opcional y las
// variables desconocidas se PRESERVAN (allowUnknown): esta función devuelve el
// config completo sin recortar nada.
// ============================================================================

import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, validateSync } from 'class-validator';

// Solo lo IMPRESCINDIBLE (sin defaults sensatos y sin lo que la app no puede
// suplir). Mantener esta lista mínima evita romper el arranque en Render por
// declarar como requerida una variable realmente opcional.
class RequiredEnv {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;
}

/**
 * Valida las variables de entorno críticas al arrancar. Si falta alguna, lanza
 * y NestJS aborta el bootstrap con un mensaje claro (fail-fast) en vez de fallar
 * más tarde en runtime. Devuelve el config ORIGINAL completo (no recorta las
 * variables no declaradas).
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(RequiredEnv, config, { enableImplicitConversion: true });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    // allowUnknown: no rechazar ni eliminar variables ajenas a RequiredEnv.
    whitelist: false,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const detail = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join(' | ');
    throw new Error(`Configuración de entorno inválida: ${detail}`);
  }

  return config;
}
