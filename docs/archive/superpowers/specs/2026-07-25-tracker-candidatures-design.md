# Tracker de candidatures — « Mes candidatures »

*Spec de conception — 25/07/2026*

---

## 1. Problème

L'utilisateur quotidien de Cvmatchr accumule les candidatures (cible : 100+) et n'a
aucun moyen de savoir ce qu'il a envoyé, à qui, quand, ni avec quel CV. Trois
symptômes concrets :

1. **Les offres sont jetées après usage.** L'extracteur magique nettoie une offre,
   l'IA adapte le CV, puis le texte de l'offre disparaît. Impossible de relire
   l'offre avant un entretien, ni de régénérer un document sur la même base.
2. **L'historique ne raconte rien.** `db.history` liste des documents générés, pas
   des candidatures. Deux CV et une lettre pour la même entreprise apparaissent
   comme trois lignes sans lien entre elles.
3. **Le dashboard est enterré dans Paramètres** et ne mesure que des volumes de
   tables Dexie (nombre de snapshots, de modèles) — aucune information
   actionnable pour un candidat.

## 2. Contrainte directrice : le suivi doit être quasi zéro-maintenance

Le mode d'échec de tous les trackers de candidatures est connu : la mise à jour
coûte plus cher que le bénéfice, donc l'utilisateur arrête de la faire et les
données deviennent fausses. À 100+ candidatures, **l'utilisateur ne doit jamais
passer plus de temps à tenir son suivi qu'à postuler**.

Conséquences retenues :

- **Le temps fait le travail.** L'ancienneté d'une candidature est calculée à
  partir de sa date, jamais saisie. Après un seuil de silence configurable
  (défaut 30 jours), la candidature est automatiquement présentée comme « Sans
  suite ». L'utilisateur ne clique jamais « marquer comme morte » : le silence
  des recruteurs le fait pour lui.
- **Les seules saisies manuelles sont les événements rares et heureux** :
  « Entretien » (≈ 5 fois sur 100) et « Refusée » (optionnel — l'aging couvre le
  cas où l'utilisateur ne fait rien).
- **Pas de relances.** Écarté délibérément : la relance n'a de sens que pour les
  candidatures spontanées, or l'écrasante majorité des candidatures répond à une
  offre publiée sans interlocuteur identifié.

## 3. Décisions de cadrage

| Sujet | Décision |
|---|---|
| Emplacement | Nouvelle page `/candidatures`, qui **absorbe** `/history`. Une seule vue centrale, pas de doublon conceptuel. |
| Dashboard | Migre de `/settings` vers `/candidatures`, recentré sur des indicateurs de candidature. `/settings` redevient purement réglages. |
| Création | Automatique (génération de PDF) + 1 clic depuis l'onglet Offres + ajout manuel. |
| Statuts | Postulée / Entretien / Refusée (manuels) + Sans suite (dérivé de l'ancienneté). |
| CV non rattachés | Rayon « Mes CV ». Un seul CV anonyme par type de document (remplacé à chaque export) ; **nommer un CV, c'est le garder**. |
| Extensibilité IA | Journal d'événements avec un champ `source` acceptant `"ai"`. Aucun code de connecteur écrit maintenant. |
| Style | Skeumorphique / neumorphique existant, variables `--neu-*` et tokens de thème. Jamais de couleur en dur. Maquette validée via Claude Design avant implémentation. |

## 4. Modèle de données

### 4.1 Nouvelle table Dexie `applications` (version 8)

```ts
export interface ApplicationEvent {
  date: number;
  type: "applied" | "interview" | "rejected" | "note";
  source: "manual" | "system" | "ai";
  detail?: string;
}

export interface Application {
  id: string;              // crypto.randomUUID()
  createdAt: number;
  company: string;
  role: string;
  normKey: string;         // clé de dédoublonnage (voir 4.2)
  jobText: string;         // texte de l'offre conservé ("" si inconnu)
  jobUrl: string;          // "" si inconnu
  source: "generated" | "ft-job" | "manual";
  events: ApplicationEvent[];
  notes: string;
  updatedAt: number;
}
```

Index Dexie : `applications: "id, normKey, createdAt, updatedAt"`.

**Le statut n'est pas un champ.** Il est dérivé du journal (voir section 5). Cette
règle est ce qui rend l'évolution IA possible sans migration : un futur
classificateur de mails n'aura qu'à *ajouter* un événement `source: "ai"`.

### 4.2 Clé de dédoublonnage `normKey`

`normKey = norm(company) + "|" + norm(role)` où `norm` : minuscules,
suppression des diacritiques, suppression de la ponctuation, espaces réduits à
un seul, trim. Deux candidatures partageant la même `normKey` sont la même
candidature. Si `company` **et** `role` sont vides, aucune candidature n'est
créée (cas des documents libres, voir 6.4).

### 4.3 Champs ajoutés aux tables existantes

- `HistoryEntry.applicationId?: string` — rattache un document généré à sa
  candidature.
- `HistoryEntry.label?: string` — nom donné à un CV du rayon « Mes CV »
  (voir section 6.4). Vide ou absent = document anonyme, remplaçable.
- `JobEntry.applicationId?: string` — mémorise qu'une offre France Travail est
  suivie (l'affichage du bouton « Suivre » en dépend).

Tous sont optionnels : aucune donnée existante n'est invalidée.

### 4.4 Migration v8

La migration Dexie v8 crée la table `applications` et ajoute les index. Le
rattachement rétroactif de l'historique existant n'est **pas** fait dans
`upgrade()` (pas de logique métier dans une migration Dexie, difficile à tester)
mais par une fonction idempotente `backfillApplications()` appelée au premier
chargement de `/candidatures`, gardée par un flag `localStorage`
(`applications-backfill-v1`) :

1. Lire toutes les entrées `history` sans `applicationId` ayant `company` ou
   `role` non vide.
2. Les grouper par `normKey`.
3. Pour chaque groupe : créer une `Application` (`source: "generated"`,
   `createdAt` = date de l'entrée la plus ancienne, un événement `applied` daté
   de cette même date, `source: "system"`), puis écrire `applicationId` sur
   chaque entrée du groupe.

Résultat : le tracker est peuplé dès la première visite, sans saisie.

## 5. Dérivation du statut

Module pur `src/lib/applications/status.ts`, sans dépendance à Dexie ni à React
— donc testable directement.

```ts
export type ApplicationStatus = "applied" | "interview" | "rejected" | "stale";

export function deriveStatus(app: Application, now: number, staleDays: number): ApplicationStatus
export function daysSince(app: Application, now: number): number
```

Règles, dans cet ordre :

1. Un événement `rejected` existe → `"rejected"` (terminal).
2. Un événement `interview` existe → `"interview"` (ignore l'ancienneté : un
   entretien décroché ne devient jamais « sans suite »).
3. Ancienneté du dernier événement significatif > `staleDays` → `"stale"`.
4. Sinon → `"applied"`.

Les événements `note` n'influencent jamais le statut ni l'ancienneté.

`staleDays` est un réglage utilisateur (`settingsStore`, défaut **30**), exposé
dans Paramètres. `now` est injecté en paramètre pour rendre les tests
déterministes.

## 6. Points de création

### 6.1 Automatique — génération de PDF

Dans `TopBar.tsx` (là où `saveHistoryEntry` est déjà appelé après un export
réussi, cf. `web/src/components/layout/TopBar.tsx:105`) : appeler
`upsertApplicationForDocument({ company, role })` puis passer l'`applicationId`
obtenu à l'entrée d'historique.

`upsertApplicationForDocument` (dans `src/lib/applications/store.ts`) :
- calcule `normKey` ; si vide → retourne `undefined`, rien n'est créé ;
- si une candidature existe avec cette `normKey` → la retourne inchangée (pas de
  nouvel événement : régénérer un CV n'est pas une nouvelle candidature) ;
- sinon → crée la candidature avec un événement `applied` daté de maintenant,
  `source: "system"`.

Même traitement dans `HistoryActions.tsx` s'il crée des entrées d'historique.

### 6.2 Depuis l'onglet Offres

Bouton « Suivre » sur `JobCard`. Crée une candidature `source: "ft-job"` avec
`company`, `role` (le titre de l'offre), `jobUrl`, `jobText` (la description déjà
en base dans `JobEntry.jobText` — l'offre est donc conservée), et un événement
`applied` (`source: "manual"`). Écrit `applicationId` sur le `JobEntry`. Si le
`JobEntry` porte déjà un `applicationId`, le bouton affiche « Suivie » et est
inactif.

### 6.3 Manuel

Bouton « + Ajouter » sur `/candidatures`, ouvrant une modale (style
`TailorModal`) : entreprise (requis), poste (requis), URL de l'offre
(optionnel), texte de l'offre (optionnel, textarea). Crée une candidature
`source: "manual"` avec un événement `applied`. Si la `normKey` existe déjà, un
toast le signale et la candidature existante est mise en évidence dans la liste
plutôt que dupliquée.

### 6.4 Rayon « Mes CV » (documents non rattachés)

Un CV peut être généré sans viser une entreprise précise : un CV d'intérim qu'on
ressortira devant vingt agences, un CV en anglais, un CV généraliste. Ce n'est ni
une candidature, ni un déchet : c'est un document réutilisable, et il a besoin
d'un endroit où le retrouver.

Les entrées d'historique sans `applicationId` (donc exportées sans entreprise
**ni** poste) apparaissent dans une section **« Mes CV »** en bas de
`/candidatures`. Chaque document y expose son nom, sa date, son gabarit,
« Ouvrir dans l'éditeur » et « Supprimer ».

**Règle du CV anonyme.** Un utilisateur qui retouche sa mise en page télécharge le
même CV cinq fois de suite ; sans garde-fou, le rayon se remplit de cinq lignes
identiques et redevient le tiroir fourre-tout qu'on voulait éviter. Donc :

- il n'existe **qu'un seul document anonyme par type** (`doc_type`) à la fois. Un
  nouvel export sans entreprise ni poste **remplace** le précédent document
  anonyme du même type ;
- un document anonyme s'affiche sous le libellé **« Dernier CV exporté »** (ou
  « Dernière lettre exportée »), avec la mention « sera remplacé au prochain
  export » — l'utilisateur ne peut pas être surpris par le remplacement ;
- **nommer un document, c'est le garder.** Dès qu'il porte un `label`, il est
  épinglé, ne compte plus comme anonyme, et n'est jamais remplacé ni purgé. Un
  nouveau document anonyme reprend alors la place libre.

Le nommage est donc l'unique geste de conservation, et il est explicite. Rien
d'autre n'est demandé à l'utilisateur.

Le remplacement est **silencieux** : aucune confirmation. Le libellé annonce déjà
ce qui va arriver, et le cas normal — cinq essais de mise en page d'affilée — ne
doit poser aucune question. Le contenu reste par ailleurs dans le brouillon
courant de l'éditeur, qui n'est jamais touché par cette purge.

## 7. Page `/candidatures`

### 7.1 Structure

```
app/candidatures/page.tsx        # page, chargement des données, état des filtres
components/applications/
  ApplicationsDashboard.tsx      # bandeau d'indicateurs
  ApplicationsFilters.tsx        # recherche + filtres de statut
  ApplicationList.tsx            # liste
  ApplicationCard.tsx            # une candidature (dépliable)
  AddApplicationModal.tsx        # ajout manuel
  ResumeShelf.tsx                # rayon « Mes CV » (documents non rattachés)
lib/applications/
  status.ts                      # dérivation pure (testée)
  normKey.ts                     # normalisation (testée)
  store.ts                       # accès Dexie + upsert + backfill + rayon (testé)
```

Découpage volontairement fin : la logique métier testable (`status`, `normKey`)
est isolée de Dexie, qui est lui-même isolé de React.

### 7.2 Dashboard

Cinq indicateurs, tous calculés depuis `applications` :

- **Candidatures** — total.
- **En cours** — statut `applied`.
- **Entretiens** — statut `interview`.
- **Taux de réponse** — `(interview + rejected) / total`, arrondi à l'entier.
- **Sans suite** — statut `stale`.

Réutilise le style des tuiles actuellement dans `/settings` (`form-item`,
grande valeur en gras). Aucun graphique dans cette version.

Écarté explicitement : aucune statistique par CV (taux de réponse par variante de
CV, suivi du CV utilisé pour chaque candidature). L'idée était séduisante mais
repose sur une corvée de nommage que l'utilisateur cible ne fera pas, et sur une
déduction invisible qui produirait des chiffres faux dès qu'un CV est retouché
après ouverture. Une donnée fausse est pire qu'une donnée absente.

### 7.3 Filtres

- Champ de recherche texte : filtre sur entreprise, poste et texte de l'offre.
- Filtre de statut : Tout / En cours / Entretien / Refusée / Sans suite.

Filtrage purement client, en mémoire. À 100–1000 candidatures c'est instantané ;
pas de pagination, pas de virtualisation (YAGNI).

### 7.4 Carte de candidature

Repliée : entreprise, poste, ancienneté en clair (« il y a 12 jours »), badge de
statut, nombre de documents rattachés.

Dépliée :
- documents rattachés — chacun avec « Ouvrir dans l'éditeur » (recharge le JSON,
  comportement identique à l'actuelle page Historique) ;
- lien vers l'offre (`jobUrl`) si présent ;
- texte de l'offre dans un bloc dépliable si présent ;
- actions **Entretien** et **Refusée** (un clic → ajoute l'événement
  correspondant, `source: "manual"`) ; annulable en retirant le dernier
  événement ;
- champ de note libre (`notes`), enregistré avec le même délai d'autosave que
  l'éditeur ;
- suppression de la candidature (via `uiConfirm`, jamais `confirm`).

### 7.5 Navigation

- `SegmentedNav` : `Historique` → `Candidatures` (`/candidatures`).
- `app/history/page.tsx` devient une redirection vers `/candidatures` (les liens
  et signets existants continuent de fonctionner). Les composants
  `components/history/*` encore utiles sont réutilisés par `ResumeShelf` et
  `ApplicationCard` ; les autres sont supprimés.
- `/settings` : la section Dashboard est retirée, le titre redevient
  « Paramètres », et le réglage `staleDays` est ajouté dans « Préférences de
  l'Application ».

## 8. Style visuel

Le style skeumorphique / neumorphique de l'app est non négociable. Avant toute
implémentation UI, la page est maquettée via **Claude Design** (DesignSync) et
validée par le propriétaire. L'implémentation réutilise exclusivement les
variables existantes de `globals.css` (`--neu-raised`, `--neu-inset`, `--bg`,
`--text`, `--muted`, `--border`, `--field`, couleur d'accent). Les badges de
statut utilisent les tokens sémantiques existants (`--success`, `--error`,
`--muted`) — **aucune couleur en dur**.

## 9. Évolution prévue (non implémentée)

Le seul point d'ancrage laissé pour la suite est `ApplicationEvent.source: "ai"`.
Deux étapes envisagées, dans cet ordre, chacune faisant l'objet de sa propre
spec :

1. **Collage de réponse recruteur** — l'utilisateur colle un mail, l'IA déjà
   branchée le classe (entretien / refus / autre) et extrait une date
   d'entretien ; le résultat est ajouté comme événement `source: "ai"`. Pas
   d'OAuth, faisable dans l'architecture locale actuelle.
2. **Connecteur Gmail / Calendar** — lecture automatique des réponses et rappels
   d'entretien. Nécessite OAuth Google, un backend et une vraie base : réservé au
   passage multi-utilisateur / SaaS.

Aucune de ces deux étapes ne demandera de migration du modèle défini ici.

## 10. Gestion des erreurs

Cohérente avec l'existant : toutes les fonctions d'accès Dexie encapsulent leurs
erreurs (`try/catch` + `console.warn`, valeur de repli) comme le reste de
`db.ts`. Les erreurs visibles par l'utilisateur passent par `toast` /
`uiAlert` ; les confirmations par `uiConfirm`. **Jamais** `alert` / `confirm` /
`prompt` natifs.

## 11. Critères de succès vérifiables

Tests Vitest (nouveaux) :

1. `normKey` — « Société Générale » / « societe generale » produisent la même
   clé ; ponctuation et espaces multiples ignorés ; entreprise et poste vides →
   clé vide.
2. `deriveStatus` — un `rejected` gagne sur tout ; un `interview` empêche
   `stale` même à 200 jours ; 31 jours de silence avec `staleDays = 30` →
   `stale` ; 29 jours → `applied` ; un événement `note` récent ne rajeunit pas
   une candidature.
3. `upsertApplicationForDocument` — deux exports pour la même entreprise/poste
   ne créent qu'une candidature et n'ajoutent qu'un seul événement `applied` ;
   entreprise et poste vides → aucune candidature.
4. `backfillApplications` — idempotent (deux exécutions ne dupliquent rien) ;
   trois entrées d'historique pour deux entreprises → deux candidatures avec les
   documents correctement rattachés.
5. Règle du CV anonyme — trois exports d'affilée sans entreprise ni poste ne
   laissent qu'un seul document dans le rayon ; nommer ce document puis exporter
   de nouveau donne deux documents (le nommé est conservé) ; un CV nommé n'est
   jamais remplacé ; un export de lettre anonyme ne remplace pas le CV anonyme
   (cloisonnement par `doc_type`).

Vérifications manuelles :

6. `npm test` passe.
7. `npm run build` passe (typecheck strict inclus — Vitest ne typecheck pas).
8. `npm run lint` passe.
9. Dans le navigateur : générer un PDF avec entreprise + poste renseignés fait
   apparaître la candidature dans `/candidatures` ; « Entretien » change le badge ;
   un PDF sans entreprise ni poste atterrit dans « Mes CV » sous « Dernier CV
   exporté » et peut être nommé pour être conservé ; `/history` redirige ; le
   dashboard a disparu de `/settings` ; le rendu respecte la maquette validée en
   mode clair **et** sombre.
