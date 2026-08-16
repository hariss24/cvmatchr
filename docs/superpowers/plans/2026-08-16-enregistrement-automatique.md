# L'enregistrement devient automatique — plan d'exécution

**Suit :** `../specs/2026-08-16-enregistrement-automatique-design.md`
**Date :** 16 août 2026

---

## Ce que l'exploration du code a ajouté à la spec

Trois choses vues en relisant le code, qui changent le plan :

1. **L'identité doit survivre à un rafraîchissement de page.** Si `documentId`
   ne vit qu'en mémoire (`docStore`), un F5 en cours d'édition la perd : la
   sauvegarde suivante crée un second document. Le brouillon local
   (`draft-<type>`, `useAutoDraft.ts`) est déjà ce qui survit au rafraîchissement
   et est déjà séparé par type de document. **L'identité voyage donc avec le
   brouillon.** Cela règle du même coup le cas CV → Lettre → CV : chaque type
   retrouve son propre document.

2. **Le téléchargement PDF enregistre déjà** (`TopBar.tsx:110`). Il n'y a rien à
   y changer : il appellera le même `saveCurrentDocument`, devenu une mise à
   jour. C'est justement ce qui produisait des copies à chaque téléchargement.

3. **`saveCurrentDocument` fait deux écritures réseau** : la candidature
   (`upsertApplicationForDocument`) puis le document. En automatique, les deux
   partent à chaque pause de frappe. La candidature est dédoublonnée par
   `normKey`, donc c'est correct, seulement bavard. On garde tel quel
   (*Simplicity First*) et on mesure ; si c'est trop, on n'enverra la
   candidature qu'au premier envoi.

---

## Tâche 1 — Le document courant a une identité, et elle survit

**Fichiers :** `src/state/docStore.ts`, `src/lib/storage/useAutoDraft.ts`,
`src/lib/storage/db.ts` (type du brouillon), `src/lib/storage/newResume.ts`,
`src/components/applications/ResumeShelf.tsx`

- `docStore` gagne `documentId: string | null` et `setDocumentId`.
- Le brouillon gagne le même champ : `useAutoDraft` l'écrit en sauvegardant et le
  restaure au chargement, comme il le fait déjà pour `templateId` / `company` /
  `role`. Au changement de type, il restaure celui du brouillon du nouveau type
  (`null` s'il n'y en a pas).
- `startNewResume()` remet `documentId` à `null` — et l'écrit dans le brouillon
  vierge qu'il pose, sinon l'ancienne identité y survivrait.
- `reload()` dans `ResumeShelf` pose `documentId: doc.id` — dans le store **et**
  dans le brouillon qu'il écrit ligne 70.

**Vérification :** tests unitaires sur `docStore`, `newResume`, `useAutoDraft`
(l'identité est écrite, restaurée, remise à zéro). Un test qui échoue avant.

## Tâche 2 — Enregistrer met à jour au lieu d'archiver

**Fichiers :** `src/lib/storage/saveDocument.ts` (+ son test)

- `saveCurrentDocument` lit `documentId` du store. S'il est `null`, il en crée un
  (`crypto.randomUUID()`) **et le pose dans le store** ; sinon il réutilise
  l'existant. `saveHistoryEntry` est déjà un `upsert` côté serveur — à vérifier
  explicitement dans `db.ts` avant d'écrire quoi que ce soit ; si ce n'en est pas
  un, c'est ici que ça se corrige.
- `created_at` n'est plus réécrit lors d'une mise à jour (même piège que le
  `createdAt` des candidatures, corrigé le 15/08 : une date de création qui
  rajeunit à chaque frappe est une date fausse).

**Vérification :** test « dix appels successifs → une seule entrée, le même
identifiant, `created_at` inchangé », et « après `startNewResume`, un second
identifiant ». Critères de succès 2, 3 et 4.

## Tâche 3 — L'enregistrement part tout seul

**Fichiers :** nouveau `src/lib/storage/useAutoSaveCompte.ts`, monté là où
`useAutoDraft` l'est déjà

- Souscrit à `docStore` ; après **4 s** sans modification, appelle
  `saveCurrentDocument`.
- Ne part pas si : personne n'est connecté, rien n'a changé depuis le dernier
  envoi réussi, ou un envoi est déjà en vol.
- Respecte `autosaveDelay === 0` des réglages (auto-sauvegarde désactivée =
  choix explicite de l'utilisateur, déjà honoré par `useAutoDraft`).
- Un échec ne réessaie pas en boucle : il passe l'état à « erreur » et attend la
  prochaine modification.

**Vérification :** tests avec horloge factice (`vi.useFakeTimers`) — frappe puis
attente déclenche un envoi ; dix frappes rapprochées n'en déclenchent qu'un ;
déconnecté n'en déclenche aucun.

## Tâche 4 — Un seul état, discret et honnête

**Fichiers :** `src/state/saveStateStore.ts`, `src/components/layout/TopBar.tsx`,
`src/components/editor/EditorPane.tsx`, `src/app/globals.css`

- `SaveState` devient `idle | saving | saved | anonymous | error`. `device`
  disparaît : plus rien n'est « enregistré sur cet appareil » du point de vue de
  l'utilisateur — le brouillon local est un filet, pas une promesse.
- TopBar : bouton « Enregistrer » supprimé, `onSave` supprimé. À sa place, un
  état court : rien en `idle`, « Enregistrement… », « Enregistré »,
  « Non enregistré — connectez-vous », « Non enregistré — réessai à la prochaine
  modification ». Couleurs par variables de thème, jamais en dur.
- `EditorPane:202` : la pastille disparaît, **sauf** quand l'auto-sauvegarde est
  désactivée dans les réglages — là, elle reste le seul témoin du brouillon.
- Règle du chantier précédent maintenue : une absence (pas connecté), un refus et
  une panne ne se disent pas de la même façon.

**Vérification :** `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`
— puis vérification à l'écran des critères 1, 5, 6 et 7 de la spec (dont réseau
coupé via les outils navigateur).

---

## Ordre et interdits

Les tâches s'enchaînent : 1 → 2 → 3 → 4. Après chacune, les tests passent.

- **Aucun `git push`** — pousser déploie la production.
- Aucune dépendance npm ajoutée.
- `alert` / `confirm` / `prompt` natifs interdits (`uiAlert` / `uiConfirm` /
  `toast`).
- Aucune couleur en dur.
- Aucun test existant modifié pour le faire passer.
