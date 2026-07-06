// ============================================================================
// Unit · NotificationsService — creación a nivel sistema y lectura con IDOR
// ============================================================================

import { NotFoundException } from '@nestjs/common';

import { NotificationsService } from '../../../src/notifications/notifications.service';
import { createPrismaMock, PrismaMock } from '../../mocks/prisma.mock';
import { USER_IDS } from '../../fixtures/users.fixture';

describe('NotificationsService', () => {
  let prisma: PrismaMock;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new NotificationsService(prisma);
  });

  it('createForUser inserta la notificación a nombre del destinatario', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.notification.create.mockResolvedValue({ id: 'n1' } as any);

    await service.createForUser({ userId: USER_IDS.parent, type: 'ANSWER', title: 't' });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_IDS.parent }) }),
    );
  });

  it('listForUser lista las propias bajo contexto RLS', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }] as any);

    const res = await service.listForUser(USER_IDS.parent, 'PARENT');

    expect(prisma.runWithUserContext).toHaveBeenCalled();
    expect(res).toHaveLength(1);
  });

  it('unreadCount devuelve el conteo de no leídas', async () => {
    prisma.notification.count.mockResolvedValue(3);

    await expect(service.unreadCount(USER_IDS.parent, 'PARENT')).resolves.toEqual({ count: 3 });
  });

  it('markRead lanza 404 si la notificación no es del usuario', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.notification.updateMany.mockResolvedValue({ count: 0 } as any);

    await expect(service.markRead(USER_IDS.parent, 'PARENT', 'n1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('markRead marca la notificación propia', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.notification.updateMany.mockResolvedValue({ count: 1 } as any);

    await expect(service.markRead(USER_IDS.parent, 'PARENT', 'n1')).resolves.toEqual({
      updated: 1,
    });
  });

  it('markAllRead marca todas las propias como leídas', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.notification.updateMany.mockResolvedValue({ count: 5 } as any);

    await expect(service.markAllRead(USER_IDS.parent, 'PARENT')).resolves.toEqual({ updated: 5 });
  });
});
