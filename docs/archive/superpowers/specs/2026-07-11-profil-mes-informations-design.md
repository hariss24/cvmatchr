# Profil « Mes informations » — Design

**Date :** 2026-07-11
**Statut :** validé (design), à décliner en plan d'implémentation.

## Problème

Les coordonnées de l'utilisateur (nom, prénom, ville, téléphone, email) ne
vivent aujourd'hui **qu'à l'intérieur d'un CV** (`Resume` dans le `docStore`).
La lettre de motivation récupère son en-tête depuis le CV chargé
(`buildLetterFromTemplate` lit `cv.name`, `cv.location`, `cv.email`, `cv.phone`)
et le prénom/nom des pastilles est redécoupé à la volée sur l'espace.

Conséquences :

- Repartir d'un CV vierge oblige à re-saisir toute l'identité.
- Écrire une lettre **sans** avoir chargé son vrai CV produit un en-tête
  placeholder (« Prénom Nom · email@example.com »), et `/pack` n'a aucun champ
  pour le corriger.

Deux réponses, complémentaires :

- **A — Autofill navigateur** (déjà livré) : attributs `autocomplete`/`type`
  sur les champs d'identité du formulaire CV, pour que Chrome/Safari proposent
  de remplir. Mécanisme du navigateur, per-device, non déterministe.
- **B — Profil « Mes informations »** (ce document) : une fiche saisie une
  fois, stockée en local, réinjectée dans chaque nouveau CV et dans la lettre.
  Source de vérité déterministe, contrôlée par l'app, pensée pour adosser un
  compte utilisateur plus tard (ambition SaaS).

## Objectifs de succès (vérifiables)

1. Une page `/profil` permet de saisir et modifier ses infos ; la saisie est
   persistée localement et rechargée au retour sur la page.
2. Créer un CV vierge pré-remplit l'identité depuis le profil **sans écraser**
   un CV déjà rempli.
3. Générer une lettre utilise le profil pour l'en-tête (expéditeur + date) et
   les pastilles Prénom/Nom, **y compris quand aucun vrai CV n'est chargé**.
4. Si le profil est vide, le comportement actuel est conservé (fallback CV).

## Modèle de données

Nouvelle table Dexie `profile`, **singleton** (une seule ligne, `id = "me"`),
ajoutée en `db.version(5)` — même schéma d'extension que les tables `jobs`
(v2) et `templates` (v4).

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
  adresse: string;     // rue
  codePostal: string;
  linkedin: string;
  updatedAt: number;
}
```

Décision : **Prénom et Nom séparés** (au lieu du champ unique `name` du CV).
Cela supprime le redécoupage bancal sur l'espace dans `PackView`/`build.ts` et
alimente directement les pastilles.

API (module `lib/storage/profile.ts` ou fonctions dans `db.ts`, à trancher au
plan) : `loadProfile(): Promise<UserProfile | null>` et
`saveProfile(p: UserProfile): Promise<void>`. Un helper de test d'existence /
complétude des champs requis (`isProfileComplete`) pourra être ajouté si utile.

## Page `/profil`

- Route App Router `app/profil/page.tsx` rendant un composant `ProfileView`
  (`"use client"`), même gabarit que `/pack` : `topbar--secondary` avec titre
  « Mes informations » + bouton « Retour ».
- Mention discrète en haut :
  > Ces informations pré-remplissent automatiquement tes CV et tes lettres de
  > motivation.
- Formulaire : 5 champs requis marqués d'un `*` (Prénom, Nom, Email,
  Téléphone, Ville), puis une section repliable « Informations complémentaires »
  pour les optionnels (Adresse, Code postal, LinkedIn).
- Les inputs portent les mêmes attributs `autocomplete`/`type` que le CV
  (cohérence avec A : `given-name`, `family-name`, `email`, `tel`,
  `address-level2`, `postal-code`, `address-line1`, `url`).
- **Sauvegarde automatique** débouncée (~800 ms), comme la page lettre — pas de
  bouton « Enregistrer ». Indicateur discret « Enregistré » optionnel.
- Accès : bouton **« Mes infos » (👤)** dans la barre d'actions du bas
  (`ActionsBar`), à côté de l'aide et de la clé API.

## Réinjection

### Nouveau CV vierge

Au moment où l'app instancie un CV par défaut (reset / absence de brouillon),
appliquer le profil via un helper pur :

```ts
applyProfileToResume(resume: Resume, profile: UserProfile | null): Resume
```

Règle : ne remplir un champ que s'il est **vide ou égal au placeholder par
défaut** (`DEFAULT_RESUME`). Ne jamais écraser une saisie réelle. Composition
`name = \`${prenom} ${nom}\`.trim()`, `location = ville` (ou
`\`${ville}\`` enrichi si adresse/CP présents — à préciser au plan),
`email`, `phone`, `linkedin` recopiés.

Le point d'injection exact (où le CV vierge est créé) est à localiser pendant
la phase de plan.

### Lettre

Le profil devient la **source de vérité** de l'en-tête et des pastilles, avec
fallback CV :

- Ordre de priorité : **Profil → CV chargé → placeholder**.
- `PackView` construit ses `vars` (Prénom, Nom) depuis le profil s'il existe,
  sinon depuis le CV (comportement actuel).
- `buildLetterFromTemplate` reçoit une identité résolue (profil ou CV) pour
  `sender_name`, `sender_address`, `sender_contact`, et la ville de la date.
  Refactor minimal : passer une « identité » déjà résolue plutôt que le CV brut,
  ou résoudre en amont dans `PackView`. À trancher au plan (préférence : résoudre
  dans `PackView`, garder `build.ts` inchangé si possible).
- Bloc expéditeur formel : si `adresse`/`codePostal` sont remplis, les inclure
  dans `sender_address` ; sinon garder la ville seule (comportement actuel).

## Hors périmètre (YAGNI)

- Pas de compte / login / synchro serveur (table structurée pour l'accueillir
  plus tard).
- Le CV n'est **pas** contraint de refléter le profil en permanence : un
  document reste éditable indépendamment (variantes possibles).
- Pas de champs étendus (date de naissance, permis, portfolio) tant qu'ils ne
  sont pas demandés.
- Pas de blocage dur en cas de champ requis manquant : marquage `*` + rappel
  discret éventuel ; le fallback lettre couvre l'absence.

## Vérification

- **Unitaires (Vitest)** :
  - `saveProfile` / `loadProfile` (round-trip Dexie).
  - `applyProfileToResume` : remplit les champs vides/placeholder, préserve les
    valeurs réelles.
  - Construction de lettre : identité résolue Profil > CV, fallback quand profil
    vide.
- **e2e (Playwright)** : remplir `/profil`, créer une lettre, vérifier que
  l'en-tête et les pastilles utilisent les infos du profil — y compris **sans
  CV chargé** (en-tête non-placeholder).
- Barre verte de référence : `tsc` 0, `eslint` 0 erreur, Vitest complet, build,
  e2e.

## Journalisation

Consigner la tâche dans `WORK_HISTORY.md` (feature Profil « Mes informations »),
et noter le lien avec le quick win A (autofill navigateur).
