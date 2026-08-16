import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applicationToRemoteRow, jobToRemoteSavedJob, remoteRowToApplication } from './db';
import type { JobEntry } from './db';
import type { Application } from '@/lib/applications/types';

/**
 * Verrou posé après un incident du 15/08/2026 : les modèles de lettre étaient
 * écrits avec les colonnes `subject`, `body` et `is_default`, alors que la table
 * `templates` de `0003_documents_templates.sql` déclare `letter_subject` et
 * `letter_body` et n'a pas de `is_default`. PostgreSQL refusait chaque écriture.
 *
 * Le défaut était invisible : aucune migration n'ayant encore été appliquée,
 * aucun test ne parlait à une vraie base, et le faux client Supabase des tests
 * accepte n'importe quelle colonne. Ce test lit donc le SQL lui-même.
 */
function colonnesDeLaTable(nomTable: string): string[] {
  const sqlPath = fileURLToPath(
    new URL('../../../supabase/migrations/0003_documents_templates.sql', import.meta.url),
  );
  const sql = readFileSync(sqlPath, 'utf8');
  const bloc = sql.split(`CREATE TABLE public.${nomTable} (`)[1]?.split(');')[0];
  if (!bloc) throw new Error(`Table ${nomTable} introuvable dans la migration 0003`);
  return bloc
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('--') && !l.startsWith('PRIMARY KEY'))
    .map((l) => l.split(/\s+/)[0]);
}

const APP: Application = {
  id: 'a-1',
  createdAt: Date.parse('2026-07-01T10:00:00Z'),
  company: 'ACME',
  role: 'Dev',
  normKey: 'acme|dev',
  jobText: '',
  jobUrl: '',
  source: 'manual',
  events: [],
  notes: '',
  updatedAt: Date.parse('2026-08-15T10:00:00Z'),
};

describe('colonnes écrites vs schéma réel', () => {
  it('la table documents déclare bien les colonnes que le code écrit', () => {
    const colonnes = colonnesDeLaTable('documents');
    for (const nom of ['id', 'doc_type', 'title', 'company', 'role', 'label', 'content',
      'template_id', 'application_id', 'notes', 'job_desc', 'pdf_views', 'editor_reloads',
      'last_viewed_at', 'created_at']) {
      expect(colonnes).toContain(nom);
    }
  });

  it('la table templates déclare letter_subject / letter_body, et pas subject / body', () => {
    const colonnes = colonnesDeLaTable('templates');
    expect(colonnes).toContain('letter_subject');
    expect(colonnes).toContain('letter_body');
    expect(colonnes).not.toContain('subject');
    expect(colonnes).not.toContain('body');
    expect(colonnes).not.toContain('is_default');
  });

  it('une candidature garde sa date de création après une modification', () => {
    // Reconstruite depuis `client_updated_at`, elle se rajeunissait à chaque
    // retouche : une candidature ancienne ne passait jamais « sans réponse ».
    const row = applicationToRemoteRow(APP, 'u-1') as unknown as Record<string, unknown>;
    const relue = remoteRowToApplication({ ...row, client_updated_at: '2026-08-15T10:00:00.000Z' });
    expect(relue.createdAt).toBe(APP.createdAt);
    expect(relue.updatedAt).toBe(Date.parse('2026-08-15T10:00:00Z'));
  });

  it('une offre enregistrée porte son horloge cliente (colonne NOT NULL)', () => {
    const job = { id: 'j-1', createdAt: 1, updatedAt: 2 } as JobEntry;
    expect(jobToRemoteSavedJob(job, 'u-1').client_updated_at).toBe(new Date(2).toISOString());
  });
});
