// ============================================================================
// RedisModule — cableado DI (global) del RedisService
// ============================================================================
// La lógica del cache (JWT blacklist, contadores, tokens efímeros y el fallback
// en memoria) vive en `redis.service.ts`. Este módulo solo lo registra y lo
// exporta de forma global para que cualquier módulo lo inyecte sin importarlo.
// ============================================================================

import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
