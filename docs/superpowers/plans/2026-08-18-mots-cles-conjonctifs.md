# Mots-clés conjonctifs — plan d'exécution

> **Destinataire** : agent d'implémentation autonome (Gemini).
> Tu travailles seul, sans pouvoir poser de question sur les points déjà tranchés
> ici. Tout ce dont tu as besoin est dans ce document. **Les chiffres cités sont
> mesurés le 18/08/2026 sur l'index réel, pas estimés.** Ne les remplace jamais
> par des estimations : tu les re-mesures avec l'outil de la tâche T0.

**Suit :** `../specs/2026-08-18-mots-cles-conjonctifs-design.md`
**Chantier précédent sur le même symptôme :** `../plans/2026-08-07-pertinence-marche-cache.md`
**Date :** 18 août 2026

**Objectif** : qu'un candidat précis (« chef de projet web ») reçoive des offres
de son métier, ou aucune offre — jamais soixante offres d'un autre métier.

---

## 0. Contexte

**CVMatchr** — Next.js 16 / React 19 / TypeScript strict. Tout le code applicatif
vit dans `web/`. Les scripts de moisson vivent dans `scripts/` (Node pur, `.mjs`).

Quatre sources d'offres. Trois interrogent une API externe (France Travail,
Adzuna, JSearch). La quatrième, **« Marché caché »**, ne fait aucune requête de
recherche : un scan quotidien moissonne les pages carrières d'environ 860
entreprises via leurs ATS (Greenhouse, Lever, Ashby, SmartRecruiters, Workday) et
écrit un index committé dans le dépôt —
`web/src/lib/jobs/data/boards-offres.json`, **19 555 offres**. La recherche
filtre ce fichier local, puis va chercher le texte complet en direct pour les
seules offres retenues.

### Chaîne de traitement actuelle

```
web/src/lib/jobs/boardsFr.ts :: searchBoards(profile)
  1. elargirMotsCles(profile.keywords)          → synonymes.ts        ← CAUSE 1
  2. filtre titre       (sous-chaîne, OU sur tous les mots-clés)      ← CAUSE 1
  3. filtre mots exclus (exclude.ts)
  4. filtre âge         (maxAgeDays)
  5. filtre lieu        (boardsLieu.ts)
  6. tri                (pertinence puis date)   ← posé le 07/08, correct
  7. dédoublonnage      (normKey)
  8. plafond 60         (repartirParEntreprise, round-robin employeur) ← CAUSE 2
  9. texte complet en direct (boardsText.ts)     ← 60 requêtes réseau
        ↓
web/src/components/jobs/JobsView.tsx
 10. rankOffer()      → score /100 + lettre                  ← CAUSES 3 et 4
 11. shouldPersist()  → jette sous le seuil C (40)  ← posé le 07/08, correct
 12. saveJob()        → base Dexie locale, CUMULATIVE
```

⚠️ **L'écran `/jobs` n'affiche pas le résultat de la dernière recherche.** Il
affiche le contenu cumulé de la base Dexie locale. Une recherche ajoute des
offres, n'en retire jamais. Le bouton « Purger les offres hors-sujet » existe
(`JobsView.tsx :: handlePurge`) et supprime celles sous le seuil. Après tes
corrections, **les offres déjà enregistrées gardent leur ancien score** : ne
t'étonne pas de les voir encore, et ne les supprime pas de ta propre initiative.

### Ce qui a déjà été corrigé le 07/08 — à ne pas refaire, à ne pas défaire

- Les groupes de synonymes bâtis sur un **niveau hiérarchique** (« responsable »,
  « manager », « directeur », « head of », « growth ») ont été supprimés. **Ne les
  restaure sous aucun prétexte.**
- Le tri par pertinence avant la date (étape 6).
- `shouldPersist` ne persiste plus sous le seuil C.
- Le filtre région/département par département réel.

Preuve que ces correctifs tiennent : avec les mots-clés réels de l'utilisateur du
07/08 (`Web marketer`, `Webmaster`, `Chargé marketing digital`, `Chargé de
communication digitale`, `E-merchandiser`), la recherche rend aujourd'hui
**9 offres, toutes pertinentes**. Le défaut traité ici est différent et se
déclenche ailleurs.

### Contraintes non négociables

Elles viennent de `CLAUDE.md`, `web/AGENTS.md` et `web/CADRAGE_EXECUTION.md`.
Une violation invalide la tâche.

| # | Contrainte |
|---|---|
| 1 | **`git push` strictement interdit.** Le push déploie la production Vercel. Tu commits (un commit par tâche, message en français), l'humain pousse. |
| 2 | **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.** TypeScript est en mode strict. |
| 3 | **Aucune dépendance npm ajoutée ou mise à jour.** |
| 4 | **Ne jamais écrire de diacritique combinant littéral dans une regex.** Toujours `[̀-ͯ]`. Ce piège s'est produit six fois dans ce dépôt. |
| 5 | **Jamais `alert` / `confirm` / `prompt` natifs** → `uiAlert` / `uiConfirm` / `uiPrompt` / `toast` depuis `src/state/uiStore.ts`. |
| 6 | **Jamais de couleur en dur** → variables de thème dans `src/app/globals.css`. |
| 7 | **Ne jamais modifier un test existant pour le faire passer** — sauf aux endroits où CE plan l'autorise nommément (T1, T2, T4). Hors de ces cas : tu t'arrêtes et tu demandes. |
| 8 | **Tu ne touches qu'aux fichiers cités par la tâche en cours.** Pas de refactor voisin, pas de nettoyage, pas de bonus. |
| 9 | Commentaires et messages de commit **en français**. |
| 10 | Le journal `WORK_HISTORY.md` est mis à jour après chaque tâche (entrée datée en tête de `## Journal`). |

### Commandes de vérification

Depuis `web/`, après **chaque** tâche, et tu colles la sortie réelle :

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test    # au minimum en fin de plan, et dès que la tâche touche l'UI
```

Depuis la racine, pour les scripts `.mjs` :

```bash
node --test scripts/boards/
```

Piège connu Windows/Turbopack : si un changement CSS ne s'affiche pas ou qu'un
e2e échoue bizarrement → supprimer `web/.next`, vérifier qu'aucun serveur ne
traîne sur le port 3000, relancer.

---

## 1. Diagnostic mesuré (18/08/2026)

### Mesure de départ

| Mots-clés | Candidats | Dont pertinents disponibles | Retenus | Dont pertinents retenus |
|---|---|---|---|---|
| `chef de projet marketing` | 221 | 0 | 60 | **0** |
| `chef de projet web` | 221 | 0 | 60 | **0** |
| `chef de projet marketing` + `marketing digital` + `Webmaster` | 230 | 1 | 60 | **1** |
| `Web marketer` + `Webmaster` + `Chargé marketing digital` + `Chargé de communication digitale` + `E-merchandiser` | 9 | 0 | 9 | 0 *(les 9 sont pertinentes, amenées par des synonymes légitimes)* |

Extraits réels de ce que reçoit le candidat sur `chef de projet marketing` :
« CDD – Chef de projet Achats – Parfums Beauté » (Chanel), « CHEF DE PROJET
SUPPLY CHAIN » (Sony Music), « Chef de Projet Santé F/H », « Chef de Projet
Electricité et Automatisme HVAC Marine », « Chef de projet Calculs
Transformateurs de Tension ».

### Cause 1 — l'élargissement remplace le mot du candidat par un mot plus large

`web/src/lib/jobs/synonymes.ts :: elargirMotsCles`, ligne 140.

Un groupe est déclenché quand le mot-clé **contient** un de ses termes, et tous
les termes du groupe sont alors ajoutés **tels quels**, comme mots-clés
indépendants. « chef de projet marketing » contient « chef de projet », donc
« chef de projet » devient un mot-clé à part entière.

| Terme | Titres de l'index atteints |
|---|---|
| `chef de projet marketing` (le mot du candidat) | **7** |
| `chef de projet` (ajouté) | 380 |
| `project manager` (ajouté) | 115 |
| `program manager` (ajouté) | 32 |

Sur 534 titres atteints au total, **527 arrivent par les termes ajoutés**.

C'est le même défaut que celui corrigé le 07/08 sur les groupes hiérarchiques,
sous une autre forme : là, le terme trop large était dans la table ; ici, il est
produit par la façon dont la table est appliquée.

### Cause 2 — le plafond de 60 se comporte comme un quota

`boardsFr.ts :: searchBoards`, ligne 255. Le tri par pertinence (posé le 07/08)
est correct, mais `repartirParEntreprise` redistribue ensuite les 60 places
**une par entreprise, à tour de rôle, sans regarder la pertinence**. Au premier
tour, chacune des ~200 entreprises reçoit une place ; les rares offres
pertinentes en occupent une poignée et tout le reste est du bruit.

Et lorsqu'il n'existe **aucune** offre pertinente — le cas mesuré ci-dessus — le
système en retient tout de même 60. Il ne comble pas un manque, il le déguise.

### Cause 3 — la notation du métier crédite les correspondances partielles

`web/src/lib/jobs/rank/text.ts :: keywordPoints`, ligne 110. Un mot-clé
introuvable tel quel est éclaté en mots de plus de 2 caractères, et le crédit est
la **moyenne** des mots trouvés. « chef de projet marketing » devient
`chef` / `projet` / `marketing` ; « Chef de projet Achats » en valide deux sur
trois.

Deux défauts secondaires au même endroit :

- Le crédit final est divisé par le **nombre de mots-clés saisis**
  (`points = round(max × credit / utiles.length)`). Un candidat qui cherche trois
  métiers voit donc chaque offre plafonner au tiers du critère, y compris une
  offre parfaite pour l'un d'eux. Chercher large écrase tous ses scores et
  rapproche les bonnes offres des mauvaises.
- Les mots de 1 à 2 caractères sont écartés par leur longueur, ce qui élimine
  « de » et « en » mais aussi « RH ».

### Cause 4 — le critère le plus lourd se rabat sur les mots-clés

`web/src/lib/jobs/rank/criteria.ts :: competencesPoints`, ligne 75 :

```ts
const mots = profile.prefilterKeywords.length > 0 ? profile.prefilterKeywords : profile.keywords;
```

Quand le candidat n'a pas saisi ses compétences, les **45 points sur 100** du
critère « Compétences & missions » sont attribués par ses mots-clés — éclatés
comme en cause 3, mais cherchés cette fois dans les 3 000 caractères de la
description. Dans une offre de chef de projet quelconque, « chef » et « projet »
saturent le crédit sans effort.

Conséquence chiffrée : c'est ce critère qui fait franchir à ces offres le seuil
de 40 sous lequel `shouldPersist` les jetterait. Sans lui, une offre hors-sujet
type marque ~25/100 (lettre D, non enregistrée) ; avec lui, elle atteint 55 à 60
(lettre B ou C, enregistrée et bien classée).

Le même signal — le titre — est en outre compté **deux fois** : une fois par
« Métier », une fois par « Compétences » dont la zone titre pèse le plus lourd
(`POIDS_TITRE = 3`).

### Cause 5 — ce que la source ne sait pas dire rapporte ou coûte quand même

Trois points, tous dans `rank/criteria.ts`, qui faussent la comparaison entre
sources :

- **Contrat** (`contratSalairePoints`, ligne 188) : les offres du marché caché
  ont `contractLabel: ""` et `salaryLabel: ""` (posés vides dans `boardsFr.ts`,
  ligne 279). Elles perdent donc **systématiquement 10 points sur 100** que
  France Travail peut gagner. Pénalité structurelle, pas méritée.
- **Distance** (`geo.ts :: distancePoints`, ligne 43) : distance inconnue →
  **la moitié des points**. Or aucune des 8 538 offres Workday n'a de
  coordonnées : 44 % de l'index reçoit 8 points sur 15 gratuitement.
- **Expérience** (`experiencePoints`, ligne 216) : niveau « indifférent » — le
  défaut du profil — rend **le maximum**, 10 points sur 10, à toutes les offres.

Le code contient déjà le bon raisonnement pour ce cas, dans
`rank/index.ts :: beneficeDuDoute` : *« il pèse alors `max: 0` et le score se
calcule au prorata du reste, au lieu d'imputer à l'offre un zéro qu'elle n'a pas
mérité »*. Il n'a simplement jamais été généralisé, ni appliqué dans l'autre
sens — celui des points offerts.

---

## 2. Principe directeur

Toutes les causes découlent d'une seule décision, prise trois fois
indépendamment : **un mot-clé composé est traité comme un sac de mots
interchangeables.** À chaque fois, l'intention était la tolérance. À chaque fois,
le résultat est du bruit, et les trois se multiplient.

> **Un mot-clé composé est une conjonction. Toute traduction de ce mot-clé —
> synonyme, découpage, notation — doit préserver la conjonction.**

« chef de projet marketing » ne devient jamais « chef de projet ». Il devient
« project manager » **et** « marketing ».

Corollaire, tout aussi important :

> **Le plafond de 60 est un plafond, pas un quota.** Une recherche sans résultat
> rend une liste vide.

Traduction technique : la notion centrale cesse d'être une liste de mots pour
devenir une liste de **critères**, chacun étant un ensemble de termes qui doivent
**tous** être présents. Un seul module les construit ; la sélection et le
classement les consomment tous les deux. Aujourd'hui ces deux étages
réinterprètent les mots-clés chacun à sa façon — c'est exactement pour ça qu'ils
divergent.

---

## 3. Ordre d'exécution

| # | Tâche | Portée | Obligatoire |
|---|---|---|---|
| T0 | Harnais de mesure | script, aucun changement de comportement | oui |
| T1 | Critères conjonctifs | `synonymes.ts` | oui |
| T2 | La sélection consomme les critères | `boardsFr.ts` | oui |
| T3 | Répartition à l'intérieur de chaque niveau | `boardsFr.ts` | oui |
| — | **Point de contrôle : mesure + validation humaine** | — | — |
| T4 | Le classement note sur les critères | `rank/` — **les 4 sources** | second lot |
| T5 | Enveloppe honnête | `rank/`, `geo.ts` — **les 4 sources** | second lot |
| T6 | Dire par quel critère l'offre est arrivée | UI | confort |

**T1 à T3 forment un lot cohérent et livrable seul.** Ils suffisent à faire
disparaître le symptôme. T4 et T5 modifient la notation des **quatre** sources :
ils sont mesurés séparément et peuvent être reportés. **Arrête-toi après T3 et
présente tes mesures avant d'entamer T4.**

---

## T0 — Un outil pour mesurer avant de corriger

**Fichier à créer :** `scripts/boards/mesurer-pertinence.mjs`
**Aucun fichier de `web/src/` n'est modifié par cette tâche.**

Sans cet outil, tu corrigeras à l'aveugle et l'humain ne pourra rien vérifier.

Le script prend des mots-clés en arguments et rejoue **la chaîne de sélection
réelle** (élargissement → filtre titre → mots exclus → âge → dédoublonnage →
plafond) sur `web/src/lib/jobs/data/boards-offres.json`. Il n'appelle aucun
réseau et ne filtre pas sur le lieu (hors périmètre, et le géocodage demanderait
le réseau).

Il affiche :

```
mots-clés saisis  : [...]
critères utilisés : [...]
candidats après filtres : N   dont pertinents disponibles : N
retenus                 : N   dont pertinents retenus     : N
--- les retenus, préfixés du niveau de pertinence ---
2  Digital Marketing Manager | Airapps
1  CHEF DE PROJET SUPPLY CHAIN | Sonymusicentertainment
```

« Pertinent » = le titre contient un mot-clé **réellement saisi**.

Contraintes : Node pur, aucune dépendance, `.mjs`. Il doit importer la vraie
logique de `web/src/lib/jobs/` autant que le permet le fait que ces fichiers
soient en TypeScript — si l'import direct est impossible sans outil de build, tu
**réimplémentes la chaîne à l'identique dans le script** et tu écris en tête du
fichier un avertissement disant que les deux doivent être modifiées ensemble.

**Critère de réussite :** lancé sur les quatre jeux de mots-clés du tableau du
§1, le script reproduit **exactement** les chiffres mesurés (221/0/60/0 ;
221/0/60/0 ; 230/1/60/1 ; 9/0/9/0). S'il ne les reproduit pas, ton script est
faux — pas les mesures. Colle sa sortie dans ton rapport.

---

## T1 — Un mot-clé composé devient un critère conjonctif

**Fichiers :** `web/src/lib/jobs/synonymes.ts`, `web/src/lib/jobs/synonymes.test.ts`

**⚠️ Ce plan t'autorise explicitement à réécrire `synonymes.test.ts`** : ses
13 cas décrivent le comportement de `elargirMotsCles`, qui disparaît. Chaque cas
supprimé doit être remplacé par son équivalent en critères, et tu justifies en
commentaire tout cas que tu ne remplaces pas.

### Ce qu'on remplace

`elargirMotsCles(keywords: string[]): string[]` disparaît, ainsi que son unique
appel dans `boardsFr.ts` (traité en T2). La table `GROUPES` **ne change pas** :
son contenu a déjà été purgé deux fois et ses commentaires expliquent pourquoi
chaque groupe est écrit comme il l'est. Lis-les avant de coder.

### La nouvelle interface

```ts
/**
 * Un critère de recherche : TOUS les termes doivent apparaître dans le texte
 * examiné. C'est ce qui distingue « chef de projet marketing » traduit en
 * « project manager » + « marketing » — qui trouve « Marketing Project
 * Manager » — de « chef de projet » seul, qui trouve tous les chefs de projet.
 */
export interface Critere {
  /** Termes exigés ensemble, déjà normalisés (minuscule, sans accent). */
  termes: string[];
  /** Vrai si ce critère est le mot-clé du candidat, tel qu'il l'a tapé. */
  litteral: boolean;
  /** Le mot-clé d'origine, pour l'affichage et le diagnostic. */
  origine: string;
}

export function construireCriteres(keywords: string[]): Critere[];
export function satisfait(texte: string, critere: Critere): boolean;
export function meilleurCritere(texte: string, criteres: Critere[]): Critere | null;
```

`satisfait` compare en normalisé (minuscule, accents retirés — réutilise la
fonction `normaliser` déjà présente dans le fichier ; **attention à la
contrainte 4** sur les diacritiques). `meilleurCritere` rend le critère littéral
satisfait s'il en existe un, sinon le premier critère élargi satisfait, sinon
`null` — il sert au tri en T2 et à l'affichage en T6.

### Règles de construction, dans l'ordre

Pour chaque mot-clé `K` (normalisé) :

1. **Toujours** produire le critère littéral `{ termes: [K], litteral: true }`.
   Un élargissement ne doit jamais faire perdre un résultat que la recherche
   littérale aurait trouvé — c'est déjà la règle du fichier actuel.

2. Pour chaque groupe `G` dont un terme `T` est **contenu** dans `K` (règle de
   déclenchement inchangée, sens unique : `K.includes(T)`, jamais l'inverse) :

   - Calculer le **reste** : les mots de `K` privés des mots de `T`, puis privés
     des mots vides.
   - Si le reste est **vide** (le candidat a tapé le terme générique lui-même,
     ex. « chef de projet ») : produire un critère `{ termes: [S] }` pour chaque
     autre terme `S` du groupe. **C'est le comportement actuel, préservé à
     l'identique.**
   - Si le reste n'est **pas vide** (ex. « chef de projet marketing », reste
     `["marketing"]`) : produire `{ termes: [S, ...reste] }` pour chaque autre
     terme `S`. **Et ne jamais produire `{ termes: [T] }` seul** — c'est
     précisément la faute à corriger.

3. Dédoublonner les critères sur la signature de leurs termes triés.

Mots vides à écarter du reste (liste explicite, pas un seuil de longueur : « RH »
fait deux caractères et compte) :

```ts
const MOTS_VIDES = new Set(["de", "du", "des", "le", "la", "les", "l", "d",
                            "en", "et", "a", "au", "aux", "pour", "sur"]);
```

Un mot-clé peut déclencher plusieurs groupes : traite chaque groupe
indépendamment, le reste étant toujours calculé par rapport au terme déclencheur
**de ce groupe**. Cela peut produire des critères improbables (« digital
marketing » + « chef » + « projet ») : ils ne ramènent rien et ne coûtent rien,
c'est acceptable. **Ne cherche pas à combiner les groupes entre eux.**

### Test décisif à écrire en premier, et à voir ROUGE avant de coder

```ts
it("ne remplace jamais un mot-clé précis par le terme générique qui l'a déclenché", () => {
  const criteres = construireCriteres(["chef de projet marketing"]);
  // Le piège : « chef de projet » seul atteint 380 titres de l'index,
  // « chef de projet marketing » en atteint 7. Mesuré le 18/08/2026.
  expect(criteres.some((c) => c.termes.length === 1 && c.termes[0] === "chef de projet")).toBe(false);
  expect(satisfait("CDD - Chef de projet Achats - Parfums Beaute", criteres[0])).toBe(false);
  expect(criteres.some((c) => satisfait("Marketing Project Manager", c))).toBe(true);
});

it("laisse intact un mot-clé générique", () => {
  const criteres = construireCriteres(["developpeur"]);
  expect(criteres.some((c) => satisfait("Software Engineer - Paris", c))).toBe(true);
});
```

**Critères de réussite :**
- Les deux tests ci-dessus passent.
- `construireCriteres(["developpeur"])` produit exactement les mêmes
  correspondances que l'ancien `elargirMotsCles(["developpeur"])` sur l'index :
  **727 titres**. Vérifie-le avec l'outil T0. *Aucune régression sur les
  mots-clés simples : c'est la propriété la plus importante de cette tâche.*
- Les mêmes vérifications pour « ingénieur » (3 031) et « commercial » (1 188).

---

## T2 — La sélection consomme les critères, et le plafond redevient un plafond

**Fichiers :** `web/src/lib/jobs/boardsFr.ts`, `web/src/lib/jobs/boardsFr.test.ts`

**⚠️ Autorisation explicite** : les cas de `boardsFr.test.ts` qui portent sur
`matchTitre` et `pertinence` doivent être adaptés à la nouvelle signature. Les
autres (répartition, âge, dédoublonnage, lieu) **ne changent pas** — si l'un
d'eux casse, c'est ton code qui est faux.

### Étapes

1. Remplacer `matchTitre(titre, motsCles)` par `satisfait` appliqué aux critères :
   une offre est candidate si **au moins un critère** est satisfait par son titre.

2. Remplacer la fonction locale `pertinence` : elle rend `2` si un critère
   **littéral** est satisfait, `1` si seul un critère élargi l'est, `0` sinon.
   Sa logique devient un simple appel à `meilleurCritere`. **Conserve son
   commentaire d'origine** — il documente une mesure du 07/08 qui reste vraie.

3. Le tri de la ligne 245 ne change pas : pertinence d'abord, date effective
   ensuite. Les commentaires qui l'entourent documentent trois pièges réels
   (tri alphabétique, `publieLe` absent chez Workday, synonymes) : **garde-les**.

4. `searchBoards` renvoie désormais, pour chaque offre, le critère qui l'a fait
   entrer. Ajoute un champ optionnel à `JobOffer` (`web/src/lib/jobs/offer.ts`) :

   ```ts
   /** Critère de recherche qui a fait entrer cette offre. Marché caché seulement. */
   critereEntree?: string;
   ```

   Rempli avec `meilleurCritere(o.titre, criteres)` formaté lisiblement
   (`"project manager + marketing"`). Il servira en T6 ; le poser ici évite de
   rouvrir ce fichier plus tard. **Aucun autre code n'a besoin de le lire pour
   l'instant.**

### Le plafond n'est pas un quota

Aucun code à écrire : c'est une conséquence de T1. Mais **ajoute un commentaire**
au-dessus de `PLAFOND_CANDIDATES` disant que ce nombre est un maximum, que rien
ne doit jamais chercher à l'atteindre, et pourquoi :

> Mesuré le 18/08/2026 : sur « chef de projet marketing », l'index ne contenait
> aucune offre pertinente de moins de 30 jours, et le système en retenait
> pourtant 60. Un plafond qu'on cherche à remplir devient un quota, et un quota
> se remplit avec ce qui reste — c'est-à-dire du bruit.

**Critères de réussite**, mesurés avec l'outil T0 :
- `chef de projet marketing` : de 60 retenus / 0 pertinent → **au plus 10
  retenus, et 100 % d'entre eux satisfont un critère conjonctif complet**.
- `chef de projet web` : idem.
- Les cinq mots-clés du 07/08 : **toujours 9 offres, les mêmes**. Aucune
  régression.
- `developpeur`, `ingenieur`, `commercial` : nombre de candidats inchangé.

---

## T3 — Répartir entre employeurs à l'intérieur de chaque niveau

**Fichiers :** `web/src/lib/jobs/boardsFr.ts`, `web/src/lib/jobs/boardsFr.test.ts`

**Ne modifie pas `repartirParEntreprise`.** Elle est correcte, bien testée, et
ses commentaires documentent deux mesures et une tentative ratée (le quota par
entreprise). Tu changes seulement **ce à quoi on l'applique**.

Aujourd'hui elle est appelée une fois sur l'ensemble trié, ce qui annule le tri
par pertinence : au premier tour, chaque entreprise reçoit une place, y compris
les ~200 entreprises qui n'ont que du bruit à offrir.

Appelle-la **une fois par niveau de pertinence**, du plus pertinent au moins
pertinent, en réduisant le plafond restant :

```ts
// La répartition entre employeurs empêche un gros publieur de manger la
// sélection — mais appliquee a l'ensemble, elle sert une place a chaque
// entreprise avant de servir la deuxieme offre pertinente d'une autre. Les deux
// mecanismes se neutralisaient : le tri mettait le bon en tete, la repartition
// remplissait derriere avec n'importe quoi. Un niveau a la fois : la diversite
// d'employeurs joue a l'interieur de la pertinence, jamais contre elle.
const gardees: OffreLegere[] = [];
for (const niveau of [2, 1]) {
  if (gardees.length >= PLAFOND_CANDIDATES) break;
  const duNiveau = triees.filter((o) => pertinence(o.titre, criteres) === niveau);
  gardees.push(...repartirParEntreprise(duNiveau, PLAFOND_CANDIDATES - gardees.length));
}
```

(`sansRedites` reste appliqué avant, comme aujourd'hui — son commentaire explique
pourquoi l'ordre compte.)

**Critères de réussite :**
- Un test unitaire : deux offres littérales chez le même employeur et une
  centaine d'offres élargies chez cent autres — les deux littérales sont
  retenues **avant** toute offre élargie.
- Les tests existants de `repartirParEntreprise` passent inchangés.
- Sur l'index réel, aucune offre de niveau 2 disponible n'est jamais écartée au
  profit d'une offre de niveau 1.

---

## ⏸ Point de contrôle — arrête-toi ici

Commits faits, vérifications collées, mesures T0 avant/après pour les quatre jeux
de mots-clés du §1. **Présente-les et attends la validation humaine avant T4.**

T4 et T5 modifient la notation des **quatre** sources, donc des offres que ce
diagnostic n'a jamais examinées.

---

## T4 — Le classement note sur les critères, lui aussi

**Fichiers :** `web/src/lib/jobs/rank/text.ts`, `web/src/lib/jobs/rank/criteria.ts`,
et leurs tests.

**⚠️ Autorisation explicite** de réécrire les cas de `rank/text.test.ts` et
`rank/criteria.test.ts` qui décrivent le découpage en mots ou la division par le
nombre de mots-clés. Les autres cas **ne changent pas**.

Le classement réinterprète aujourd'hui `profile.keywords` à sa façon, sans rien
savoir des critères. Il ignore donc pourquoi une offre a été retenue, et il
recrée la faute de la cause 1 sous une autre forme.

### Étapes

1. **Le découpage arbitraire disparaît.** `keywordPoints` devient
   `criteresPoints(zones, criteres, max)` : un critère ne crédite que si **tous**
   ses termes sont présents. La pondération par zone (`POIDS_TITRE = 3`,
   `POIDS_PROFIL = 2`, `POIDS_RESTE = 1`) et le plafond par critère ne changent
   pas.

   Effet de bord bienvenu : une offre anglaise ramenée légitimement par un
   synonyme est enfin notée correctement, alors qu'aujourd'hui le classement ne
   connaît que les mots français tapés.

2. **Le maximum remplace la moyenne.** Le crédit d'une offre est celui de son
   **meilleur** critère, pas la moyenne sur tous les mots-clés saisis. Un
   candidat qui cherche trois métiers en cherche trois : en satisfaire un
   pleinement vaut le plein score.

   ⚠️ Cette seule ligne relève le score de toutes les offres, sur les quatre
   sources. Plus d'offres franchiront le seuil de 40. **Mesure-le explicitement** :
   sur un jeu d'offres de test, combien passaient / passent le seuil. Si le bruit
   augmente, dis-le et arrête-toi — ne compense pas en bricolant les seuils.

3. **Le double comptage du titre disparaît.** Dans `competencesPoints`, quand on
   se rabat sur les mots-clés faute de compétences saisies (ligne 75), la zone
   **titre** est exclue du calcul : elle est déjà notée, entièrement, par le
   critère « Métier ». Le repli ne lit plus que le corps de l'annonce.

   Garde le repli lui-même — le supprimer retirerait 45 points sur 100 à tous les
   candidats qui n'ont pas rempli leurs compétences, et rendrait le classement
   beaucoup plus grossier.

**Critères de réussite :**
- Une offre « Chef de projet Achats – Parfums Beauté » avec le profil
  `keywords: ["chef de projet marketing"]`, `prefilterKeywords: []` : score
  **sous le seuil de 40**, donc non persistée. Mesure-le avec un test unitaire
  sur `rankOffer`, en citant le score avant et après.
- Une offre « Marketing Project Manager » avec le même profil : score **au-dessus
  du seuil**.
- Compte, avant et après, le nombre d'offres franchissant le seuil sur un jeu de
  test des quatre sources.

---

## T5 — Ce que la source ne sait pas dire ne rapporte ni ne coûte

**Fichiers :** `web/src/lib/jobs/rank/criteria.ts`, `web/src/lib/jobs/geo.ts`,
`web/src/lib/jobs/rank/index.ts`, et leurs tests.

Le code contient déjà ce raisonnement, dans `beneficeDuDoute` : un critère qu'on
ne peut pas mesurer pèse `max: 0` et sort de l'enveloppe, le score se calculant
au prorata du reste. Il n'a jamais été généralisé, ni appliqué dans l'autre sens.

Trois généralisations, **chacune dans son propre commit** pour pouvoir en annuler
une seule :

1. **Contrat & salaire** : `contractLabel` et `salaryLabel` tous deux vides →
   `max: 0`. Aujourd'hui, toutes les offres du marché caché perdent 10 points
   sur 100 pour une information que leur source ne fournit jamais.

2. **Distance** : distance inconnue → `max: 0` au lieu de la moitié des points.
   Aujourd'hui, les 8 538 offres Workday — 44 % de l'index, aucune coordonnée —
   reçoivent 8 points sur 15 gratuitement. ⚠️ `distancePoints` est une fonction
   pure utilisée ailleurs : c'est `distanceLigne` qui doit décider du `max`, pas
   elle. Lis ses appelants avant de la toucher.

3. **Expérience** : `experienceExige` absent **et** niveau du profil
   « indifférent » → `max: 0`. Aujourd'hui, ce cas — qui est le défaut du profil —
   rend le maximum à toutes les offres.

**Critère de réussite :** pour chacune, un test montrant qu'une offre dépourvue
de l'information n'est ni avantagée ni pénalisée par rapport à une offre qui la
porte et qui satisfait le critère. Et la mesure du nombre d'offres franchissant
le seuil, avant/après, comme en T4.

---

## T6 — Dire par quel critère l'offre est arrivée

**Fichiers :** `web/src/components/jobs/JobCard.tsx`, `web/src/app/globals.css`,
et le test du composant.

Le champ `critereEntree` a été posé en T2. Affiche-le discrètement sur la carte
d'une offre du marché caché : *« trouvée par : project manager + marketing »*.

Une offre inattendue cesse d'être un mystère et devient un fait vérifiable —
et l'utilisateur comprend enfin quel mot-clé produit quoi, ce qui lui permet de
corriger sa recherche lui-même.

Couleurs par variables de thème uniquement (contrainte 6). Rien à afficher quand
le champ est absent : pas de ligne vide, pas de « non précisé ».

---

## 4. Clôture

Après T3 puis après T6 :

1. `WORK_HISTORY.md` — entrée datée en tête du `## Journal`, et la ligne
   « Prochaine étape suggérée » mise à jour.
2. `LIMITES.md` — si une limite est levée ou découverte (par exemple : la
   sélection ne lit toujours que le titre, jamais le corps de l'annonce, avant de
   choisir).
3. `PROJECT_INDEX.md` — la section décrivant la chaîne de recherche d'offres, si
   elle cite `elargirMotsCles`.

### Rapport attendu, par tâche

```
### TASK n — <titre>
- Fichiers modifiés : <liste exacte>
- Résumé : <3 lignes max>
- Critères du plan : [x] / [ ] (chaque point)
- Mesure T0 avant / après : <chiffres réels>
- tsc / lint / vitest / build / e2e : OK ou KO (+ extrait si KO)
- Commit : <hash + message>
- Journal WORK_HISTORY.md : fait [x]
```

Puis une section « Points sur lesquels je me suis arrêté pour demander », même
vide.

---

## 5. Ce que ce plan ne traite pas, volontairement

- **La sélection ne lit que le titre.** Le texte complet n'est téléchargé
  qu'après le choix des 60 ; une offre retenue n'est jamais réexaminée sur son
  contenu. Télécharger 19 555 annonces à chaque recherche est hors de question,
  et le classement lit le texte ensuite. Reste un angle mort assumé :
  « Chef de projet SI - outils marketing » satisfera un critère conjonctif tout
  en étant un poste informatique. Faible volume, non traitable sur le titre seul.
- **Le malus « métier hors-sujet »** (`malusHorsSujet`, −20 points) exige un code
  ROME, que les offres du marché caché n'ont jamais. Après T1, une offre retenue
  satisfait forcément un critère conjonctif complet dans son titre : le malus
  devient sans objet pour cette source. Il reste utile pour France Travail.
  **Ne cherche pas à deviner un code ROME.** Documente simplement ce fait dans le
  commentaire de la fonction.
- **La base Dexie cumulative.** Les offres déjà enregistrées gardent leur ancien
  score et resteront affichées. C'est le bouton « Purger les offres hors-sujet »
  qui les traite, et c'est à l'utilisateur de le déclencher.
