# Le serveur devient la source unique — design

**Date :** 15 août 2026
**Chantier :** 0-bis, remplace le chantier 0 (`2026-08-15-sync-compte-restitution-design.md`)
**Décision propriétaire :** Hariss, 15/08/2026.

> Ce document remplace l'architecture *local-first + réplication* mise en place le
> 11/08/2026. Il ne l'annule pas par principe : il constate ce qu'elle a coûté et
> tranche. Ce qui a été livré aujourd'hui côté interface (bouton « Enregistrer »,
> indicateur d'état, rafraîchissement des écrans) **reste** — c'était un manque
> réel, sans rapport avec la synchronisation.

---

## 1. Le problème

Les données existent aujourd'hui en **deux copies** : IndexedDB dans le
navigateur, PostgreSQL chez Supabase. 740 lignes (`syncEngine.ts`,
`syncMapping.ts`, `syncFields.ts`) n'ont pas d'autre métier que de faire croire
que ces deux copies n'en font qu'une : curseurs de pull, `synced_at`, arbitrage
last-write-wins, purge à la déconnexion, filtrage anti-écrasement.

**Trois pertes de données silencieuses ont été trouvées dans la seule journée du
15/08/2026**, toutes causées par cette dualité :

1. **Le brouillon d'un appareil vierge écrasait un document enregistré.**
   L'auto-sauvegarde locale horodate à `Date.now()` avant le retour du serveur ;
   en last-write-wins, le CV modèle battait le vrai CV, puis repartait l'écraser
   côté serveur. (Analyse : `useAutoDraft.ts`, `isLoaded` posé après la seule
   lecture locale.)
2. **L'interface annonçait « Enregistré sur votre compte » après un refus du
   serveur.** Supabase ne lève pas d'exception quand il refuse une écriture : il
   renvoie un objet `error`. Corrigé le 15/08 (commit `37e4f4a`), mais le défaut
   était structurel — il n'existe que parce qu'un envoi peut échouer sans que
   l'utilisateur écrive quoi que ce soit de travers.
3. **Les CV Maîtres n'étaient répliqués nulle part.** `DocType` vaut
   `"CV" | "Lettre" | "Maître"` (`schema.ts:152`), le schéma distant n'a que
   `resumes` et `letters`, et `pushAll` filtre sur les deux premiers. Un CV
   Maître — la base de toutes les adaptations — n'a jamais quitté l'appareil.

Ces trois-là ont été trouvées. La question posée par le propriétaire est celle
des suivantes : *« il y a sûrement d'autres problèmes que je vais découvrir. »*
C'est le comportement attendu de cette architecture, pas de la malchance.

### 1.1 Ce que le hors-ligne rapporte réellement ici

L'app est un outil d'adaptation de CV par IA. **Sa fonction principale exige le
réseau** : l'IA est distante. Le hors-ligne complet ne permettrait donc que de
relire ses documents, jamais de faire ce pour quoi l'app existe.

Les acteurs qui financent un vrai hors-ligne (Apple Notes/CloudKit, Office,
Linear) le font parce que l'écriture hors ligne **est** leur promesse, et le
payent par des équipes dédiées et des interfaces de conflit visibles (« Le
fichier a été modifié ailleurs — conserver une copie ? »). Google Docs et Notion,
eux, sont en ligne par défaut. Le standard n'est pas « hors-ligne » : le standard
est de le construire quand c'est la promesse, et de s'en passer sinon.

---

## 2. La décision

**Le serveur est la seule source de vérité pour tout ce qui appartient à
l'utilisateur.** Le navigateur ne garde que ce qui ne regarde que cet appareil.

Conséquence directe : `syncEngine.ts`, `syncMapping.ts` et `syncFields.ts` sont
supprimés, ainsi que les champs `synced_at` / `client_updated_at` / `deleted_at`
qui n'existaient que pour eux. Il n'y a plus de conflit à arbitrer, donc plus de
last-write-wins, donc plus de perte silencieuse possible par ce mécanisme.

---

### 2.1 Ce qui survit du chantier 0

Livré le 15/08/2026 et **conservé** : le bouton « Enregistrer » séparé de
l'export PDF, l'indicateur d'état permanent (« Modifications non enregistrées » /
« sur cet appareil » / « sur votre compte »), et `saveDocument.ts`. Ces trois-là
répondaient à un manque réel — un CV n'existait nulle part tant qu'on n'avait pas
téléchargé un PDF — qui n'avait rien à voir avec la synchronisation.

**Remplacé :** `syncEvents.ts` (le signal qui faisait recharger les écrans à
l'arrivée d'un pull) perd son objet, puisqu'il n'y a plus de pull en tâche de
fond. Son rôle est repris par l'invalidation de la mémoire de session (§4.3) :
une écriture invalide ce qu'elle touche, l'écran redemande. Le fichier disparaît.

---

## 3. Ce qui vit où

### 3.1 Sur le serveur (données de l'utilisateur)

| Donnée | Aujourd'hui | Demain |
|---|---|---|
| CV, lettres, **CV Maîtres** enregistrés | `history` (local) + `resumes`/`letters` (distant) | table `documents` |
| Candidatures | `applications` (local + distant) | table `applications` (existante) |
| Offres enregistrées | `jobs` (local) + `saved_jobs` (distant) | table `saved_jobs` (existante) |
| Modèles de lettre | `templates` (local seul) | table `templates` |
| « Mes infos » | `profile` (local seul) | table `user_settings`, ligne `profile` |
| Critères de recherche | `jobProfile` (local seul) | table `user_settings`, ligne `jobProfile` |

### 3.2 Sur l'appareil (rien qui appartienne à l'utilisateur)

| Donnée | Pourquoi elle reste locale |
|---|---|
| `drafts` — le brouillon en cours de frappe | **Décision propriétaire** : modèle LinkedIn. On tape en local, on clique « Enregistrer », ça part. Rien ne traverse le réseau à chaque frappe. |
| `snapshots` — annuler/rétablir | Historique d'édition de la session en cours. Sans valeur hors de l'onglet. |
| `commuteCache` — temps de trajet | Cache d'appels Google Maps payants. L'envoyer coûterait sans rien rendre. |
| `atsDirectory` — annuaire entreprise → ATS | Cache de résolutions, reconstructible. |
| `apiUsage` — compteur d'appels d'offres | Plafond mensuel technique (France Travail, jsearch). Le quota **IA**, lui, est déjà serveur (`consume_ai_credit`). |

### 3.3 Le cas du CV Maître

Le CV Maître est aujourd'hui stocké comme un brouillon (`draft-Maître`,
`master.ts`), donc local — et jamais répliqué (constat 1.3). Or ce n'est pas un
brouillon : c'est la base de référence de toutes les adaptations. Le perdre fait
dériver chaque adaptation à partir du CV réécrit pour l'offre précédente.

**Décision :** le CV Maître devient un document enregistré comme les autres
(`documents`, `doc_type = 'Maître'`), et `master.ts` le lit depuis là. Le
brouillon `draft-Maître` disparaît.

---

## 4. Architecture

### 4.1 Le comptoir ne bouge pas, ce qu'il y a derrière change

Vérifié le 15/08/2026 : **aucun composant ne parle à Dexie directement.** Les 21
fichiers qui touchent au stockage passent tous par les ~42 fonctions exportées
de `db.ts` (`saveHistoryEntry`, `listJobs`, `loadProfile`…).

`db.ts` est donc un comptoir : les écrans commandent, le comptoir va chercher. Le
chantier réécrit **l'intérieur** du comptoir, pas les écrans. C'est ce qui rend
la migration abordable, et c'est la propriété à préserver — aucun composant ne
doit se mettre à appeler Supabase directement.

### 4.2 Liste et détail sont deux demandes différentes

Un écran qui affiche une liste demande **le catalogue** (id, titre, entreprise,
poste, date, type), jamais le contenu. Le document complet — donc la photo — n'est
téléchargé qu'à l'ouverture dans l'éditeur.

C'est le standard du métier (aucun client mail ne télécharge les messages pour
afficher la liste des expéditeurs). Ici, ça rend supportable la limite connue des
**photos en base64 dans le contenu** (`LIMITES.md` §1.1) : une photo ne voyage
plus que quand on ouvre le document concerné. Le chantier « photos vers Storage »
perd sa priorité — il ne disparaît pas.

Le comptoir expose donc, pour les documents, deux familles :
- `listDocuments(...)` → résumés (sans `json`)
- `getDocument(id)` → document complet

### 4.3 La mémoire de session

Sans base locale, chaque changement d'écran repart au réseau. Le comptoir garde
donc en **mémoire** ce qu'il vient de recevoir, et le réaffiche instantanément
tout en revérifiant en arrière-plan.

Trois propriétés à respecter, ce sont elles qui rendent la chose sûre :

1. **La mémoire meurt avec l'onglet.** Elle n'est écrite nulle part sur le
   disque. Elle ne peut donc pas montrer les données d'un compte au compte
   suivant, ni rester périmée pendant des jours.
2. **Toute écriture invalide ce qu'elle touche.** Le comptoir étant le seul
   chemin, l'invalidation est centralisée et fiable — c'est précisément ce qui
   serait fragile si les écrans se servaient eux-mêmes.
3. **Ce n'est pas une seconde source de vérité.** En cas de doute, le serveur
   tranche ; la mémoire n'a jamais raison contre lui.

Pas de dépendance npm (React Query, SWR) : le cadrage l'interdit sans instruction
explicite, et le besoin ici tient en quelques dizaines de lignes dans le comptoir.

### 4.4 Le navigateur parle directement à Supabase

La sécurité repose sur RLS, déjà en place et éprouvé
(`0001_auth_quotas.sql`, policies `*_own`) : le serveur refuse de rendre les
lignes d'un autre utilisateur. Intercaler des routes Next.js signifierait écrire
une quarantaine de petits services sans bénéfice — la validation utile est déjà
côté base.

**Écarté :** convertir les écrans en composants serveur Next.js. L'app est très
interactive (aperçu PDF en direct, éditeur, chat) ; ce serait une réécriture
bien plus large que le remplacement du comptoir, pour un bénéfice invisible.

### 4.5 Sans compte

L'éditeur fonctionne : on tape, on importe, on prévisualise, le brouillon est
local. C'est **« Enregistrer » qui exige la connexion**, ainsi que tout écran qui
lit des données du compte (« Mes candidatures », « Mes CV »).

Ça prépare directement le chantier B (compte obligatoire) : la porte devient
naturelle au lieu d'être un barrage.

---

## 5. Le schéma serveur

### 5.1 Une table `documents` au lieu de `resumes` + `letters`

Le découpage actuel est un héritage du moteur de synchronisation, qui triait par
type au moment de l'envoi. Sans moteur, il ne produit que du travail : deux
requêtes à recoller pour tout écran de liste, chaque champ ajouté deux fois, et
un troisième type de document (le CV Maître) **déjà** perdu entre les deux.

```
documents(user_id, id, doc_type, title, company, role, label,
          content jsonb, template_id, application_id,
          notes, created_at, updated_at)
PK (user_id, id) — RLS "documents_own" identique aux tables existantes.
```

`doc_type` porte `'CV' | 'Lettre' | 'Maître'`. Plus de `client_updated_at`,
`synced_at` ni `deleted_at` : sans réplication, l'horloge serveur suffit et une
suppression est une suppression.

**Reprise :** les lignes de `resumes` et `letters` sont recopiées dans
`documents` par une commande SQL unique. **Les deux anciennes tables sont
conservées** jusqu'à vérification — la bascule est réversible.

### 5.2 Les autres tables

- `applications`, `saved_jobs` : **conservées telles quelles.** Elles sont déjà
  uniques et suffisantes ; les toucher élargirait le chantier sans gain.
- `templates` : table neuve (`user_id, id, name, subject, body, updated_at`).
  ⚠️ Les modèles d'usine ne sont posés que si **le compte** n'en a aucun. Le
  drapeau actuel `pack-templates-v4` est stocké dans le `localStorage`, donc par
  appareil : gardé tel quel, il réinstallerait les modèles d'usine par-dessus
  ceux du compte sur chaque nouvelle machine.
- `user_settings` : deux lignes par utilisateur, `profile` et `jobProfile`. La
  migration `0002_user_settings.sql` écrite ce matin **n'a pas été appliquée** et
  reste valable ; elle est reprise telle quelle.

---

## 6. La reprise des données existantes

L'app est en production depuis le 13/07/2026. Des utilisateurs peuvent avoir des
données uniquement dans leur navigateur. Basculer sans rien faire les leur ferait
disparaître de l'écran — sans les détruire, mais sans moyen de les retrouver.

**À la première connexion suivant la mise en ligne**, si des données locales
existent, elles sont envoyées vers le compte, une fois, puis marquées comme
reprises. Le code d'envoi existant (`pushAll`) sert une dernière fois à ce qu'il
sait faire, avant d'être supprimé avec le reste du moteur.

Un utilisateur non connecté qui a des données locales est invité à créer un
compte pour les conserver — jamais dépossédé en silence.

---

## 7. Quand le serveur ne répond pas

**Retenu :** message honnête et bouton « Réessayer », par écran concerné —
« Impossible de charger vos documents. Vérifiez votre connexion. » Le reste de
l'app continue : l'éditeur et le brouillon local sont intacts. Une écriture qui
échoue le dit et l'état reste « Modifications non enregistrées » ; jamais
d'annonce de succès non vérifiée (leçon du constat 1.2).

Combiné à la mémoire de session (§4.3), le cas fréquent — naviguer entre écrans —
est instantané, et le cas rare — vraie coupure — est dit franchement.

**Suite prévue, hors périmètre : la copie de secours sur disque.** Une copie en
**lecture seule** des derniers documents chargés, affichée avec un bandeau
« données d'il y a N heures » quand le serveur est injoignable. Elle ne peut pas
créer de conflit (on n'écrit jamais hors ligne), son seul coût est de devoir être
vidée à la déconnexion. **Point de branchement : à l'intérieur du comptoir**, là
où la mémoire de session est lue — aucun écran à modifier. À décider une fois le
serveur seul éprouvé.

---

## 8. Hors périmètre

- Le compte obligatoire (chantier B), la connexion hors Google (A), la landing
  (C), le RGPD (D), Stripe (G). Ce chantier les prépare, ne les fait pas.
- Les photos vers Supabase Storage : dépriorisé par §4.2, non supprimé.
- Toute modification du moteur d'adaptation IA, du rendu PDF, de la recherche
  d'offres.

---

## 9. Critères de succès

Vérifiables, dans cet ordre :

1. **Deux navigateurs, même compte.** Sur A : remplir « Mes infos », enregistrer
   un CV, un CV Maître et un modèle de lettre personnalisé. Sur B, après
   connexion : les quatre sont là. Aucun rechargement de page nécessaire.
2. **Le catalogue est léger.** L'ouverture de « Mes candidatures » ne télécharge
   aucun contenu de document (vérifiable dans l'onglet réseau : les réponses ne
   contiennent pas de photo base64). Le contenu n'arrive qu'au clic sur
   « Ouvrir dans l'éditeur ».
3. **Reprise.** Un navigateur portant des données locales d'avant la bascule les
   retrouve sur son compte après une connexion, et une seule fois.
4. **Panne franche.** Réseau coupé : l'écran des documents affiche le message et
   le bouton « Réessayer », l'éditeur continue de fonctionner, et un
   enregistrement échoué n'annonce jamais « Enregistré sur votre compte ».
5. **Le moteur est bien parti.** `syncEngine.ts`, `syncMapping.ts` et
   `syncFields.ts` n'existent plus, et aucun `synced_at` ne subsiste dans le code.
6. **Le comptoir tient.** Aucun composant n'importe le client Supabase
   directement ; tout passe par `db.ts`.

---

## 10. Ce que ce chantier supprime

- `syncEngine.ts` (449 l.), `syncMapping.ts` (242 l.), `syncFields.ts` (49 l.).
- Les curseurs `sync_cursor_*` et `sync_user_id` du `localStorage`.
- `purgeLocalData`, `ensureMatchingUser`, `filterOutStalePush`, `resolveConflict`,
  `mergeRemoteHistory`, `sanitizeImportedItem`.
- Les tables Dexie `history`, `jobs`, `applications`, `templates`, `profile`,
  `jobProfile`.
- La limite « conflits hors-ligne last-write-wins » de `LIMITES.md` §1.1, qui
  cesse d'exister — à barrer avec la date, pas à supprimer.
