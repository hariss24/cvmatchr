import { describe, it, expect } from 'vitest';
import { validerEmail, validerMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from './validation';

describe('validerEmail', () => {
  it('accepte une adresse ordinaire', () => {
    expect(validerEmail('marc.dubois@example.fr')).toBeNull();
  });

  it('refuse une adresse vide', () => {
    expect(validerEmail('  ')).toBe('Indiquez votre adresse email.');
  });

  it('refuse une adresse sans arobase ni domaine', () => {
    expect(validerEmail('marc.dubois')).toBe("Cette adresse email n'est pas valide.");
    expect(validerEmail('marc@dubois')).toBe("Cette adresse email n'est pas valide.");
  });
});

describe('validerMotDePasse', () => {
  it('accepte un mot de passe assez long', () => {
    expect(validerMotDePasse('motdepasse')).toBeNull();
  });

  it('refuse un mot de passe vide', () => {
    expect(validerMotDePasse('')).toBe('Indiquez un mot de passe.');
  });

  it('refuse un mot de passe trop court, et annonce la longueur exigée', () => {
    expect(validerMotDePasse('court')).toBe(
      `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`,
    );
  });

  it('exige exactement la longueur configurée', () => {
    expect(LONGUEUR_MIN_MOT_DE_PASSE).toBe(8);
    expect(validerMotDePasse('a'.repeat(7))).not.toBeNull();
    expect(validerMotDePasse('a'.repeat(8))).toBeNull();
  });
});
