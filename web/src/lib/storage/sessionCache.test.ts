import { describe, it, expect, beforeEach } from 'vitest';
import { cacheGet, cacheSet, cacheInvalidate, cacheClear } from './sessionCache';

beforeEach(() => cacheClear());

describe('mémoire de session', () => {
  it('rend ce qu\'on lui a confié', () => {
    cacheSet('documents:list', [{ id: '1' }]);
    expect(cacheGet('documents:list')).toEqual([{ id: '1' }]);
  });

  it('ne rend rien pour une clé inconnue', () => {
    expect(cacheGet('documents:list')).toBeUndefined();
  });

  it('oublie une famille entière par son préfixe', () => {
    cacheSet('documents:list', 'A');
    cacheSet('documents:detail:1', 'B');
    cacheSet('jobs:list', 'C');
    cacheInvalidate('documents:');
    expect(cacheGet('documents:list')).toBeUndefined();
    expect(cacheGet('documents:detail:1')).toBeUndefined();
    expect(cacheGet('jobs:list')).toBe('C');
  });

  it('distingue une valeur absente d\'une valeur nulle enregistrée', () => {
    cacheSet('profil', null);
    expect(cacheGet('profil')).toBeNull();
    expect(cacheGet('inconnu')).toBeUndefined();
  });
});
