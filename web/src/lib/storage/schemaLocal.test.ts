import { describe, it, expect } from 'vitest';
import { db } from './db';

/**
 * Verrou sur le schéma local, posé après un incident réel du 15/08/2026.
 *
 * La version 14 de Dexie avait été écrite `stores({ history: null, … })`, ce qui
 * SUPPRIME les magasins à l'ouverture de la base — donc avant toute connexion,
 * donc avant que `reprendreDonneesLocales()` puisse les lire. La reprise ne
 * trouvait plus rien, posait quand même son drapeau, et les données d'un
 * utilisateur d'avant la bascule disparaissaient sans un mot.
 *
 * Aucun test ne l'avait vu : ceux de la reprise simulent la base au lieu de
 * l'ouvrir. Celui-ci regarde le schéma déclaré.
 */
describe('schéma local', () => {
  const declarees = db.tables.map((t) => t.name);

  it('garde les tables migrées lisibles pour la reprise', () => {
    for (const nom of ['history', 'applications', 'jobs', 'profile', 'jobProfile', 'templates']) {
      expect(declarees).toContain(nom);
    }
  });

  it('garde les tables qui restent locales', () => {
    for (const nom of ['drafts', 'snapshots', 'commuteCache', 'atsDirectory', 'apiUsage']) {
      expect(declarees).toContain(nom);
    }
  });
});
