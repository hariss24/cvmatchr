# Le compte restitue vraiment les données — plan d'exécution

> **Pour l'agent d'exécution :** ce plan se lit avec `.agents/rules/cadrage.md`,
> qui est la loi. Une task = un lot = un commit. Interdiction de commencer une
> task tant que la précédente n'a pas passé sa vérification. Les étapes sont en
> cases à cocher (`- [ ]`) pour le suivi.

**Spec :** `docs/superpowers/specs/2026-08-15-sync-compte-restitution-design.md`

**But :** qu'un utilisateur connecté retrouve ses CV enregistrés et son profil
« Mes infos » sur un autre appareil, sans recharger la page.

**Architecture :** on ajoute (a) un enregistrement explicite qui écrit dans
`db.history` en dehors de tout export PDF, (b) un envoi vers Supabase déclenché
par cet enregistrement au lieu du seul login/logout, (c) la réplication des
réglages `profile` et `jobProfile` via une table `user_settings` calquée sur les
tables existantes, (d) un signal qui fait recharger les écrans quand un pull a
modifié des données. Le brouillon en cours reste local, par décision.

**Pile :** Next.js 16 (App Router), React 19, TypeScript strict, Zustand, Dexie
(IndexedDB), Supabase (PostgreSQL + RLS), Vitest, Playwright.

## Contraintes globales

Copiées de `.agents/rules/cadrage.md` — elles s'appliquent à **toutes** les tasks :

- **Aucune dépendance npm ajoutée ou mise à jour.** En particulier :
  `dexie-react-hooks` n'est **pas** installé et ne doit **pas** l'être (task 4).
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.**
  `npx tsc --noEmit` doit passer en strict.
- **Jamais `alert`/`confirm`/`prompt` natifs** → `uiAlert`/`uiConfirm`/`uiPrompt`/
  `toast` de `@/state/uiStore`.
- **Jamais de couleur en dur** → variables de thème de `src/app/globals.css`
  (`var(--bg)`, `var(--text)`…).
- **Tu ne modifies pas un test existant pour le faire passer.**
- **PUSH GIT STRICTEMENT INTERDIT** (un push déploie la production Vercel).
  Commits locaux uniquement, un par task, message en français.
- **La photo de profil (`photo`, base64) n'est jamais envoyée à une IA.** Aucune
  task ici n'appelle d'IA ; ne pas introduire d'appel.
- **Périmètre** : uniquement ce que ce plan demande. Aucun refactor voisin.
- Après chaque task, journal daté dans `WORK_HISTORY.md`.

**Vérification après CHAQUE task**, depuis `web/`, sortie collée dans le rapport :

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

`npx playwright test` en plus à la fin des tasks 4, 6 et 7 (elles touchent l'UI).

## Hors périmètre — ne pas les faire « au passage »

- Synchroniser `drafts` (le brouillon en cours). **Décision propriétaire**, §3 et
  §8 de la spec. Le §8 explique le bug de destruction de données que ça causerait.
- Synchroniser `templates` (§4.3 de la spec : la table s'auto-alimente avec les
  modèles par défaut, ce qui rejoue la même course).
- Toucher au Last-Write-Wins, aux photos base64, au quota, à l'authentification.

## Structure des fichiers

| Fichier | Responsabilité | Task |
|---|---|---|
| `web/supabase/migrations/0002_user_settings.sql` *(créé)* | Table `user_settings` + trigger + RLS | 1 |
| `web/src/lib/storage/syncMapping.ts` *(modifié)* | Traduction local ↔ distant des réglages | 2 |
| `web/src/lib/profile/profile.ts` *(modifié)* | `UserProfile` gagne `synced_at` | 2 |
| `web/src/lib/storage/db.ts` *(modifié)* | Horodatage des réglages à l'écriture | 2 |
| `web/src/lib/storage/syncEngine.ts` *(modifié)* | Push/pull des réglages, purge, signal | 3, 4 |
| `web/src/lib/storage/syncEvents.ts` *(créé)* | Émetteur d'événement de synchronisation | 4 |
| `web/src/lib/storage/saveDocument.ts` *(créé)* | Enregistrement d'un document + envoi | 5 |
| `web/src/lib/applications/store.ts` *(modifié)* | Envoi après suppression / changement de statut | 5 |
| `web/src/state/saveStateStore.ts` *(créé)* | État affiché : non enregistré / appareil / compte | 6 |
| `web/src/components/layout/TopBar.tsx` *(modifié)* | Bouton « Enregistrer » + indicateur | 5, 6 |

---

## Task 1 : la table `user_settings` côté Supabase

**Fichiers :**
- Créer : `web/supabase/migrations/0002_user_settings.sql`

**Interfaces :**
- Produit : la table `public.user_settings(user_id, id, content, deleted_at, client_updated_at, created_at, updated_at)`, PK `(user_id, id)`, consommée par les tasks 2 et 3.

**Pourquoi la colonne s'appelle `id` et non `key` :** `filterOutStalePush()`
(`syncEngine.ts:24`) interroge la colonne `id` pour toutes les tables. Nommer la
colonne `id` permet de réutiliser cette fonction sans la modifier. La valeur de
`id` vaut `'profile'` ou `'jobProfile'`.

- [ ] **Étape 1 : lire le modèle existant**

Lis `web/supabase/migrations/0001_auth_quotas.sql` en entier — au minimum la
table `saved_jobs` (l. 98-110), le trigger `touch_updated_at` (l. 135-155) et
les policies (l. 308-336). La nouvelle table les copie à l'identique.

- [ ] **Étape 2 : écrire la migration**

```sql
-- ---------------------------------------------------------------------
-- 0002 — Réglages utilisateur répliqués (profil « Mes infos », critères
-- de recherche d'offres).
--
-- Calquée sur les tables de 0001_auth_quotas.sql :
--   client_updated_at : horloge du navigateur, arbitre last-write-wins.
--   updated_at        : horloge serveur (trigger), curseur de pull.
--   deleted_at        : suppression douce.
--
-- La colonne s'appelle `id` (et non `key`) parce que filterOutStalePush()
-- interroge la colonne `id` pour toutes les tables répliquées.
-- Valeurs attendues : 'profile' | 'jobProfile'.
--
-- `templates` n'est PAS répliquée : la table locale s'auto-alimente avec les
-- modèles par défaut, dont l'horodatage frais gagnerait l'arbitrage contre les
-- modèles réels du compte (spec du 15/08/2026, §4.3).
-- ---------------------------------------------------------------------
CREATE TABLE public.user_settings (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id                TEXT NOT NULL CHECK (id IN ('profile', 'jobProfile')),
  content           JSONB NOT NULL,
  deleted_at        TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TRIGGER trg_user_settings_touch BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_own" ON public.user_settings
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
```

- [ ] **Étape 3 : vérifier**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

Aucun test unitaire ici : le fichier est du SQL, non exécuté par l'application.

- [ ] **Étape 4 : signaler l'action humaine requise**

Écris explicitement dans ton rapport de task : **« La migration
`0002_user_settings.sql` doit être appliquée à la main sur le projet Supabase
avant que les tasks 3 et suivantes fonctionnent en conditions réelles. »**
Tu ne l'appliques pas toi-même.

- [ ] **Étape 5 : commit**

```bash
git add web/supabase/migrations/0002_user_settings.sql
git commit -m "feat(sync): table user_settings pour repliquer les reglages"
```

---

## Task 2 : traduire les réglages local ↔ distant

**Fichiers :**
- Modifier : `web/src/lib/storage/syncMapping.ts` (ajouts en fin de fichier)
- Modifier : `web/src/lib/profile/profile.ts:9-20` (interface `UserProfile`)
- Modifier : `web/src/lib/storage/db.ts:133` (type de la table `jobProfile`)
- Modifier : `web/src/lib/storage/db.ts:599-635` (`saveProfile`, `saveJobProfile`)
- Test : `web/src/lib/storage/syncMapping.test.ts` *(créé)*

**Interfaces :**
- Consomme : la table de la task 1 (colonnes `id`, `content`, `client_updated_at`).
- Produit, exportés depuis `syncMapping.ts` :
  - `interface RemoteUserSettingRow { user_id?: string; id: 'profile' | 'jobProfile'; content: Record<string, unknown>; deleted_at?: string | null; client_updated_at: string; updated_at?: string; }`
  - `profileToRemoteSetting(p: UserProfile, userId: string): RemoteUserSettingRow`
  - `remoteSettingToProfile(row: RemoteUserSettingRow): UserProfile`
  - `jobProfileToRemoteSetting(row: JobProfileRow, userId: string): RemoteUserSettingRow`
  - `remoteSettingToJobProfile(row: RemoteUserSettingRow): JobProfileRow`
  - `type JobProfileRow = { id: 'me'; profile: JobSearchProfile; updatedAt?: number; synced_at?: string | null }`, exporté depuis `db.ts`.

- [ ] **Étape 1 : écrire les tests (ils doivent échouer)**

Crée `web/src/lib/storage/syncMapping.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import {
  profileToRemoteSetting,
  remoteSettingToProfile,
  jobProfileToRemoteSetting,
  remoteSettingToJobProfile,
} from './syncMapping';
import type { UserProfile } from '@/lib/profile/profile';
import type { JobSearchProfile } from '@/lib/jobs/profile';

const PROFIL: UserProfile = {
  id: 'me',
  prenom: 'Hariss',
  nom: 'Hafeji',
  email: 'h@example.com',
  telephone: '0600000000',
  ville: 'Lyon',
  linkedin: 'https://linkedin.com/in/x',
  updatedAt: Date.parse('2026-08-15T10:00:00.000Z'),
};

describe('mapping des réglages', () => {
  it('le profil part avec id="profile" et son horloge client', () => {
    const row = profileToRemoteSetting(PROFIL, 'user-1');
    expect(row.id).toBe('profile');
    expect(row.user_id).toBe('user-1');
    expect(row.client_updated_at).toBe('2026-08-15T10:00:00.000Z');
    expect(row.content.prenom).toBe('Hariss');
  });

  it('le profil fait l\'aller-retour sans perdre de champ', () => {
    const back = remoteSettingToProfile(profileToRemoteSetting(PROFIL, 'user-1'));
    expect(back).toEqual({ ...PROFIL, synced_at: null });
  });

  it('un profil distant sans horodatage lisible ne casse pas le retour', () => {
    const back = remoteSettingToProfile({
      id: 'profile',
      content: { prenom: 'Zoe' },
      client_updated_at: '2026-08-15T11:00:00.000Z',
    });
    expect(back.prenom).toBe('Zoe');
    expect(back.nom).toBe('');
    expect(back.id).toBe('me');
    expect(back.updatedAt).toBe(Date.parse('2026-08-15T11:00:00.000Z'));
  });

  it('les critères de recherche font l\'aller-retour', () => {
    const profile = { homeAddress: 'Lyon', keywords: ['dev'] } as unknown as JobSearchProfile;
    const local = { id: 'me' as const, profile, updatedAt: Date.parse('2026-08-15T09:00:00.000Z') };
    const row = jobProfileToRemoteSetting(local, 'user-1');
    expect(row.id).toBe('jobProfile');
    expect(remoteSettingToJobProfile(row).profile).toEqual(profile);
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils sont ROUGES**

```bash
npx vitest run src/lib/storage/syncMapping.test.ts
```

Attendu : ÉCHEC, `profileToRemoteSetting` n'est pas exporté.

- [ ] **Étape 3 : ajouter `synced_at` à `UserProfile`**

Dans `web/src/lib/profile/profile.ts`, ajoute le champ à l'interface (garde
`EMPTY_PROFILE` inchangé — le champ est optionnel) :

```ts
export interface UserProfile {
  id: "me";
  // Requis
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  // Optionnels
  linkedin: string;
  updatedAt: number;
  /** Dernière réplication réussie vers le compte. `null` = jamais envoyé. */
  synced_at?: string | null;
}
```

- [ ] **Étape 4 : typer la ligne locale `jobProfile`**

Dans `web/src/lib/storage/db.ts`, remplace la déclaration de table (l. 133) et
exporte le type, car `syncMapping.ts` et `syncEngine.ts` en ont besoin :

```ts
/** Ligne locale des critères de recherche (singleton "me"), avec ses champs de sync. */
export type JobProfileRow = {
  id: "me";
  profile: JobSearchProfile;
  updatedAt?: number;
  synced_at?: string | null;
};
```

puis, dans la classe :

```ts
  jobProfile!: Table<JobProfileRow, string>; // Primary key: id (singleton "me")
```

- [ ] **Étape 5 : écrire les mappings**

À la fin de `web/src/lib/storage/syncMapping.ts` :

```ts
import type { UserProfile } from '@/lib/profile/profile';
import type { JobProfileRow } from './db';

/**
 * Réglages répliqués. `id` porte la clé du réglage ('profile' | 'jobProfile')
 * et non un UUID : ce sont des singletons par utilisateur, et la colonne
 * s'appelle `id` pour rester compatible avec `filterOutStalePush()`.
 */
export interface RemoteUserSettingRow {
  user_id?: string;
  id: 'profile' | 'jobProfile';
  content: Record<string, unknown>;
  deleted_at?: string | null;
  client_updated_at: string;
  updated_at?: string;
}

export function profileToRemoteSetting(p: UserProfile, userId: string): RemoteUserSettingRow {
  return {
    user_id: userId,
    id: 'profile',
    content: { ...p } as unknown as Record<string, unknown>,
    client_updated_at: toIso(p.updatedAt || Date.now()),
  };
}

export function remoteSettingToProfile(row: RemoteUserSettingRow): UserProfile {
  const c = row.content as Partial<UserProfile>;
  return {
    id: 'me',
    prenom: c.prenom ?? '',
    nom: c.nom ?? '',
    email: c.email ?? '',
    telephone: c.telephone ?? '',
    ville: c.ville ?? '',
    linkedin: c.linkedin ?? '',
    updatedAt: c.updatedAt ?? new Date(row.client_updated_at).getTime(),
    synced_at: null,
  };
}

export function jobProfileToRemoteSetting(row: JobProfileRow, userId: string): RemoteUserSettingRow {
  return {
    user_id: userId,
    id: 'jobProfile',
    content: { profile: row.profile } as unknown as Record<string, unknown>,
    client_updated_at: toIso(row.updatedAt || Date.now()),
  };
}

export function remoteSettingToJobProfile(row: RemoteUserSettingRow): JobProfileRow {
  const c = row.content as { profile?: JobProfileRow['profile'] };
  return {
    id: 'me',
    profile: c.profile as JobProfileRow['profile'],
    updatedAt: new Date(row.client_updated_at).getTime(),
    synced_at: null,
  };
}
```

Note : `remoteSettingToProfile` pose `synced_at: null`, et `syncEngine` le
corrigera au moment du pull (task 3) — une valeur fraîchement descendue ne doit
pas repartir aussitôt.

- [ ] **Étape 6 : horodater les réglages à l'écriture**

Dans `web/src/lib/storage/db.ts`, `saveProfile` et `saveJobProfile` doivent
marquer la ligne « à envoyer » (`synced_at: null`) — sans ça, `pendingPush()`
ne la verra jamais :

```ts
export async function saveProfile(p: UserProfile): Promise<void> {
  try {
    await db.profile.put({ ...p, id: "me", updatedAt: Date.now(), synced_at: null });
  } catch (e) {
    console.warn("saveProfile error:", e);
  }
}
```

```ts
export async function saveJobProfile(profile: JobSearchProfile): Promise<void> {
  try {
    await db.jobProfile.put({ id: "me", profile, updatedAt: Date.now(), synced_at: null });
  } catch (e) {
    console.warn("saveJobProfile error:", e);
  }
}
```

- [ ] **Étape 7 : lancer les tests, vérifier qu'ils sont VERTS**

```bash
npx vitest run src/lib/storage/syncMapping.test.ts
```

- [ ] **Étape 8 : vérification complète**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 9 : commit**

```bash
git add web/src/lib/storage/syncMapping.ts web/src/lib/storage/syncMapping.test.ts web/src/lib/storage/db.ts web/src/lib/profile/profile.ts
git commit -m "feat(sync): mapping des reglages profil et criteres de recherche"
```

---

## Task 3 : répliquer les réglages (push, pull, purge)

**Fichiers :**
- Modifier : `web/src/lib/storage/syncEngine.ts` (`filterOutStalePush` l. 26, `purgeLocalData` l. 102-122, `pushAll` fin, `pullAll` fin)
- Test : `web/src/lib/storage/syncEngine.test.ts` (ajouts)

**Interfaces :**
- Consomme : les mappings de la task 2, `pendingPush`/`toIso` de `syncFields.ts`.
- Produit : `pushAll()` et `pullAll()` traitent en plus la table `user_settings` ; `purgeLocalData()` vide `profile` et `jobProfile`.

- [ ] **Étape 1 : écrire le test (il doit échouer)**

Ajoute dans `web/src/lib/storage/syncEngine.test.ts`, à l'intérieur du
`describe('SyncEngine', ...)` existant :

```ts
  it('un réglage jamais synchronisé est candidat au push', async () => {
    const { pendingPush } = await import('./syncFields');
    const profil = { id: 'me', updatedAt: Date.parse('2026-08-15T10:00:00Z'), synced_at: null };
    expect(pendingPush([profil])).toHaveLength(1);
  });

  it('un réglage déjà synchronisé et non modifié ne repart pas', async () => {
    const { pendingPush } = await import('./syncFields');
    const profil = {
      id: 'me',
      updatedAt: Date.parse('2026-08-15T10:00:00Z'),
      synced_at: '2026-08-15T10:00:01.000Z',
    };
    expect(pendingPush([profil])).toHaveLength(0);
  });
```

- [ ] **Étape 2 : lancer, vérifier ROUGE ou VERT**

```bash
npx vitest run src/lib/storage/syncEngine.test.ts
```

Ces deux tests peuvent passer immédiatement : `pendingPush` est générique et
gère déjà `updatedAt`. **C'est attendu** — ils verrouillent le contrat sur
lequel repose la suite. S'ils échouent, `pendingPush` ne traite pas les lignes
en `updatedAt` numérique et il faut le corriger avant de continuer.

- [ ] **Étape 3 : autoriser la table dans `filterOutStalePush`**

`web/src/lib/storage/syncEngine.ts`, l. 26 :

```ts
  table: 'resumes' | 'letters' | 'applications' | 'saved_jobs' | 'user_settings',
```

- [ ] **Étape 4 : purger les réglages à la déconnexion**

Sans ça, le profil d'un utilisateur reste visible pour le suivant sur la même
machine. Dans `purgeLocalData` :

```ts
    await db.transaction('rw', [db.history, db.jobs, db.applications, db.snapshots, db.drafts, db.profile, db.jobProfile], async () => {
      await db.history.clear();
      await db.jobs.clear();
      await db.applications.clear();
      await db.snapshots.clear();
      await db.drafts.clear();
      await db.profile.clear();
      await db.jobProfile.clear();
    });
```

et, dans le bloc `localStorage` de la même fonction, ajoute :

```ts
      localStorage.removeItem('sync_cursor_user_settings');
```

- [ ] **Étape 5 : envoyer les réglages**

À la fin de `pushAll()`, après le bloc « 3. Saved Jobs » :

```ts
  // 4. Réglages (profil « Mes infos », critères de recherche d'offres).
  //    Deux singletons : une ligne distante chacun, arbitrée comme le reste.
  const settingsToPush: RemoteUserSettingRow[] = [];

  const localProfile = await db.profile.get('me');
  if (localProfile && pendingPush([localProfile]).length > 0) {
    settingsToPush.push(profileToRemoteSetting(localProfile, user.id));
  }

  const localJobProfile = await db.jobProfile.get('me');
  if (localJobProfile && pendingPush([localJobProfile]).length > 0) {
    settingsToPush.push(jobProfileToRemoteSetting(localJobProfile, user.id));
  }

  if (settingsToPush.length > 0) {
    const freshSettings = await filterOutStalePush(supabase, 'user_settings', settingsToPush);
    if (freshSettings.length > 0) {
      const { error } = await supabase.from('user_settings').upsert(freshSettings);
      if (!error) {
        const nowIso = new Date().toISOString();
        for (const row of freshSettings) {
          if (row.id === 'profile') await db.profile.update('me', { synced_at: nowIso });
          else await db.jobProfile.update('me', { synced_at: nowIso });
        }
      }
    }
  }
```

Ajoute les imports nécessaires en tête de `syncEngine.ts` :

```ts
import {
  // …imports existants…
  profileToRemoteSetting,
  remoteSettingToProfile,
  jobProfileToRemoteSetting,
  remoteSettingToJobProfile,
  type RemoteUserSettingRow,
} from './syncMapping';
```

- [ ] **Étape 6 : rapatrier les réglages**

À la fin de `pullAll()`, après le bloc « 4. Pull Saved Jobs » :

```ts
  // 5. Pull Réglages. `synced_at` est posé à maintenant : une valeur qui vient
  //    d'arriver ne doit pas repartir au push suivant.
  const settingsCursor = getCursor('sync_cursor_user_settings');
  const { data: remoteSettings } = await supabase
    .from('user_settings')
    .select('*')
    .gt('updated_at', settingsCursor);

  if (remoteSettings && remoteSettings.length > 0) {
    let maxUpdatedAt = settingsCursor;
    const nowIso = new Date().toISOString();
    for (const sRow of remoteSettings as RemoteUserSettingRow[]) {
      if (sRow.updated_at && sRow.updated_at > maxUpdatedAt) {
        maxUpdatedAt = sRow.updated_at;
      }
      if (sRow.id === 'profile') {
        const local = await db.profile.get('me');
        if (!local || resolveConflict(local, sRow) === 'remote') {
          await db.profile.put({ ...remoteSettingToProfile(sRow), synced_at: nowIso });
        }
      } else if (sRow.id === 'jobProfile') {
        const local = await db.jobProfile.get('me');
        if (!local || resolveConflict(local, sRow) === 'remote') {
          await db.jobProfile.put({ ...remoteSettingToJobProfile(sRow), synced_at: nowIso });
        }
      }
    }
    setCursor('sync_cursor_user_settings', maxUpdatedAt);
  }
```

- [ ] **Étape 7 : vérification complète**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 8 : commit**

```bash
git add web/src/lib/storage/syncEngine.ts web/src/lib/storage/syncEngine.test.ts
git commit -m "feat(sync): replique le profil et les criteres de recherche"
```

---

## Task 4 : l'écran se rafraîchit quand les données arrivent

**Fichiers :**
- Créer : `web/src/lib/storage/syncEvents.ts`
- Créer : `web/src/lib/storage/syncEvents.test.ts`
- Modifier : `web/src/lib/storage/syncEngine.ts` (`pullAll`)
- Modifier : `web/src/components/applications/ApplicationsScreen.tsx`
- Modifier : `web/src/components/applications/ResumeShelf.tsx`

**Interfaces :**
- Produit : `onSyncChange(listener: () => void): () => void` (rend la fonction de désabonnement) et `emitSyncChange(): void`, exportés depuis `syncEvents.ts`.
- Consomme : `pullAll()` appelle `emitSyncChange()` **uniquement** s'il a écrit au moins une ligne locale.

**Pourquoi pas `dexie-react-hooks`** : ce serait une dépendance npm, interdite
par les contraintes globales. Un émetteur de six lignes suffit.

- [ ] **Étape 1 : écrire le test (il doit échouer)**

Crée `web/src/lib/storage/syncEvents.test.ts` :

```ts
import { describe, it, expect, vi } from 'vitest';
import { onSyncChange, emitSyncChange } from './syncEvents';

describe('syncEvents', () => {
  it('prévient les abonnés', () => {
    const vu = vi.fn();
    const off = onSyncChange(vu);
    emitSyncChange();
    expect(vu).toHaveBeenCalledTimes(1);
    off();
  });

  it('ne prévient plus après désabonnement', () => {
    const vu = vi.fn();
    onSyncChange(vu)();
    emitSyncChange();
    expect(vu).not.toHaveBeenCalled();
  });

  it('un abonné qui se désabonne pendant l\'émission ne casse pas les suivants', () => {
    const suivant = vi.fn();
    const off = onSyncChange(() => off());
    onSyncChange(suivant);
    emitSyncChange();
    expect(suivant).toHaveBeenCalledTimes(1);
    off();
  });
});
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/syncEvents.test.ts
```

Attendu : ÉCHEC, le module `./syncEvents` n'existe pas.

- [ ] **Étape 3 : écrire l'émetteur**

```ts
/**
 * Signal émis quand une synchronisation descendante a modifié des données
 * locales. Les écrans qui lisent IndexedDB une fois au montage s'y abonnent :
 * sans ça, les données arrivées en tâche de fond ne s'affichent qu'après F5.
 *
 * Pas de `dexie-react-hooks` : ce serait une dépendance npm, interdite par le
 * cadrage sans instruction explicite.
 */
type SyncListener = () => void;

const listeners = new Set<SyncListener>();

export function onSyncChange(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSyncChange(): void {
  // Copie : un abonné peut se désabonner pendant l'émission.
  for (const listener of [...listeners]) listener();
}
```

- [ ] **Étape 4 : lancer, vérifier VERT**

```bash
npx vitest run src/lib/storage/syncEvents.test.ts
```

- [ ] **Étape 5 : émettre depuis `pullAll`**

Dans `web/src/lib/storage/syncEngine.ts`, importe `emitSyncChange` depuis
`./syncEvents`, puis, au tout début du corps de `pullAll()` (après les gardes
`supabase` et `user`) :

```ts
  let aEcrit = false;
```

Passe `aEcrit = true;` juste après **chaque** `db.<table>.put(...)` des cinq
blocs de `pullAll` (resumes, letters, applications, saved_jobs, réglages). Par
exemple, pour le bloc resumes :

```ts
      if (!local || resolveConflict(local, rRow) === 'remote') {
        await db.history.put(mergeRemoteHistory(local, remoteResumeToHistory(rRow)));
        aEcrit = true;
      }
```

Puis, en toute fin de fonction :

```ts
  if (aEcrit) emitSyncChange();
```

- [ ] **Étape 6 : abonner « Mes candidatures »**

Dans `web/src/components/applications/ApplicationsScreen.tsx`, `load` existe
déjà (l. 26-29). Ajoute l'import `import { onSyncChange } from "@/lib/storage/syncEvents";`
et, après le `useEffect` de chargement initial :

```ts
  // La synchronisation écrit dans IndexedDB en tâche de fond : sans cet
  // abonnement, les données rapatriées n'apparaissent qu'après un F5.
  useEffect(() => onSyncChange(() => { void load(); }), [load]);
```

- [ ] **Étape 7 : abonner « Mes CV »**

Dans `web/src/components/applications/ResumeShelf.tsx`, repère la fonction
`load` utilisée par `remove` (l. 47-51) et le `useEffect` qui l'appelle au
montage. Ajoute le même import et le même abonnement :

```ts
  useEffect(() => onSyncChange(() => { void load(); }), [load]);
```

Si `load` n'est pas déjà mémoïsé avec `useCallback`, enveloppe-le avec
`useCallback(..., [])` pour éviter un réabonnement à chaque rendu. C'est le
seul changement autorisé sur cette fonction.

- [ ] **Étape 8 : vérification complète, e2e inclus**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

- [ ] **Étape 9 : commit**

```bash
git add web/src/lib/storage/syncEvents.ts web/src/lib/storage/syncEvents.test.ts web/src/lib/storage/syncEngine.ts web/src/components/applications/ApplicationsScreen.tsx web/src/components/applications/ResumeShelf.tsx
git commit -m "feat(sync): rafraichit les ecrans a l'arrivee des donnees"
```

---

## Task 5 : enregistrer un document sans passer par le PDF

**Fichiers :**
- Créer : `web/src/lib/storage/saveDocument.ts`
- Créer : `web/src/lib/storage/saveDocument.test.ts`
- Modifier : `web/src/components/layout/TopBar.tsx:87-110` (l'export réutilise le module)

**Interfaces :**
- Produit : `saveCurrentDocument(): Promise<'account' | 'device'>` — enregistre le document courant du `docStore` dans `db.history`, rattache la candidature, puis tente l'envoi. Rend `'account'` si l'envoi a abouti, `'device'` sinon (hors ligne, non connecté, erreur).
- Consomme : `upsertApplicationForDocument`, `pruneAnonymousShelf` (`@/lib/applications/store`), `saveHistoryEntry` (`@/lib/storage/db`), `pushAll` (`@/lib/storage/syncEngine`), `useAuthStore` (`@/state/authStore`), `useDocStore` (`@/state/docStore`).

**Pourquoi un module séparé :** la logique vit aujourd'hui à l'intérieur de
`onConvert` dans la TopBar (l. 87-110), donc inatteignable autrement qu'en
téléchargeant un PDF, et intestable. On l'extrait telle quelle — même ordre,
mêmes champs — et les deux boutons l'appellent.

- [ ] **Étape 1 : écrire le test (il doit échouer)**

Crée `web/src/lib/storage/saveDocument.test.ts` :

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/storage/db', () => ({ saveHistoryEntry: vi.fn(async () => {}) }));
vi.mock('@/lib/applications/store', () => ({
  upsertApplicationForDocument: vi.fn(async () => 'app-1'),
  pruneAnonymousShelf: vi.fn(async () => {}),
}));
vi.mock('@/lib/storage/syncEngine', () => ({ pushAll: vi.fn(async () => {}) }));
vi.mock('@/state/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) },
}));

import { saveHistoryEntry } from '@/lib/storage/db';
import { pushAll } from '@/lib/storage/syncEngine';
import { useDocStore } from '@/state/docStore';
import { DEFAULT_RESUME } from '@/lib/resume/defaults';
import { saveCurrentDocument } from './saveDocument';

beforeEach(() => {
  vi.clearAllMocks();
  useDocStore.setState({
    docType: 'CV',
    json: { ...DEFAULT_RESUME, name: 'Hariss' },
    company: 'ACME',
    role: 'Dev',
    templateId: 'sobre',
  });
});

describe('saveCurrentDocument', () => {
  it('écrit dans l\'historique sans générer aucun PDF', async () => {
    await saveCurrentDocument();
    expect(vi.mocked(saveHistoryEntry)).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(saveHistoryEntry).mock.calls[0][0];
    expect(entry.doc_type).toBe('CV');
    expect(entry.company).toBe('ACME');
    expect(entry.json).toEqual(useDocStore.getState().json);
  });

  it('rend "account" quand l\'envoi aboutit', async () => {
    expect(await saveCurrentDocument()).toBe('account');
    expect(vi.mocked(pushAll)).toHaveBeenCalledTimes(1);
  });

  it('rend "device" quand l\'envoi échoue, sans faire échouer l\'enregistrement', async () => {
    vi.mocked(pushAll).mockRejectedValueOnce(new Error('offline'));
    expect(await saveCurrentDocument()).toBe('device');
    expect(vi.mocked(saveHistoryEntry)).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/saveDocument.test.ts
```

Attendu : ÉCHEC, le module `./saveDocument` n'existe pas.

- [ ] **Étape 3 : écrire le module**

```ts
import { useDocStore, type DocData } from "@/state/docStore";
import { useAuthStore } from "@/state/authStore";
import { saveHistoryEntry } from "@/lib/storage/db";
import { upsertApplicationForDocument, pruneAnonymousShelf } from "@/lib/applications/store";
import { pushAll } from "@/lib/storage/syncEngine";
import type { Resume, Letter, DocType } from "@/lib/resume/schema";

/** Nom de la personne selon le type : `sender_name` pour une lettre, `name` pour un CV. */
function personNameFor(docType: DocType, json: DocData): string {
  const name = docType === "Lettre" ? (json as Letter).sender_name : (json as Resume).name;
  return name?.trim() || docType;
}

/**
 * Enregistre le document courant dans « Mes candidatures » / « Mes CV », puis
 * tente de l'envoyer sur le compte.
 *
 * Extrait de `TopBar.onConvert`, où il n'était atteignable qu'en téléchargeant
 * un PDF — un CV jamais exporté n'existait donc nulle part (spec §2, constat 1).
 *
 * L'envoi ne peut jamais faire échouer l'enregistrement local : on rend
 * `'device'` et l'interface l'annonce honnêtement.
 */
export async function saveCurrentDocument(): Promise<'account' | 'device'> {
  const { company, role, docType, json, templateId } = useDocStore.getState();
  const name = personNameFor(docType, json);

  const applicationId = await upsertApplicationForDocument({ company, role, source: "generated" });
  const entryId = crypto.randomUUID();
  await saveHistoryEntry({
    id: entryId,
    created_at: new Date().toISOString(),
    doc_type: docType,
    company,
    role,
    job_desc: "",
    filename: `${name} - ${docType}.pdf`,
    notes: "",
    pdf_views: 0,
    editor_reloads: 0,
    last_viewed_at: new Date().toISOString(),
    json: structuredClone(json),
    templateId,
    applicationId,
  });
  if (!applicationId) await pruneAnonymousShelf(docType, entryId);

  if (!useAuthStore.getState().user) return 'device';
  try {
    await pushAll();
    return 'account';
  } catch (e) {
    console.warn("Envoi vers le compte impossible :", e);
    return 'device';
  }
}
```

- [ ] **Étape 4 : lancer, vérifier VERT**

```bash
npx vitest run src/lib/storage/saveDocument.test.ts
```

- [ ] **Étape 5 : faire passer l'export PDF par le module**

Dans `web/src/components/layout/TopBar.tsx`, remplace le bloc l. 87-110 (de
`// Une candidature naît de l'export…` jusqu'à `if (!applicationId) await pruneAnonymousShelf(...)`)
par un appel unique :

```ts
      // Le téléchargement enregistre toujours, comme avant — il n'en est
      // simplement plus le seul moyen (bouton « Enregistrer », task 6).
      await saveCurrentDocument();
```

Ajoute `import { saveCurrentDocument } from "@/lib/storage/saveDocument";` et
supprime les imports devenus inutilisés dans ce fichier (`saveHistoryEntry`,
`upsertApplicationForDocument`, `pruneAnonymousShelf`) **uniquement s'ils ne
servent plus nulle part ailleurs dans le fichier** — `npm run lint` te le dira.
`personNameFor` reste dans `TopBar.tsx` si `buildPdfFilename` ou un autre appel
l'utilise encore ; sinon supprime-la aussi.

⚠️ Différence assumée : `pdf_views` passe de `1` à `0` dans le module, et
l'export ne le remonte pas. Un compteur de vues PDF à 1 dès l'enregistrement
serait faux maintenant qu'on enregistre sans générer de PDF. Signale-le dans ton
rapport.

- [ ] **Étape 6 : envoyer aussi après une suppression ou un changement de statut**

Spec §4.2 : l'envoi part après **chaque écriture qui compte**, pas seulement
l'enregistrement. Sans ça, une suppression faite ici réapparaît sur l'autre
appareil, et un statut de candidature ne voyage pas.

Dans `web/src/lib/applications/store.ts`, ajoute
`import { pushAll } from "@/lib/storage/syncEngine";` puis, en **dernière ligne
du corps** de ces quatre fonctions déjà existantes :

- `addApplicationEvent` (l. 69)
- `undoLastStatusEvent` (l. 84)
- `deleteApplication` (l. 113)
- `setShelfLabel` (l. 152)

```ts
  void pushAll();
```

`void` et non `await` : l'envoi ne doit jamais retarder ni faire échouer
l'action locale. Ne touche à **rien d'autre** dans ces fonctions.

⚠️ **N'ajoute rien dans `db.ts`.** `syncEngine.ts` importe `db.ts` : y importer
`pushAll` créerait un import circulaire. Pour la suppression d'un document,
l'appel va donc dans le composant appelant — `web/src/components/applications/ResumeShelf.tsx`,
fonction `remove`, après `await deleteHistoryEntry(doc.id);` :

```ts
    void pushAll();
```

⚠️ Ne mets pas d'appel dans `saveApplicationNotes` : elle est déclenchée par
une auto-sauvegarde débouncée à 800 ms pendant la frappe
(`ApplicationCard.tsx:49`), donc un envoi par pause de frappe. Les notes
repartiront au prochain envoi déclenché par une autre action.

- [ ] **Étape 7 : vérification complète, e2e inclus**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

- [ ] **Étape 8 : commit**

```bash
git add web/src/lib/storage/saveDocument.ts web/src/lib/storage/saveDocument.test.ts web/src/components/layout/TopBar.tsx web/src/lib/applications/store.ts web/src/components/applications/ResumeShelf.tsx
git commit -m "feat(save): extrait l'enregistrement du document hors de l'export PDF"
```

---

## Task 6 : le bouton « Enregistrer » et l'état visible

**Fichiers :**
- Créer : `web/src/state/saveStateStore.ts`
- Créer : `web/src/state/saveStateStore.test.ts`
- Modifier : `web/src/components/layout/TopBar.tsx`
- Modifier : `web/src/app/globals.css` (classe de l'indicateur)

**Interfaces :**
- Produit : `useSaveStateStore` (Zustand) exposant `{ state: 'dirty' | 'device' | 'account', markDirty(): void, markSaved(where: 'device' | 'account'): void }`.
- Consomme : `saveCurrentDocument()` (task 5), `useDocStore.subscribe`.

**Pourquoi l'indicateur fait partie de la task** (spec §4.4) : l'auto-sauvegarde
locale fait persister le travail d'un rechargement à l'autre. Sans état affiché,
l'utilisateur en déduit que tout est à l'abri, ne clique jamais sur
« Enregistrer », et ne retrouve rien sur un autre appareil — le bug d'origine,
avec un bouton en plus.

- [ ] **Étape 1 : écrire le test (il doit échouer)**

Crée `web/src/state/saveStateStore.test.ts` :

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSaveStateStore } from './saveStateStore';

beforeEach(() => {
  useSaveStateStore.setState({ state: 'dirty' });
});

describe('saveStateStore', () => {
  it('part de "non enregistré"', () => {
    expect(useSaveStateStore.getState().state).toBe('dirty');
  });

  it('passe à "compte" après un enregistrement répliqué', () => {
    useSaveStateStore.getState().markSaved('account');
    expect(useSaveStateStore.getState().state).toBe('account');
  });

  it('n\'annonce jamais le compte quand l\'envoi a échoué', () => {
    useSaveStateStore.getState().markSaved('device');
    expect(useSaveStateStore.getState().state).toBe('device');
  });

  it('repasse à "non enregistré" à la première modification', () => {
    useSaveStateStore.getState().markSaved('account');
    useSaveStateStore.getState().markDirty();
    expect(useSaveStateStore.getState().state).toBe('dirty');
  });
});
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/state/saveStateStore.test.ts
```

- [ ] **Étape 3 : écrire le store**

```ts
import { create } from "zustand";

/**
 * État d'enregistrement affiché en permanence à côté du bouton.
 *
 * `device` et `account` sont distincts à dessein : annoncer « enregistré sur
 * votre compte » alors que l'envoi a échoué (hors ligne, non connecté) est
 * exactement le malentendu que ce chantier répare.
 */
export type SaveState = "dirty" | "device" | "account";

interface SaveStateStore {
  state: SaveState;
  markDirty: () => void;
  markSaved: (where: "device" | "account") => void;
}

export const useSaveStateStore = create<SaveStateStore>((set) => ({
  state: "dirty",
  markDirty: () => set({ state: "dirty" }),
  markSaved: (where) => set({ state: where }),
}));
```

- [ ] **Étape 4 : lancer, vérifier VERT**

```bash
npx vitest run src/state/saveStateStore.test.ts
```

- [ ] **Étape 5 : marquer « modifié » et poser le bouton**

Dans `web/src/components/layout/TopBar.tsx`, ajoute les imports :

```ts
import { useSaveStateStore } from "@/state/saveStateStore";
import { saveCurrentDocument } from "@/lib/storage/saveDocument";
```

Puis, dans le composant, après les sélecteurs existants :

```ts
  const saveState = useSaveStateStore((s) => s.state);
  const [saving, setSaving] = useState(false);

  // Toute modification du document repasse l'état à « non enregistré ».
  useEffect(() => {
    const { markDirty } = useSaveStateStore.getState();
    return useDocStore.subscribe((s, prev) => {
      if (s.json !== prev.json || s.templateId !== prev.templateId
        || s.company !== prev.company || s.role !== prev.role) {
        markDirty();
      }
    });
  }, []);

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const where = await saveCurrentDocument();
      useSaveStateStore.getState().markSaved(where);
      toast(where === "account" ? "Enregistré sur votre compte." : "Enregistré sur cet appareil.", "success");
    } catch {
      await uiAlert("Impossible d'enregistrer ce document.", "Enregistrement");
    } finally {
      setSaving(false);
    }
  }, [saving]);
```

Et, dans la zone droite du JSX, **avant** le bouton « Télécharger » (l. 175) :

```tsx
        <span className="save-state" data-state={saveState} title="État d'enregistrement">
          {saveState === "dirty" && "Modifications non enregistrées"}
          {saveState === "device" && "Enregistré sur cet appareil"}
          {saveState === "account" && "Enregistré sur votre compte"}
        </span>

        <button type="button" className="btn-nav mobile-hidden" onClick={onSave} disabled={saving}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
```

Dans `onConvert`, remplace l'appel `await saveCurrentDocument();` de la task 5
par la version qui met aussi l'état à jour :

```ts
      useSaveStateStore.getState().markSaved(await saveCurrentDocument());
```

- [ ] **Étape 6 : styler l'indicateur**

Dans `web/src/app/globals.css`, à côté des styles `.topbar-pill` existants —
**variables de thème uniquement, aucune couleur en dur** :

```css
/* État d'enregistrement, à côté du bouton « Enregistrer ». Discret quand tout
   va bien, lisible quand il reste du travail non enregistré. */
.save-state {
  font-size: 12px;
  white-space: nowrap;
  color: var(--muted);
}
.save-state[data-state="dirty"] {
  color: var(--text);
  font-weight: 600;
}
```

Vérifie le nom réel des variables dans `globals.css` avant d'écrire : si
`--muted` n'existe pas, prends celle utilisée par `.topbar-pill`. **Ne crée pas
de nouvelle variable de thème.**

- [ ] **Étape 7 : vérification complète, e2e inclus**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

- [ ] **Étape 8 : commit**

```bash
git add web/src/state/saveStateStore.ts web/src/state/saveStateStore.test.ts web/src/components/layout/TopBar.tsx web/src/app/globals.css
git commit -m "feat(save): bouton Enregistrer et etat d'enregistrement visible"
```

---

## Task 7 : vérification manuelle sur deux navigateurs

**Fichiers :** aucun (sauf correction si un défaut apparaît).

C'est le critère de succès de la spec (§6). Une exécution réelle, pas un
raisonnement : colle dans ton rapport ce que tu as **vu**, écran par écran.

**Prérequis :** la migration de la task 1 doit avoir été appliquée sur Supabase
par l'humain. Si ce n'est pas le cas, **arrête-toi et demande** — les tasks 3 à
6 ne peuvent pas être validées sans elle.

- [ ] **Étape 1 : lancer l'application**

```bash
npm run dev
```

Si un changement CSS ne s'affiche pas ou qu'un e2e échoue bizarrement :
supprime `web/.next`, vérifie qu'aucun serveur ne traîne sur le port 3000,
relance (piège Turbopack, cadrage §1).

- [ ] **Étape 2 : navigateur A, connecté**

Se connecter avec Google. Remplir « Mes infos » (prénom, nom, email, ville).
Créer un CV, y écrire un nom reconnaissable. **Vérifier que l'indicateur affiche
« Modifications non enregistrées ».** Cliquer sur **Enregistrer**. Vérifier qu'il
affiche « Enregistré sur votre compte ». Fermer l'onglet **sans se déconnecter**.

- [ ] **Étape 3 : navigateur B, profil vierge**

Ouvrir un autre navigateur (ou une fenêtre privée). Se connecter au même compte.

**Attendu, sans aucun rechargement de page :**
- le CV apparaît dans « Mes CV » de la page `/candidatures` ;
- « Mes infos » est pré-rempli avec les valeurs saisies sur A.

- [ ] **Étape 4 : l'état, déconnecté**

Sur le navigateur B, se déconnecter. Modifier le document : l'indicateur passe à
« Modifications non enregistrées ». Cliquer sur Enregistrer : il doit afficher
**« Enregistré sur cet appareil »**, jamais « sur votre compte ».

- [ ] **Étape 5 : rapport**

Colle le déroulé observé, étape par étape. Si l'une échoue, **n'invente aucune
explication** : décris ce que tu as vu et arrête-toi.

- [ ] **Étape 6 : journal**

Ajoute l'entrée datée dans `WORK_HISTORY.md` : ce qui a été fait, pourquoi,
fichiers touchés, résultat des vérifications.

```bash
git add WORK_HISTORY.md
git commit -m "docs(journal): chantier sync compte restitution verifie de bout en bout"
```
