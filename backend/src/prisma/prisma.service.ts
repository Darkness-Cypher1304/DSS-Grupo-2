// ============================================================================
// PrismaService
// ============================================================================
// Wrapper sobre PrismaClient que añade:
//   1. Lifecycle hooks (onModuleInit / onModuleDestroy)
//   2. Método runWithUserContext() que setea variables de sesión Postgres
//      antes de ejecutar queries (esto es lo que activa RLS por request).
// ============================================================================

import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('✅ Conectado a PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('🔌 Desconectado de PostgreSQL');
  }

  /**
   * Ejecuta `fn` dentro de una transacción con las variables de sesión
   * `app.current_user_id` y `app.current_user_role` seteadas.
   *
   * Esto es lo que activa las políticas Row-Level Security definidas en
   * `prisma/migrations/20260501000000_init_rls_policies/migration.sql`.
   *
   * Uso típico (en un service):
   *   const screenings = await prisma.runWithUserContext(
   *     userId, role,
   *     (tx) => tx.mchatScreening.findMany()
   *   );
   *
   * Si el código de la app tuviera un bug y no filtrara por userId, RLS
   * IGUALMENTE bloquearía las filas ajenas. Defensa en profundidad.
   */
  async runWithUserContext<T>(
    userId: string,
    userRole: string,
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // SET LOCAL solo aplica dentro de la transacción → no contamina otras conexiones
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_user_id = '${this.escapeForSetLocal(userId)}'`,
      );
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_user_role = '${this.escapeForSetLocal(userRole)}'`,
      );
      return fn(tx);
    });
  }

  /**
   * Sanitización extra para SET LOCAL.
   * userId viene de un JWT firmado por nosotros, pero defensa en profundidad.
   */
  private escapeForSetLocal(value: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error('Invalid value for SET LOCAL');
    }
    return value;
  }
}
