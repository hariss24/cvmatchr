import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createBrowserClientHelper: () => ({ auth: { getSession } }),
}));

import { requireRemote, currentUserId, RemoteError } from './remote';

beforeEach(() => vi.clearAllMocks());

describe('accès distant', () => {
  it('rend le client et l\'utilisateur quand la session existe', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } });
    expect((await requireRemote()).userId).toBe('u-1');
  });

  it('lève une RemoteError quand personne n\'est connecté', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(requireRemote()).rejects.toBeInstanceOf(RemoteError);
  });

  it('currentUserId rend null sans lever quand personne n\'est connecté', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await currentUserId()).toBeNull();
  });
});
