// ============================================================================
// Setup global (setupFilesAfterEnv) — se ejecuta tras instalar el framework.
// ============================================================================
// `clearMocks: true` en jest.config.js ya limpia el estado de los mocks entre
// tests (F.I.R.S.T. → Independent). Aquí solo ajustamos el timeout por si algún
// test de integración con supertest tarda un poco más en el primer arranque.
// ============================================================================

import 'reflect-metadata';
import { Logger } from '@nestjs/common';

// Silencia el Logger interno de Nest (PrismaService, RedisService, guards, …)
// para mantener limpia la salida de los tests. Los tests que verifican logging
// usan sus propios mocks (p. ej. el Logger de Pino), no este.
Logger.overrideLogger(false);

jest.setTimeout(15000);
