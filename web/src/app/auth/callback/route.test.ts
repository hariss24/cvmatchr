import { describe, it, expect, vi } from 'vitest';
import { safeRedirectPath, GET } from './route';

// L'échange échoue : c'est exactement ce qui arrive quand le lien du courriel
// est ouvert dans un AUTRE navigateur que celui de l'inscription — la clé de
// vérification n'y existe pas.
vi.mock('@/lib/supabase/server', () => ({
  createServerClientHelper: async () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: new Error('code verifier absent') }),
    },
  }),
}));

describe('safeRedirectPath', () => {
  it('accepte un chemin interne', () => {
    expect(safeRedirectPath('/mes-cv')).toBe('/mes-cv');
  });
  it('refuse une URL absolue', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/');
  });
  it('refuse un chemin protocol-relative', () => {
    expect(safeRedirectPath('//evil.example')).toBe('/');
  });
  it('retombe sur la racine si absent', () => {
    expect(safeRedirectPath(null)).toBe('/');
  });
});

describe('GET, session impossible sur cet appareil', () => {
  // Avant : redirection vers /?auth_error=callback_failed, que rien n'affiche.
  // La personne voyait l'accueil déconnecté sans un mot d'explication, alors
  // que son adresse VENAIT d'être confirmée par ce même lien.
  it("renvoie vers la page de connexion avec un motif affichable", async () => {
    const reponse = await GET(new Request('https://cvmatchr.fr/auth/callback?code=abc'));
    expect(reponse.headers.get('location'))
      .toBe('https://cvmatchr.fr/connexion?erreur=session_impossible');
  });
});
