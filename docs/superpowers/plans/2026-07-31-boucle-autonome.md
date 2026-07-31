# Boucle autonome — plan d'implémentation

> **Pour l'agent d'exécution :** SKILL REQUISE — `superpowers:subagent-driven-development`
> (recommandé) ou `superpowers:executing-plans`, tâche par tâche, DANS L'ORDRE.
> Le contrat d'exécution du dépôt est `web/CADRAGE_EXECUTION.md` : preuves obligatoires,
> une tâche = un commit, pas de refactor voisin.

**But :** un agent Claude qui, toutes les 6 heures et sans intervention humaine, audite
CVMatchr, conçoit des plans et les implémente, avec fusion en production uniquement si
la CI est explicitement verte.

**Architecture :** un workflow GitHub Actions programmé réveille une session Claude
neuve. Un script Node pur choisit le rôle à jouer (Gardien, Bâtisseur, Architecte,
Éclaireur) d'après trois fichiers Markdown versionnés. Claude n'écrit que du code et des
commits locaux ; **le workflow seul** pousse, ouvre la PR et demande la fusion
automatique — l'agent n'a jamais la main sur la production.

**Pile technique :** GitHub Actions, `anthropics/claude-code-action`, Node 22 (lanceur de
tests intégré `node --test`), `gh` CLI (préinstallé sur les runners). **Aucune dépendance
npm ajoutée.**

**Spec de référence :** `docs/superpowers/specs/2026-07-31-boucle-autonome-design.md`

## Contraintes globales

- **Aucune dépendance npm ajoutée ou mise à jour.** Les scripts de la boucle n'utilisent
  que la bibliothèque standard de Node et le lanceur `node --test`.
- **Tous les fichiers produits sont en français** — noms de rôles accentués compris
  (`Éclaireur`, `Bâtisseur`).
- **Les scripts de la boucle vivent hors de `web/`** (dans `.claude/loop/`). Vitest est
  configuré sur `src/**/*.test.{ts,tsx}` uniquement et ne les verra jamais ; ils sont
  testés par `node --test`.
- **Fichiers interdits en écriture à la boucle :** `.github/workflows/`,
  `.claude/loop/MISSION.md`, `.claude/loop/roles/`, `.claude/loop/bin/`, tout `.env*`,
  et la branche `main`. Cette liste est appliquée par un script, pas par la bonne
  volonté de l'agent — le script s'y protège lui-même, sans quoi la boucle pourrait le
  désarmer et la version désarmée validerait son propre diff.
- **Encodage UTF-8 sans BOM**, fins de ligne LF pour tous les fichiers créés.
- Le dépôt a `main` protégée par le déploiement Vercel : **aucun push direct sur `main`**
  dans tout ce plan.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `.claude/loop/MISSION.md` | Le référentiel : objectif, seuils chiffrés, priorités, chantiers sous feu vert. Lu par tous les rôles. **Jamais écrit par la boucle.** |
| `.claude/loop/BACKLOG.md` | File d'attente en sections. Seul canal de pilotage du propriétaire. Lu et écrit par la boucle. |
| `.claude/loop/ETAT.md` | Dernier réveil, rôle joué, PR courante. Premier fichier lu. Écrit par la boucle. |
| `.claude/loop/PAUSE.md` | Absent par défaut. Présent = arrêt (total, ou des rôles qu'il nomme). |
| `.claude/loop/roles/*.md` | Les quatre mandats, en clair. **Jamais écrits par la boucle.** |
| `.claude/loop/bin/choisir-role.mjs` | Fonctions pures de décision + interface ligne de commande. |
| `.claude/loop/bin/choisir-role.test.mjs` | Tests du sélecteur (`node --test`). |
| `.claude/loop/bin/verifier-perimetre.mjs` | Refuse un diff qui touche un fichier interdit. |
| `.claude/loop/bin/verifier-perimetre.test.mjs` | Tests du garde-fou. |
| `.github/workflows/boucle.yml` | Le moteur : cron, choix du rôle, appel de Claude, push, PR, fusion auto. |
| `.claude/loop/constats/` | Sorties de l'Éclaireur, datées. |
| `.claude/loop/journal/` | Une entrée par réveil. |

---

## Task 0 : constater l'état réel de la CI

Toute la fusion automatique repose sur « la CI est verte ». `WORK_HISTORY.md` (28/07)
indique *« Playwright test ignoré (bloqué) »*. Si l'end-to-end échoue, la boucle
produira des PR que rien ne fusionnera, sans bruit, pendant des jours.
**On mesure. On ne suppose pas.**

**Fichiers :**
- Créer : `.claude/loop/constats/2026-07-31-etat-ci.md`
- Modifier (seulement si un correctif est nécessaire) : les fichiers que le diagnostic
  désigne.

**Produit :** un constat écrit indiquant si `npm run test:e2e` passe, et le cas échéant
la cause racine.

- [ ] **Étape 1 : lancer la suite end-to-end en local**

```bash
cd web && npx playwright install --with-deps && npm run test:e2e
```

Coller la sortie intégrale (ou les 40 dernières lignes si elle est très longue).

- [ ] **Étape 2 : écrire le constat**

Créer `.claude/loop/constats/2026-07-31-etat-ci.md` :

```markdown
# Constat — état de la CI au 2026-07-31

**Domaine :** fiabilité
**Mesuré par :** `cd web && npm run test:e2e`

## Résultat

<coller ici le nombre de tests passés/échoués et la sortie significative>

## Verdict

<« CI verte, la fusion automatique peut s'appuyer dessus »
 OU « CI rouge : <cause racine identifiée>. Corrigé par <fichiers>. »
 OU « CI rouge : <cause racine>. Non corrigeable dans cette tâche, voir Étape 4. »>
```

- [ ] **Étape 3 : si la suite échoue, diagnostiquer avant de corriger**

Utiliser la skill `superpowers:systematic-debugging` : cause racine d'abord, correctif
ensuite. Ne jamais neutraliser un test pour le faire passer (règle 9 du cadrage).

- [ ] **Étape 4 : si la cause racine ne peut pas être corrigée ici**

Ne pas bloquer le plan. Écrire dans le constat pourquoi, puis retirer Playwright de la
liste des vérifications **exigées pour la fusion automatique** en modifiant
`.github/workflows/web.yml` pour marquer l'étape non bloquante :

```yaml
      - name: E2E Tests (Playwright)
        continue-on-error: true
        run: npm run test:e2e
```

Le noter explicitement dans le constat comme une dette, et ajouter la ligne
correspondante au backlog en Task 1.

- [ ] **Étape 5 : vérifier que la CI complète passe**

```bash
cd web && npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Attendu : les quatre commandes en succès.

- [ ] **Étape 6 : commit**

```bash
git add .claude/loop/constats/2026-07-31-etat-ci.md
git commit -m "docs(boucle): constat de l'état réel de la CI avant armement"
```

---

## Task 0 bis : remettre la suite end-to-end en phase avec l'app

Ajoutée après la mesure de la Task 0. Les 14 tests rouges ne signalent **aucun bug
produit** : ils décrivent une application qui n'existe plus, parce qu'elle a
délibérément évolué. Une suite périmée est un filet décoratif — et c'est le seul filet
qui vérifie qu'un utilisateur peut réellement se servir de l'app. Vitest teste des
fonctions ; Playwright teste des parcours.

**Autorisation explicite** : cette tâche lève la règle 9 de `web/CADRAGE_EXECUTION.md`
(« tu ne modifies pas un test existant pour le faire passer ») **pour ces quatre
fichiers uniquement**. La justification est que le comportement attendu a changé par
décision produit, documentée par un commit — pas que le code soit faux.

**Écart assumé au format du plan** : cette tâche ne contient pas le code à écrire, parce
que sa rédaction exigeait de lire les quatre fichiers de test et les composants qu'ils
visent. Le diagnostic ci-dessous est en revanche complet : chaque échec a sa cause
racine et son commit d'origine.

**Fichiers :**
- Modifier : `web/tests/e2e/jobs.spec.ts`, `help.spec.ts`, `mobile.spec.ts`,
  `profile.spec.ts` (chemins exacts à confirmer à l'ouverture)
- Modifier : `.github/workflows/web.yml` — retirer le `continue-on-error: true`

**Diagnostic établi par la Task 0** (voir `.claude/loop/constats/2026-07-31-etat-ci.md`) :

| Fichier | Tests rouges | Cause racine |
|---|---|---|
| `jobs.spec.ts` | 9 | Le bouton de scan est désactivé tant qu'aucun mot-clé métier n'est saisi (`canScan`, décision produit du 22/07). Les tests n'en saisissent jamais. |
| `help.spec.ts` | 2 | L'accordéon FAQ est passé de `<details>` à des boutons React pilotés par état (commit `5dc0a01`, pour l'animation CSS Grid). |
| `mobile.spec.ts` | 2 | La page « Historique » a été absorbée par « Candidatures » (commit `d0d9082`). |
| `profile.spec.ts` | 1 | Le lien `/profil` vit maintenant dans le menu utilisateur (`UserMenu`, commit `b9a84e3`) ; le test clique sans ouvrir le menu. |

- [ ] **Étape 1 : constater les 14 échecs**

```bash
cd web && npm run test:e2e -- --workers=1 --reporter=line
```

Attendu : `24 passed`, `14 failed`. Relever le nom exact de chaque test rouge.

- [ ] **Étape 2 : réparer chaque fichier, en visant le comportement d'aujourd'hui**

Règle qui gouverne cette étape : **le test doit décrire ce que l'app fait maintenant, et
échouer si elle cesse de le faire.** Un test qu'on rend vert en supprimant son assertion
est pire que pas de test — il donne l'illusion d'une protection.

Concrètement, pour chacun :
- `jobs.spec.ts` — saisir un mot-clé métier dans le champ prévu avant d'attendre que le
  bouton de scan soit actif. Le test doit continuer d'échouer si le bouton reste
  désactivé alors qu'un mot-clé est saisi.
- `help.spec.ts` — cibler les boutons de l'accordéon et vérifier l'ouverture par l'état
  visible du panneau, pas par l'attribut `open` d'un `<details>` disparu.
- `mobile.spec.ts` — viser « Candidatures » là où le test visait « Historique ». Ne pas
  supprimer les assertions : l'écran existe toujours, il a changé de nom et d'adresse.
- `profile.spec.ts` — ouvrir le menu utilisateur avant de cliquer sur le lien.

Ne modifier aucun fichier de `web/src/` : la Task 0 a déjà restauré le seul point
d'accroche réellement manquant (`data-testid="jobs-scan"`). Si un autre point d'accroche
manque vraiment, l'ajouter est permis — mais uniquement un attribut de test, jamais un
changement de comportement.

- [ ] **Étape 3 : vérifier que la suite est verte**

```bash
cd web && npm run test:e2e -- --workers=1 --reporter=line
```

Attendu : `38 passed`, `0 failed`. Si un test résiste, ne pas le neutraliser : le
diagnostiquer avec `superpowers:systematic-debugging` et rapporter.

- [ ] **Étape 4 : rendre Playwright bloquant à nouveau**

Dans `.github/workflows/web.yml`, supprimer la ligne `continue-on-error: true` sous
`- name: E2E Tests (Playwright)`. L'étape doit redevenir :

```yaml
      - name: E2E Tests (Playwright)
        run: npm run test:e2e
```

C'est cette ligne, et elle seule, qui redonne à la fusion automatique un filet réel.

- [ ] **Étape 5 : vérifier la CI complète**

```bash
cd web && npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Attendu : les quatre en succès.

- [ ] **Étape 6 : commit**

```bash
git add web/tests .github/workflows/web.yml
git commit -m "test(e2e): la suite décrit à nouveau l'app réelle, Playwright redevient bloquant"
```

---

## Task 1 : le socle de fichiers

**Fichiers :**
- Créer : `.claude/loop/MISSION.md`
- Créer : `.claude/loop/BACKLOG.md`
- Créer : `.claude/loop/ETAT.md`
- Créer : `.claude/loop/constats/.gitkeep`, `.claude/loop/journal/.gitkeep`

**Interfaces :**
- Produit : le format de sections de `BACKLOG.md`, que `lireBacklog()` (Task 2) analyse.
  Les titres de section exacts sont `## Prêt à coder`, `## À planifier`,
  `## En attente de feu vert`, `## Idées`, `## Terminé`, `## Échoué`.

- [ ] **Étape 1 : écrire `.claude/loop/MISSION.md`**

```markdown
# MISSION — le référentiel de la boucle

Ce fichier est la boussole. Tous les rôles le lisent à chaque réveil.
**La boucle ne le modifie jamais.** Elle peut proposer de le changer : une ligne dans
`BACKLOG.md`, section « Idées », adressée au propriétaire.

## Objectif

N'importe quel candidat, sans explication préalable, doit pouvoir produire un CV et une
lettre adaptés à une offre précise — et ne jamais avoir envie de retourner à Word.

## Seuils vérifiables

| Domaine | Seuil |
|---|---|
| Affichage des offres | premier résultat visible < 2 s |
| Chargement de l'éditeur | interactif < 2,5 s |
| Accessibilité | parcours principaux navigables au clavier seul, contrastes AA |
| Fiabilité | CI verte ; aucun `any` ni `eslint-disable` ajouté |
| Mobile | tout parcours principal utilisable sur 375 px de large |
| Nouvel arrivant | de l'arrivée au premier PDF sans consulter l'aide |

Un chiffre au-dessus du seuil justifie un chantier. Un chiffre en dessous le clôt.

## Ordre des priorités

1. **Finition professionnelle** — l'application donne l'impression d'un produit fini.
2. **Fonctionnalités** — combler les manques face aux produits concurrents.
3. **Multi-utilisateur** — comptes, données qui suivent d'un appareil à l'autre.

Cet ordre est fixé par le propriétaire. Il ne se redébat pas à chaque réveil.

## Règle de tranchage

À chaque arbitrage, retenir l'option **la plus complète et la plus qualitative**, pas la
moins coûteuse. Puis écrire ce qui a été écarté et pourquoi.

## Chantiers exigeant un feu vert humain

- comptes et authentification ;
- migration des données hors d'IndexedDB ;
- ajout d'une dépendance npm importante ;
- tout ce qui touche à un paiement ou au modèle économique.

L'Architecte **peut** écrire la spec de ces chantiers. Le Bâtisseur ne les implémente
qu'après que le propriétaire ait écrit `!ok` sur la ligne du backlog. Toute ligne de
backlog portant `[feu vert requis]` sans `!ok` est invisible pour le Bâtisseur.

## Interdits absolus

La boucle ne modifie jamais : `.github/workflows/`, `.claude/loop/MISSION.md`,
`.claude/loop/roles/`, `.claude/loop/bin/`, tout fichier `.env*`. Elle ne pousse jamais
sur `main`. Elle décide librement **comment** atteindre le but, jamais **quel** but.

Si tu penses qu'un de ces fichiers doit changer, écris une ligne dans `BACKLOG.md`,
section « Idées », adressée au propriétaire. Ne le modifie pas toi-même : un script
(`bin/verifier-perimetre.mjs`) refusera ton diff et le réveil sera perdu.

## Règles héritées du dépôt

- `CLAUDE.md` (racine) et `web/AGENTS.md` s'appliquent intégralement.
- `web/CADRAGE_EXECUTION.md` est le contrat d'exécution, avec un seul amendement :
  sa règle 10 (« push strictement interdit ») devient « push sur une branche `claude/…`
  uniquement, jamais sur `main` ».
- Jamais `alert`/`confirm`/`prompt` natifs → `uiAlert`/`uiConfirm`/`uiPrompt`.
- Jamais de couleur en dur → variables de thème dans `src/app/globals.css`.
- La photo de profil (base64) n'est jamais envoyée à une IA.
```

- [ ] **Étape 2 : écrire `.claude/loop/BACKLOG.md`**

```markdown
# BACKLOG

Canal de pilotage. Le propriétaire écrit ici en langage courant, sans syntaxe à
apprendre. Conventions minimales :

- une ligne commence par `- ` ;
- `!` en tête = à traiter en premier dans sa section ;
- `[feu vert requis]` = chantier bloqué tant que la ligne ne porte pas `!ok` ;
- une ligne barrée `~~…~~` est ignorée (refusée par le propriétaire).

**Les titres de section ci-dessous sont analysés par un script — ne pas les renommer.**

## Prêt à coder

*(un plan existe, le Bâtisseur peut s'y mettre — vide au démarrage)*

## À planifier

*(un constat existe, l'Architecte doit en faire une spec + un plan)*

## En attente de feu vert

*(spec écrite, implémentation bloquée jusqu'au `!ok` du propriétaire)*

## Idées

*(dépôt libre du propriétaire et de l'Éclaireur, à trier)*

## Terminé

## Échoué
```

Si la Task 0 a laissé une dette Playwright, ajouter sous `## À planifier` :

```markdown
- Playwright non bloquant en CI — voir .claude/loop/constats/2026-07-31-etat-ci.md
```

- [ ] **Étape 3 : écrire `.claude/loop/ETAT.md`**

```markdown
# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `.claude/loop/journal/`)*

- **Dernier réveil :** aucun
- **Rôle joué :** aucun
- **PR en cours :** aucune
- **Domaine audité en dernier :** aucun
- **Échecs consécutifs du Gardien sur la PR courante :** 0
```

- [ ] **Étape 4 : créer les répertoires**

```bash
mkdir -p .claude/loop/constats .claude/loop/journal
touch .claude/loop/constats/.gitkeep .claude/loop/journal/.gitkeep
```

- [ ] **Étape 5 : vérifier**

```bash
ls -R .claude/loop
```

Attendu : `MISSION.md`, `BACKLOG.md`, `ETAT.md`, et les répertoires `constats/` et
`journal/` contenant chacun `.gitkeep`.

- [ ] **Étape 6 : commit**

```bash
git add .claude/loop
git commit -m "feat(boucle): socle de fichiers — mission, backlog, état"
```

---

## Task 2 : le sélecteur de rôle

Le seul morceau de logique du système. Il est pur et testé, pour que le choix du rôle ne
dépende jamais de l'humeur d'un agent.

**Fichiers :**
- Créer : `.claude/loop/bin/choisir-role.mjs`
- Tester : `.claude/loop/bin/choisir-role.test.mjs`

**Interfaces :**
- Consomme : le format de sections de `BACKLOG.md` (Task 1).
- Produit :
  - `ROLES: string[]` — `["Gardien", "Bâtisseur", "Architecte", "Éclaireur"]`
  - `lirePause(texte: string | null): { rolesGeles: string[] } | null`
  - `lireBacklog(texte: string): { pretACoder: boolean, constatSansPlan: boolean }`
  - `choisirRole(entree: { pause, pr, backlog }): string` — renvoie un nom de rôle ou
    `"Pause"`. `pr` vaut `null` ou `{ rouge: boolean, heures: number, brouillon: boolean }`.
  - Interface ligne de commande : `node .claude/loop/bin/choisir-role.mjs --pr '<json>'`
    écrit `role=<nom>` sur la sortie standard (format attendu par `$GITHUB_OUTPUT`).

- [ ] **Étape 1 : écrire les tests, qui échouent**

Créer `.claude/loop/bin/choisir-role.test.mjs` :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { choisirRole, lireBacklog, lirePause } from "./choisir-role.mjs";

const VIDE = { pretACoder: false, constatSansPlan: false };

test("sans rien à faire, on explore", () => {
  assert.equal(choisirRole({ backlog: VIDE }), "Éclaireur");
});

test("une PR rouge passe avant tout le reste", () => {
  const backlog = { pretACoder: true, constatSansPlan: true };
  const pr = { rouge: true, heures: 1, brouillon: false };
  assert.equal(choisirRole({ pr, backlog }), "Gardien");
});

test("une PR verte mais figée depuis plus de 24 h réveille le Gardien", () => {
  const pr = { rouge: false, heures: 30, brouillon: false };
  assert.equal(choisirRole({ pr, backlog: VIDE }), "Gardien");
});

// Un plan inachevé se reprend, il ne se remplace pas : la spec impose une seule PR
// ouverte à la fois.
test("une PR en brouillon est reprise par le Bâtisseur", () => {
  const pr = { rouge: false, heures: 2, brouillon: true };
  assert.equal(choisirRole({ pr, backlog: { pretACoder: true, constatSansPlan: false } }), "Bâtisseur");
});

test("aucun nouveau chantier tant qu'une PR est ouverte", () => {
  const pr = { rouge: false, heures: 2, brouillon: false };
  const backlog = { pretACoder: true, constatSansPlan: false };
  assert.equal(choisirRole({ pr, backlog }), "Éclaireur");
});

test("un plan prêt et aucune PR ouverte lance le Bâtisseur", () => {
  assert.equal(choisirRole({ backlog: { pretACoder: true, constatSansPlan: false } }), "Bâtisseur");
});

test("un constat sans plan appelle l'Architecte", () => {
  assert.equal(choisirRole({ backlog: { pretACoder: false, constatSansPlan: true } }), "Architecte");
});

test("l'Architecte travaille même pendant qu'une PR est ouverte", () => {
  const pr = { rouge: false, heures: 2, brouillon: false };
  const backlog = { pretACoder: false, constatSansPlan: true };
  assert.equal(choisirRole({ pr, backlog }), "Architecte");
});

test("une pause sans nom de rôle arrête tout", () => {
  const pause = lirePause("En pause, je refais l'UI moi-même.");
  assert.equal(choisirRole({ pause, backlog: VIDE }), "Pause");
});

test("une pause nommant un rôle ne gèle que celui-là", () => {
  const pause = lirePause("Gel du Bâtisseur le temps que je tranche.");
  const backlog = { pretACoder: true, constatSansPlan: true };
  assert.equal(choisirRole({ pause, backlog }), "Architecte");
});

test("un rôle gelé cède la place au suivant, pas à l'arrêt", () => {
  const pause = lirePause("Gel du Gardien.");
  const pr = { rouge: true, heures: 1, brouillon: false };
  const backlog = { pretACoder: false, constatSansPlan: true };
  assert.equal(choisirRole({ pause, pr, backlog }), "Architecte");
});

test("l'absence de fichier de pause n'est pas une pause", () => {
  assert.equal(lirePause(null), null);
});

const BACKLOG = `# BACKLOG

## Prêt à coder

- Barre de filtres mémorisée — plan: docs/superpowers/plans/x.md

## À planifier

- ~~Idée refusée par le propriétaire~~

## En attente de feu vert

- [feu vert requis] Comptes utilisateurs — spec: docs/x.md
`;

test("une section peuplée est détectée", () => {
  assert.equal(lireBacklog(BACKLOG).pretACoder, true);
});

// Une ligne barrée est un refus explicite du propriétaire : elle ne doit jamais
// réveiller un rôle.
test("une ligne barrée ne compte pas", () => {
  assert.equal(lireBacklog(BACKLOG).constatSansPlan, false);
});

test("un chantier sous feu vert reste invisible sans !ok", () => {
  const texte = "# B\n\n## Prêt à coder\n\n- [feu vert requis] Comptes\n";
  assert.equal(lireBacklog(texte).pretACoder, false);
});

test("le !ok du propriétaire débloque le chantier", () => {
  const texte = "# B\n\n## Prêt à coder\n\n- !ok [feu vert requis] Comptes\n";
  assert.equal(lireBacklog(texte).pretACoder, true);
});

test("les sections absentes valent vide", () => {
  assert.deepEqual(lireBacklog("# BACKLOG\n"), { pretACoder: false, constatSansPlan: false });
});
```

- [ ] **Étape 2 : lancer les tests pour vérifier qu'ils échouent**

```bash
node --test .claude/loop/bin/
```

Attendu : ÉCHEC, `Cannot find module` sur `./choisir-role.mjs`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `.claude/loop/bin/choisir-role.mjs` :

```js
/**
 * Choix du rôle joué par un réveil de la boucle.
 *
 * Volontairement pur et testé : le rôle ne doit jamais dépendre du jugement de
 * l'agent. L'ordre de priorité est réparer > livrer > planifier > explorer —
 * explorer arrive en dernier parce que c'est la tâche la plus agréable, donc celle
 * qui monopoliserait tout si on la laissait libre.
 */
import { readFile } from "node:fs/promises";

export const ROLES = ["Gardien", "Bâtisseur", "Architecte", "Éclaireur"];

/** `null` = pas de pause. Un fichier sans nom de rôle gèle tout. */
export function lirePause(texte) {
  if (texte === null || texte === undefined) return null;
  return { rolesGeles: ROLES.filter((r) => texte.includes(r)) };
}

function lignesDeSection(texte, titre) {
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => l.trim() === `## ${titre}`);
  if (debut === -1) return [];
  const reste = lignes.slice(debut + 1);
  const fin = reste.findIndex((l) => l.startsWith("## "));
  return (fin === -1 ? reste : reste.slice(0, fin))
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

/** Une ligne compte si elle n'est ni barrée ni bloquée par un feu vert non donné. */
function ouvrable(ligne) {
  if (ligne.startsWith("~~")) return false;
  if (ligne.includes("[feu vert requis]") && !ligne.includes("!ok")) return false;
  return true;
}

export function lireBacklog(texte) {
  return {
    pretACoder: lignesDeSection(texte, "Prêt à coder").some(ouvrable),
    constatSansPlan: lignesDeSection(texte, "À planifier").some(ouvrable),
  };
}

export function choisirRole({ pause = null, pr = null, backlog }) {
  const geles = pause ? (pause.rolesGeles.length > 0 ? pause.rolesGeles : ROLES) : [];
  const libre = (role) => !geles.includes(role);

  if (pr && (pr.rouge || pr.heures > 24) && libre("Gardien")) return "Gardien";
  if (pr && pr.brouillon && libre("Bâtisseur")) return "Bâtisseur";
  // Une seule PR ouverte à la fois : tant qu'elle vit, on n'en ouvre pas d'autre.
  if (!pr && backlog.pretACoder && libre("Bâtisseur")) return "Bâtisseur";
  // L'Architecte n'écrit que des documents : il peut travailler en parallèle d'une PR.
  if (backlog.constatSansPlan && libre("Architecte")) return "Architecte";
  if (libre("Éclaireur")) return "Éclaireur";
  return "Pause";
}

async function lireOuNull(chemin) {
  try {
    return await readFile(chemin, "utf8");
  } catch {
    return null;
  }
}

// Interface ligne de commande, appelée par le workflow.
if (process.argv[1]?.endsWith("choisir-role.mjs")) {
  const drapeau = process.argv.indexOf("--pr");
  const brut = drapeau === -1 ? "" : (process.argv[drapeau + 1] ?? "");
  const pr = brut && brut !== "null" ? JSON.parse(brut) : null;

  const pause = lirePause(await lireOuNull(".claude/loop/PAUSE.md"));
  const backlog = lireBacklog((await lireOuNull(".claude/loop/BACKLOG.md")) ?? "");

  process.stdout.write(`role=${choisirRole({ pause, pr, backlog })}\n`);
}
```

- [ ] **Étape 4 : lancer les tests pour vérifier qu'ils passent**

```bash
node --test .claude/loop/bin/
```

Attendu : `pass 17`, `fail 0`.

- [ ] **Étape 5 : vérifier l'interface ligne de commande**

```bash
node .claude/loop/bin/choisir-role.mjs --pr null
```

Attendu, avec le backlog vide de la Task 1 : `role=Éclaireur`.

```bash
node .claude/loop/bin/choisir-role.mjs --pr '{"rouge":true,"heures":1,"brouillon":false}'
```

Attendu : `role=Gardien`.

- [ ] **Étape 6 : commit**

```bash
git add .claude/loop/bin/choisir-role.mjs .claude/loop/bin/choisir-role.test.mjs
git commit -m "feat(boucle): sélecteur de rôle pur et testé"
```

---

## Task 3 : le garde-fou de périmètre

La spec interdit à la boucle de modifier son moteur et son but. Cette interdiction est
appliquée par un script exécuté **après** le travail de Claude et **avant** l'ouverture
de la PR — pas par une consigne dans un prompt.

**Fichiers :**
- Créer : `.claude/loop/bin/verifier-perimetre.mjs`
- Tester : `.claude/loop/bin/verifier-perimetre.test.mjs`

**Interfaces :**
- Produit :
  - `CHEMINS_INTERDITS: RegExp[]`
  - `fichiersInterdits(chemins: string[]): string[]` — renvoie les chemins fautifs.
  - Interface ligne de commande : lit la liste des fichiers modifiés sur l'entrée
    standard (un par ligne), sort en code 1 et écrit les fautifs sur la sortie d'erreur
    si le périmètre est violé.

- [ ] **Étape 1 : écrire les tests, qui échouent**

Créer `.claude/loop/bin/verifier-perimetre.test.mjs` :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fichiersInterdits } from "./verifier-perimetre.mjs";

test("le code applicatif passe", () => {
  const chemins = ["web/src/components/jobs/JobCard.tsx", "web/src/lib/jobs/rank/index.ts"];
  assert.deepEqual(fichiersInterdits(chemins), []);
});

test("les fichiers de suivi de la boucle passent", () => {
  const chemins = [".claude/loop/BACKLOG.md", ".claude/loop/ETAT.md", ".claude/loop/journal/2026-08-01.md"];
  assert.deepEqual(fichiersInterdits(chemins), []);
});

// Un agent qui peut réécrire sa planification ou ses permissions n'a plus de limites,
// seulement des limites qu'il consent à garder.
test("modifier son propre moteur est refusé", () => {
  assert.deepEqual(fichiersInterdits([".github/workflows/boucle.yml"]), [".github/workflows/boucle.yml"]);
});

test("modifier la CI est refusé", () => {
  assert.deepEqual(fichiersInterdits([".github/workflows/web.yml"]), [".github/workflows/web.yml"]);
});

test("réécrire sa propre mission est refusé", () => {
  assert.deepEqual(fichiersInterdits([".claude/loop/MISSION.md"]), [".claude/loop/MISSION.md"]);
});

test("réécrire ses propres mandats est refusé", () => {
  assert.deepEqual(fichiersInterdits([".claude/loop/roles/batisseur.md"]), [".claude/loop/roles/batisseur.md"]);
});

// Sans cette règle, la boucle pourrait affaiblir le garde-fou, et la version
// affaiblie validerait le diff qui l'a affaiblie.
test("désarmer son propre garde-fou est refusé", () => {
  const chemins = [".claude/loop/bin/verifier-perimetre.mjs", ".claude/loop/bin/choisir-role.mjs"];
  assert.deepEqual(fichiersInterdits(chemins), chemins);
});

test("toucher à un fichier d'environnement est refusé", () => {
  const chemins = ["web/.env.local", ".env", "web/.env.production"];
  assert.deepEqual(fichiersInterdits(chemins), chemins);
});

test("les fautifs sont signalés au milieu de changements légitimes", () => {
  const chemins = ["web/src/app/page.tsx", ".claude/loop/MISSION.md", "README.md"];
  assert.deepEqual(fichiersInterdits(chemins), [".claude/loop/MISSION.md"]);
});

// Les chemins arrivent de `git diff` : sur Windows le séparateur peut différer.
test("les séparateurs Windows sont reconnus", () => {
  assert.deepEqual(fichiersInterdits([".claude\\loop\\MISSION.md"]), [".claude\\loop\\MISSION.md"]);
});
```

- [ ] **Étape 2 : lancer les tests pour vérifier qu'ils échouent**

```bash
node --test .claude/loop/bin/
```

Attendu : ÉCHEC, `Cannot find module` sur `./verifier-perimetre.mjs`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `.claude/loop/bin/verifier-perimetre.mjs` :

```js
/**
 * Refuse un diff qui sort du périmètre autorisé à la boucle.
 *
 * Appliqué par un script, pas par une consigne de prompt : la boucle décide
 * librement comment atteindre le but, jamais quel but.
 */
export const CHEMINS_INTERDITS = [
  /^\.github\/workflows\//,
  /^\.claude\/loop\/MISSION\.md$/,
  /^\.claude\/loop\/roles\//,
  // Ce script est son propre moteur : s'il était modifiable, la boucle pourrait
  // se désarmer, et la version désarmée validerait le diff qui l'a désarmée.
  /^\.claude\/loop\/bin\//,
  /(^|\/)\.env($|\.)/,
];

export function fichiersInterdits(chemins) {
  return chemins.filter((brut) => {
    const chemin = brut.replace(/\\/g, "/");
    return CHEMINS_INTERDITS.some((motif) => motif.test(chemin));
  });
}

if (process.argv[1]?.endsWith("verifier-perimetre.mjs")) {
  const entree = [];
  for await (const morceau of process.stdin) entree.push(morceau);
  const chemins = entree.join("").split("\n").map((l) => l.trim()).filter(Boolean);
  const fautifs = fichiersInterdits(chemins);

  if (fautifs.length > 0) {
    process.stderr.write(`Périmètre violé — fichiers interdits :\n${fautifs.join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Périmètre respecté (${chemins.length} fichiers).\n`);
}
```

- [ ] **Étape 4 : lancer les tests pour vérifier qu'ils passent**

```bash
node --test .claude/loop/bin/
```

Attendu : `pass 27`, `fail 0` (les 17 de la Task 2 plus les 10 de celle-ci).

- [ ] **Étape 5 : vérifier l'interface ligne de commande**

```bash
printf 'web/src/app/page.tsx\n' | node .claude/loop/bin/verifier-perimetre.mjs; echo "code=$?"
printf '.claude/loop/MISSION.md\n' | node .claude/loop/bin/verifier-perimetre.mjs; echo "code=$?"
```

Attendu : `Périmètre respecté (1 fichiers).` puis `code=0` ; puis `Périmètre violé` et
`code=1`.

- [ ] **Étape 6 : commit**

```bash
git add .claude/loop/bin/verifier-perimetre.mjs .claude/loop/bin/verifier-perimetre.test.mjs
git commit -m "feat(boucle): garde-fou de périmètre appliqué par script"
```

---

## Task 4 : les quatre mandats

**Fichiers :**
- Créer : `.claude/loop/roles/eclaireur.md`, `architecte.md`, `batisseur.md`, `gardien.md`

**Interfaces :**
- Consomme : `MISSION.md`, `BACKLOG.md`, `ETAT.md` (Task 1).
- Produit : les noms de fichiers exacts que `boucle.yml` (Task 5) associe à chaque rôle,
  via la table `Éclaireur→eclaireur.md`, `Architecte→architecte.md`,
  `Bâtisseur→batisseur.md`, `Gardien→gardien.md`.

- [ ] **Étape 1 : écrire `.claude/loop/roles/eclaireur.md`**

```markdown
# Rôle — ÉCLAIREUR

Tu observes. **Tu n'écris aucune ligne de code applicatif.**

## Ce que tu fais

1. Lis `.claude/loop/ETAT.md` pour connaître le dernier domaine audité.
2. Choisis **le domaine suivant** dans cette rotation :
   performance → accessibilité → parcours d'un nouvel arrivant → cohérence visuelle →
   sécurité → veille concurrentielle → (retour à performance).
3. Audite **ce domaine seul**. Un audit qui balaie tout ne mesure rien.
4. Écris un constat daté dans `.claude/loop/constats/AAAA-MM-JJ-<domaine>.md`.
5. Ajoute tes conclusions à `.claude/loop/BACKLOG.md`, section `## À planifier`,
   une ligne par chantier, la plus grave en premier.

## La règle qui te gouverne

**Aucun constat sans chiffre ni reproduction.**

- Refusé : « l'interface pourrait être plus moderne ».
- Accepté : « sur `/jobs`, le premier résultat s'affiche en 11,8 s ; mesuré trois fois ;
  commande : `curl -w '%{time_total} %{http_code}' …` ».

Vérifie toujours le code de sortie et le code HTTP de tes mesures : un serveur mort
renvoie des temps rapides et faux.

Pour la veille concurrentielle, consulte réellement les produits (Jobscan, Teal, Rezi,
Huntr, Kickresume) et cite tes sources. Ne décris jamais une fonctionnalité concurrente
de mémoire.

## Format du constat

```markdown
# Constat — <domaine> au AAAA-MM-JJ

**Mesuré par :** <commande exacte>

## Mesures
<chiffres bruts, au moins trois relevés quand c'est une mesure de temps>

## Écart au seuil de MISSION.md
<seuil visé, écart constaté>

## Chantiers proposés
1. <titre> — gain attendu : <chiffré si possible>
```

## Bornes

- Tu ne lis que les fichiers de ton domaine. **Jamais tout le dépôt.**
- Tu ne modifies ni `MISSION.md`, ni `roles/`, ni `.github/workflows/`, ni aucun `.env*`.
- Tu termines en mettant `.claude/loop/ETAT.md` à jour et en écrivant ton entrée de
  journal dans `.claude/loop/journal/AAAA-MM-JJ-eclaireur.md`.
```

- [ ] **Étape 2 : écrire `.claude/loop/roles/architecte.md`**

```markdown
# Rôle — ARCHITECTE

Tu transformes un constat en plan exécutable. **Tu n'écris aucune ligne de code
applicatif.**

## Ce que tu fais

1. Lis `.claude/loop/BACKLOG.md`, section `## À planifier`. Prends la ligne préfixée `!`
   s'il y en a une, sinon la première.
2. Invoque `superpowers:brainstorming`, puis `superpowers:writing-plans`.
3. Écris la spec dans `docs/superpowers/specs/AAAA-MM-JJ-<sujet>-design.md` et le plan
   dans `docs/superpowers/plans/AAAA-MM-JJ-<sujet>.md`, aux formats déjà utilisés par le
   dépôt (une trentaine d'exemples y sont).
4. Déplace la ligne de `## À planifier` vers `## Prêt à coder`, en y ajoutant le chemin
   du plan.

## L'approbation humaine, déplacée et non supprimée

`superpowers:brainstorming` exige normalement l'accord d'un humain avant toute
implémentation. Il n'y a pas d'humain à 4 h du matin. Tu **tranches donc toi-même**,
selon la règle de `MISSION.md` : l'option la plus complète et la plus qualitative.

En contrepartie, tu écris dans la spec une section « Écarté explicitement » qui dit ce
que tu n'as pas retenu et pourquoi. Le propriétaire lit un raisonnement, il ne découvre
pas un fait accompli.

## Chantiers sous feu vert

Si le chantier figure dans la liste « exigeant un feu vert humain » de `MISSION.md`
(comptes, sortie des données d'IndexedDB, dépendance importante, paiement) :

- tu écris quand même la spec et le plan — c'est du terrain préparé, c'est utile ;
- mais tu places la ligne dans `## En attente de feu vert` et **non** dans
  `## Prêt à coder`, en la marquant `[feu vert requis]`.

## Bornes

- Tu ne modifies aucun fichier sous `web/src/`.
- Tu ne modifies ni `MISSION.md`, ni `roles/`, ni `.github/workflows/`, ni aucun `.env*`.
- Tu termines en mettant `.claude/loop/ETAT.md` à jour et en écrivant ton entrée de
  journal dans `.claude/loop/journal/AAAA-MM-JJ-architecte.md`.
```

- [ ] **Étape 3 : écrire `.claude/loop/roles/batisseur.md`**

```markdown
# Rôle — BÂTISSEUR

Tu exécutes un plan. C'est le seul rôle qui écrit du code applicatif.

## Ce que tu fais

1. Lis `.claude/loop/ETAT.md`. Si une PR est en brouillon, **tu reprends son plan là où
   il s'est arrêté** — tu n'en commences pas un autre.
2. Sinon, prends la première ligne de `## Prêt à coder` (celle préfixée `!` en priorité)
   et ouvre son plan.
3. Lis `web/CADRAGE_EXECUTION.md` en entier, et applique-le.
4. Invoque `superpowers:test-driven-development`. Test rouge d'abord, code ensuite, test
   vert enfin — dans cet ordre, avec les sorties collées dans ton journal.
5. Un commit local par tâche du plan, message en français.
6. Clos par `superpowers:verification-before-completion`.

## Vérifications, après CHAQUE tâche du plan

```bash
cd web && npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Une vérification rouge = tâche non livrée. **Tu ne désactives jamais une règle pour
passer**, et tu ne modifies jamais un test existant pour le faire passer : si un test
casse, c'est ton code qui est faux.

## Le push et la PR ne sont pas ton affaire

Tu committes **en local uniquement**. Le workflow pousse et ouvre la PR après avoir
vérifié ton périmètre. Ne lance ni `git push`, ni `gh pr create`, ni `gh pr merge`.

## Si tu n'as pas fini

Committe ce qui est vert, laisse le reste. Note dans `ETAT.md` la tâche atteinte. Le
réveil suivant reprendra. **Un plan à moitié fait n'est jamais fusionné** — c'est le
workflow qui garde la PR en brouillon tant que le plan n'est pas bouclé.

## Bornes

- Amendement à la règle 10 du cadrage : push autorisé sur une branche `claude/…`
  uniquement — mais c'est le workflow qui le fait, pas toi. **Jamais `main`.**
- Aucune dépendance npm ajoutée sans instruction explicite du plan.
- Aucun `any`, aucun `@ts-ignore`, aucun `eslint-disable` ajouté.
- Jamais `alert`/`confirm`/`prompt` natifs, jamais de couleur en dur.
- Tu ne modifies ni `MISSION.md`, ni `roles/`, ni `.github/workflows/`, ni aucun `.env*`.
- Tu ajoutes une entrée à `WORK_HISTORY.md` (section `## Journal`) et une à
  `.claude/loop/journal/AAAA-MM-JJ-batisseur.md`.
```

- [ ] **Étape 4 : écrire `.claude/loop/roles/gardien.md`**

```markdown
# Rôle — GARDIEN

Tu répares. Tu passes avant tous les autres rôles.

## Ce que tu fais

1. Lis `.claude/loop/ETAT.md` pour la PR courante et le nombre d'échecs consécutifs.
2. Récupère l'échec réel :

```bash
gh pr checks --watch=false
gh run view --log-failed
```

3. Invoque `superpowers:systematic-debugging`. **Cause racine avant correctif, jamais
   l'inverse.** Tu ne proposes pas de correctif tant que tu n'as pas reproduit.
4. Corrige, vérifie, committe en local.
5. Incrémente le compteur d'échecs dans `ETAT.md`.

## Le droit de renoncer

**Au troisième réveil consécutif sur le même échec, tu fermes la PR.**

```bash
gh pr close <numéro> --comment "<ce qui a été tenté, et pourquoi ça bloque>"
```

Puis déplace la ligne du backlog vers `## Échoué`, en y consignant les trois tentatives
et le chemin du plan. Remets le compteur à 0 dans `ETAT.md`.

Une boucle qui n'abandonne jamais s'enlise : un seul test rétif consommerait
indéfiniment les quatre réveils quotidiens. Savoir renoncer proprement fait partie du
métier.

## Vérifications

```bash
cd web && npx tsc --noEmit && npm run lint && npm run test && npm run build
```

## Bornes

- Tu ne modifies ni `MISSION.md`, ni `roles/`, ni `.github/workflows/`, ni aucun `.env*`.
  Si l'échec vient de la CI elle-même, tu ne la répares pas : tu écris une ligne dans
  `## Idées` du backlog, adressée au propriétaire, et tu fermes la PR.
- Tu ne pousses pas et tu n'ouvres pas de PR : le workflow s'en charge.
- Tu termines en mettant `ETAT.md` à jour et en écrivant
  `.claude/loop/journal/AAAA-MM-JJ-gardien.md`.
```

- [ ] **Étape 5 : vérifier**

```bash
ls .claude/loop/roles/
printf '.claude/loop/roles/gardien.md\n' | node .claude/loop/bin/verifier-perimetre.mjs; echo "code=$?"
```

Attendu : les quatre fichiers listés ; puis `Périmètre violé` et `code=1` — la boucle ne
peut pas réécrire ses propres mandats.

- [ ] **Étape 6 : commit**

```bash
git add .claude/loop/roles
git commit -m "feat(boucle): les quatre mandats — Éclaireur, Architecte, Bâtisseur, Gardien"
```

---

## Task 5 : le moteur

**Fichiers :**
- Créer : `.github/workflows/boucle.yml`
- Modifier : `.github/workflows/web.yml` — ajouter les tests des scripts de la boucle
  (le plan l'ordonne explicitement, ce qui lève l'interdiction de la section 3 du
  cadrage).

**Interfaces :**
- Consomme : `choisir-role.mjs` (Task 2), `verifier-perimetre.mjs` (Task 3), les
  mandats (Task 4).
- Produit : les secrets attendus `CLAUDE_CODE_OAUTH_TOKEN` et `LOOP_GITHUB_TOKEN`,
  configurés par le propriétaire en Task 6.

- [ ] **Étape 1 : lire la documentation de l'action avant d'écrire le YAML**

Les noms exacts des entrées de `anthropics/claude-code-action` doivent être **confirmés,
pas supposés**. Consulter `https://github.com/anthropics/claude-code-action` et relever :
le nom de l'entrée du jeton OAuth, celui du prompt, et celui des arguments passés à
Claude Code. Ajuster l'étape 3 en conséquence si les noms diffèrent de ceux écrits ici.

- [ ] **Étape 2 : ajouter les tests de la boucle à la CI existante**

Sans cela, `choisir-role.test.mjs` et `verifier-perimetre.test.mjs` ne tournent nulle
part et pourrissent. Dans `.github/workflows/web.yml`, insérer entre l'étape
« Setup Node.js » et « Install dependencies » :

```yaml
      - name: Tests des scripts de la boucle
        working-directory: .
        run: node --test .claude/loop/bin/
```

- [ ] **Étape 3 : écrire `.github/workflows/boucle.yml`**

```yaml
name: Boucle autonome

on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:
    inputs:
      role:
        description: "Forcer un rôle (vide = choix automatique)"
        required: false
        default: ""

concurrency:
  group: boucle-autonome
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write

jobs:
  reveil:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.LOOP_GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
          cache-dependency-path: web/package-lock.json

      - name: Tests des scripts de la boucle
        run: node --test .claude/loop/bin/

      # État de la PR courante de la boucle. Une seule PR ouverte à la fois :
      # on prend la plus récente sur une branche `claude/…`.
      - name: État de la PR courante
        id: pr
        env:
          GH_TOKEN: ${{ secrets.LOOP_GITHUB_TOKEN }}
        run: |
          brut=$(gh pr list --state open --limit 1 --json number,isDraft,createdAt,statusCheckRollup,headRefName \
                   --jq '[.[] | select(.headRefName | startswith("claude/"))] | .[0] // empty')
          if [ -z "$brut" ]; then
            echo "pr=null" >> "$GITHUB_OUTPUT"
            echo "numero=" >> "$GITHUB_OUTPUT"
            echo "Aucune PR de la boucle ouverte."
          else
            echo "$brut" > /tmp/pr.json
            node -e '
              const pr = require("/tmp/pr.json");
              const etats = (pr.statusCheckRollup ?? []).map((c) => c.conclusion ?? c.state);
              const rouge = etats.some((e) => e === "FAILURE" || e === "TIMED_OUT" || e === "CANCELLED");
              const heures = (Date.now() - Date.parse(pr.createdAt)) / 3600000;
              const out = { rouge, heures, brouillon: pr.isDraft };
              process.stdout.write(`pr=${JSON.stringify(out)}\nnumero=${pr.number}\n`);
            ' >> "$GITHUB_OUTPUT"
          fi

      - name: Choix du rôle
        id: role
        run: |
          if [ -n "${{ github.event.inputs.role }}" ]; then
            echo "role=${{ github.event.inputs.role }}" >> "$GITHUB_OUTPUT"
          else
            node .claude/loop/bin/choisir-role.mjs --pr '${{ steps.pr.outputs.pr }}' >> "$GITHUB_OUTPUT"
          fi

      - name: Mandat du rôle
        id: mandat
        if: steps.role.outputs.role != 'Pause'
        run: |
          case "${{ steps.role.outputs.role }}" in
            "Éclaireur")  echo "fichier=.claude/loop/roles/eclaireur.md" >> "$GITHUB_OUTPUT" ;;
            "Architecte") echo "fichier=.claude/loop/roles/architecte.md" >> "$GITHUB_OUTPUT" ;;
            "Bâtisseur")  echo "fichier=.claude/loop/roles/batisseur.md" >> "$GITHUB_OUTPUT" ;;
            "Gardien")    echo "fichier=.claude/loop/roles/gardien.md" >> "$GITHUB_OUTPUT" ;;
            *) echo "Rôle inconnu : ${{ steps.role.outputs.role }}" && exit 1 ;;
          esac

      - name: Branche de travail
        id: branche
        if: steps.role.outputs.role != 'Pause'
        run: |
          if [ -n "${{ steps.pr.outputs.numero }}" ]; then
            nom=$(gh pr view ${{ steps.pr.outputs.numero }} --json headRefName --jq .headRefName)
            git checkout "$nom"
            # Le propriétaire gagne toujours : on se rebase sur son travail. En cas de
            # conflit on abandonne la branche au lieu de forcer quoi que ce soit — le
            # chantier repartira du backlog, aucun travail humain n'est écrasé.
            if ! git rebase origin/main; then
              git rebase --abort
              gh pr close "${{ steps.pr.outputs.numero }}" \
                --comment "Conflit avec main après un changement du propriétaire. Branche abandonnée, le chantier retourne au backlog."
              nom="claude/reveil-$(date -u +%Y%m%d-%H%M)"
              git checkout origin/main -B "$nom"
            fi
          else
            nom="claude/reveil-$(date -u +%Y%m%d-%H%M)"
            git checkout -b "$nom"
          fi
          echo "nom=$nom" >> "$GITHUB_OUTPUT"
        env:
          GH_TOKEN: ${{ secrets.LOOP_GITHUB_TOKEN }}

      - name: Dépendances
        if: steps.role.outputs.role != 'Pause'
        working-directory: web
        run: npm ci

      - name: Identité des commits de la boucle
        if: steps.role.outputs.role != 'Pause'
        run: |
          git config user.name "Boucle CVMatchr"
          git config user.email "boucle@cvmatchr.local"

      - name: Réveil de Claude
        if: steps.role.outputs.role != 'Pause'
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          prompt: |
            Tu es réveillé pour jouer le rôle « ${{ steps.role.outputs.role }} » de la
            boucle autonome de CVMatchr.

            Lis dans cet ordre, en entier :
            1. .claude/loop/MISSION.md
            2. .claude/loop/ETAT.md
            3. .claude/loop/BACKLOG.md
            4. ${{ steps.mandat.outputs.fichier }}

            Applique ton mandat à la lettre. Ne lis jamais tout le dépôt : uniquement
            les fichiers dont ton mandat a besoin.

            Tu committes en local. Tu ne pousses pas, tu n'ouvres pas de PR, tu ne
            fusionnes rien : le workflow s'en charge après avoir vérifié ton périmètre.

      # Le garde-fou passe APRÈS Claude et AVANT le push : une violation ne quitte
      # jamais le runner.
      - name: Vérification du périmètre
        if: steps.role.outputs.role != 'Pause'
        run: git diff --name-only origin/main...HEAD | node .claude/loop/bin/verifier-perimetre.mjs

      - name: Y a-t-il quelque chose à pousser ?
        id: travail
        if: steps.role.outputs.role != 'Pause'
        run: |
          if [ -z "$(git log origin/main..HEAD --oneline)" ]; then
            echo "rien=oui" >> "$GITHUB_OUTPUT"
          else
            echo "rien=non" >> "$GITHUB_OUTPUT"
          fi

      - name: Push
        if: steps.role.outputs.role != 'Pause' && steps.travail.outputs.rien == 'non'
        run: git push --set-upstream origin "${{ steps.branche.outputs.nom }}"

      - name: Ouverture ou mise à jour de la PR
        if: steps.role.outputs.role != 'Pause' && steps.travail.outputs.rien == 'non'
        env:
          GH_TOKEN: ${{ secrets.LOOP_GITHUB_TOKEN }}
        run: |
          if [ -z "${{ steps.pr.outputs.numero }}" ]; then
            gh pr create \
              --base main \
              --head "${{ steps.branche.outputs.nom }}" \
              --title "Boucle — ${{ steps.role.outputs.role }} du $(date -u +%d/%m/%Y)" \
              --body "Réveil automatique. Rôle joué : ${{ steps.role.outputs.role }}.

          Voir \`.claude/loop/journal/\` pour le compte rendu et \`.claude/loop/ETAT.md\`
          pour l'état de la boucle.

          🤖 Generated with [Claude Code](https://claude.com/claude-code)"
          fi

      # `--auto` confie la fusion à GitHub : elle n'aura lieu que lorsque les
      # vérifications EXIGÉES par la protection de branche seront vertes. Sans cette
      # protection (Task 6), GitHub fusionnerait immédiatement.
      - name: Demande de fusion automatique
        if: steps.role.outputs.role != 'Pause' && steps.travail.outputs.rien == 'non'
        env:
          GH_TOKEN: ${{ secrets.LOOP_GITHUB_TOKEN }}
        run: |
          numero="${{ steps.pr.outputs.numero }}"
          [ -z "$numero" ] && numero=$(gh pr view --json number --jq .number)
          if [ "$(gh pr view "$numero" --json isDraft --jq .isDraft)" = "true" ]; then
            echo "PR en brouillon : plan inachevé, pas de fusion automatique."
          else
            gh pr merge "$numero" --auto --squash
          fi

      - name: Compte rendu
        if: always()
        run: |
          echo "Rôle : ${{ steps.role.outputs.role }}"
          echo "Branche : ${{ steps.branche.outputs.nom }}"
          echo "PR : ${{ steps.pr.outputs.numero }}"
```

- [ ] **Étape 4 : valider la syntaxe du workflow**

```bash
node -e "const f=require('fs').readFileSync('.github/workflows/boucle.yml','utf8'); if(!f.includes('schedule')) throw new Error('cron absent'); console.log('lu, '+f.split('\n').length+' lignes')"
```

Puis, après le push de la Task 6, vérifier que GitHub l'accepte :

```bash
gh workflow list
```

Attendu : `Boucle autonome` apparaît dans la liste. Un YAML invalide n'y figure pas.

- [ ] **Étape 5 : vérifier que la CI existante passe toujours**

```bash
cd web && npx tsc --noEmit && npm run lint && npm run test && npm run build
cd .. && node --test .claude/loop/bin/
```

Attendu : tout vert, `pass 27` pour les scripts de la boucle.

- [ ] **Étape 6 : commit**

```bash
git add .github/workflows/boucle.yml .github/workflows/web.yml
git commit -m "feat(boucle): moteur GitHub Actions — cron 6 h, périmètre, PR, fusion auto"
```

---

## Task 6 : mise en route

Cette tâche contient les seules manipulations que **le propriétaire** doit faire
lui-même : elles demandent ses identifiants GitHub, qu'un agent ne doit ni voir ni
manipuler. L'agent d'exécution rédige la marche à suivre et attend.

**Fichiers :**
- Créer : `.claude/loop/README.md`
- Modifier : `PROJECT_INDEX.md` — ajouter une section « 13. Boucle autonome ».

- [ ] **Étape 1 : écrire `.claude/loop/README.md`**

```markdown
# La boucle autonome — mode d'emploi

Un agent Claude se réveille toutes les 6 heures, joue **un** rôle, et s'arrête.
Conception : `docs/superpowers/specs/2026-07-31-boucle-autonome-design.md`.

## Piloter la boucle

| Je veux… | Je fais… |
|---|---|
| Tout arrêter | Créer `.claude/loop/PAUSE.md` (le contenu sert de mot d'explication) |
| Geler un seul rôle | Créer `PAUSE.md` en y écrivant le nom du rôle, ex. `Gel du Bâtisseur` |
| Reprendre | Supprimer `PAUSE.md` |
| Proposer une idée | Ajouter une ligne sous `## Idées` de `BACKLOG.md` |
| Faire passer une idée devant | La préfixer de `!` |
| Refuser une proposition | Barrer la ligne : `- ~~mon refus~~` |
| Débloquer un chantier sensible | Écrire `!ok` sur sa ligne dans `## En attente de feu vert` |
| Changer le comportement d'un rôle | Éditer `.claude/loop/roles/<role>.md` |
| Changer les objectifs | Éditer `.claude/loop/MISSION.md` |
| Déclencher un réveil tout de suite | Onglet Actions → « Boucle autonome » → Run workflow |

La boucle ne peut modifier ni `MISSION.md`, ni `roles/`, ni les workflows, ni aucun
`.env*` : un script (`bin/verifier-perimetre.mjs`) refuse le diff avant le push.

## Savoir ce qu'elle a fait

- `.claude/loop/ETAT.md` — où elle en est, en cinq lignes.
- `.claude/loop/journal/` — une entrée par réveil.
- `.claude/loop/constats/` — les audits, chiffrés.
- `git log --author="Boucle CVMatchr"` — tous ses commits.
```

- [ ] **Étape 2 : marche à suivre pour le propriétaire (à exécuter par lui)**

Générer le jeton d'abonnement Claude, en local :

```bash
claude setup-token
```

Puis, dans **Settings → Secrets and variables → Actions** du dépôt `hariss24/cvmatchr`,
créer deux secrets de dépôt :

| Nom du secret | Contenu |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | le jeton renvoyé par `claude setup-token` |
| `LOOP_GITHUB_TOKEN` | un jeton personnel *fine-grained* limité au dépôt `cvmatchr`, avec les permissions **Contents: Read and write**, **Pull requests: Read and write**, **Workflows: Read** |

Le jeton personnel est indispensable : une PR ouverte avec le jeton par défaut de
GitHub Actions **ne déclenche aucun workflow**, la CI resterait donc muette et la
fusion automatique ne partirait jamais.

- [ ] **Étape 3 : activer les deux réglages GitHub dont dépend la fusion**

Dans **Settings → General → Pull Requests** : cocher **Allow auto-merge**.
Sans ça, `gh pr merge --auto` échoue.

Dans **Settings → Branches**, créer une règle de protection sur `main` :

- ✅ **Require status checks to pass before merging**
- ✅ y ajouter le check **`test-web`** (le job de `web.yml`)
- ✅ **Require branches to be up to date before merging**

**C'est ce réglage, et lui seul, qui empêche une PR rouge d'être fusionnée.** Sans lui,
`--auto` fusionne dès que possible, y compris avant que la CI n'ait répondu.

- [ ] **Étape 4 : essai à blanc, en pause**

Créer un fichier de pause, pousser, déclencher un réveil manuel :

```bash
echo "Essai de mise en route — la boucle doit s'arrêter ici." > .claude/loop/PAUSE.md
git add .claude/loop/PAUSE.md && git commit -m "test(boucle): pause pour l'essai à blanc"
git push origin main
gh workflow run "Boucle autonome"
sleep 45 && gh run list --workflow="Boucle autonome" --limit 1
```

Attendu : le run est en succès, et son journal montre `role=Pause` avec les étapes
suivantes toutes sautées. **Aucun token Claude consommé.**

- [ ] **Étape 5 : essai réel, rôle forcé sur l'Éclaireur**

```bash
git rm .claude/loop/PAUSE.md && git commit -m "test(boucle): fin de l'essai à blanc"
git push origin main
gh workflow run "Boucle autonome" -f role="Éclaireur"
```

Attendu, en consultant `gh run watch` puis la PR créée :

1. une branche `claude/reveil-…` existe ;
2. une PR est ouverte, et **la CI `test-web` s'y déclenche** (c'est le test du jeton
   personnel — si aucun check n'apparaît, le secret `LOOP_GITHUB_TOKEN` est en cause) ;
3. la PR contient un constat dans `.claude/loop/constats/`, avec des chiffres ;
4. la fusion automatique est armée mais **n'a pas eu lieu** tant que la CI tourne.

- [ ] **Étape 6 : essai du refus — une PR rouge ne doit jamais passer**

C'est la vérification la plus importante du plan : elle prouve que la production est
protégée. Sur la branche de la PR d'essai, introduire une faute délibérée :

```bash
git checkout "$(gh pr view --json headRefName --jq .headRefName)"
printf '\nconst casse: number = "pas un nombre";\n' >> web/src/lib/jobs/offer.ts
git commit -am "test(boucle): faute délibérée pour vérifier le refus de fusion"
git push
```

Attendu : la CI passe au rouge et **la PR n'est pas fusionnée**, malgré `--auto` armé.

Puis nettoyer :

```bash
git revert --no-edit HEAD && git push
```

- [ ] **Étape 7 : documenter dans `PROJECT_INDEX.md`**

Ajouter à la fin du fichier, avant la section « 12. Commandes essentielles » :

```markdown
## 13. Boucle autonome

Un agent Claude se réveille toutes les 6 heures (`.github/workflows/boucle.yml`) et joue
**un** rôle : Gardien (répare), Bâtisseur (code), Architecte (planifie) ou Éclaireur
(audite). Le choix est fait par un script pur et testé
(`.claude/loop/bin/choisir-role.mjs`), jamais par le jugement de l'agent.

Piloter la boucle : `.claude/loop/README.md`.
Conception : `docs/superpowers/specs/2026-07-31-boucle-autonome-design.md`.

Pièges :
- **La boucle ne pousse jamais sur `main`.** Elle committe en local ; le workflow pousse
  sur `claude/…`, ouvre la PR et arme `--auto`. La fusion n'a lieu que si la protection
  de branche `main` exige le check `test-web` — **sans cette protection, `--auto`
  fusionne immédiatement**, y compris avant que la CI ait répondu.
- Une PR ouverte avec le jeton par défaut de GitHub Actions **ne déclenche aucune CI**.
  D'où le secret `LOOP_GITHUB_TOKEN` (jeton personnel). Si les PR de la boucle n'ont
  aucun check, c'est ce secret qu'il faut regarder.
- **Une seule PR de la boucle ouverte à la fois** : tant qu'elle vit, les réveils la
  font avancer au lieu d'en ouvrir une autre.
- La boucle ne peut modifier ni `MISSION.md`, ni `roles/`, ni `.github/workflows/`, ni
  aucun `.env*` — `bin/verifier-perimetre.mjs` refuse le diff avant le push.
- Elle n'a **aucune clé applicative** (France Travail, Adzuna, Gemini, Maps, Brandfetch) :
  les tests tournent sur des bouchons.
```

- [ ] **Étape 8 : commit**

```bash
git add .claude/loop/README.md PROJECT_INDEX.md
git commit -m "docs(boucle): mode d'emploi et section dédiée dans l'index"
```

---

## Ce que ce plan ne fait pas

- **Il n'implémente aucune amélioration de CVMatchr.** Il construit la machine qui les
  produira. Le premier chantier réel sortira du premier réveil d'Éclaireur.
- **Il ne configure ni compte ni base de données.** Le multi-utilisateur est la
  troisième priorité de `MISSION.md` et figure parmi les chantiers exigeant un feu vert.
- **Il ne modifie pas `web/CADRAGE_EXECUTION.md`.** Son amendement (push sur branche
  `claude/…`) vit dans `MISSION.md`, qui s'applique à la boucle seule ; le cadrage reste
  intact pour les sessions manuelles.
