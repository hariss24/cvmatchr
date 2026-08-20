import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, typeAutorise } from './route';

const verifyOtp = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerClientHelper: async () => ({ auth: { verifyOtp } }),
}));

beforeEach(() => {
  verifyOtp.mockReset();
  verifyOtp.mockResolvedValue({ error: null });
});

describe('typeAutorise', () => {
  // Le type vient de l'URL, donc de l'extérieur. Le passer tel quel à Supabase
  // laisserait choisir n'importe quel flux depuis un lien fabriqué.
  it('accepte les deux flux réellement envoyés par l\'application', () => {
    expect(typeAutorise('recovery')).toBe('recovery');
    expect(typeAutorise('signup')).toBe('signup');
  });
  it('refuse tout le reste', () => {
    expect(typeAutorise('magiclink')).toBeNull();
    expect(typeAutorise('')).toBeNull();
    expect(typeAutorise(null)).toBeNull();
  });
});

describe('GET', () => {
  it('vérifie le jeton et mène à la destination demandée', async () => {
    const r = await GET(new Request(
      'https://cvmatchr.fr/auth/confirmer?token_hash=abc&type=recovery&next=/connexion/nouveau-mot-de-passe',
    ));
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc' });
    expect(r.headers.get('location'))
      .toBe('https://cvmatchr.fr/connexion/nouveau-mot-de-passe');
  });

  it('refuse une destination externe', async () => {
    const r = await GET(new Request(
      'https://cvmatchr.fr/auth/confirmer?token_hash=abc&type=signup&next=https://evil.example',
    ));
    expect(r.headers.get('location')).toBe('https://cvmatchr.fr/');
  });

  it('signale un lien périmé sans laisser la personne sans issue', async () => {
    verifyOtp.mockResolvedValue({ error: new Error('Token has expired') });
    const r = await GET(new Request(
      'https://cvmatchr.fr/auth/confirmer?token_hash=abc&type=recovery',
    ));
    expect(r.headers.get('location')).toBe('https://cvmatchr.fr/connexion?erreur=lien_expire');
  });

  it('refuse un type non prévu sans appeler Supabase', async () => {
    const r = await GET(new Request(
      'https://cvmatchr.fr/auth/confirmer?token_hash=abc&type=magiclink',
    ));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(r.headers.get('location')).toBe('https://cvmatchr.fr/connexion?erreur=lien_expire');
  });

  it('refuse une requête sans jeton', async () => {
    const r = await GET(new Request('https://cvmatchr.fr/auth/confirmer?type=recovery'));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(r.headers.get('location')).toBe('https://cvmatchr.fr/connexion?erreur=lien_expire');
  });
});
