import { describe, it, expect } from 'vitest';
import { evaluateQuotaRules, ENDPOINT_COST } from './quota';

describe('Règles de quota', () => {
  it('une clé personnelle court-circuite le quota serveur', () => {
    const r = evaluateQuotaRules({ hasCustomKey: true, isAuthenticated: false });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('custom_key');
  });

  it('un invité sans clé est refusé en 401', () => {
    const r = evaluateQuotaRules({ hasCustomKey: false, isAuthenticated: false });
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(401);
  });

  it('un utilisateur connecté sans clé passe par le quota serveur', () => {
    const r = evaluateQuotaRules({ hasCustomKey: false, isAuthenticated: true });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('server_quota');
  });

  it('tarifie ats-score et extract-meta à zéro', () => {
    expect(ENDPOINT_COST['ats-score']).toBe(0);
    expect(ENDPOINT_COST['extract-meta']).toBe(0);
    expect(ENDPOINT_COST['tailor-resume']).toBe(1);
  });
});
