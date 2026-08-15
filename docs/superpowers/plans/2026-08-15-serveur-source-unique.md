# Le serveur devient la source unique — plan d'exécution

> **Pour l'agent d'exécution :** ce plan se lit avec `.agents/rules/cadrage.md`,
> qui est la loi. Une task = un lot = un commit. Interdiction de commencer une
> task tant que la précédente n'a pas passé sa vérification.

**Spec :** `docs/superpowers/specs/2026-08-15-serveur-source-unique-design.md`

**But :** supprimer la double copie des données. Le serveur devient la seule
source de vérité pour ce qui appartient à l'utilisateur ; l'appareil ne garde que
le brouillon en cours, l'annuler/rétablir et trois caches techniques.

**Architecture :** `db.ts` est un comptoir — aucun composant ne parle à Dexie
directement (vérifié le 15/08/2026). On réécrit l'intérieur du comptoir en
appels Supabase, on ajoute une mémoire de session, et on supprime les 740 lignes
du moteur de réplication. Les listes ne rapatrient plus les contenus.

**Pile :** Next.js 16, React 19, TypeScript strict, Zustand, Dexie (résiduel),
Supabase (PostgreSQL + RLS), Vitest, Playwright.

## Contraintes globales

- **Aucune dépendance npm ajoutée ou mise à jour.** Ni React Query, ni SWR, ni
  quoi que ce soit d'autre : la mémoire de session est écrite à la main (task 2).
- **Pas de `any`, `@ts-ignore`, `eslint-disable` ajouté.** `tsc` en strict.
- **Aucun composant n'importe `createBrowserClientHelper` ni `@supabase/*`.**
  Tout passe par `db.ts`. C'est la propriété qui rend ce chantier faisable ; la
  casser le rend irréversible.
- **Jamais `alert`/`confirm`/`prompt` natifs** → `uiAlert`/`uiConfirm`/`uiPrompt`/
  `toast` (`@/state/uiStore`). **Jamais de couleur en dur** → variables de thème.
- **Tu ne modifies pas un test existant pour le faire passer**, sauf quand ce
  plan te le demande explicitement (tasks 3, 7 : le contrat change).
- **PUSH GIT STRICTEMENT INTERDIT.** Commits locaux, un par task, en français.
- **Tu ne supprimes aucun fichier avant la task 7.** Le moteur de réplication
  reste en place et fonctionnel jusque-là — il sert à la reprise des données.
- Après chaque task, journal daté dans `WORK_HISTORY.md`.

**Vérification après CHAQUE task**, depuis `web/` :

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

`npx playwright test` en plus aux tasks 3, 8 et 9.

## Règle de comportement en cas d'échec réseau

Elle vaut pour tout le chantier, c'est la leçon du bug `37e4f4a` :

- **Une lecture qui échoue lève une erreur** (`RemoteError`, task 2). Elle ne
  rend jamais `[]` ni `null` : une liste vide est un fait, pas une panne, et les
  confondre est exactement ce qui a produit les bugs de la journée.
- **Une écriture qui échoue lève.** L'appelant décide quoi afficher.
- **Aucune fonction n'avale une erreur silencieusement.** Le `try/catch` +
  `console.warn` + valeur de repli, présent partout dans `db.ts` aujourd'hui,
  disparaît des fonctions converties.

## Ce qui reste local — ne pas y toucher

`drafts` (brouillon en cours), `snapshots` (annuler/rétablir), `commuteCache`,
`atsDirectory`, `apiUsage`. Leurs fonctions dans `db.ts` ne changent pas.

## Structure des fichiers

| Fichier | Responsabilité | Task |
|---|---|---|
| `web/supabase/migrations/0003_documents_templates.sql` *(créé)* | Tables `documents` et `templates`, reprise depuis `resumes`/`letters` | 1 |
| `web/src/lib/storage/remote.ts` *(créé)* | Accès Supabase + `RemoteError` | 2 |
| `web/src/lib/storage/sessionCache.ts` *(créé)* | Mémoire de session et son invalidation | 2 |
| `web/src/lib/storage/db.ts` *(modifié)* | Le comptoir : signatures inchangées, intérieur distant | 3, 4, 5 |
| `web/src/lib/storage/master.ts` *(modifié)* | Le CV Maître devient un document | 6 |
| `web/src/lib/storage/reprise.ts` *(créé)* | Envoi unique des données locales d'avant la bascule | 7 |
| `web/src/state/authStore.ts` *(modifié)* | Déclenche la reprise, ne synchronise plus | 7 |
| `web/src/components/**` *(modifié)* | États d'erreur + « Réessayer » | 8 |

---

## Task 1 : le schéma serveur

**Fichiers :**
- Créer : `web/supabase/migrations/0003_documents_templates.sql`

**Interfaces :**
- Produit : `public.documents` et `public.templates`, consommées par les tasks 3, 5 et 6.

- [ ] **Étape 1 : lire le modèle existant**

Lis `web/supabase/migrations/0001_auth_quotas.sql` : table `resumes` (l. 49-60),
trigger `touch_updated_at` (l. 135-155), policies `*_own` (l. 323-336). Les
nouvelles tables les copient, **moins** `client_updated_at`, `synced_at` et
`deleted_at` : sans réplication, l'horloge serveur suffit et une suppression est
une suppression.

- [ ] **Étape 2 : écrire la migration**

```sql
-- ---------------------------------------------------------------------
-- 0003 — Le serveur devient la source unique.
--
-- `documents` remplace `resumes` + `letters`. Le découpage en deux tables
-- était un héritage du moteur de réplication, qui triait par type à
-- l'envoi. Il a déjà coûté : `DocType` vaut 'CV' | 'Lettre' | 'Maître'
-- (schema.ts:152) et les CV Maîtres, ne correspondant à aucune des deux
-- tables, n'étaient répliqués nulle part.
--
-- Pas de client_updated_at / synced_at / deleted_at : plus de copie
-- concurrente à arbitrer, donc plus rien à horodater côté client.
-- ---------------------------------------------------------------------
CREATE TABLE public.documents (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  doc_type       TEXT NOT NULL CHECK (doc_type IN ('CV', 'Lettre', 'Maître')),
  title          TEXT NOT NULL DEFAULT '',
  company        TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT '',
  label          TEXT,
  content        JSONB NOT NULL,
  template_id    TEXT,
  application_id TEXT,
  notes          TEXT NOT NULL DEFAULT '',
  job_desc       TEXT NOT NULL DEFAULT '',
  pdf_views      INT NOT NULL DEFAULT 0,
  editor_reloads INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Index de liste : l'écran « Mes candidatures » trie par date décroissante.
CREATE INDEX documents_user_created_idx
  ON public.documents (user_id, created_at DESC);

CREATE TABLE public.templates (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL,
  letter_subject TEXT NOT NULL DEFAULT '',
  letter_body    TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TRIGGER trg_documents_touch BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_templates_touch BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_own" ON public.documents
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "templates_own" ON public.templates
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- REPRISE : les lignes déjà répliquées rejoignent `documents`.
-- `resumes` et `letters` sont CONSERVÉES — la bascule reste réversible
-- tant que la vérification manuelle (task 9) n'a pas eu lieu.
-- Les lignes supprimées en douceur (deleted_at) ne sont pas reprises.
-- ---------------------------------------------------------------------
INSERT INTO public.documents (user_id, id, doc_type, title, content, created_at, updated_at)
SELECT user_id, id, 'CV', title, content, created_at, updated_at
FROM public.resumes WHERE deleted_at IS NULL
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.documents (user_id, id, doc_type, title, company, role, content, created_at, updated_at)
SELECT user_id, id, 'Lettre', title, COALESCE(company, ''), COALESCE(job_title, ''), content, created_at, updated_at
FROM public.letters WHERE deleted_at IS NULL
ON CONFLICT (user_id, id) DO NOTHING;
```

- [ ] **Étape 3 : vérifier**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 4 : signaler les deux actions humaines**

Écris dans ton rapport, mot pour mot : **« Deux migrations doivent être
appliquées à la main dans l'éditeur SQL Supabase, dans cet ordre :
`0002_user_settings.sql` puis `0003_documents_templates.sql`. Les tasks 3 et
suivantes ne fonctionnent pas en conditions réelles avant. »** Tu ne les
appliques pas toi-même.

- [ ] **Étape 5 : commit**

```bash
git add web/supabase/migrations/0003_documents_templates.sql
git commit -m "feat(serveur): tables documents et templates, reprise des lignes existantes"
```

---

## Task 2 : l'accès distant et la mémoire de session

**Fichiers :**
- Créer : `web/src/lib/storage/remote.ts`, `web/src/lib/storage/remote.test.ts`
- Créer : `web/src/lib/storage/sessionCache.ts`, `web/src/lib/storage/sessionCache.test.ts`

**Interfaces produites :**

```ts
// remote.ts
export class RemoteError extends Error {
  constructor(message: string, public readonly cause?: unknown);
}
/** Client + identifiant de l'utilisateur. Lève si non configuré ou non connecté. */
export async function requireRemote(): Promise<{ supabase: SupabaseClient; userId: string }>;
/** `null` si non connecté, sans lever — pour les chemins qui tolèrent l'anonymat. */
export async function currentUserId(): Promise<string | null>;

// sessionCache.ts
export function cacheGet<T>(key: string): T | undefined;
export function cacheSet<T>(key: string, value: T): void;
/** Oublie toutes les entrées dont la clé commence par `prefix`. */
export function cacheInvalidate(prefix: string): void;
export function cacheClear(): void;
```

- [ ] **Étape 1 : écrire les tests de la mémoire (ils doivent échouer)**

`web/src/lib/storage/sessionCache.test.ts` :

```ts
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
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/sessionCache.test.ts
```

- [ ] **Étape 3 : écrire la mémoire de session**

```ts
/**
 * Mémoire de session du comptoir : ce que le serveur vient de rendre, réutilisé
 * le temps de la navigation, revérifié en arrière-plan par les appelants.
 *
 * Trois propriétés qui la rendent sûre, à ne pas casser :
 * 1. Elle n'est écrite NULLE PART sur le disque — elle meurt avec l'onglet.
 *    Elle ne peut donc pas montrer les données d'un compte au compte suivant.
 * 2. Toute écriture invalide ce qu'elle touche (`cacheInvalidate`). Le comptoir
 *    étant le seul chemin vers les données, l'invalidation est centralisée.
 * 3. Ce n'est PAS une source de vérité. En cas de doute, le serveur tranche.
 *
 * Volontairement sans React Query ni SWR : dépendance npm interdite par le
 * cadrage, et le besoin tient ici en quelques lignes.
 */
const store = new Map<string, unknown>();

export function cacheGet<T>(key: string): T | undefined {
  return store.has(key) ? (store.get(key) as T) : undefined;
}

export function cacheSet<T>(key: string, value: T): void {
  store.set(key, value);
}

export function cacheInvalidate(prefix: string): void {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}
```

- [ ] **Étape 4 : lancer, vérifier VERT**

```bash
npx vitest run src/lib/storage/sessionCache.test.ts
```

- [ ] **Étape 5 : écrire le test de l'accès distant (il doit échouer)**

`web/src/lib/storage/remote.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createBrowserClientHelper: () => ({ auth: { getSession } }),
}));

import { requireRemote, currentUserId, RemoteError } from './remote';

beforeEach(() => vi.clearAllMocks());

describe('accès distant', () => {
  it('rend le client et l\'utilisateur quand la session existe', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } });
    expect((await requireRemote()).userId).toBe('u-1');
  });

  it('lève une RemoteError quand personne n\'est connecté', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(requireRemote()).rejects.toBeInstanceOf(RemoteError);
  });

  it('currentUserId rend null sans lever quand personne n\'est connecté', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await currentUserId()).toBeNull();
  });
});
```

- [ ] **Étape 6 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/remote.test.ts
```

- [ ] **Étape 7 : écrire l'accès distant**

```ts
import { createBrowserClientHelper } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Panne d'accès aux données : pas de réseau, refus du serveur, session absente.
 *
 * Levée et non avalée, à dessein. `db.ts` rendait jusqu'ici `[]` ou `null` en
 * cas d'échec : une liste vide et une panne devenaient indiscernables, et
 * l'interface annonçait le succès d'écritures refusées (bug 37e4f4a).
 */
export class RemoteError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RemoteError';
  }
}

export async function requireRemote(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = createBrowserClientHelper();
  if (!supabase) throw new RemoteError("Le service de données n'est pas configuré.");
  const { data } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id;
  if (!userId) throw new RemoteError('Connectez-vous pour accéder à vos données.');
  return { supabase, userId };
}

export async function currentUserId(): Promise<string | null> {
  const supabase = createBrowserClientHelper();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}
```

- [ ] **Étape 8 : lancer, vérifier VERT, puis vérification complète**

```bash
npx vitest run src/lib/storage/remote.test.ts
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 9 : commit**

```bash
git add web/src/lib/storage/remote.ts web/src/lib/storage/remote.test.ts web/src/lib/storage/sessionCache.ts web/src/lib/storage/sessionCache.test.ts
git commit -m "feat(serveur): acces distant typé et memoire de session"
```

---

## Task 3 : les documents passent au serveur

**Fichiers :**
- Modifier : `web/src/lib/storage/db.ts` (section « HISTORY API », l. 340-395, et les fonctions documents de la section applications l. 691-742)
- Créer : `web/src/lib/storage/documents.test.ts`
- Modifier : `web/src/lib/storage/saveDocument.ts` (l'appel n'a plus à pousser)

**Interfaces produites — le comptoir garde ses noms, gagne le couple liste/détail :**

```ts
/** Résumé de liste : tout SAUF `json`. C'est le catalogue. */
export type DocumentSummary = Omit<HistoryEntry, 'json'>;

export async function listHistoryEntries(): Promise<DocumentSummary[]>;   // signature élargie
export async function getHistoryEntry(id: string): Promise<HistoryEntry | undefined>;
export async function saveHistoryEntry(entry: HistoryEntry): Promise<void>;
export async function deleteHistoryEntry(id: string): Promise<void>;
export async function deleteHistoryEntries(ids: string[]): Promise<void>;
export async function updateHistoryFields(id: string, fields: Partial<HistoryEntry>): Promise<void>;
export async function updateHistoryEntryStat(id: string, field: 'pdf_views' | 'editor_reloads'): Promise<void>;
export async function listHistoryByApplication(applicationId: string): Promise<DocumentSummary[]>;
export async function listUnattachedHistory(): Promise<DocumentSummary[]>;
```

**Correspondance colonne ↔ champ**, à respecter à la lettre dans les deux sens :

| `HistoryEntry` | colonne `documents` |
|---|---|
| `id` | `id` |
| `doc_type` | `doc_type` |
| `company`, `role`, `label`, `notes`, `job_desc` | mêmes noms |
| `filename` | `title` |
| `json` | `content` |
| `templateId` | `template_id` |
| `applicationId` | `application_id` |
| `pdf_views`, `editor_reloads` | mêmes noms |
| `last_viewed_at`, `created_at`, `updated_at` | mêmes noms |
| `synced_at`, `deleted_at` | **n'existent plus** — les retirer de `HistoryEntry` |

- [ ] **Étape 1 : écrire les tests (ils doivent échouer)**

Crée `web/src/lib/storage/documents.test.ts`. Le client Supabase est simulé par
un faux enregistreur d'appels, pour vérifier **ce qui est demandé au serveur** —
c'est le cœur du chantier (le catalogue ne doit pas rapatrier les contenus).

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectSpy = vi.fn();
const fakeQuery = {
  select: (cols: string) => { selectSpy(cols); return fakeQuery; },
  eq: () => fakeQuery,
  order: () => Promise.resolve({ data: [], error: null }),
  single: () => Promise.resolve({ data: null, error: null }),
  upsert: () => Promise.resolve({ error: null }),
  delete: () => fakeQuery,
  in: () => Promise.resolve({ error: null }),
};

vi.mock('./remote', async () => {
  const actual = await vi.importActual<typeof import('./remote')>('./remote');
  return {
    ...actual,
    requireRemote: vi.fn(async () => ({
      supabase: { from: () => fakeQuery },
      userId: 'u-1',
    })),
  };
});

import { listHistoryEntries, getHistoryEntry } from './db';
import { cacheClear } from './sessionCache';

beforeEach(() => { vi.clearAllMocks(); cacheClear(); });

describe('documents', () => {
  it('le catalogue ne demande jamais le contenu', async () => {
    await listHistoryEntries();
    const colonnes = selectSpy.mock.calls[0][0] as string;
    expect(colonnes).not.toContain('content');
    expect(colonnes).toContain('id');
    expect(colonnes).toContain('doc_type');
  });

  it('le détail demande le contenu', async () => {
    await getHistoryEntry('doc-1');
    const colonnes = selectSpy.mock.calls[0][0] as string;
    expect(colonnes === '*' || colonnes.includes('content')).toBe(true);
  });

  it('deux catalogues d\'affilée ne font qu\'un appel au serveur', async () => {
    await listHistoryEntries();
    await listHistoryEntries();
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/documents.test.ts
```

- [ ] **Étape 3 : réécrire la section documents du comptoir**

Remplace les fonctions listées dans « Interfaces produites ». Modèle exact à
suivre pour les trois formes (liste, détail, écriture) :

```ts
import { requireRemote, RemoteError } from './remote';
import { cacheGet, cacheSet, cacheInvalidate } from './sessionCache';

/** Colonnes du catalogue : tout sauf `content`. Voir spec §4.2. */
const DOC_LIST_COLS =
  'id,doc_type,title,company,role,label,notes,job_desc,template_id,application_id,pdf_views,editor_reloads,last_viewed_at,created_at,updated_at';

function rowToSummary(r: Record<string, unknown>): DocumentSummary {
  return {
    id: r.id as string,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string | undefined,
    doc_type: r.doc_type as DocType,
    company: (r.company as string) ?? '',
    role: (r.role as string) ?? '',
    job_desc: (r.job_desc as string) ?? '',
    filename: (r.title as string) ?? '',
    notes: (r.notes as string) ?? '',
    pdf_views: (r.pdf_views as number) ?? 0,
    editor_reloads: (r.editor_reloads as number) ?? 0,
    last_viewed_at: r.last_viewed_at as string | undefined,
    applicationId: (r.application_id as string) ?? undefined,
    label: (r.label as string) ?? undefined,
    templateId: (r.template_id as TemplateId | null) ?? null,
  };
}

export async function listHistoryEntries(): Promise<DocumentSummary[]> {
  const enMemoire = cacheGet<DocumentSummary[]>('documents:list');
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('documents')
    .select(DOC_LIST_COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new RemoteError('Impossible de charger vos documents.', error);

  const liste = (data ?? []).map(rowToSummary);
  cacheSet('documents:list', liste);
  return liste;
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry | undefined> {
  const cle = `documents:detail:${id}`;
  const enMemoire = cacheGet<HistoryEntry>(cle);
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (error) {
    // PGRST116 = aucune ligne : c'est un fait, pas une panne.
    if ((error as { code?: string }).code === 'PGRST116') return undefined;
    throw new RemoteError('Impossible de charger ce document.', error);
  }
  const entree = { ...rowToSummary(data), json: data.content as DocData } as HistoryEntry;
  cacheSet(cle, entree);
  return entree;
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { error } = await supabase.from('documents').upsert({
    user_id: userId,
    id: entry.id,
    doc_type: entry.doc_type,
    title: entry.filename,
    company: entry.company,
    role: entry.role,
    label: entry.label ?? null,
    content: entry.json,
    template_id: entry.templateId,
    application_id: entry.applicationId ?? null,
    notes: entry.notes,
    job_desc: entry.job_desc,
    pdf_views: entry.pdf_views,
    editor_reloads: entry.editor_reloads,
    last_viewed_at: entry.last_viewed_at ?? null,
    created_at: entry.created_at,
  });
  if (error) throw new RemoteError("Impossible d'enregistrer ce document.", error);
  cacheInvalidate('documents:');
}
```

Applique la même forme aux six fonctions restantes :

| Fonction | Requête | Après |
|---|---|---|
| `deleteHistoryEntry(id)` | `.delete().eq('user_id',…).eq('id',id)` | `cacheInvalidate('documents:')` |
| `deleteHistoryEntries(ids)` | `.delete().eq('user_id',…).in('id',ids)` | idem |
| `updateHistoryFields(id, f)` | `.update(<champs traduits>).eq('user_id',…).eq('id',id)` | idem |
| `updateHistoryEntryStat(id, f)` | lecture du compteur puis `.update({ [f]: n+1, last_viewed_at })` | idem |
| `listHistoryByApplication(appId)` | `DOC_LIST_COLS` + `.eq('application_id', appId)` | mémoire `documents:byApp:<appId>` |
| `listUnattachedHistory()` | `DOC_LIST_COLS` + `.is('application_id', null)` | mémoire `documents:unattached` |

**Ne laisse aucun `try/catch` avalant l'erreur** dans ces fonctions.

- [ ] **Étape 4 : retirer les champs de réplication de `HistoryEntry`**

Supprime `synced_at` et `deleted_at` de l'interface (`db.ts:43-44`). `tsc` te
signalera chaque usage restant — dans `syncEngine.ts`, qui vit encore : garde-le
compilable en y remplaçant les accès par des valeurs neutres, **sans changer son
comportement**, il sert à la reprise (task 7).

- [ ] **Étape 5 : alléger `saveDocument.ts`**

`saveHistoryEntry` écrit désormais directement sur le serveur ; l'appel à
`pushAll()` fait double emploi et disparaît.

⚠️ **L'ordre change** : le contrôle de connexion passe **avant** l'écriture. Sans
compte il n'y a plus de stockage local possible pour un document enregistré, donc
écrire d'abord produirait une `RemoteError` incompréhensible au lieu d'une
invitation à se connecter (spec §4.5 : l'éditeur marche sans compte, c'est
« Enregistrer » qui l'exige).

```ts
export async function saveCurrentDocument(): Promise<'account'> {
  if (!useAuthStore.getState().user) {
    throw new RemoteError('Connectez-vous pour enregistrer ce document.');
  }
  const { company, role, docType, json, templateId } = useDocStore.getState();
  // …suite inchangée : upsertApplicationForDocument, saveHistoryEntry, pruneAnonymousShelf…
  return 'account';
}
```

Le retour `'device'` disparaît : il n'existait que pour l'ancien mode local.
`useSaveStateStore` garde ses trois états — `'device'` n'est simplement plus
jamais atteint par cette fonction. Ne touche pas au store.

`saveCurrentDocument` doit **laisser remonter** l'erreur : c'est la TopBar qui
l'affiche (task 8). Ne l'attrape pas ici.

Mets à jour `saveDocument.test.ts` en conséquence — le contrat change, c'est
prévu : `pushAll` n'y est plus simulé, et un `saveHistoryEntry` qui lève doit
faire lever `saveCurrentDocument`.

- [ ] **Étape 6 : lancer, vérifier VERT, puis vérification complète**

```bash
npx vitest run src/lib/storage/documents.test.ts
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

- [ ] **Étape 7 : commit**

```bash
git add web/src/lib/storage/db.ts web/src/lib/storage/documents.test.ts web/src/lib/storage/saveDocument.ts web/src/lib/storage/saveDocument.test.ts web/src/lib/storage/syncEngine.ts
git commit -m "feat(serveur): les documents vivent sur le serveur, catalogue et detail separes"
```

---

## Task 4 : candidatures et offres enregistrées

**Fichiers :**
- Modifier : `web/src/lib/storage/db.ts` (sections « JOBS API » l. 400-555 et « APPLICATIONS API » l. 649-742)
- Créer : `web/src/lib/storage/applicationsRemote.test.ts`

**Interfaces :** les signatures ne changent pas. `listApplicationsRaw`,
`getApplicationByNormKey`, `putApplication`, `deleteApplicationRecord`,
`jobExists`, `saveJob`, `jobKeys`, `listJobs`, `setJobStatus`, `saveExplored`,
`markJobSeen`, `listJobsByGrade`, `supprimerJobsSousLeSeuil`.

**Tables visées :** `applications` et `saved_jobs`, **conservées telles quelles**
(spec §5.2). Elles portent encore `client_updated_at NOT NULL` : passe
`new Date().toISOString()` à l'écriture, la colonne devient un simple horodatage.

**Correspondance :** `applications` ← `Application` via `applicationToRemoteRow`
et `remoteRowToApplication`, `saved_jobs` ← `JobEntry` via `jobToRemoteSavedJob`
et `remoteSavedJobToJob` — ces quatre fonctions existent déjà dans
`syncMapping.ts` et sont **déplacées** dans `db.ts` (elles survivent à la
suppression du moteur en task 7). Retire-leur les champs `synced_at` /
`deleted_at` au passage.

- [ ] **Étape 1 : écrire le test (il doit échouer)**

`web/src/lib/storage/applicationsRemote.test.ts` — même faux client qu'en task 3
(recopie le bloc `fakeQuery` / `vi.mock('./remote', …)` tel quel, ne l'importe
pas depuis l'autre fichier de test) :

```ts
  it('une candidature enregistrée invalide la mémoire des candidatures', async () => {
    await listApplicationsRaw();
    await putApplication({ id: 'a-1', createdAt: 0, company: 'ACME', role: 'Dev',
      normKey: 'acme|dev', jobText: '', jobUrl: '', source: 'manual', events: [],
      notes: '', updatedAt: 0 });
    await listApplicationsRaw();
    expect(selectSpy).toHaveBeenCalledTimes(2); // et non 1 : la mémoire a été jetée
  });

  it('la liste des offres n\'est pas invalidée par une écriture de candidature', async () => {
    await listJobs();
    await putApplication({ id: 'a-2', createdAt: 0, company: 'B', role: 'C',
      normKey: 'b|c', jobText: '', jobUrl: '', source: 'manual', events: [],
      notes: '', updatedAt: 0 });
    await listJobs();
    expect(selectSpy).toHaveBeenCalledTimes(1); // la mémoire des offres a survécu
  });
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/applicationsRemote.test.ts
```

- [ ] **Étape 3 : convertir les deux sections**

Même forme qu'en task 3 : `requireRemote()`, requête, `throw new RemoteError(...)`
sur erreur, `cacheSet` en lecture, `cacheInvalidate` en écriture. Préfixes de
mémoire : `applications:` et `jobs:` — **distincts**, une écriture de candidature
ne doit pas jeter la liste des offres.

Points à ne pas manquer :

- `listApplicationsRaw` filtrait les `deleted_at` : la colonne disparaît de
  l'usage, une suppression devient un `.delete()` réel.
- `jobKeys()` et `jobExists()` servent au dédoublonnage d'un scan d'offres, donc
  appelés en boucle : ils lisent **une seule fois** la liste des identifiants
  (`select('id')`), mise en mémoire sous `jobs:keys`.
- `supprimerJobsSousLeSeuil` devient un `.delete().lt('score', seuil)`.
- `getCachedCommute` / `setCachedCommute` / `bumpApiUsage` / `getApiUsage` /
  `getAtsEntry` / `saveAtsEntry` / `allAtsEntries` **ne bougent pas** : caches
  techniques locaux (spec §3.2).

- [ ] **Étape 4 : lancer, vérifier VERT, puis vérification complète**

```bash
npx vitest run src/lib/storage/applicationsRemote.test.ts
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 5 : commit**

```bash
git add web/src/lib/storage/db.ts web/src/lib/storage/applicationsRemote.test.ts
git commit -m "feat(serveur): candidatures et offres enregistrees passent au serveur"
```

---

## Task 5 : réglages et modèles de lettre

**Fichiers :**
- Modifier : `web/src/lib/storage/db.ts` (sections « TEMPLATES API » l. 559-600, « PROFILE API » l. 607-625, « JOB PROFILE API » l. 628-645)
- Créer : `web/src/lib/storage/reglages.test.ts`

**Interfaces :** signatures inchangées — `loadProfile`, `saveProfile`,
`getJobProfile`, `saveJobProfile`, `listTemplates`, `saveTemplate`,
`deleteTemplate`, `ensureDefaultTemplates`.

**Tables :** `user_settings` (lignes `profile` et `jobProfile`, migration 0002) et
`templates` (migration 0003).

**Correspondance `templates`** : `MailTemplate.letterSubject` ↔ `letter_subject`,
`letterBody` ↔ `letter_body`, `name` ↔ `name`, `updatedAt` ↔ `updated_at`.

- [ ] **Étape 1 : écrire le test (il doit échouer)**

`web/src/lib/storage/reglages.test.ts`, avec le même faux client qu'en task 3 :

```ts
  it('les modèles d\'usine ne sont posés que si le COMPTE n\'en a aucun', async () => {
    localStorage.setItem('pack-templates-v4', '1'); // drapeau d'un autre appareil
    listeRendue = [{ id: 'perso-1', name: 'Mon modèle', letter_subject: '', letter_body: '', updated_at: null }];
    await ensureDefaultTemplates();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('les modèles d\'usine sont posés quand le compte est vierge', async () => {
    listeRendue = [];
    await ensureDefaultTemplates();
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
```

Le faux client de cette task diffère de celui de la task 3 : il doit pouvoir
rendre une liste variable et espionner l'écriture. Déclare-le ainsi en tête du
fichier, avant le `vi.mock` :

```ts
let listeRendue: Record<string, unknown>[] = [];
const upsertSpy = vi.fn();
const fakeQuery = {
  select: () => fakeQuery,
  eq: () => fakeQuery,
  order: () => Promise.resolve({ data: listeRendue, error: null }),
  single: () => Promise.resolve({ data: listeRendue[0] ?? null, error: null }),
  upsert: (rows: unknown) => { upsertSpy(rows); return Promise.resolve({ error: null }); },
  delete: () => fakeQuery,
};
```

et remets `listeRendue = []` dans le `beforeEach`.

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/reglages.test.ts
```

- [ ] **Étape 3 : convertir, et corriger le semis des modèles**

⚠️ Le point délicat de cette task. `ensureDefaultTemplates` décide aujourd'hui
d'installer les modèles d'usine en consultant un drapeau du `localStorage`
(`pack-templates-v4`) — donc **par appareil**. Conservé tel quel avec des modèles
désormais partagés par le compte, il réinstallerait les modèles d'usine par-dessus
les modèles personnalisés à chaque nouvelle machine.

Nouvelle règle, sans drapeau : on demande au serveur combien le compte a de
modèles ; **zéro** → on pose les modèles d'usine ; **au moins un** → on ne touche
à rien. Supprime la lecture et l'écriture de `pack-templates-v4`.

`loadProfile` / `getJobProfile` lisent `user_settings` (`.eq('id','profile')` /
`.eq('id','jobProfile')`), rendent `null` si la ligne n'existe pas — **une absence
n'est pas une panne** — et lèvent `RemoteError` sur erreur réelle.

- [ ] **Étape 4 : lancer, vérifier VERT, puis vérification complète**

```bash
npx vitest run src/lib/storage/reglages.test.ts
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 5 : commit**

```bash
git add web/src/lib/storage/db.ts web/src/lib/storage/reglages.test.ts
git commit -m "feat(serveur): profil, criteres de recherche et modeles de lettre au compte"
```

---

## Task 6 : le CV Maître devient un document

**Fichiers :**
- Modifier : `web/src/lib/storage/master.ts`
- Créer : `web/src/lib/storage/master.test.ts`

**Le problème** (spec §3.3) : le CV Maître est stocké comme brouillon
(`draft-Maître`), donc local et jamais répliqué — `DocType` a trois valeurs, le
schéma distant en avait deux, et `pushAll` filtrait sur les deux autres. C'est la
base de toutes les adaptations : la perdre fait dériver chaque adaptation à
partir du CV réécrit pour l'offre précédente.

**Interfaces :** `loadMasterResume(): Promise<Resume | null>` et
`saveMasterResume(resume, templateId)` gardent leur signature ; elles passent par
`listHistoryEntries` / `getHistoryEntry` / `saveHistoryEntry` avec
`doc_type: 'Maître'`. Identifiant fixe : `master`.

- [ ] **Étape 1 : écrire le test (il doit échouer)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/storage/db', () => ({
  getHistoryEntry: vi.fn(),
  saveHistoryEntry: vi.fn(async () => {}),
}));

import { getHistoryEntry, saveHistoryEntry } from '@/lib/storage/db';
import { loadMasterResume, saveMasterResume } from './master';
import { DEFAULT_RESUME } from '@/lib/resume/defaults';

beforeEach(() => vi.clearAllMocks());

describe('CV Maître', () => {
  it('s\'enregistre comme un document de type Maître', async () => {
    await saveMasterResume({ ...DEFAULT_RESUME, name: 'Hariss' }, 'sobre');
    const entry = vi.mocked(saveHistoryEntry).mock.calls[0][0];
    expect(entry.doc_type).toBe('Maître');
    expect(entry.id).toBe('master');
  });

  it('rend null quand le compte n\'a pas de CV Maître', async () => {
    vi.mocked(getHistoryEntry).mockResolvedValueOnce(undefined);
    expect(await loadMasterResume()).toBeNull();
  });

  it('rend null quand le CV Maître enregistré est vide', async () => {
    vi.mocked(getHistoryEntry).mockResolvedValueOnce({
      id: 'master', doc_type: 'Maître', json: { ...DEFAULT_RESUME, name: '' },
    } as never);
    expect(await loadMasterResume()).toBeNull();
  });
});
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/master.test.ts
```

- [ ] **Étape 3 : réécrire `master.ts`**

Remplace `loadDraft(MASTER_DRAFT_ID)` par `getHistoryEntry('master')` et
`saveDraft({...})` par `saveHistoryEntry({...})` avec `doc_type: 'Maître'`,
`id: 'master'`, `filename: 'CV Maître'`, les compteurs à 0 et les chaînes vides
pour `company`, `role`, `job_desc`, `notes`. Garde `normalizeResume` et
`isEmptyResume` : la règle « un maître vide n'est pas un maître » ne change pas.

- [ ] **Étape 4 : lancer, vérifier VERT, puis vérification complète**

```bash
npx vitest run src/lib/storage/master.test.ts
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 5 : commit**

```bash
git add web/src/lib/storage/master.ts web/src/lib/storage/master.test.ts
git commit -m "feat(serveur): le CV Maitre devient un document du compte"
```

---

## Task 7 : reprise des données locales, puis suppression du moteur

**Fichiers :**
- Créer : `web/src/lib/storage/reprise.ts`, `web/src/lib/storage/reprise.test.ts`
- Modifier : `web/src/state/authStore.ts`, `web/src/state/authStore.test.ts`
- Supprimer : `syncEngine.ts`, `syncMapping.ts`, `syncFields.ts` et leurs tests
- Modifier : `web/src/lib/storage/db.ts` (déclaration des tables Dexie)

**Ordre impératif :** la reprise d'abord, la suppression ensuite, dans **cette**
task et ce commit. Supprimer le moteur avant d'avoir repris ferait disparaître le
seul code capable de lire l'ancien format.

**Interfaces :** `reprendreDonneesLocales(): Promise<number>` — rend le nombre
d'éléments envoyés ; ne fait rien et rend `0` si le drapeau
`reprise_locale_faite` existe déjà dans le `localStorage`.

- [ ] **Étape 1 : écrire le test (il doit échouer)**

```ts
  it('ne reprend qu\'une seule fois', async () => {
    localStorage.setItem('reprise_locale_faite', '1');
    expect(await reprendreDonneesLocales()).toBe(0);
    expect(vi.mocked(pushAll)).not.toHaveBeenCalled();
  });

  it('pose le drapeau seulement si l\'envoi a abouti', async () => {
    vi.mocked(pushAll).mockResolvedValueOnce(false);
    await reprendreDonneesLocales();
    expect(localStorage.getItem('reprise_locale_faite')).toBeNull();
  });
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
npx vitest run src/lib/storage/reprise.test.ts
```

- [ ] **Étape 3 : écrire la reprise**

Elle lit les tables Dexie de l'ancien monde (`history`, `applications`, `jobs`,
`profile`, `jobProfile`, `templates`, `draft-Maître`), les envoie via les
fonctions du comptoir **déjà converties** (tasks 3 à 6), puis pose le drapeau.
Un échec ne pose pas le drapeau : la reprise sera retentée à la connexion
suivante.

⚠️ Le CV Maître se reprend depuis le brouillon `draft-Maître` (ancien
emplacement) vers `saveMasterResume` (nouveau).

- [ ] **Étape 4 : brancher sur la connexion**

Dans `authStore.ts` : `initAuth` et `onAuthStateChange` appellent
`reprendreDonneesLocales()` **au lieu de** `syncAll()`. `signOut` n'appelle plus
`pushAll()` ni `purgeLocalData()` — il vide la mémoire de session (`cacheClear()`)
et les tables locales résiduelles (`drafts`, `snapshots`). Mets à jour
`authStore.test.ts` : l'ordre attendu devient `auth.signOut` puis `cacheClear`.

- [ ] **Étape 5 : supprimer le moteur**

```bash
git rm web/src/lib/storage/syncEngine.ts web/src/lib/storage/syncEngine.test.ts web/src/lib/storage/syncMapping.ts web/src/lib/storage/syncMapping.test.ts web/src/lib/storage/syncFields.ts web/src/lib/storage/syncFields.test.ts web/src/lib/storage/syncEvents.ts web/src/lib/storage/syncEvents.test.ts
```

Retire ensuite : les abonnements `onSyncChange` (`ApplicationsScreen.tsx`,
`ResumeShelf.tsx`), les `void pushAll()` d'`applications/store.ts`, les tables
Dexie `history`, `jobs`, `applications`, `templates`, `profile`, `jobProfile` de
la déclaration de `db.ts` (**garde** `drafts`, `snapshots`, `commuteCache`,
`atsDirectory`, `apiUsage`), et les curseurs `sync_cursor_*` / `sync_user_id`
partout où ils sont encore lus ou écrits.

⚠️ Ne supprime **pas** les versions Dexie existantes (`this.version(1..12)`) :
elles décrivent l'historique du schéma local et leur retrait casse les bases
déjà installées chez les utilisateurs. Ajoute une version neuve qui retire les
tables devenues inutiles.

- [ ] **Étape 6 : vérification complète**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

Et la preuve que le moteur est bien parti :

```bash
grep -rn "synced_at\|pushAll\|pullAll\|syncAll\|sync_cursor" web/src || echo "MOTEUR SUPPRIME"
```

- [ ] **Étape 7 : commit**

```bash
git add -A web/src
git commit -m "feat(serveur): reprise des donnees locales puis suppression du moteur de replication"
```

---

## Task 8 : ce qu'on voit quand le serveur ne répond pas

**Fichiers :**
- Modifier : `ApplicationsScreen.tsx`, `ResumeShelf.tsx`, `JobsView.tsx`, `ProfileView.tsx`, `PackView.tsx`, `TopBar.tsx`
- Modifier : `web/src/app/globals.css`

**Interface produite :** un composant `EtatErreur` réutilisable —
`web/src/components/ui/EtatErreur.tsx` :

```tsx
export default function EtatErreur({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="etat-erreur" role="alert">
      <p>{message}</p>
      <button type="button" className="btn-nav" onClick={onRetry}>Réessayer</button>
    </div>
  );
}
```

- [ ] **Étape 1 : écrire le test (il doit échouer)**

`web/src/components/ui/EtatErreur.test.tsx`, en `@vitest-environment jsdom` :
rend le composant, vérifie que le message s'affiche et qu'un clic sur
« Réessayer » appelle `onRetry` une fois.

- [ ] **Étape 2 : lancer, vérifier ROUGE, écrire le composant, vérifier VERT**

```bash
npx vitest run src/components/ui/EtatErreur.test.tsx
```

- [ ] **Étape 3 : brancher les écrans**

Chaque écran qui charge des données du compte gagne un état d'erreur. Forme à
appliquer aux six fichiers, sur le `load` existant :

```ts
  const [erreur, setErreur] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErreur(null);
      setApps(await listApplications());
    } catch (e) {
      setErreur(e instanceof RemoteError ? e.message : 'Une erreur est survenue.');
    }
  }, []);
```

et, dans le rendu, avant la liste :

```tsx
  if (erreur) return <EtatErreur message={erreur} onRetry={() => void load()} />;
```

Pour la TopBar, `onSave` attrape l'erreur remontée par `saveCurrentDocument`
(task 3, étape 5) : `toast(message, "error")` et l'état reste
**« Modifications non enregistrées »** — jamais d'annonce de succès non vérifiée.

- [ ] **Étape 4 : styler**

Dans `globals.css`, classe `.etat-erreur` — **variables de thème uniquement**,
aucune couleur en dur.

- [ ] **Étape 5 : vérification complète, e2e inclus**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

- [ ] **Étape 6 : commit**

```bash
git add -A web/src
git commit -m "feat(serveur): message honnete et bouton Reessayer quand le serveur ne repond pas"
```

---

## Task 9 : vérification manuelle

**Prérequis :** les migrations `0002` et `0003` appliquées sur Supabase par
l'humain. Sinon **arrête-toi et demande**.

- [ ] **Étape 1 : lancer**

```bash
npm run dev
```

Piège Turbopack (cadrage §1) si un changement ne s'affiche pas : supprimer
`web/.next`, vérifier qu'aucun serveur ne traîne sur le port 3000, relancer.

- [ ] **Étape 2 : deux navigateurs, même compte**

Sur A, connecté : remplir « Mes infos », enregistrer un CV, un CV Maître (depuis
la modale d'adaptation) et un modèle de lettre personnalisé. Sur B, après
connexion : **les quatre sont là**.

- [ ] **Étape 3 : le catalogue est léger**

Onglet Réseau du navigateur, ouvrir « Mes candidatures ». **Aucune réponse ne
doit contenir de photo en base64** ni de contenu de document. Ouvrir un CV dans
l'éditeur : c'est là, et seulement là, que le contenu arrive. Colle les tailles
de réponse observées.

- [ ] **Étape 4 : reprise**

Sur un navigateur portant des données d'avant la bascule : à la connexion, elles
remontent sur le compte. Se déconnecter, se reconnecter : **rien n'est renvoyé
une deuxième fois** (drapeau `reprise_locale_faite`).

- [ ] **Étape 5 : panne franche**

Couper le réseau (onglet Réseau → « Offline »). « Mes candidatures » affiche le
message et le bouton « Réessayer ». L'éditeur continue de fonctionner. Cliquer
sur « Enregistrer » : message d'erreur, et l'état reste « Modifications non
enregistrées ». Rétablir le réseau, cliquer « Réessayer » : la liste revient.

- [ ] **Étape 6 : rapport et journal**

Colle le déroulé observé, étape par étape. En cas d'échec, **n'invente aucune
explication** : décris ce que tu as vu et arrête-toi. Puis journal dans
`WORK_HISTORY.md`, et barre dans `LIMITES.md` §1.1 la ligne « Conflits hors-ligne
(Last-Write-Wins) » avec la date — sans la supprimer.

```bash
git add WORK_HISTORY.md LIMITES.md
git commit -m "docs(journal): serveur source unique verifie de bout en bout"
```
