# Spec — Le compte restitue vraiment les données

**Date :** 15 août 2026
**Chantier :** 0 (le premier de la file SaaS — voir §9)
**Statut :** validé par le propriétaire, prêt pour le plan d'exécution

---

## 1. Le problème, tel qu'il a été vécu

Test du propriétaire, août 2026 : CV créés sur le PC, connexion au même compte
Google depuis un MacBook. **Rien n'est revenu.** Ni les CV, ni le profil « Mes
infos ». L'éditeur s'est ouvert sur le CV modèle (« Marc Dubois »).

L'authentification Supabase, la base PostgreSQL et le `SyncEngine` existent
depuis le 11/08/2026 (`LIMITES.md` §1, commit `160b238`). La promesse implicite
d'un compte — *mes données me suivent* — n'est donc pas tenue, alors que toute
l'infrastructure pour la tenir est en place.

## 2. Ce que le code fait réellement

Vérifié dans le code le 15/08/2026, après un premier diagnostic de Gemini
confirmé point par point.

| # | Constat | Où |
|---|---|---|
| 1 | **Il n'existe aucun bouton « Enregistrer ».** Le seul appel à `saveHistoryEntry` de toute l'application est déclenché par le **téléchargement du PDF**. Un CV jamais exporté n'existe nulle part ailleurs que dans le brouillon local. | `src/components/layout/TopBar.tsx:94` |
| 2 | **`pushAll()` / `syncAll()` ne sont appelés que depuis `authStore`** : ouverture de session (l. 77, 88) et déconnexion (l. 56). Aucun autre appelant dans `src/`. Entre deux connexions, **rien ne remonte jamais** : enregistrer puis fermer l'onglet laisse tout sur la machine. | `src/state/authStore.ts` |
| 3 | **`profile` et `jobProfile` ne sont pas répliqués.** Le moteur ne connaît que `resumes`, `letters`, `applications`, `saved_jobs`. Le profil « Mes infos » est donc à ressaisir sur chaque appareil. | `src/lib/storage/syncEngine.ts` |
| 4 | **`drafts` n'est pas répliqué non plus, mais il est purgé à la déconnexion** (`purgeLocalData`, l. 109) — effacé sans avoir jamais été envoyé. | `src/lib/storage/syncEngine.ts:109` |
| 5 | **L'interface ne réagit pas à l'arrivée des données.** `pullAll()` écrit dans IndexedDB en tâche de fond ; les écrans chargent leur liste une fois au montage (`useEffect`) et ne sont pas prévenus. Sans F5, l'écran reste vide. | `src/components/applications/ApplicationsScreen.tsx:34` |

## 3. Le modèle retenu : l'enregistrement explicite

**Décision du propriétaire, 15/08/2026.** Le brouillon en cours d'édition **ne
se synchronise pas**. Ce qui voyage entre les appareils, c'est ce que
l'utilisateur a **enregistré** — comme sur LinkedIn : on ne s'attend pas à
retrouver un formulaire quitté sans cliquer sur « Enregistrer ».

**Pourquoi cette décision est écrite ici** : elle ressemble de l'extérieur à un
oubli, et quelqu'un la « corrigera » un jour en croyant réparer un manque. Elle
est délibérée, et elle supprime un risque réel de destruction de données décrit
au §8.

Conséquence sur l'auto-sauvegarde locale existante (`useAutoDraft`) : **elle ne
change pas**. Deux gestes, deux significations distinctes :

- l'auto-sauvegarde locale protège d'une fermeture accidentelle **sur cet
  appareil** et ne traverse jamais le réseau ;
- « Enregistrer » range la version courante dans « Mes CV » **et** l'envoie sur
  le compte.

## 4. Ce qui est construit

### 4.1 Un bouton « Enregistrer »

Dans la TopBar, distinct du téléchargement PDF. Il exécute ce que fait
aujourd'hui l'export : `upsertApplicationForDocument` puis `saveHistoryEntry`,
avec le document courant, son template et ses métadonnées (entreprise, poste).

Le téléchargement PDF **continue** d'enregistrer comme aujourd'hui : on n'enlève
aucun chemin existant, on cesse seulement d'en faire le seul.

### 4.2 L'envoi part à l'enregistrement

`pushAll()` est appelé après chaque écriture qui compte : enregistrement,
suppression d'un document, changement de statut d'une candidature. Appel non
bloquant (`void`), échec silencieux journalisé — une panne réseau ne doit jamais
empêcher l'enregistrement local d'aboutir.

Pas de minuterie, pas de synchronisation périodique, pas de `visibilitychange` :
hors périmètre, et inutile dès lors que l'utilisateur déclenche lui-même
l'enregistrement.

### 4.3 Le profil suit le compte

`profile` (« Mes infos ») et `jobProfile` (critères de recherche) rejoignent la
réplication. Ce ne sont pas des brouillons : ce sont des réglages saisis une
fois, dont la ressaisie sur chaque appareil est une friction pure.

Côté Supabase, **une seule table nouvelle**, sur le modèle exact des tables
existantes de `0001_auth_quotas.sql` — PK composite `(user_id, key)`, RLS par
`user_id`, `client_updated_at` (horloge client, arbitre LWW), `updated_at`
(trigger serveur, curseur de pull), `deleted_at` (suppression douce) :

```
user_settings(user_id, key, content jsonb, client_updated_at, updated_at, deleted_at)
```

`key` ∈ `{'profile', 'jobProfile'}`. Chaque réglage est un document unique par
utilisateur, donc une ligne, arbitrée en last-write-wins comme le reste.

**`templates` est explicitement exclu de ce chantier.** La table est
auto-alimentée avec `DEFAULT_TEMPLATES` quand elle est vide (`db.ts:561`) : sur
un appareil neuf, ce peuplement produirait un horodatage frais qui gagnerait
l'arbitrage contre les modèles réels du compte — exactement la course décrite au
§8. La répliquer suppose d'abord de distinguer un modèle personnalisé d'un
modèle par défaut. À traiter dans un chantier séparé.

### 4.4 L'état d'enregistrement est visible en permanence

Sans cet indicateur, le chantier **crée** une confusion au lieu de la lever :
l'auto-sauvegarde locale conservée (§3) fait persister le travail d'un
rechargement à l'autre, ce dont l'utilisateur déduit que tout est à l'abri — il
ne clique donc jamais sur « Enregistrer », change d'appareil, et ne retrouve
rien. C'est le bug d'origine reproduit, avec un bouton en plus.

À côté du bouton, un état permanent, jamais à deviner :

- **« Modifications non enregistrées »** dès que le document courant diffère de
  la dernière version enregistrée ;
- **« Enregistré sur votre compte »** après un enregistrement répliqué ;
- **« Enregistré sur cet appareil »** quand l'utilisateur n'est pas connecté, ou
  quand l'envoi a échoué — ne jamais annoncer une mise à l'abri distante qui n'a
  pas eu lieu.

Cet indicateur fait partie du chantier. Ce n'est pas une finition.

### 4.5 L'interface se rafraîchit à l'arrivée des données

`syncAll()` émet un signal quand un pull a modifié des données locales. Les
écrans qui affichent des données répliquées — « Mes candidatures », « Mes CV »
(`ResumeShelf`), l'historique — rechargent leur liste à la réception.

**Aucune dépendance npm n'est ajoutée** (`dexie-react-hooks` n'est pas installé,
et `.agents/rules/cadrage.md` §0.6 l'interdit sans instruction explicite du
plan) : un émetteur d'événement minimal suffit, souscrit par les écrans
concernés.

## 5. Ce qui n'est PAS dans ce chantier

- **Le brouillon en cours** — reste local, par décision (§3).
- **La photo de profil en base64 dans le JSONB**, qui voyage entière à chaque
  envoi (`LIMITES.md` §1.1) → chantier « photos vers Supabase Storage ».
- **Le compte obligatoire** et la connexion hors Google → chantiers A et B (§9).
- **Le brouillon transformé en entrée d'historique** (piste envisagée puis
  écartée le 15/08) : elle mêle deux problèmes distincts — « mes données me
  suivent » et « qu'est-ce qui mérite d'être archivé ». Conservée comme piste
  future, non retenue ici.
- **Toute reprise du Last-Write-Wins** : le moteur garde sa règle actuelle.

## 6. Critères de succès

**Test manuel de bout en bout** (dernière task du plan, à exécuter réellement,
sortie collée dans le rapport) :

1. Navigateur A, connecté : remplir « Mes infos », créer un CV, cliquer
   **Enregistrer**, fermer l'onglet **sans se déconnecter**.
2. Navigateur B (profil vierge), même compte : se connecter.
3. **Attendu** : le CV apparaît dans « Mes CV » **sans rechargement de page**, et
   « Mes infos » est pré-rempli.
4. **Attendu aussi** : en modifiant le CV sur le navigateur B, l'état passe à
   « Modifications non enregistrées », et repasse à « Enregistré sur votre
   compte » après un clic sur Enregistrer. Déconnecté, le même clic annonce
   « Enregistré sur cet appareil ».

Avant ce chantier, l'étape 3 rend un écran vide et un profil vierge — c'est
le bug d'origine.

**Tests automatiques** (Vitest, sur les fonctions pures, sans réseau) :

- `pendingPush` / `resolveConflict` appliqués aux réglages : une ligne locale
  jamais synchronisée part ; une ligne distante plus récente gagne.
- Le mapping `profile`/`jobProfile` ↔ `user_settings` fait l'aller-retour sans
  perte de champ.
- L'enregistrement écrit bien une entrée d'historique **hors** de tout export
  PDF (verrouille le constat n°1 du §2).
- Le signal de rafraîchissement est émis quand un pull a modifié des données, et
  ne l'est pas quand le pull n'a rien changé.

## 7. Vérification

Protocole standard de `.agents/rules/cadrage.md` §4, après **chaque** task :
`npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, plus
`npx playwright test` en fin de plan puisque l'UI est touchée.

## 8. Le piège à ne pas réintroduire

Si un jour quelqu'un décide de synchroniser le brouillon, voici ce qui l'attend
— constaté dans le code, pas supposé.

`useAutoDraft` passe `isLoaded` à `true` dès la fin de la lecture **locale**.
Toute modification du store déclenche ensuite une sauvegarde débouncée
horodatée `Date.now()`. Sur un appareil neuf, la séquence est :

1. IndexedDB vide → l'éditeur monte le CV modèle ;
2. le profil s'y applique — c'est une modification du store ;
3. auto-sauvegarde d'un « Marc Dubois » horodaté **maintenant** ;
4. le pull arrive ensuite avec le vrai brouillon, horodaté **hier** ;
5. en last-write-wins, le CV modèle gagne — puis **écrase le vrai brouillon sur
   le serveur** à l'envoi suivant.

Ce n'est pas « du travail non enregistré perdu », c'est du travail enregistré
détruit. Toute synchronisation du brouillon exige donc, au minimum, que
l'auto-sauvegarde reste bloquée tant que le premier pull n'est pas revenu (ou
n'a pas échoué).

## 9. Place dans la file SaaS

Ce chantier passe devant les autres : les chantiers A et B servent à rendre la
création de compte obligatoire, or un compte qui ne restitue rien n'a aucune
raison d'être créé. Ordre retenu le 15/08/2026 :

| # | Chantier | Dépend de |
|---|---|---|
| **0** | **Le compte restitue vraiment les données** *(cette spec)* | — |
| A | Connexion hors Google (lien magique / email) | — |
| B | Compte obligatoire + solde de crédits visible | A, 0 |
| C | Page d'accueil / landing | — |
| D | RGPD : suppression de compte et export | — |
| F | Photos de profil vers Supabase Storage | 0 |
| G | Stripe : un plan payant | B, D |

Chaque chantier reçoit sa propre spec puis son propre plan, écrits au moment de
l'attaquer — pas tous d'avance.
