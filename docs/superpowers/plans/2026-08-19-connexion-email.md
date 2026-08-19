# Connexion par email et mot de passe — plan d'implémentation

> **Pour les agents d'exécution :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour exécuter ce plan task par task. Les étapes
> sont en cases à cocher (`- [ ]`) pour le suivi.

**But :** permettre de créer un compte et de se connecter avec une adresse email
et un mot de passe, à côté de Google, avec confirmation d'adresse et
récupération de mot de passe oublié.

**Architecture :** tout passe par `authStore.ts` côté navigateur, comme Google
aujourd'hui. `onAuthStateChange`, déjà abonné, déclenche
`reprendreDonneesLocales()` à toute connexion — aucun second chemin
d'authentification n'est créé. Une page `/connexion` à quatre états porte les
formulaires ; une route API dédiée reconnaît les comptes Google.

**Pile :** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict,
Zustand, Supabase Auth (`@supabase/ssr`), Vitest, Playwright, PostgreSQL.

**Spec :** `docs/superpowers/specs/2026-08-19-connexion-email-design.md` — à
lire en entier avant la Task 1. Le plan argumente depuis elle.

---

## Contraintes globales

Extraites de `.agents/rules/cadrage.md` et de la spec. Elles s'appliquent à
**toutes** les tasks.

- **TDD** : test écrit d'abord, montré ROUGE, puis code, puis montré VERT.
- **Vérification après CHAQUE task**, depuis `web/`, dans cet ordre :
  `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. Plus
  `npx playwright test` dès qu'une task touche l'UI, et en fin de plan.
  Une vérification rouge = task NON LIVRÉE.
- **Un commit par task**, message en français.
- **PUSH INTERDIT** : un push déploie la production Vercel. C'est l'humain qui
  pousse.
- **Journal** : après chaque task, une entrée datée dans `## Journal` de
  `WORK_HISTORY.md` (racine). ⚠️ Le cadrage cite `REWRITE_PROGRESS.md` : cette
  consigne est **périmée**, ce fichier est une archive figée. Le journal actif
  est `WORK_HISTORY.md`.
- **Aucune dépendance npm** ajoutée ou mise à jour. Tout ce qui est nécessaire
  est déjà installé.
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable`** ajouté.
- **Jamais `alert`/`confirm`/`prompt` natifs** → `toast`/`uiAlert` de
  `@/state/uiStore`.
- **Jamais de couleur en dur** → variables de thème dans `src/app/globals.css`
  (`var(--bg)`, `var(--text)`, `var(--border)`…).
- **Longueur minimale du mot de passe : 8 caractères.** Valeur unique, utilisée
  côté client (Task 2) et à régler côté Supabase (Task 8).
- **Nom de la page : `/connexion`**, jamais `/login` — cette adresse est déjà
  prise par le portail à mot de passe partagé, qui n'a aucun rapport.
- Ne modifier aucun test existant pour le faire passer, **sauf** ceux que les
  Tasks 7 et 8 désignent nommément (leur texte change par décision de
  conception).

---

## Structure des fichiers

**À créer :**

| Fichier | Responsabilité |
|---|---|
| `web/supabase/migrations/0005_identite_google.sql` | Fonction en base : cette adresse passe-t-elle par Google ? |
| `web/supabase/tests/identite_google.sql` | Tests SQL de la fonction ci-dessus |
| `web/src/lib/supabase/admin.ts` | Client Supabase à droits d'administration, serveur uniquement |
| `web/src/app/api/auth/methode/route.ts` | Route qui expose la fonction, sous limitation de débit |
| `web/src/lib/auth/messages.ts` | Traduction des erreurs Supabase en français |
| `web/src/lib/auth/messages.test.ts` | Tests de la traduction |
| `web/src/lib/auth/validation.ts` | Validation email / mot de passe avant tout appel réseau |
| `web/src/lib/auth/validation.test.ts` | Tests de la validation |
| `web/src/components/auth/FormulaireConnexion.tsx` | Le formulaire à quatre états |
| `web/src/components/auth/FormulaireConnexion.test.tsx` | Tests du formulaire |
| `web/src/app/connexion/page.tsx` | La page `/connexion` |
| `web/src/app/connexion/nouveau-mot-de-passe/page.tsx` | Pose du nouveau mot de passe |
| `web/tests/e2e/connexion-email.spec.ts` | Parcours de bout en bout |

**À modifier :**

| Fichier | Changement |
|---|---|
| `web/src/state/authStore.ts` | +5 méthodes (créer, connecter, confirmer, réinitialiser, changer) |
| `web/src/state/authStore.test.ts` | Tests des 5 méthodes |
| `web/src/lib/security/rateLimit.ts` | +1 entrée `auth-methode` dans `RATE_LIMITS` |
| `web/src/lib/security/rateLimit.test.ts` | Le scanner anti-régression doit voir la nouvelle route |
| `web/src/components/layout/UserMenu.tsx` | Le bouton Google devient un lien vers `/connexion` |
| `web/src/components/layout/MobileMenu.tsx` | Idem |
| `web/src/components/layout/UserMenuAuth.test.tsx` | Adapté au changement ci-dessus (autorisé) |
| `web/src/components/layout/MobileMenu.test.tsx` | Idem (autorisé) |
| `web/src/middleware.ts` | `/auth/callback` ajouté aux chemins libres |
| `web/src/lib/ai/quota.ts` | Message de blocage : ne plus dire « avec Google » |
| `web/src/app/globals.css` | Styles de la page de connexion |
| `web/.env.example` | `SUPABASE_SERVICE_ROLE_KEY`, documentée |
| `web/supabase/README.md` | Migration 0005 et son test |
| `WORK_HISTORY.md` | Une entrée par task |

**Explicitement hors périmètre — ne pas y toucher :** le portail `/login` et sa
route `api/login`, le moment où l'app réclame un compte (chantier B), la
suppression de compte (chantier D), `syncEngine`/`reprise` et tout le stockage.

---

## Task 1 : la base sait reconnaître un compte Google

**Pourquoi :** Supabase répond `Invalid login credentials` à l'identique que le
mot de passe soit faux ou que le compte n'ait aucun mot de passe. Sans cette
fonction, une personne venue par Google qui revient six mois plus tard est
bloquée devant ses propres CV (spec §6).

**Fichiers :**
- Créer : `web/supabase/migrations/0005_identite_google.sql`
- Créer : `web/supabase/tests/identite_google.sql`
- Modifier : `web/supabase/README.md`

**Interfaces produites :**
`public.identite_est_google(p_email TEXT) RETURNS BOOLEAN` — vrai si cette
adresse a une identité Google, faux dans tous les autres cas, **y compris
adresse inconnue**. Exécutable par `service_role` uniquement.

- [ ] **Étape 1 : lire le modèle existant**

Lire `web/supabase/migrations/0004_rate_limits.sql` en entier. La migration à
écrire en reprend la forme : commentaire d'en-tête expliquant le pourquoi,
`SECURITY DEFINER`, `SET search_path = ''`, `REVOKE` puis `GRANT` explicite.

- [ ] **Étape 2 : écrire la migration**

Créer `web/supabase/migrations/0005_identite_google.sql` :

```sql
-- ---------------------------------------------------------------------
-- 0005 — Reconnaître un compte créé avec Google
--
-- POURQUOI
--
-- Supabase renvoie « Invalid login credentials » de façon identique que le mot
-- de passe soit faux ou que le compte n'ait aucun mot de passe (créé via
-- Google). Le navigateur ne peut donc pas distinguer les deux cas, et une
-- personne venue par Google se retrouve bloquée devant ses propres CV sans
-- comprendre pourquoi.
--
-- CE QUE LA FONCTION DIT, ET RIEN D'AUTRE
--
-- Un booléen. Jamais de nom, jamais de date, jamais d'identifiant. Une adresse
-- inconnue et une adresse à mot de passe renvoient toutes deux `false` : on ne
-- peut pas les distinguer par la réponse.
--
-- POURQUOI PAS `anon`
--
-- Exposée au navigateur, cette fonction serait un testeur d'adresses libre.
-- Seul `service_role` peut l'exécuter, et seule la route /api/auth/methode
-- l'appelle — sous limitation de débit, et uniquement après un échec de mot de
-- passe. La limite vit côté Next.js parce que l'IP appelante n'est pas connue
-- en SQL.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.identite_est_google(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.identities i
    JOIN auth.users u ON u.id = i.user_id
    WHERE lower(u.email) = lower(p_email)
      AND i.provider = 'google'
  );
$$;

-- ---------------------------------------------------------------------
-- DROITS D'EXÉCUTION
--
-- Ni `anon` ni `authenticated`. Contrairement à consume_rate_limit (0004), qui
-- devait servir les visiteurs, celle-ci ne doit jamais être appelable depuis un
-- navigateur.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.identite_est_google(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identite_est_google(TEXT) TO service_role;
```

- [ ] **Étape 3 : écrire le test SQL**

Créer `web/supabase/tests/identite_google.sql`, sur le modèle de
`web/supabase/tests/rate_limit.sql` (lire son en-tête d'abord) :

```sql
-- =====================================================================
-- Test de la reconnaissance des comptes Google (migration 0005)
--
-- Ce que ce test COUVRE :
--   1. Une adresse liée à Google renvoie vrai
--   2. Une adresse à mot de passe renvoie faux
--   3. Une adresse inconnue renvoie faux (indistinguable du cas 2)
--   4. La casse de l'adresse n'a aucune influence
--   5. `anon` et `authenticated` ne peuvent pas exécuter la fonction
--
-- Ce que ce test NE couvre PAS : la limitation de débit et le moment de
-- l'appel, qui vivent côté Next.js (src/lib/security/rateLimit.test.ts et
-- src/app/api/auth/methode/route.ts).
-- =====================================================================

\set ON_ERROR_STOP on

-- Deux comptes de test : un Google, un à mot de passe.
INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'google@test.fr'),
       ('22222222-2222-2222-2222-222222222222', 'motdepasse@test.fr');

INSERT INTO auth.identities (id, user_id, provider, provider_id)
VALUES ('aaaaaaaa-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111', 'google', 'google-123'),
       ('bbbbbbbb-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222', 'email', 'motdepasse@test.fr');

DO $$
BEGIN
  IF NOT public.identite_est_google('google@test.fr') THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : un compte Google n''est pas reconnu';
  END IF;

  IF public.identite_est_google('motdepasse@test.fr') THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : un compte à mot de passe est pris pour un compte Google';
  END IF;

  IF public.identite_est_google('inconnu@test.fr') THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC : une adresse inconnue renvoie vrai';
  END IF;

  IF NOT public.identite_est_google('GOOGLE@Test.FR') THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : la casse de l''adresse change la réponse';
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- TEST 5 — la fonction est fermée aux rôles du navigateur
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT unnest(ARRAY['anon', 'authenticated']) AS role_nom LOOP
    IF has_function_privilege(r.role_nom,
                              'public.identite_est_google(text)',
                              'EXECUTE') THEN
      RAISE EXCEPTION 'TEST 5 ÉCHEC : le rôle % peut exécuter la fonction', r.role_nom;
    END IF;
  END LOOP;
END
$$;

SELECT 'TOUS_LES_TESTS_OK' AS resultat;
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il est VERT**

La procédure exacte (Docker PostgreSQL + `_auth_stub.sql`) est décrite dans
`web/supabase/README.md`, section « Tester en local ». Docker Desktop doit être
démarré ; compter ~20 s avant que le démon réponde.

Attendu : `TOUS_LES_TESTS_OK`.

⚠️ Le bouchon `_auth_stub.sql` doit contenir une table `auth.identities` avec
les colonnes `id`, `user_id`, `provider`, `provider_id`. Si elle manque, ajouter
sa définition au bouchon **sans toucher** aux tables déjà présentes, puis
relancer aussi `tests/rls_etancheite.sql` et `tests/rate_limit.sql` pour
prouver que l'ajout n'a rien cassé.

- [ ] **Étape 5 : validation par mutation**

Un test qui ne tombe jamais ne prouve rien. Casser volontairement la migration,
une mutation à la fois, relancer le test, vérifier qu'il ÉCHOUE, puis rétablir :

1. Remplacer `i.provider = 'google'` par `i.provider = 'email'` → le TEST 1 doit tomber.
2. Retirer les deux `lower(...)` → le TEST 4 doit tomber.
3. Remplacer `GRANT ... TO service_role` par `TO anon, authenticated` → le TEST 5 doit tomber.

Coller la sortie des trois mutations dans le rapport.

- [ ] **Étape 6 : documenter dans le README**

Ajouter la migration `0005_identite_google.sql` au tableau des migrations de
`web/supabase/README.md`, et `tests/identite_google.sql` à la liste des tests,
en suivant exactement la forme des lignes existantes.

- [ ] **Étape 7 : signaler l'action humaine**

Écrire dans le rapport de task, en évidence :

> **ACTION HUMAINE REQUISE** — la migration `0005_identite_google.sql` doit être
> appliquée sur Supabase (`npx supabase db push` depuis `web/`, ou l'éditeur SQL
> du tableau de bord). Tant qu'elle ne l'est pas, la route de la Task 3 répond
> « je ne sais pas » et l'interface affiche le message générique : rien ne
> casse, mais le cas « compte Google » n'est pas reconnu.

- [ ] **Étape 8 : vérification et commit**

```bash
cd web
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

(La task ne touche aucun TypeScript, mais la vérification reste due : elle
prouve que rien n'a bougé.)

```bash
git add web/supabase/migrations/0005_identite_google.sql web/supabase/tests/identite_google.sql web/supabase/README.md WORK_HISTORY.md
git commit -m "feat(auth): la base sait reconnaitre un compte cree avec Google"
```

---

## Task 2 : traduire les erreurs, valider les champs

**Pourquoi :** Supabase répond en anglais. Une personne bloquée à l'inscription
doit lire une phrase en français qui lui dit quoi faire (spec §8). Ces deux
fonctions sont pures : elles se testent sans réseau et sans navigateur.

**Fichiers :**
- Créer : `web/src/lib/auth/messages.ts`, `web/src/lib/auth/messages.test.ts`
- Créer : `web/src/lib/auth/validation.ts`, `web/src/lib/auth/validation.test.ts`

**Interfaces produites :**
- `messageErreurAuth(brut: string, compteGoogle?: boolean): string`
- `LONGUEUR_MIN_MOT_DE_PASSE: 8`
- `validerEmail(valeur: string): string | null` — message d'erreur, ou `null` si valide
- `validerMotDePasse(valeur: string): string | null` — idem

- [ ] **Étape 1 : écrire les tests (ils doivent échouer)**

Créer `web/src/lib/auth/messages.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { messageErreurAuth } from './messages';

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
```

Créer `web/src/lib/auth/validation.test.ts` :

```ts
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
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
cd web
npx vitest run src/lib/auth/
```

Attendu : ÉCHEC, « Failed to resolve import './messages' » et « './validation' ».

- [ ] **Étape 3 : écrire les deux modules**

Créer `web/src/lib/auth/messages.ts` :

```ts
/**
 * Supabase répond en anglais. Cette table traduit les cas réellement
 * rencontrés dans les parcours de connexion ; le reste tombe sur un message
 * générique qui conserve le texte d'origine — un écran muet devant une erreur
 * imprévue est pire qu'une phrase anglaise.
 */
const TRADUCTIONS: ReadonlyArray<{ motif: string; texte: string }> = [
  { motif: 'invalid login credentials', texte: 'Email ou mot de passe incorrect.' },
  { motif: 'user already registered', texte: 'Cette adresse a déjà un compte.' },
  { motif: 'password should be at least', texte: 'Le mot de passe doit faire au moins 8 caractères.' },
  { motif: 'email rate limit exceeded', texte: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  { motif: 'over email send rate limit', texte: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  { motif: 'token has expired or is invalid', texte: "Ce code n'est plus valable. Demandez-en un nouveau." },
  { motif: 'email not confirmed', texte: "Confirmez d'abord votre adresse : le code vous a été envoyé par email." },
];

/**
 * @param brut       message renvoyé par Supabase
 * @param compteGoogle vrai si la route /api/auth/methode a reconnu un compte
 *                     Google pour cette adresse — le message change alors
 *                     complètement, puisque la personne n'a jamais eu de mot
 *                     de passe à se rappeler.
 */
export function messageErreurAuth(brut: string, compteGoogle = false): string {
  if (compteGoogle) {
    return 'Ce compte a été créé avec Google. Utilisez le bouton Google ci-dessus.';
  }

  const normalise = brut.toLowerCase();
  const trouve = TRADUCTIONS.find(({ motif }) => normalise.includes(motif));
  if (trouve) return trouve.texte;

  if (!brut.trim()) return 'La connexion a échoué. Réessayez dans un instant.';
  return `La connexion a échoué. Détail : ${brut}`;
}
```

Créer `web/src/lib/auth/validation.ts` :

```ts
/**
 * Longueur exigée côté navigateur. Elle doit rester alignée sur le réglage
 * « Minimum password length » du tableau de bord Supabase : si les deux
 * divergent, l'app annonce une règle que le serveur n'applique pas.
 */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

/** Renvoie le message d'erreur à afficher, ou `null` si la valeur convient. */
export function validerEmail(valeur: string): string | null {
  const propre = valeur.trim();
  if (!propre) return 'Indiquez votre adresse email.';
  // Volontairement grossier : la seule validation qui fait autorité est l'envoi
  // du courriel. On n'arrête ici que les fautes de frappe évidentes.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propre)) {
    return "Cette adresse email n'est pas valide.";
  }
  return null;
}

/** Renvoie le message d'erreur à afficher, ou `null` si la valeur convient. */
export function validerMotDePasse(valeur: string): string | null {
  if (!valeur) return 'Indiquez un mot de passe.';
  if (valeur.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`;
  }
  return null;
}
```

- [ ] **Étape 4 : lancer, vérifier VERT**

```bash
cd web
npx vitest run src/lib/auth/
```

Attendu : tous les tests passent.

- [ ] **Étape 5 : vérification complète et commit**

```bash
cd web
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

```bash
git add web/src/lib/auth WORK_HISTORY.md
git commit -m "feat(auth): messages d'erreur en francais et validation des champs"
```

---

## Task 3 : la route qui reconnaît un compte Google

**Pourquoi :** la fonction de la Task 1 n'est appelable que par `service_role`,
donc jamais depuis le navigateur. Il faut une route serveur, sous limitation de
débit, appelée **uniquement après un échec de mot de passe** (spec §6).

**Fichiers :**
- Créer : `web/src/lib/supabase/admin.ts`
- Créer : `web/src/app/api/auth/methode/route.ts`
- Modifier : `web/src/lib/security/rateLimit.ts`, `web/src/lib/security/rateLimit.test.ts`
- Modifier : `web/.env.example`

**Interfaces consommées :** `identite_est_google` (Task 1),
`enforceRateLimit` (`@/lib/security/rateLimit`).

**Interfaces produites :**
- `createAdminClient(): SupabaseClient | null`
- `POST /api/auth/methode` — corps `{ email: string }`, réponse
  `{ google: boolean }`. Répond `{ google: false }` quand la clé
  d'administration est absente ou la base muette : l'appelant retombe alors sur
  le message générique.

- [ ] **Étape 1 : écrire les tests (ils doivent échouer)**

Ajouter à `web/src/lib/security/rateLimit.test.ts`, dans le `describe` qui
contient déjà le scanner anti-régression :

```ts
it('plafonne la reconnaissance de compte Google', () => {
  expect(RATE_LIMITS['auth-methode']).toEqual({ limit: 10, windowSeconds: 300 });
});
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
cd web
npx vitest run src/lib/security/rateLimit.test.ts
```

Attendu : ÉCHEC — `RATE_LIMITS['auth-methode']` vaut `undefined`.

⚠️ Le scanner anti-régression du même fichier parcourt tous les `route.ts` et
exige que chacun appelle `guardAiRequest` ou `enforceRateLimit`. Il passera au
vert de lui-même une fois l'étape 4 faite ; s'il reste rouge, c'est que la
nouvelle route n'appelle pas `enforceRateLimit` — ne pas modifier le scanner
pour le contourner.

- [ ] **Étape 3 : ajouter le plafond**

Dans `web/src/lib/security/rateLimit.ts`, ajouter une entrée à `RATE_LIMITS`,
à la suite de `login` :

```ts
  /**
   * Reconnaissance d'un compte Google, appelée seulement après un échec de mot
   * de passe. Plafond serré : c'est le seul point de l'app qui répond quoi que
   * ce soit au sujet d'une adresse, et le compte à protéger est celui d'un
   * utilisateur légitime qui se trompe deux ou trois fois, pas dix.
   */
  "auth-methode": { limit: 10, windowSeconds: 300 },
```

- [ ] **Étape 4 : écrire le client d'administration et la route**

Créer `web/src/lib/supabase/admin.ts` :

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client à droits d'administration. **Serveur uniquement** : la clé
 * `SUPABASE_SERVICE_ROLE_KEY` contourne toutes les politiques RLS. Elle ne
 * porte volontairement pas le préfixe NEXT_PUBLIC_, sans quoi Next.js
 * l'embarquerait dans le paquet envoyé au navigateur.
 *
 * Renvoie `null` quand la clé est absente : l'app tourne alors en mode dégradé
 * plutôt que de refuser de démarrer — c'est le cas d'un poste de développement
 * ou d'une installation 100 % locale.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  return createClient(url, cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

Créer `web/src/app/api/auth/methode/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * « Cette adresse passe-t-elle par Google ? »
 *
 * Appelée par la page /connexion UNIQUEMENT après un échec de mot de passe,
 * jamais à la frappe : on ne répond donc jamais à quelqu'un qui n'a pas déjà
 * soumis une tentative. La limitation de débit borne ce que cette réponse
 * permet d'apprendre.
 *
 * En cas de doute — clé d'administration absente, migration 0005 non appliquée,
 * base muette — la réponse est `false`. L'interface affiche alors le message
 * générique : on préfère un message moins utile à une affirmation fausse.
 */
export async function POST(req: Request) {
  const limite = await enforceRateLimit(req, 'auth-methode');
  if (limite) return limite;

  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  if (typeof email !== 'string' || !email.trim() || email.length > 320) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ google: false });

  const { data, error } = await admin.rpc('identite_est_google', {
    p_email: email.trim(),
  });

  if (error) {
    console.warn('Reconnaissance de compte Google indisponible :', error.message);
    return NextResponse.json({ google: false });
  }

  return NextResponse.json({ google: data === true });
}
```

- [ ] **Étape 5 : documenter la variable d'environnement**

Ajouter à la fin de `web/.env.example` :

```
# Clé d'administration Supabase (Project Settings > API > service_role).
# JAMAIS de préfixe NEXT_PUBLIC_ : elle contourne toutes les règles de sécurité
# de la base et serait exposée dans le navigateur.
# Sert uniquement à reconnaître qu'une adresse a été inscrite via Google, pour
# orienter la personne vers le bon bouton (/api/auth/methode). Absente : ce cas
# n'est pas reconnu, l'app affiche un message générique et rien ne casse.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Étape 6 : lancer, vérifier VERT, puis vérification complète**

```bash
cd web
npx vitest run src/lib/security/
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 7 : commit**

```bash
git add web/src/lib/supabase/admin.ts web/src/app/api/auth/methode/route.ts web/src/lib/security/rateLimit.ts web/src/lib/security/rateLimit.test.ts web/.env.example WORK_HISTORY.md
git commit -m "feat(auth): route qui reconnait un compte Google, sous limite de debit"
```

---

## Task 4 : les cinq appels dans authStore

**Pourquoi :** c'est le cœur du chantier, et le seul endroit où une session
s'ouvre. `onAuthStateChange` y est déjà abonné et déclenche
`reprendreDonneesLocales()` : en passant par lui, les nouveaux parcours
héritent gratuitement de la restitution des données (spec §4 et §11).

**Fichiers :**
- Modifier : `web/src/state/authStore.ts`
- Modifier : `web/src/state/authStore.test.ts`

**Interfaces consommées :** `messageErreurAuth` n'est **pas** appelée ici — le
store laisse remonter l'erreur brute de Supabase, c'est l'interface qui traduit.

**Interfaces produites** (ajoutées à `AuthState`) :

```ts
signUpWithEmail: (email: string, password: string) => Promise<void>;
signInWithEmail: (email: string, password: string) => Promise<void>;
confirmSignupCode: (email: string, token: string) => Promise<void>;
requestPasswordReset: (email: string) => Promise<void>;
updatePassword: (password: string) => Promise<void>;
```

Toutes lèvent l'erreur Supabase telle quelle (`throw error`) et ne renvoient
rien. Aucune n'attrape d'exception : l'appelant décide quoi afficher.

- [ ] **Étape 1 : écrire les tests (ils doivent échouer)**

Ajouter à `web/src/state/authStore.test.ts`. Lire d'abord le `describe`
« AuthStore.signOut » du même fichier : il montre le montage de `vi.doMock` sur
`@/lib/supabase/client` à reproduire ici.

```ts
describe('AuthStore — parcours email et mot de passe', () => {
  const signUp = vi.fn();
  const signInWithPassword = vi.fn();
  const verifyOtp = vi.fn();
  const resetPasswordForEmail = vi.fn();
  const updateUser = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    for (const m of [signUp, signInWithPassword, verifyOtp, resetPasswordForEmail, updateUser]) {
      m.mockClear().mockResolvedValue({ data: {}, error: null });
    }
    vi.doMock('@/lib/supabase/client', () => ({
      createBrowserClientHelper: () => ({
        auth: { signUp, signInWithPassword, verifyOtp, resetPasswordForEmail, updateUser },
      }),
    }));
  });

  it('crée un compte avec l\'adresse et le mot de passe fournis', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().signUpWithEmail('marc@test.fr', 'motdepasse');
    expect(signUp).toHaveBeenCalledWith({ email: 'marc@test.fr', password: 'motdepasse' });
  });

  it('connecte avec l\'adresse et le mot de passe fournis', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().signInWithEmail('marc@test.fr', 'motdepasse');
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'marc@test.fr', password: 'motdepasse',
    });
  });

  it('valide le code d\'inscription avec le bon type', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().confirmSignupCode('marc@test.fr', '123456');
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'marc@test.fr', token: '123456', type: 'signup',
    });
  });

  it('renvoie le lien de réinitialisation vers le callback puis la page dédiée', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().requestPasswordReset('marc@test.fr');
    const [adresse, options] = resetPasswordForEmail.mock.calls[0];
    expect(adresse).toBe('marc@test.fr');
    expect(options.redirectTo).toContain('/auth/callback');
    expect(options.redirectTo).toContain('next=/connexion/nouveau-mot-de-passe');
  });

  it('change le mot de passe de la session en cours', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().updatePassword('nouveaumotdepasse');
    expect(updateUser).toHaveBeenCalledWith({ password: 'nouveaumotdepasse' });
  });

  it('laisse remonter l\'erreur Supabase sans l\'avaler', async () => {
    signInWithPassword.mockResolvedValue({
      data: {}, error: { message: 'Invalid login credentials' },
    });
    const { useAuthStore } = await import('./authStore');
    await expect(
      useAuthStore.getState().signInWithEmail('marc@test.fr', 'faux'),
    ).rejects.toMatchObject({ message: 'Invalid login credentials' });
  });
});
```

- [ ] **Étape 2 : lancer, vérifier ROUGE**

```bash
cd web
npx vitest run src/state/authStore.test.ts
```

Attendu : ÉCHEC — `signUpWithEmail is not a function`.

- [ ] **Étape 3 : écrire les cinq méthodes**

Dans `web/src/state/authStore.ts`, déclarer les cinq signatures dans
l'interface `AuthState` (juste après `signInWithGoogleIdToken`), puis ajouter
les implémentations juste avant `signOut` :

```ts
  signUpWithEmail: async (email, password) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

  signInWithEmail: async (email, password) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  // `type: 'signup'` et non `'email'` : c'est le code du courriel de
  // confirmation d'inscription. Se tromper de type fait échouer la
  // vérification sans que le message ne dise pourquoi.
  confirmSignupCode: async (email, token) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) throw error;
  },

  // Le lien du courriel passe par /auth/callback, qui échange le code contre
  // une session avant de rediriger. `next` y est validé par safeRedirectPath :
  // seul un chemin interne est accepté.
  requestPasswordReset: async (email) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const retour = `${window.location.origin}/auth/callback?next=/connexion/nouveau-mot-de-passe`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: retour,
    });
    if (error) throw error;
  },

  updatePassword: async (password) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },
```

- [ ] **Étape 4 : lancer, vérifier VERT, puis vérification complète**

```bash
cd web
npx vitest run src/state/authStore.test.ts
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Étape 5 : commit**

```bash
git add web/src/state/authStore.ts web/src/state/authStore.test.ts WORK_HISTORY.md
git commit -m "feat(auth): inscription, connexion, code et mot de passe oublie dans le store"
```

---

## Task 5 : la page /connexion

**Pourquoi :** c'est la porte que le chantier existe pour ouvrir. Quatre états
dans une seule page (spec §3), Google et le formulaire côte à côte comme **deux
chemins exclusifs** — jamais une étape l'un de l'autre.

**Fichiers :**
- Créer : `web/src/components/auth/FormulaireConnexion.tsx`
- Créer : `web/src/components/auth/FormulaireConnexion.test.tsx`
- Créer : `web/src/app/connexion/page.tsx`
- Modifier : `web/src/app/globals.css`

**Interfaces consommées :** `validerEmail`, `validerMotDePasse` (Task 2),
`messageErreurAuth` (Task 2), les cinq méthodes du store (Task 4),
`POST /api/auth/methode` (Task 3), `GoogleSignInButton` (existant).

- [ ] **Étape 1 : lire l'existant**

Lire `web/src/components/auth/GoogleSignInButton.tsx` (il se suffit à lui-même,
on l'insère tel quel) et `web/src/components/layout/UserMenu.tsx:70-95` — il
montre l'arbitrage à reproduire : bouton Google Identity Services si
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` est présent, sinon repli sur `signInWithGoogle`.

- [ ] **Étape 2 : écrire les tests (ils doivent échouer)**

Créer `web/src/components/auth/FormulaireConnexion.test.tsx`. Prendre pour
modèle l'en-tête de `web/src/components/layout/UserMenuAuth.test.tsx`
(`@vitest-environment jsdom`, `cleanup` en `afterEach`).

```tsx
/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import FormulaireConnexion from './FormulaireConnexion';
import { useAuthStore } from '@/state/authStore';

describe('FormulaireConnexion', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useAuthStore.setState({
      user: null, session: null, isLoading: false, isConfigured: true,
      signInWithEmail: vi.fn().mockResolvedValue(undefined),
      signUpWithEmail: vi.fn().mockResolvedValue(undefined),
      confirmSignupCode: vi.fn().mockResolvedValue(undefined),
      requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ google: false }),
    }));
  });

  // Le bouton Google est rendu par Google Identity Services, dont le script ne
  // se charge pas sous jsdom : on ne peut donc pas chercher son libellé. Le
  // séparateur « ou » prouve que le bloc Google est bien monté à côté du
  // formulaire — c'est la cohabitation des deux chemins qu'on teste ici.
  it('affiche les deux chemins : Google et le formulaire', () => {
    render(<FormulaireConnexion />);
    expect(screen.getByText(/^ou$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^mot de passe$/i)).toBeInTheDocument();
  });

  it('refuse une adresse invalide sans appeler le réseau', async () => {
    render(<FormulaireConnexion />);
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'pas-une-adresse' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }));

    expect(await screen.findByText(/adresse email n'est pas valide/i)).toBeInTheDocument();
    expect(useAuthStore.getState().signInWithEmail).not.toHaveBeenCalled();
  });

  it('connecte avec des identifiants valides', async () => {
    render(<FormulaireConnexion />);
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'marc@test.fr' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().signInWithEmail)
        .toHaveBeenCalledWith('marc@test.fr', 'motdepasse');
    });
  });

  it('oriente vers Google quand la route reconnaît un compte Google', async () => {
    useAuthStore.setState({
      signInWithEmail: vi.fn().mockRejectedValue({ message: 'Invalid login credentials' }),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ google: true }),
    }));

    render(<FormulaireConnexion />);
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'marc@test.fr' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }));

    expect(await screen.findByText(/compte a été créé avec google/i)).toBeInTheDocument();
  });

  it('passe à la saisie du code après une inscription réussie', async () => {
    render(<FormulaireConnexion />);
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }));
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'marc@test.fr' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^créer mon compte$/i }));

    expect(await screen.findByLabelText(/code reçu par email/i)).toBeInTheDocument();
  });

  it('ne demande pas de mot de passe pour une réinitialisation', async () => {
    render(<FormulaireConnexion />);
    fireEvent.click(screen.getByRole('button', { name: /mot de passe oublié/i }));
    expect(screen.queryByLabelText(/^mot de passe$/i)).toBeNull();
    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
  });
});
```

- [ ] **Étape 3 : lancer, vérifier ROUGE**

```bash
cd web
npx vitest run src/components/auth/FormulaireConnexion.test.tsx
```

Attendu : ÉCHEC — module `./FormulaireConnexion` introuvable.

- [ ] **Étape 4 : écrire le composant**

Créer `web/src/components/auth/FormulaireConnexion.tsx` :

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useAuthStore } from "@/state/authStore";
import { toast } from "@/state/uiStore";
import { messageErreurAuth } from "@/lib/auth/messages";
import { validerEmail, validerMotDePasse } from "@/lib/auth/validation";

type Etape = "connexion" | "inscription" | "code" | "oubli";

/**
 * Les quatre états de la page /connexion.
 *
 * Google et le formulaire sont deux chemins EXCLUSIFS : un clic sur Google
 * inscrit et connecte d'un coup, sans mot de passe ni code. L'état `code` ne
 * concerne donc jamais quelqu'un venu par Google.
 */
export default function FormulaireConnexion() {
  const router = useRouter();
  const {
    isConfigured, signInWithEmail, signUpWithEmail, confirmSignupCode,
    requestPasswordReset,
  } = useAuthStore();

  const [etape, setEtape] = useState<Etape>("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  /**
   * Appelée UNIQUEMENT après un échec de mot de passe (cf. la route
   * /api/auth/methode). Un échec réseau vaut « je ne sais pas » : on retombe
   * alors sur le message générique.
   */
  async function compteVientDeGoogle(adresse: string): Promise<boolean> {
    try {
      const reponse = await fetch("/api/auth/methode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adresse }),
      });
      if (!reponse.ok) return false;
      const donnees = await reponse.json();
      return donnees.google === true;
    } catch {
      return false;
    }
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (etape === "code") {
      setEnCours(true);
      try {
        await confirmSignupCode(email, code.trim());
        toast("Votre adresse est confirmée.", "success");
        router.push("/");
      } catch (err) {
        setErreur(messageErreurAuth((err as Error).message ?? ""));
      } finally {
        setEnCours(false);
      }
      return;
    }

    const fauteEmail = validerEmail(email);
    if (fauteEmail) return setErreur(fauteEmail);

    if (etape === "oubli") {
      setEnCours(true);
      try {
        await requestPasswordReset(email.trim());
        // Formulé pour ne pas révéler si l'adresse est inscrite.
        toast("Si un compte existe pour cette adresse, un lien vient d'être envoyé.", "success");
        setEtape("connexion");
      } catch (err) {
        setErreur(messageErreurAuth((err as Error).message ?? ""));
      } finally {
        setEnCours(false);
      }
      return;
    }

    const fauteMotDePasse = validerMotDePasse(motDePasse);
    if (fauteMotDePasse) return setErreur(fauteMotDePasse);

    setEnCours(true);
    try {
      if (etape === "inscription") {
        await signUpWithEmail(email.trim(), motDePasse);
        setEtape("code");
      } else {
        await signInWithEmail(email.trim(), motDePasse);
        router.push("/");
      }
    } catch (err) {
      const brut = (err as Error).message ?? "";
      const google = etape === "connexion" && (await compteVientDeGoogle(email.trim()));
      setErreur(messageErreurAuth(brut, google));
    } finally {
      setEnCours(false);
    }
  }

  if (!isConfigured) {
    return <p className="connexion__indispo">La connexion est indisponible sur cette installation.</p>;
  }

  const titres: Record<Etape, string> = {
    connexion: "Se connecter",
    inscription: "Créer un compte",
    code: "Confirmer votre adresse",
    oubli: "Mot de passe oublié",
  };

  return (
    <div className="connexion">
      <h1 className="connexion__titre">{titres[etape]}</h1>

      {etape !== "code" && etape !== "oubli" && (
        <>
          <div className="connexion__google">
            <GoogleSignInButton />
          </div>
          <p className="connexion__ou">ou</p>
        </>
      )}

      <form onSubmit={soumettre} className="connexion__form">
        {etape === "code" ? (
          <>
            <p className="connexion__aide">
              Un code à 6 chiffres vient d&apos;être envoyé à {email}. Saisissez-le
              ici pour rester sur cette page — votre CV en cours n&apos;est pas perdu.
            </p>
            <label className="connexion__champ">
              Code reçu par email
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label className="connexion__champ">
              Adresse email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {etape !== "oubli" && (
              <label className="connexion__champ">
                Mot de passe
                <input
                  type="password"
                  autoComplete={etape === "inscription" ? "new-password" : "current-password"}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                />
              </label>
            )}
          </>
        )}

        {erreur && <p className="connexion__erreur" role="alert">{erreur}</p>}

        <button type="submit" className="connexion__valider" disabled={enCours}>
          {etape === "connexion" && "Se connecter"}
          {etape === "inscription" && "Créer mon compte"}
          {etape === "code" && "Confirmer"}
          {etape === "oubli" && "Envoyer le lien"}
        </button>
      </form>

      <div className="connexion__liens">
        {etape === "connexion" && (
          <>
            <button type="button" onClick={() => { setErreur(null); setEtape("inscription"); }}>
              Créer un compte
            </button>
            <button type="button" onClick={() => { setErreur(null); setEtape("oubli"); }}>
              Mot de passe oublié
            </button>
          </>
        )}
        {etape !== "connexion" && (
          <button type="button" onClick={() => { setErreur(null); setEtape("connexion"); }}>
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Étape 5 : écrire la page**

Créer `web/src/app/connexion/page.tsx` :

```tsx
import FormulaireConnexion from "@/components/auth/FormulaireConnexion";

export const metadata = {
  title: "Connexion — CVMatchr",
};

export default function PageConnexion() {
  return (
    <main className="connexion-page">
      <FormulaireConnexion />
    </main>
  );
}
```

- [ ] **Étape 6 : écrire les styles**

Ajouter à la fin de `web/src/app/globals.css`. **Aucune couleur en dur** :
n'utiliser que les variables de thème déjà définies en tête du fichier (les
relire avant d'écrire ; si l'une des variables citées ci-dessous n'existe pas,
prendre l'équivalente réellement présente — ne pas en inventer).

```css
/* ---------- Page de connexion (chantier A) ---------- */
.connexion-page {
  display: flex;
  justify-content: center;
  padding: 48px 16px;
}
.connexion {
  width: 100%;
  max-width: 380px;
}
.connexion__titre {
  font-size: 1.4rem;
  margin-bottom: 24px;
  text-align: center;
}
.connexion__google { display: flex; justify-content: center; }
.connexion__ou {
  text-align: center;
  margin: 20px 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}
.connexion__form { display: flex; flex-direction: column; gap: 14px; }
.connexion__champ { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; }
.connexion__champ input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
}
.connexion__aide { font-size: 0.9rem; color: var(--text-muted); }
.connexion__erreur { color: var(--danger); font-size: 0.9rem; }
.connexion__valider {
  padding: 11px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.connexion__valider:disabled { opacity: 0.6; cursor: default; }
.connexion__liens {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}
.connexion__liens button {
  background: none;
  border: none;
  padding: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
}
.connexion__indispo { text-align: center; color: var(--text-muted); }
```

- [ ] **Étape 7 : lancer, vérifier VERT**

```bash
cd web
npx vitest run src/components/auth/FormulaireConnexion.test.tsx
```

- [ ] **Étape 8 : vérifier à l'écran**

Lancer `npm run dev`, ouvrir `http://localhost:3000/connexion`, et vérifier
concrètement :

1. Les deux chemins sont visibles et séparés par « ou ».
2. « Créer un compte » puis « Retour à la connexion » ramène bien à l'état initial.
3. « Mot de passe oublié » fait disparaître le champ mot de passe.
4. En thème sombre comme en thème clair, le texte reste lisible et aucun bloc
   ne déborde. Basculer le thème depuis le menu utilisateur.

Si un style ne s'applique pas : piège Turbopack connu — supprimer `web/.next`,
vérifier qu'aucun serveur ne traîne sur le port 3000, relancer.

- [ ] **Étape 9 : vérification complète et commit**

```bash
cd web
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

```bash
git add web/src/components/auth/FormulaireConnexion.tsx web/src/components/auth/FormulaireConnexion.test.tsx web/src/app/connexion/page.tsx web/src/app/globals.css WORK_HISTORY.md
git commit -m "feat(auth): page /connexion, quatre etats et deux chemins d'entree"
```

---

## Task 6 : poser le nouveau mot de passe

**Pourquoi :** le lien de réinitialisation doit atterrir quelque part. Sans
cette page, « mot de passe oublié » envoie un courriel qui ne mène à rien.

**Fichiers :**
- Créer : `web/src/app/connexion/nouveau-mot-de-passe/page.tsx`

**Interfaces consommées :** `updatePassword` (Task 4), `validerMotDePasse`
(Task 2), `messageErreurAuth` (Task 2).

- [ ] **Étape 1 : écrire la page**

Créer `web/src/app/connexion/nouveau-mot-de-passe/page.tsx` :

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/state/authStore";
import { toast } from "@/state/uiStore";
import { messageErreurAuth } from "@/lib/auth/messages";
import { validerMotDePasse } from "@/lib/auth/validation";

/**
 * Fin du parcours « mot de passe oublié ». On arrive ici depuis le lien du
 * courriel, après que /auth/callback a échangé le code contre une session de
 * récupération. Sans cette session, `updateUser` échoue — le message renvoyé
 * l'explique, plutôt que de laisser un écran muet.
 */
export default function PageNouveauMotDePasse() {
  const router = useRouter();
  const { updatePassword } = useAuthStore();
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    const faute = validerMotDePasse(motDePasse);
    if (faute) return setErreur(faute);

    setEnCours(true);
    try {
      await updatePassword(motDePasse);
      toast("Votre mot de passe est enregistré.", "success");
      router.push("/");
    } catch (err) {
      setErreur(messageErreurAuth((err as Error).message ?? ""));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="connexion-page">
      <div className="connexion">
        <h1 className="connexion__titre">Nouveau mot de passe</h1>
        <form onSubmit={soumettre} className="connexion__form">
          <label className="connexion__champ">
            Nouveau mot de passe
            <input
              type="password"
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </label>

          {erreur && <p className="connexion__erreur" role="alert">{erreur}</p>}

          <button type="submit" className="connexion__valider" disabled={enCours}>
            Enregistrer
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Étape 2 : vérifier à l'écran**

Ouvrir `http://localhost:3000/connexion/nouveau-mot-de-passe`. Sans session de
récupération, saisir un mot de passe de 8 caractères et valider : un message
d'erreur lisible doit s'afficher — **jamais** un écran figé ni une page blanche.

- [ ] **Étape 3 : vérification complète et commit**

```bash
cd web
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

```bash
git add web/src/app/connexion/nouveau-mot-de-passe/page.tsx WORK_HISTORY.md
git commit -m "feat(auth): page de pose du nouveau mot de passe"
```

---

## Task 7 : les menus mènent à la page

**Pourquoi :** tant que les menus ne proposent que Google, la page construite
aux tasks 5 et 6 n'est atteignable qu'en tapant son adresse à la main.

**Fichiers :**
- Modifier : `web/src/components/layout/UserMenu.tsx`
- Modifier : `web/src/components/layout/MobileMenu.tsx`
- Modifier : `web/src/components/layout/UserMenuAuth.test.tsx` *(adaptation autorisée)*
- Modifier : `web/src/components/layout/MobileMenu.test.tsx` *(adaptation autorisée)*

**⚠️ Exception à la règle « on ne modifie pas un test existant » :** ces deux
tests vérifient la présence du texte « Se connecter avec Google » dans les
menus. Ce texte disparaît par décision de conception. Les adapter à
« Se connecter » est attendu ; **supprimer** une assertion ne l'est pas.

- [ ] **Étape 1 : adapter le menu desktop**

Dans `web/src/components/layout/UserMenu.tsx`, remplacer tout le bloc
`isConfigured ? (…) : null` (le ternaire qui choisit entre `GoogleSignInButton`
et le bouton de repli, lignes ~71-95) par une entrée unique :

```tsx
          ) : isConfigured ? (
            // Les deux méthodes (Google, email) vivent désormais sur
            // /connexion : un menu déroulant ne peut pas porter un formulaire
            // à quatre états, un code de confirmation et un mot de passe
            // oublié.
            <Link
              href="/connexion"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Se connecter
            </Link>
          ) : null}
```

Ajouter `import Link from "next/link";` en tête. Retirer ensuite les imports
et variables devenus inutilisés (`GoogleSignInButton`, `signInWithGoogle` s'ils
ne servent plus ailleurs dans le fichier) — sinon `npm run lint` échoue.

- [ ] **Étape 2 : adapter le menu mobile**

Dans `web/src/components/layout/MobileMenu.tsx`, remplacer le contenu de
`<div className="mm-signin">` (le commentaire d'arbitrage et le ternaire
Google, lignes ~128-149) en gardant le paragraphe d'accroche existant :

```tsx
            <div className="mm-signin">
              <p className="mm-signin__pitch">
                Connectez-vous pour que vos CV soient enregistrés et vous suivent d&apos;un
                appareil à l&apos;autre.
              </p>
              <Link href="/connexion" className="mm-google" onClick={() => fermer()}>
                Se connecter
              </Link>
            </div>
```

⚠️ `fermer()` est un exemple : reprendre la fonction de fermeture réellement
utilisée par les autres entrées du fichier (l'assistant `act(...)` visible sur
les boutons voisins). Lire les lignes alentour avant d'écrire.

Ajouter `import Link from "next/link";`, retirer les imports devenus inutiles.

- [ ] **Étape 3 : adapter les deux tests**

Dans `UserMenuAuth.test.tsx`, remplacer les deux occurrences de
`/se connecter avec google/i` par `/se connecter/i`. Ne rien supprimer d'autre :
les deux cas testés (proposée quand déconnecté, masquée quand Supabase n'est
pas configuré) restent valables tels quels.

Dans `MobileMenu.test.tsx`, appliquer le même remplacement à toute assertion
portant sur ce texte. Lire le fichier avant : s'il n'en contient aucune, ne pas
le modifier du tout.

- [ ] **Étape 4 : lancer, vérifier VERT**

```bash
cd web
npx vitest run src/components/layout/
```

- [ ] **Étape 5 : vérifier à l'écran**

Menu utilisateur (bureau) puis menu ☰ (mobile, via la vue mobile du
navigateur) : « Se connecter » mène bien à `/connexion`, et le menu se referme.

- [ ] **Étape 6 : vérification complète et commit**

```bash
cd web
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

```bash
git add web/src/components/layout WORK_HISTORY.md
git commit -m "feat(auth): les menus menent a /connexion au lieu du seul bouton Google"
```

---

## Task 8 : les deux correctifs d'environnement

**Pourquoi :** deux défauts que ce chantier rend visibles (spec §7). Petits,
mais l'un rend les liens de confirmation inopérants, l'autre fait mentir
l'application.

**Fichiers :**
- Modifier : `web/src/middleware.ts`
- Modifier : `web/src/lib/ai/quota.ts`
- Modifier : `web/src/lib/ai/quota.test.ts` *(si une assertion porte sur le message ; le lire d'abord)*

- [ ] **Étape 1 : laisser passer le callback**

Dans `web/src/middleware.ts`, ajouter `/auth/callback` à la liste des chemins
libres :

```ts
  if (
    path === "/login" ||
    // Sans cette ligne, tout lien de confirmation d'adresse ou de
    // réinitialisation de mot de passe est renvoyé sur le portail à mot de
    // passe partagé au lieu de connecter la personne — le code de session
    // arrive dans l'URL et est perdu.
    path === "/auth/callback" ||
    path.startsWith("/_next/") ||
    path.startsWith("/static/") ||
    path === "/favicon.ico" ||
    path === "/api/login"
  ) {
```

- [ ] **Étape 2 : corriger le message qui ment**

Dans `web/src/lib/ai/quota.ts`, remplacer le message de `evaluateQuotaRules` :

```ts
      message:
        'Créez un compte gratuit pour utiliser l\'IA, ou ajoutez votre propre clé API dans les Paramètres.',
```

⚠️ **Périmètre strict** : on corrige la phrase, rien d'autre. Mettre le compte
en avant, replier la clé API dans une section « Avancé », déplacer le moment du
blocage — c'est le chantier B, pas celui-ci.

- [ ] **Étape 3 : mettre les tests au diapason**

Lire `web/src/lib/ai/quota.test.ts`. Si une assertion porte sur l'ancien texte,
l'adapter au nouveau (adaptation autorisée : le texte change par décision de
conception). Sinon, ne pas toucher au fichier.

- [ ] **Étape 4 : vérification complète et commit**

```bash
cd web
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

```bash
git add web/src/middleware.ts web/src/lib/ai/quota.ts web/src/lib/ai/quota.test.ts WORK_HISTORY.md
git commit -m "fix(auth): le callback passe le portail, et le message ne promet plus Google seul"
```

---

## Task 9 : le parcours de bout en bout, et la livraison

**Pourquoi :** les tests précédents simulent Supabase. Celui-ci vérifie que la
page existe vraiment, s'affiche, et refuse ce qu'elle doit refuser. Il ne peut
pas aller jusqu'à la création d'un compte réel : cela exigerait une boîte mail.

**Fichiers :**
- Créer : `web/tests/e2e/connexion-email.spec.ts`
- Modifier : `WORK_HISTORY.md` (entrée de clôture, section « État actuel » comprise)

- [ ] **Étape 1 : écrire le parcours**

Lire d'abord `web/tests/e2e/auth.spec.ts` (conventions du projet), puis créer
`web/tests/e2e/connexion-email.spec.ts` :

```ts
import { test, expect } from '@playwright/test';

test.describe('Connexion par email', () => {
  test('la page propose les deux chemins', async ({ page }) => {
    await page.goto('/connexion');
    await expect(page.getByRole('heading', { name: /se connecter/i })).toBeVisible();
    await expect(page.getByLabel(/adresse email/i)).toBeVisible();
    await expect(page.getByLabel(/^mot de passe$/i)).toBeVisible();
  });

  test('une adresse invalide est refusée sans appel réseau', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel(/adresse email/i).fill('pas-une-adresse');
    await page.getByLabel(/^mot de passe$/i).fill('motdepasse');
    await page.getByRole('button', { name: /^se connecter$/i }).click();
    await expect(page.getByText(/adresse email n'est pas valide/i)).toBeVisible();
  });

  test('mot de passe oublié masque le champ mot de passe', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByRole('button', { name: /mot de passe oublié/i }).click();
    await expect(page.getByLabel(/^mot de passe$/i)).toHaveCount(0);
    await expect(page.getByLabel(/adresse email/i)).toBeVisible();
  });

  test('la page de nouveau mot de passe répond au lieu de rester muette', async ({ page }) => {
    await page.goto('/connexion/nouveau-mot-de-passe');
    await page.getByLabel(/nouveau mot de passe/i).fill('court');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
```

- [ ] **Étape 2 : lancer les e2e**

```bash
cd web
npx playwright test tests/e2e/connexion-email.spec.ts
```

Attendu : 4 tests verts. En cas d'échec incompréhensible : supprimer
`web/.next`, vérifier qu'aucun serveur ne traîne sur le port 3000, relancer.

- [ ] **Étape 3 : vérification complète, e2e inclus**

```bash
cd web
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

Attendu : suite complète verte, y compris les tests préexistants.

- [ ] **Étape 4 : écrire l'entrée de clôture**

Dans `WORK_HISTORY.md` : une entrée de journal au format du fichier (Quoi,
Pourquoi, Fichiers touchés, Résultat vérifs, Reste ouvert), **et** la mise à
jour de la ligne unique « État actuel » en tête.

« Reste ouvert » doit citer explicitement les réglages de l'étape 5 non encore
faits, et le fait que le chantier n'est pas livrable sans eux.

- [ ] **Étape 5 : le rapport final liste les réglages humains**

Ces cinq points ne peuvent pas être faits par un agent. Les recopier tels quels
dans le rapport final, en tête :

> **ACTIONS HUMAINES REQUISES — le chantier n'est pas livrable sans elles**
>
> 1. **Appliquer la migration 0005** sur Supabase (`npx supabase db push` depuis
>    `web/`, ou l'éditeur SQL du tableau de bord). Sans elle, la reconnaissance
>    des comptes Google renvoie toujours « non ».
> 2. **Créer un compte Resend** et vérifier le domaine `cvmatchr.fr` (trois
>    enregistrements DNS : SPF, DKIM, DMARC).
> 3. **Coller les identifiants SMTP Resend** dans Supabase → Authentication →
>    SMTP Settings. Sans cela, l'envoi intégré de Supabase ne délivre que
>    quelques messages par heure, uniquement aux adresses déclarées dans le
>    projet : la plupart des inscrits ne recevraient jamais leur code.
> 4. **Activer « Confirm email »**, et modifier le gabarit « Confirm signup »
>    pour qu'il contienne `{{ .Token }}` (le code à 6 chiffres) **en plus** du
>    lien `{{ .ConfirmationURL }}`.
> 5. **Porter « Minimum password length » à 8** (Supabase en impose 6 par
>    défaut). Sinon l'app annonce une règle que le serveur n'applique pas.
>
> Et, pour la reconnaissance des comptes Google : renseigner
> `SUPABASE_SERVICE_ROLE_KEY` dans les variables d'environnement locales **et**
> dans Vercel. Absente, la fonctionnalité se tait proprement — rien ne casse.

- [ ] **Étape 6 : commit**

```bash
git add web/tests/e2e/connexion-email.spec.ts WORK_HISTORY.md
git commit -m "test(auth): parcours e2e de la page de connexion, et cloture du chantier A"
```

**PUSH INTERDIT.** C'est l'humain qui pousse, après lecture du rapport.

---

## Ordre et dépendances

```
Task 1 (base)  ─┐
                ├─→ Task 3 (route) ─┐
Task 2 (pures) ─┘                   ├─→ Task 5 (page) ─→ Task 6 (nouveau mdp) ─→ Task 7 (menus) ─→ Task 9 (e2e)
                   Task 4 (store) ──┘
Task 8 (environnement) : indépendante, peut être faite à tout moment
```

Les tasks 1 et 2 sont indépendantes l'une de l'autre. Tout le reste suit
l'ordre du plan.
