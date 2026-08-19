import { describe, it, expect } from 'vitest';
import { messageErreurAuth, erreurPeutVenirDeGoogle } from './messages';

describe('messageErreurAuth', () => {
  it('traduit un mot de passe ou un email incorrect', () => {
    expect(messageErreurAuth('Invalid login credentials'))
      .toBe('Email ou mot de passe incorrect.');
  });

  it('oriente vers Google quand le compte en vient', () => {
    expect(messageErreurAuth('Invalid login credentials', true))
      .toBe('Ce compte a été créé avec Google. Utilisez le bouton Google ci-dessus.');
  });

  it('signale une adresse déjà inscrite', () => {
    expect(messageErreurAuth('User already registered'))
      .toBe('Cette adresse a déjà un compte.');
  });

  it('annonce la longueur attendue du mot de passe', () => {
    expect(messageErreurAuth('Password should be at least 8 characters'))
      .toBe('Le mot de passe doit faire au moins 8 caractères.');
  });

  it('demande de patienter quand Supabase limite les envois', () => {
    expect(messageErreurAuth('Email rate limit exceeded'))
      .toBe('Trop de tentatives. Réessayez dans quelques minutes.');
  });

  it('signale un code périmé', () => {
    expect(messageErreurAuth('Token has expired or is invalid'))
      .toBe("Ce code n'est plus valable. Demandez-en un nouveau.");
  });

  it('reste utilisable devant une erreur inconnue, sans masquer le texte d\'origine', () => {
    const rendu = messageErreurAuth('Something exploded upstream');
    expect(rendu).toContain('La connexion a échoué');
    expect(rendu).toContain('Something exploded upstream');
  });

  it('ne renvoie jamais une chaîne vide', () => {
    expect(messageErreurAuth('').length).toBeGreaterThan(0);
  });
});

describe('erreurPeutVenirDeGoogle', () => {
  it("retient les identifiants refusés : le compte peut n'avoir aucun mot de passe", () => {
    expect(erreurPeutVenirDeGoogle('Invalid login credentials')).toBe(true);
  });

  it("retient l'adresse déjà prise : elle peut l'être par le compte Google", () => {
    expect(erreurPeutVenirDeGoogle('User already registered')).toBe(true);
  });

  it("écarte une coupure réseau, qui ne dit rien de la méthode d'inscription", () => {
    expect(erreurPeutVenirDeGoogle('Failed to fetch')).toBe(false);
    expect(erreurPeutVenirDeGoogle('')).toBe(false);
  });
});
