import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './route';

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
