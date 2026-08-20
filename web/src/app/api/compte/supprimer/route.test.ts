import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const getUser = vi.fn();
// `enforceRateLimit` interroge la base par le même client : sans ce double, la
// route échoue avant d'atteindre ce qu'on veut tester.
const rpc = vi.fn();
const deleteUser = vi.fn();
const createAdminClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClientHelper: async () => ({ auth: { getUser }, rpc }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => createAdminClient(),
}));

beforeEach(() => {
  getUser.mockReset();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  deleteUser.mockReset();
  createAdminClient.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  deleteUser.mockResolvedValue({ error: null });
  createAdminClient.mockReturnValue({ auth: { admin: { deleteUser } } });
});

const requete = () => new Request('https://cvmatchr.fr/api/compte/supprimer', { method: 'POST' });

describe('POST /api/compte/supprimer', () => {
  // L'identité vient de la SESSION, jamais du corps de la requête : accepter un
  // identifiant fourni par l'appelant laisserait supprimer le compte d'autrui.
  it("supprime le compte de la session en cours", async () => {
    const r = await POST(requete());
    expect(deleteUser).toHaveBeenCalledWith('u1');
    expect(r.status).toBe(200);
  });

  it('refuse une requête au-delà du plafond, avant toute suppression', async () => {
    rpc.mockResolvedValue({ data: { allowed: false, retry_after: 3600 }, error: null });
    const r = await POST(requete());
    expect(r.status).toBe(429);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('refuse une requête sans session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const r = await POST(requete());
    expect(deleteUser).not.toHaveBeenCalled();
    expect(r.status).toBe(401);
  });

  // Sans clé d'administration, Supabase refuse la suppression. Répondre 200
  // ferait croire à l'utilisateur que ses données sont effacées alors qu'elles
  // sont intactes — le pire des mensonges possibles sur cet écran.
  it("échoue franchement si la clé d'administration manque", async () => {
    createAdminClient.mockReturnValue(null);
    const r = await POST(requete());
    expect(r.status).toBe(500);
  });

  it('échoue franchement si Supabase refuse la suppression', async () => {
    deleteUser.mockResolvedValue({ error: new Error('boom') });
    const r = await POST(requete());
    expect(r.status).toBe(500);
  });
});
