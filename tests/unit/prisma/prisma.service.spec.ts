// ============================================================================
// Unit · PrismaService — lifecycle + runWithUserContext (RLS) + saneamiento
// ============================================================================

import { PrismaService } from '../../../src/prisma/prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('onModuleInit conecta y onModuleDestroy desconecta', async () => {
    const connect = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('runWithUserContext setea las variables de sesión y ejecuta fn con la tx', async () => {
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(1) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service, '$transaction').mockImplementation(((fn: any) => fn(tx)) as any);

    const result = await service.runWithUserContext('clUser_123', 'PARENT', async (t) => {
      expect(t).toBe(tx);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(tx.$executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id = 'clUser_123'");
    expect(tx.$executeRawUnsafe.mock.calls[1][0]).toContain("app.current_user_role = 'PARENT'");
  });

  it('rechaza valores no seguros para SET LOCAL (defensa en profundidad)', async () => {
    const tx = { $executeRawUnsafe: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service, '$transaction').mockImplementation(((fn: any) => fn(tx)) as any);

    await expect(
      service.runWithUserContext("bad'; DROP TABLE users; --", 'PARENT', async () => 'x'),
    ).rejects.toThrow('Invalid value for SET LOCAL');
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
