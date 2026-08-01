# Retirer zod du bundle JS de toutes les pages sauf l'éditeur — Plan d'implémentation

> **Pour les agents d'exécution :** ce plan se lit avec `web/CADRAGE_EXECUTION.md`
> (le contrat, qui prime en cas de conflit), `.agents/rules/cadrage.md` et
> `docs/superpowers/specs/2026-08-01-zod-global-allegement-bundle-design.md` (la
> spec, qui justifie chaque choix par deux builds réels mesurés le 01/08/2026 — un
> correctif partiel réfuté, un correctif complet validé).
> Les étapes utilisent des cases à cocher (`- [ ]`) pour le suivi.

**But :** `DEFAULT_RESUME` et `DEFAULT_LETTER` (deux littéraux objets, aucun
appel zod) vivent aujourd'hui dans `web/src/lib/resume/schema.ts`, le même
fichier qui définit tous les schémas zod réels de l'app. Importer l'un ou
l'autre — ce que fait `docStore.ts`, chargé sur **toutes** les routes via
`UiHost` — embarque tout le fichier, donc zod (283 Ko), dans le bundle de
l'importeur. Ce plan déplace ces deux constantes dans un nouveau fichier
zod-libre (`defaults.ts`) et migre les 14 fichiers qui les consomment.

**Architecture :** nouveau fichier `web/src/lib/resume/defaults.ts`
(`DEFAULT_RESUME`, `DEFAULT_LETTER`, `import type` uniquement vers `schema.ts`).
`schema.ts` perd ces deux exports. Les 13 autres fichiers consommateurs
repointent leur import de `DEFAULT_RESUME`/`DEFAULT_LETTER` vers `defaults.ts`,
en gardant depuis `schema.ts` tout ce qui reste légitimement nécessaire
(`resumeSchema`, `letterSchema`, `type Resume`, `type Letter`, etc.).

**Stack :** TypeScript strict, Vitest, Next.js 16 (App Router), Turbopack.
Aucune dépendance npm ajoutée ou modifiée.

**⚠️ Important — cette migration a déjà été appliquée et mesurée une fois** par
l'Architecte en rédigeant la spec (§2.4), pour valider l'hypothèse avant de
l'écrire, puis **annulée** (`git checkout`) pour respecter la borne qui interdit
à l'Architecte de modifier `web/src/`. Les diffs ci-dessous sont donc connus pour
compiler, passer `npx tsc --noEmit` et `npx vitest run` (584 tests verts), et
faire disparaître le chunk zod des 8 routes hors édition — ce n'est pas une
proposition à l'aveugle. Applique-les tels quels, vérifie à chaque tâche comme
d'habitude, ne réinvente pas la disposition du code.

## Contraintes globales

Ces règles s'appliquent à **toutes** les tâches, sans être répétées à chaque fois.

- **Aucune dépendance npm ajoutée ou mise à jour.**
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.**
  TypeScript strict doit compiler.
- **Jamais `alert`/`confirm`/`prompt` natifs** → aucune tâche de ce plan n'y touche.
- **PUSH STRICTEMENT INTERDIT sur `main`.** Travaille sur une branche `claude/…`.
  Commit local par tâche.
- **Vérification après CHAQUE tâche**, depuis `web/`, dans cet ordre, sortie
  collée dans le rapport :
  ```
  npx tsc --noEmit
  npm run lint
  npx vitest run
  ```
  (`npm run build` uniquement à la Task 4, qui est la vérification de poids —
  inutile de rebuilder à chaque tâche intermédiaire, seul le typecheck/tests
  comptent tant que la migration n'est pas complète.)
- **Une vérification rouge = tâche NON LIVRÉE.** On corrige avant de continuer.
- **Aucune assertion de test existante ne change** dans ce plan — uniquement des
  chemins d'import. Si une assertion semble devoir changer, c'est que quelque
  chose s'est mal passé, pas que le test avait tort.
- **Journal obligatoire** après chaque tâche : entrée datée en tête de la
  section `## Journal` de `WORK_HISTORY.md` (racine) + mise à jour de la ligne
  « Prochaine étape suggérée ».

---

## Vue d'ensemble des fichiers

| Fichier | Sort |
|---|---|
| `web/src/lib/resume/defaults.ts` | **Créé** — `DEFAULT_RESUME`, `DEFAULT_LETTER` |
| `web/src/lib/resume/schema.ts` | Modifié — retire les deux blocs `DEFAULT_RESUME`/`DEFAULT_LETTER` |
| `web/src/state/docStore.ts` | Modifié — import repointé |
| `web/src/state/docStore.test.ts` | Modifié — import repointé |
| `web/src/lib/resume/normalize.ts` | Modifié — import repointé (garde `resumeSchema`/`letterSchema`/`RESUME_TOP_KEYS`) |
| `web/src/lib/resume/normalize.test.ts` | Modifié — import repointé |
| `web/src/lib/pdfgen/ResumeDocument.test.tsx` | Modifié — import repointé (garde `resumeSchema`) |
| `web/src/lib/pdfgen/LetterDocument.test.tsx` | Modifié — import repointé (garde `letterSchema`) |
| `web/src/lib/storage/newResume.ts` | Modifié — import repointé |
| `web/src/lib/storage/useAutoDraft.test.ts` | Modifié — import repointé |
| `web/src/lib/profile/profile.ts` | Modifié — import repointé (garde `type Resume`) |
| `web/src/lib/profile/profile.test.ts` | Modifié — import repointé (garde `type Resume`) |
| `web/src/lib/letter/adapt.ts` | Modifié — import repointé (garde `type Letter`, `type Resume`) |
| `web/src/lib/letter/adapt.test.ts` | Modifié — import repointé (garde `type Letter`, `type Resume`) |
| `web/src/lib/templates/defaults.test.ts` | Modifié — import repointé |

---

## Task 1 : Créer `defaults.ts`, nettoyer `schema.ts`, migrer `docStore.ts`

**Files:**
- Create: `web/src/lib/resume/defaults.ts`
- Modify: `web/src/lib/resume/schema.ts`
- Modify: `web/src/state/docStore.ts`
- Modify: `web/src/state/docStore.test.ts`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces:
  ```ts
  // web/src/lib/resume/defaults.ts
  export const DEFAULT_RESUME: Resume;
  export const DEFAULT_LETTER: Letter;
  ```

**Contexte.** `docStore.ts` est le nœud identifié par la spec (§2.2) : chargé sur
toutes les routes via `RootLayout → UiHost → useGlobalUndoRedo → useDocStore`,
il importe aujourd'hui `DEFAULT_RESUME`/`DEFAULT_LETTER` **par valeur** depuis
`schema.ts`, le fichier qui définit tous les schémas zod réels. La spec §2.3 a
montré que corriger ce seul fichier ne suffit pas (Turbopack continue de
regrouper zod dans un chunk partagé tant que d'autres consommateurs touchent
encore `schema.ts` par valeur) — cette tâche pose la fondation (le nouveau
fichier zod-libre) et migre le nœud le plus visible ; les Tasks 2 et 3 achèvent
la migration.

- [ ] **Step 1 : Créer `web/src/lib/resume/defaults.ts`**

Contenu exact (littéraux identiques à ceux actuellement dans `schema.ts` lignes
162-239, y compris le commentaire sur `signoff` — rien ne change dans les
valeurs) :

```ts
import type { Resume, Letter } from "./schema";

/** Port fidèle de `DEFAULT_RESUME` (resume-form.js, l.20-51). */
export const DEFAULT_RESUME: Resume = {
  name: "Prénom Nom",
  title: "Titre du poste",
  location: "Ville, Pays",
  email: "email@example.com",
  phone: "+33 6 00 00 00 00",
  linkedin: "linkedin.com/in/profil",
  photo: "",
  summary:
    "Bref résumé professionnel : 2 à 3 phrases qui présentent votre profil, votre expérience et ce que vous recherchez.",
  experience: [
    {
      title: "Poste occupé",
      company: "Entreprise",
      contract: "Stage",
      location: "Ville",
      date: "Jan 2024 - Présent",
      bullets: [
        "Réalisation marquante avec métrique chiffrée.",
        "Autre réalisation pertinente pour le poste visé.",
      ],
    },
    {
      title: "Poste précédent",
      company: "Autre entreprise",
      contract: "",
      location: "Ville",
      date: "2022 - 2023",
      bullets: ["Description courte de la mission."],
    },
  ],
  education: [
    { title: "Diplôme", school: "Établissement", location: "Ville", date: "2020 - 2022" },
  ],
  skills: [
    "Compétence 1", "Compétence 2", "Compétence 3",
    "Compétence 4", "Compétence 5", "Compétence 6",
  ],
  softSkills: ["Soft skill 1", "Soft skill 2", "Soft skill 3"],
  tools: ["Outil 1", "Outil 2", "Outil 3"],
  languages: [
    { name: "Français", level: "Natif" },
    { name: "Anglais", level: "Courant" },
  ],
  interests: ["Lecture", "Sport", "Voyages"],
  projects: [],
  certifications: [],
  volunteer: [],
  customSections: [],
  customFields: [],
  sectionOrder: [],
  sectionTitles: {},
  hiddenSections: [],
};

/** Port fidèle de `DEFAULT_LETTER` (resume-form.js, l.54-67). */
export const DEFAULT_LETTER: Letter = {
  sender_name: "Prénom Nom",
  sender_address: "Adresse, Ville",
  sender_contact: "email@example.com · +33 6 00 00 00 00",
  date: "Ville, le JJ/MM/AAAA",
  recipient_name: "Nom de l'entreprise",
  recipient_service: "Service Recrutement",
  recipient_address: "Adresse de l'entreprise",
  subject: "Candidature au poste de [Intitulé du poste]",
  greeting: "Madame, Monsieur,",
  body:
    "[Accroche : présentez-vous brièvement et expliquez pourquoi ce poste et cette entreprise vous intéressent particulièrement.]\n\n" +
    "[Argumentaire : décrivez vos compétences et expériences les plus pertinentes, avec des exemples concrets.]\n\n" +
    "[Conclusion : réaffirmez votre motivation, mentionnez votre disponibilité pour un entretien et remerciez pour l'attention portée à votre candidature.]",
  // Politesse courte : la formule cérémonieuse d'origine (« Dans l'attente de votre réponse,
  // je reste à votre disposition… Veuillez agréer… ») terminait en langue de bois même une
  // lettre écrite au registre « Authentique » — ce champ échappe à l'IA, qui ne touche
  // qu'au corps.
  signoff: "Cordialement,",
  signature: "Prénom Nom",
};
```

- [ ] **Step 2 : Retirer les deux blocs de `web/src/lib/resume/schema.ts`**

Supprimer entièrement les lignes 162-239 (du commentaire `/** Port fidèle de
`DEFAULT_RESUME`… */` jusqu'à la fin du littéral `DEFAULT_LETTER`, incluse) —
c'est-à-dire tout le contenu déplacé au Step 1. Rien d'autre dans `schema.ts` ne
change : `resumeSchema`, `letterSchema`, les types `Resume`/`Letter`,
`RESUME_TOP_KEYS`, etc. restent en place.

- [ ] **Step 3 : Migrer `docStore.ts`**

Dans `web/src/state/docStore.ts`, remplacer (lignes 1-8) :

```ts
// avant
import {
  DEFAULT_RESUME,
  DEFAULT_LETTER,
  type Resume,
  type Letter,
  type DocType,
} from "@/lib/resume/schema";
```

par :

```ts
// après
import { DEFAULT_RESUME, DEFAULT_LETTER } from "@/lib/resume/defaults";
import type { Resume, Letter, DocType } from "@/lib/resume/schema";
```

- [ ] **Step 4 : Migrer `docStore.test.ts`**

Dans `web/src/state/docStore.test.ts`, remplacer :

```ts
// avant
import { DEFAULT_RESUME } from "@/lib/resume/schema";
```

par :

```ts
// après
import { DEFAULT_RESUME } from "@/lib/resume/defaults";
```

- [ ] **Step 5 : Vérification**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

Attendu : `npx tsc --noEmit` signale des erreurs dans les **autres** fichiers qui
importaient encore `DEFAULT_RESUME`/`DEFAULT_LETTER` depuis `schema.ts` (ils
n'existent plus là-bas) — normal à ce stade, c'est l'objet des Tasks 2 et 3.
`npx vitest run` échouera pour la même raison sur les fichiers non encore migrés.
Si les seules erreurs concernent des imports manquants de `DEFAULT_RESUME`/
`DEFAULT_LETTER` dans les fichiers listés en Task 2/3, continuer ; toute autre
erreur est un vrai problème à corriger avant de poursuivre.

- [ ] **Step 6 : Commit**

```bash
git add web/src/lib/resume/defaults.ts web/src/lib/resume/schema.ts web/src/state/docStore.ts web/src/state/docStore.test.ts
git commit -m "perf(cv): extraire DEFAULT_RESUME/DEFAULT_LETTER hors de schema.ts

DEFAULT_RESUME et DEFAULT_LETTER sont des littéraux, sans dépendance réelle à
zod, mais vivaient dans schema.ts — le fichier qui définit tous les schémas zod
de l'app. docStore.ts (chargé sur toutes les routes via UiHost) les important
par valeur, tout schema.ts (donc zod, 283 Ko) finissait dans le bundle de
chaque route. Nouveau fichier defaults.ts, zod-libre ; docStore.ts migré en
premier (le nœud le plus visible, identifié par la spec du 01/08/2026). Les
autres consommateurs suivent dans les commits suivants — la migration n'est
complète, et le poids réellement gagné, qu'une fois tous migrés (vérifié par
mesure réelle en amont, voir spec §2.3-2.4)."
```

---

## Task 2 : Migrer les fichiers de production restants

**Files:**
- Modify: `web/src/lib/resume/normalize.ts`
- Modify: `web/src/lib/storage/newResume.ts`
- Modify: `web/src/lib/profile/profile.ts`
- Modify: `web/src/lib/letter/adapt.ts`

**Interfaces:** rien de nouveau, uniquement des chemins d'import.

**Contexte.** Ces quatre fichiers sont, avec `docStore.ts` (Task 1), les
véritables consommateurs de production de `DEFAULT_RESUME`/`DEFAULT_LETTER`.
La spec §2.3 a montré qu'il ne suffit pas de migrer `docStore.ts` seul : tant
qu'un seul de ces quatre fichiers touche encore `schema.ts` par valeur, le chunk
zod reste partagé par toutes les routes. `profile.ts` (consommé par
`ProfileView.tsx`, `ActionsBar.tsx`, `PackView.tsx`), `letter/adapt.ts`
(consommé par `PackView.tsx`, `TailorModal.tsx`) et `storage/newResume.ts`
(consommé par `TopBar.tsx`) sont exactement les chaînes qui expliquaient
pourquoi `/pack` et `/profil` payaient aussi ce coût.

- [ ] **Step 1 : `normalize.ts`**

Dans `web/src/lib/resume/normalize.ts`, remplacer (lignes 1-8) :

```ts
// avant
import {
  resumeSchema,
  letterSchema,
  RESUME_TOP_KEYS,
  DEFAULT_LETTER,
  type Resume,
  type Letter,
} from "./schema";
```

par :

```ts
// après
import {
  resumeSchema,
  letterSchema,
  RESUME_TOP_KEYS,
  type Resume,
  type Letter,
} from "./schema";
import { DEFAULT_LETTER } from "./defaults";
```

(`resumeSchema`/`letterSchema` restent légitimement importés ici : ce fichier
les appelle réellement, `.parse(...)`, lignes 183 et 190.)

- [ ] **Step 2 : `storage/newResume.ts`**

Dans `web/src/lib/storage/newResume.ts`, remplacer :

```ts
// avant
import { DEFAULT_RESUME } from "@/lib/resume/schema";
```

par :

```ts
// après
import { DEFAULT_RESUME } from "@/lib/resume/defaults";
```

- [ ] **Step 3 : `profile/profile.ts`**

Dans `web/src/lib/profile/profile.ts`, remplacer :

```ts
// avant
import { DEFAULT_RESUME, type Resume } from "@/lib/resume/schema";
```

par :

```ts
// après
import { DEFAULT_RESUME } from "@/lib/resume/defaults";
import type { Resume } from "@/lib/resume/schema";
```

- [ ] **Step 4 : `letter/adapt.ts`**

Dans `web/src/lib/letter/adapt.ts`, remplacer :

```ts
// avant
import { DEFAULT_LETTER, type Letter, type Resume } from "@/lib/resume/schema";
```

par :

```ts
// après
import { DEFAULT_LETTER } from "@/lib/resume/defaults";
import type { Letter, Resume } from "@/lib/resume/schema";
```

- [ ] **Step 5 : Vérification**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

Attendu : les erreurs de type restantes ne concernent plus que les fichiers de
**test** listés en Task 3 (imports de `DEFAULT_RESUME`/`DEFAULT_LETTER` toujours
absents de `schema.ts`). Si une erreur touche un fichier de production non listé
ici, s'arrêter et investiguer — cela voudrait dire qu'un consommateur de
`DEFAULT_RESUME`/`DEFAULT_LETTER` a été oublié dans la spec.

- [ ] **Step 6 : Commit**

```bash
git add web/src/lib/resume/normalize.ts web/src/lib/storage/newResume.ts web/src/lib/profile/profile.ts web/src/lib/letter/adapt.ts
git commit -m "perf(cv): migrer normalize/profile/adapt/newResume vers defaults.ts

Suite de la migration hors de schema.ts (commit précédent) : ces quatre
fichiers de production étaient, avec docStore.ts, les seuls consommateurs
réels de DEFAULT_RESUME/DEFAULT_LETTER. profile.ts et letter/adapt.ts sont
notamment ce qui faisait payer le coût de zod à /pack et /profil, alors que ni
l'un ni l'autre n'appelle jamais resumeSchema/letterSchema pour de vrai."
```

---

## Task 3 : Migrer les fichiers de test restants

**Files:**
- Modify: `web/src/lib/resume/normalize.test.ts`
- Modify: `web/src/lib/pdfgen/ResumeDocument.test.tsx`
- Modify: `web/src/lib/pdfgen/LetterDocument.test.tsx`
- Modify: `web/src/lib/storage/useAutoDraft.test.ts`
- Modify: `web/src/lib/profile/profile.test.ts`
- Modify: `web/src/lib/letter/adapt.test.ts`
- Modify: `web/src/lib/templates/defaults.test.ts`

**Interfaces:** rien de nouveau, uniquement des chemins d'import. Ces fichiers
ne pèsent sur aucun bundle client (Vitest, pas Next.js) — les migrer ici sert la
cohérence (une seule source pour `DEFAULT_RESUME`/`DEFAULT_LETTER`) et évite de
laisser un import cassé après la Task 1.

- [ ] **Step 1 : `normalize.test.ts`**

```ts
// avant (ligne 2)
import { DEFAULT_RESUME, type Resume } from "./schema";

// après
import { DEFAULT_RESUME } from "./defaults";
import type { Resume } from "./schema";
```

- [ ] **Step 2 : `pdfgen/ResumeDocument.test.tsx`**

```ts
// avant (ligne 3)
import { resumeSchema, DEFAULT_RESUME } from "@/lib/resume/schema";

// après
import { resumeSchema } from "@/lib/resume/schema";
import { DEFAULT_RESUME } from "@/lib/resume/defaults";
```

- [ ] **Step 3 : `pdfgen/LetterDocument.test.tsx`**

```ts
// avant (ligne 3)
import { letterSchema, DEFAULT_LETTER } from "@/lib/resume/schema";

// après
import { letterSchema } from "@/lib/resume/schema";
import { DEFAULT_LETTER } from "@/lib/resume/defaults";
```

- [ ] **Step 4 : `storage/useAutoDraft.test.ts`**

```ts
// avant (ligne 14)
import { DEFAULT_RESUME, DEFAULT_LETTER } from "@/lib/resume/schema";

// après
import { DEFAULT_RESUME, DEFAULT_LETTER } from "@/lib/resume/defaults";
```

- [ ] **Step 5 : `profile/profile.test.ts`**

```ts
// avant (ligne 3)
import { DEFAULT_RESUME, type Resume } from "@/lib/resume/schema";

// après
import { DEFAULT_RESUME } from "@/lib/resume/defaults";
import type { Resume } from "@/lib/resume/schema";
```

- [ ] **Step 6 : `letter/adapt.test.ts`**

```ts
// avant (ligne 3)
import { DEFAULT_LETTER, DEFAULT_RESUME, type Letter, type Resume } from "@/lib/resume/schema";

// après
import { DEFAULT_LETTER, DEFAULT_RESUME } from "@/lib/resume/defaults";
import type { Letter, Resume } from "@/lib/resume/schema";
```

- [ ] **Step 7 : `templates/defaults.test.ts`**

⚠️ Ce fichier importe déjà un `./defaults` **local** à `templates/`
(`DEFAULT_TEMPLATES`, un fichier différent de `lib/resume/defaults.ts`) — ne pas
confondre les deux specifiers, garder le chemin complet pour celui du CV :

```ts
// avant (ligne 4)
import { DEFAULT_RESUME } from "@/lib/resume/schema";

// après
import { DEFAULT_RESUME } from "@/lib/resume/defaults";
```

- [ ] **Step 8 : Vérification complète**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

Attendu : tout vert, 584 tests (même nombre qu'avant ce plan, aucune assertion
n'a changé).

- [ ] **Step 9 : Vérifier qu'aucun import de `DEFAULT_RESUME`/`DEFAULT_LETTER` ne vise plus `schema.ts`**

```bash
cd web && grep -rn "DEFAULT_RESUME\|DEFAULT_LETTER" --include="*.ts" --include="*.tsx" src | grep "resume/schema\|from \"\./schema\"\|from \"\.\./schema\""
```

Attendu : aucune ligne de code, seulement (au plus) une mention en commentaire
dans `schema.ts` s'il en reste une (inoffensive).

- [ ] **Step 10 : Commit**

```bash
git add web/src/lib/resume/normalize.test.ts web/src/lib/pdfgen/ResumeDocument.test.tsx web/src/lib/pdfgen/LetterDocument.test.tsx web/src/lib/storage/useAutoDraft.test.ts web/src/lib/profile/profile.test.ts web/src/lib/letter/adapt.test.ts web/src/lib/templates/defaults.test.ts
git commit -m "test(cv): migrer les tests restants vers defaults.ts

Dernier lot : plus aucun fichier (production ou test) n'importe
DEFAULT_RESUME/DEFAULT_LETTER depuis schema.ts. La migration amorcée dans les
deux commits précédents est maintenant complète."
```

---

## Task 4 : Vérification finale — mesure du poids réel par route

**Files:** aucun fichier modifié, tâche de vérification uniquement.

**But :** confirmer, avec la méthode de la spec (§2.1 et §2.4), que le chunk
zod a bien disparu du bundle initial de `/login`, `/help`, `/pack`, `/jobs`,
`/history`, `/profil`, `/settings`, `/candidatures`, et qu'il **reste** présent
sur `/` (l'éditeur, où il est légitime).

- [ ] **Step 1 : Build de production propre et démarrage**

```bash
cd web
rm -rf .next
npm run build
npm run start &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # attendu : 200
```

- [ ] **Step 2 : Identifier le chunk zod de ce build**

```bash
grep -l "zod" .next/static/chunks/*.js 2>/dev/null | xargs -n1 basename
```

Attendu : un seul fichier, avec plusieurs centaines d'occurrences du mot « zod »
(vérifiable par `grep -c zod .next/static/chunks/<fichier>`) et rien d'autre de
reconnaissable dans son contenu (uniquement la bibliothèque elle-même).

- [ ] **Step 3 : Mesurer chaque route**

```bash
ZOD_CHUNK=$(grep -l "zod" .next/static/chunks/*.js 2>/dev/null | xargs -n1 basename)
for route in "" login help pack jobs history profil settings candidatures; do
  curl -s "http://localhost:3000/$route" -o "/tmp/page_${route:-root}.html"
  total=0
  for chunk in $(grep -oE '"/_next/static/chunks/[^"]+\.js"' "/tmp/page_${route:-root}.html" | tr -d '"' | sed 's#.*/##' | sort -u); do
    sz=$(stat -c%s ".next/static/chunks/$chunk" 2>/dev/null || echo 0)
    total=$((total+sz))
  done
  has_zod=$(grep -c "$ZOD_CHUNK" "/tmp/page_${route:-root}.html")
  echo "${route:-/} : ${total} o, occurrences du chunk zod : ${has_zod}"
done
```

Attendu (critères §7 de la spec) :
- `/` (racine) : occurrences du chunk zod **> 0** (légitime, §2.5 de la spec).
- Toutes les 8 autres routes : occurrences du chunk zod **= 0**, et un poids
  total en baisse d'au moins 250 000 o par rapport aux chiffres « Avant » du
  tableau §2.1/§2.4 de la spec.

- [ ] **Step 4 : Arrêter le serveur, consigner les résultats**

```bash
kill %1 2>/dev/null
```

Consigner dans `WORK_HISTORY.md` (`## Journal`) les poids mesurés par route
(avant/après, repris de la spec §2.1/§2.4 pour « avant », mesure du Step 3
ci-dessus pour « après ») et confirmer explicitement que `/` garde zod alors que
les 8 autres routes ne l'ont plus.

- [ ] **Step 5 : Pas de commit de code** — tâche de vérification uniquement :

```bash
git add WORK_HISTORY.md
git commit -m "docs(boucle): consigne la mesure de poids par route après le retrait de zod du bundle partagé"
```
