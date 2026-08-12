# 📖 Le jargon du chantier « comptes + base de données », expliqué depuis zéro

> **Pour qui** : toi, qui pilotes le projet et fais coder les agents, sans être développeur.
> **Objectif** : qu'aucun mot de la revue technique du 10/08/2026 ne te soit opaque, et
> surtout que tu comprennes **pourquoi** chaque problème signalé est un problème.
>
> Ce document remplace l'ancien guide de configuration. Les étapes de configuration
> pas-à-pas (Supabase, Google Cloud, `.env.local`) sont conservées en **Annexe A**.

---

## 0. La carte mentale : où vivent les données aujourd'hui, et où elles vivront demain

Avant le vocabulaire, il faut la géographie. Aujourd'hui, Cvmatchr a **deux endroits** où
du code s'exécute. Demain il y en aura **trois**.

### Aujourd'hui

**1. Le navigateur de l'utilisateur (« le client »)**
C'est Chrome ou Firefox, sur le PC de la personne. C'est là que s'affiche l'interface,
que l'utilisateur tape son CV, et — point crucial — **c'est là que ses données sont
stockées**, dans une petite base de données intégrée au navigateur. Si la personne vide
le cache de son navigateur ou change d'ordinateur, tout est perdu. C'est la limite n°1
que ce chantier veut lever.

**2. Le serveur (« le back »)**
Un ordinateur distant qui fait tourner l'application. Aujourd'hui il ne stocke rien : il
sert juste les pages, et il sert d'intermédiaire vers les IA (Gemini, Anthropic). Pourquoi
un intermédiaire ? Parce que la clé d'API de l'IA ne doit jamais être visible dans le
navigateur — sinon n'importe qui l'inspecterait et la volerait. Donc le navigateur dit au
serveur « adapte ce CV », et c'est le serveur qui parle à Gemini.

### Demain, on ajoute

**3. Supabase**
Un troisième ordinateur, hébergé par une société tierce, qui fait deux choses :
- il **stocke** les CV, lettres, candidatures de manière permanente et par utilisateur ;
- il **gère les comptes** (le « Connexion avec Google »).

L'intérêt : les données survivent au navigateur, et suivent l'utilisateur d'un appareil
à l'autre.

```
   NAVIGATEUR                    SERVEUR Next.js                  SUPABASE
   (chez l'utilisateur)          (ton app déployée)               (base + comptes)
   ┌──────────────┐              ┌──────────────┐                 ┌──────────────┐
   │  Interface   │─────────────▶│  Routes API  │────────────────▶│  PostgreSQL  │
   │  React       │              │  (IA, etc.)  │                 │  + Auth      │
   │              │              └──────┬───────┘                 └──────────────┘
   │  IndexedDB   │                     │                                 ▲
   │  (Dexie)     │                     ▼                                 │
   │              │              ┌──────────────┐                         │
   └──────┬───────┘              │ Gemini /     │                         │
          │                      │ Anthropic    │                         │
          └──────────────────────┴──────────────┴─────────────────────────┘
                     SyncEngine : copie le local vers Supabase
```

Retiens cette image : **quasiment tous les problèmes de la revue viennent de la frontière
entre ces trois boîtes** — qui a le droit de faire quoi, et qui peut mentir à qui.

---

## 1. Le vocabulaire de la base de données

### Base de données
Un classeur Excel très rigide et très rapide. On y range des informations sous forme de
tableaux, et on peut poser des questions du type « donne-moi tous les CV de cet
utilisateur, triés par date ».

### PostgreSQL (souvent abrégé « Postgres »)
Le nom du logiciel de base de données choisi. C'est le standard de l'industrie pour ce
type de projet : gratuit, très fiable, très puissant. Supabase, c'est essentiellement
« PostgreSQL hébergé pour toi, avec des services autour ».

### Supabase
La société/le produit qui héberge le PostgreSQL, gère les connexions Google, et fournit
du code prêt à l'emploi pour parler à tout ça. C'est l'alternative open-source à Firebase
de Google.

### Table
Un onglet du classeur. `resumes` = l'onglet des CV. `profiles` = l'onglet des utilisateurs.
Le projet en prévoit 6 : `profiles`, `resumes`, `letters`, `applications`, `saved_jobs`,
`api_usage`.

### Colonne (ou « champ »)
Une colonne du tableau. Dans `resumes` : `title`, `content`, `created_at`… Chaque colonne
a un **type** imposé : du texte, un nombre, une date. Impossible de mettre du texte dans
une colonne « nombre » — c'est ce qui rend une base fiable là où Excel te laisse faire
n'importe quoi.

### Ligne (ou « enregistrement »)
Une entrée. Un CV = une ligne dans `resumes`.

### Schéma
Le **plan** de la base : la liste des tables, leurs colonnes, leurs types, leurs règles.
Quand je dis « le schéma est faux », je veux dire « le plan du bâtiment a un problème »,
pas « il y a un bug dans le code ». Un schéma se corrige beaucoup plus facilement avant
d'avoir des utilisateurs qu'après.

### Types de colonnes cités dans le spec
- `TEXT` : du texte, longueur libre.
- `INT` : un nombre entier (le compteur d'appels IA).
- `BOOLEAN` : vrai/faux.
- `UUID` : un identifiant unique très long, du genre `a3f9c1e2-...`. Impossible à deviner,
  donc impossible d'aller « fouiller » le compte du voisin en tapant un numéro au hasard.
- `TIMESTAMPTZ` : une date + heure + fuseau horaire. Le `TZ` compte : sans lui, un
  utilisateur au Japon et un en France se marchent dessus.
- `JSONB` : **une colonne qui contient un document entier**, avec sa propre structure
  interne. C'est là que le CV complet est rangé (expériences, formations, compétences…)
  plutôt que d'éclater tout ça en 15 tables. Pratique et souple ; l'inconvénient est que
  la base ne vérifie rien du contenu, et que ça peut devenir volumineux — d'où mon alerte
  sur les photos en base64 (voir §12).

### Clé primaire (PK)
La colonne qui identifie une ligne de façon unique — le « numéro de sécurité sociale » de
la ligne. La base **refuse** deux lignes avec la même clé primaire.

👉 **C'est là qu'est le problème n°9 de ma revue.** Dans le spec, l'identifiant d'un CV
est unique **pour toute la base**, alors que ces identifiants sont fabriqués par le
navigateur de chaque utilisateur. Si tu partages ton fichier de sauvegarde avec un ami et
qu'il l'importe, son CV porte le même identifiant que le tien → la base le rejette. Et
comme il ne peut pas voir ton CV (sécurité), il reçoit une erreur incompréhensible.
La correction : rendre l'identifiant unique **par utilisateur** (« clé primaire
composite » : la paire utilisateur + identifiant).

### Clé étrangère (FK)
Un lien entre deux tables. `resumes.user_id` pointe vers l'utilisateur propriétaire. La
base garantit que ce lien reste valide.

### `ON DELETE CASCADE`
Une règle attachée à ce lien : « si l'utilisateur est supprimé, supprime aussi
automatiquement tous ses CV ». Utile, et important pour le RGPD (§13).

### Index
Un répertoire alphabétique posé sur une colonne. Sans index, chercher « les CV de Hariss »
oblige la base à lire les 100 000 lignes une par une. Avec, elle va directement au bon
endroit. Ça n'ajoute aucune fonctionnalité — juste de la vitesse. Le coût : chaque écriture
devient un peu plus lente, car il faut aussi mettre le répertoire à jour.

### Contrainte `UNIQUE`
« Interdit d'avoir deux lignes identiques sur ces colonnes-là. » Dans `api_usage`, la
contrainte `UNIQUE (user_id, endpoint, period_start)` signifie : un seul compteur par
(utilisateur, fonctionnalité, mois). C'est ce qui rend l'incrémentation fiable — voir
« atomique » juste en dessous.

### Migration
**Le mot le plus important de cette section.** Une migration est un fichier qui décrit un
changement de schéma : « ajoute la table X », « ajoute la colonne Y ». Elle est numérotée,
versionnée dans Git, et rejouée à l'identique sur chaque environnement (ton PC, la
préprod, la production).

Pourquoi c'est vital : sans migration, tu modifies ta base à la main dans l'interface web
de Supabase. Trois mois plus tard, personne ne sait plus quel est l'état réel de la base,
tu ne peux pas revenir en arrière, et tu ne peux pas recréer une base de test identique.
C'est la dette technique la plus classique et la plus douloureuse d'un projet.

👉 **C'est le bloquant n°2 de ma revue** : le plan d'implémentation contient 150 lignes de
SQL dans le document de spec… et **aucune tâche pour les transformer en fichier de
migration et l'appliquer**. Les 5 tâches du plan supposent une base qui n'existera jamais.
Le guide en Annexe A dit « colle le SQL dans le SQL Editor et clique Run » — ça marche
pour un test, mais c'est exactement l'anti-pattern décrit ci-dessus.

### SQL
Le langage pour parler à la base. `SELECT` = lire, `INSERT` = ajouter, `UPDATE` = modifier,
`DELETE` = supprimer, `CREATE TABLE` = créer une table.

### UPSERT / `ON CONFLICT DO UPDATE`
« Insère cette ligne ; si elle existe déjà, mets-la à jour à la place. » Une seule
instruction pour les deux cas.

### Atomique
Une opération est atomique si elle est **indivisible** : soit elle se fait entièrement,
soit pas du tout, et personne ne peut se glisser au milieu.

L'exemple concret du projet : incrémenter le compteur d'appels IA. La version naïve serait
« lis le compteur (12), ajoute 1, écris 13 ». Si l'utilisateur clique deux fois très vite,
les deux opérations lisent 12 en même temps, et écrivent toutes les deux 13. Un appel est
perdu — l'utilisateur a consommé 2 crédits, tu n'en as compté qu'un. À l'échelle, ça se
transforme en abus. La fonction `increment_user_ai_usage` du spec fait bien la chose en une
seule instruction atomique. **C'est un bon point du spec.**

---

## 2. Le vocabulaire de la sécurité côté base

C'est la partie où le spec se trompe le plus lourdement, donc lis-la lentement.

### Le problème de fond : le navigateur n'est pas de confiance

Quand ton application tourne dans le navigateur de quelqu'un, **cette personne peut faire
absolument tout ce qu'elle veut avec**. Elle peut ouvrir la console de développement
(touche F12), lire tout ton code, voir toutes les clés que tu y as mises, et **envoyer à
ta base des commandes que ton interface ne propose pas**.

Retiens ça : *tout ce qui est envoyé depuis le navigateur peut être fabriqué de toutes
pièces par l'utilisateur*. Toute règle qui n'est appliquée que par ton interface n'est pas
une règle, c'est une suggestion.

### Clé `anon` (clé anonyme / publique)
La clé que Supabase te donne pour que le navigateur puisse parler directement à la base.
Elle est **publiquement visible** — c'est prévu, ce n'est pas une faille. Son nom complet
est « anon **public** key ». Ce qui protège les données, ce n'est pas le secret de cette
clé : c'est le RLS ci-dessous.

### Clé `service_role`
La clé **maîtresse**, qui contourne toutes les règles de sécurité. Elle ne doit **jamais**
sortir du serveur. Si elle fuit dans le navigateur, n'importe qui lit et modifie toute ta
base. C'est la clé qu'on utilise côté serveur pour les opérations de confiance — par
exemple créditer/débiter un quota.

### RLS = Row Level Security = « sécurité au niveau de la ligne »
Le mécanisme central. Il dit à PostgreSQL : « même si quelqu'un demande TOUS les CV, ne
lui renvoie que **ses** lignes à lui ». La règle est appliquée par la base elle-même, pas
par ton code. C'est ce qui rend acceptable le fait que la clé `anon` soit publique.

Sans RLS activé, un utilisateur peut lire les CV de tout le monde en une commande. Avec
RLS mal configuré, il peut faire pire : les modifier.

### Policy (« politique »)
Une règle RLS concrète. Elle précise **qui** peut faire **quoi**.

```sql
CREATE POLICY "Resumes access" ON public.resumes FOR ALL USING (auth.uid() = user_id);
```

Traduction mot à mot :
- `ON public.resumes` → sur la table des CV,
- `FOR ALL` → pour **toutes** les opérations : lire, ajouter, modifier, supprimer,
- `USING (auth.uid() = user_id)` → à condition que l'identifiant de la personne connectée
  soit égal au propriétaire de la ligne.

Pour la table des CV, c'est correct : c'est normal que tu puisses modifier et supprimer tes
propres CV.

👉 **Mais c'est le bloquant n°3 de ma revue**, parce que le spec applique **exactement la
même règle** à deux tables où elle est catastrophique :

**`api_usage`** — le compteur d'appels IA. Avec `FOR ALL`, l'utilisateur a le droit de
**modifier son propre compteur**. Il ouvre la console du navigateur et tape :

```js
await supabase.from('api_usage').update({ count: 0 })
```

Son quota est remis à zéro. Il recommence tous les jours. Or le spec écrit noir sur blanc
que les consommations sont enregistrées « de façon **infalsifiable** ». C'est l'inverse.
**Le correctif** : sur cette table, l'utilisateur ne doit avoir le droit que de *lire*
(`FOR SELECT`) ; seul le serveur écrit.

**`profiles`** — où sont rangés `plan_tier` (gratuit/pro) et `monthly_quota_limit` (15).
Même règle `FOR ALL` → l'utilisateur peut se déclarer lui-même client Pro illimité :

```js
await supabase.from('profiles').update({ plan_tier: 'unlimited', monthly_quota_limit: 999999 })
```

Ton modèle économique entier tient sur une ligne que le client peut réécrire. **Le
correctif** : l'utilisateur peut modifier son nom d'affichage, pas son plan. Ça se fait
soit en restreignant les colonnes modifiables, soit par un garde-fou côté base qui refuse
tout changement sur ces deux colonnes-là.

### `USING` vs `WITH CHECK`
`USING` filtre les lignes **existantes** (que puis-je voir/modifier ?). `WITH CHECK` valide
les lignes **entrantes** (ai-je le droit d'écrire ça ?). Quand `WITH CHECK` est absent,
PostgreSQL réutilise `USING` — donc sur ce point précis le spec n'a pas de faille, contrairement
à ce qu'on pourrait croire. Je le mentionne pour que tu ne t'inquiètes pas si un autre
agent te le signale comme un bug : ce n'en est pas un.

### Fonction SQL
Un petit programme stocké **dans** la base, qu'on peut appeler par son nom. Le spec en
définit trois : créer un profil à l'inscription, incrémenter le compteur, lire la
consommation du mois.

### `SECURITY DEFINER`
Une option sur ces fonctions qui signifie : « quand cette fonction s'exécute, elle a les
droits de son **auteur** (l'administrateur), pas ceux de l'appelant ».

C'est exactement le bon outil pour le compteur : l'utilisateur ne peut pas toucher à
`api_usage` directement (RLS en lecture seule), mais il peut appeler la fonction
`increment_user_ai_usage`, qui elle a le droit d'écrire. La fonction agit comme un guichet :
tu ne rentres pas dans le coffre, tu passes par l'employé.

### `SET search_path`
Un détail technique avec une vraie conséquence. Le `search_path` dit à PostgreSQL « où
chercher les tables dont on te donne le nom sans préciser l'emplacement ». Une fonction
`SECURITY DEFINER` sans `search_path` figé peut, dans certains scénarios, être détournée
pour exécuter du code avec les droits administrateur. C'est un point que **l'outil d'audit
de Supabase lui-même signale automatiquement**. Correctif : une ligne à ajouter sur chaque
fonction.

### Trigger (« déclencheur »)
Une règle du type « quand X arrive, fais automatiquement Y ». Le spec en utilise un très
bien vu : *quand un nouvel utilisateur s'inscrit via Google, crée automatiquement sa ligne
dans `profiles` avec 15 crédits*. Sans ça, il faudrait y penser dans le code, et un oubli
donnerait des utilisateurs sans profil. **Bon point du spec.**

### RPC
« Remote Procedure Call » — appeler une fonction stockée dans la base depuis le code de
l'application. C'est le mécanisme par lequel le serveur déclenchera
`increment_user_ai_usage`.

---

## 3. Le vocabulaire du stockage local (dans le navigateur)

### IndexedDB
La base de données **intégrée à chaque navigateur**. Chrome, Firefox et Safari en ont tous
une. C'est là que vivent aujourd'hui 100 % des données de Cvmatchr. Elle est propre à un
navigateur sur une machine : rien n'est partagé entre ton PC et ton téléphone.

### Dexie
Une bibliothèque qui rend IndexedDB utilisable. IndexedDB brut est notoirement pénible à
programmer ; Dexie pose une couche simple par-dessus. Dans le code, `db.history`,
`db.applications`, `db.jobs` sont des tables Dexie.

### Version de schéma Dexie (`version(12)`, `version(13)`…)
Le pendant local des migrations. Chaque fois qu'on change la structure du stockage local, on
ajoute une version numérotée. Quand un utilisateur qui avait la v11 ouvre l'app passée en
v13, Dexie exécute automatiquement les mises à jour 12 puis 13 dans son navigateur.

Le projet est aujourd'hui en **v12**. Le plan ajoute la **v13**. Point d'attention : ces
migrations tournent chez l'utilisateur, sur des données que tu ne peux pas inspecter. Une
migration ratée casse l'app pour lui, et tu ne le sauras jamais.

### `store` (au sens Dexie)
Le mot de Dexie pour « table ». À ne pas confondre avec le « store » de Zustand (§5), qui
n'a rien à voir. C'est une collision de vocabulaire malheureuse mais très courante.

---

## 4. Le vocabulaire de la synchronisation

C'est le cœur technique du chantier, et la partie la plus incomplète des deux documents.

### Offline-first (« hors-ligne d'abord »)
Le principe retenu : l'application écrit **toujours** en local d'abord, instantanément, et
recopie vers le serveur en arrière-plan. Avantage : aucune latence, ça marche dans le
métro. Inconvénient : il faut réconcilier deux copies qui peuvent diverger — d'où tout ce
qui suit.

### Push / Pull
- **Push** = envoyer les modifications locales vers Supabase.
- **Pull** = télécharger les modifications du serveur vers le local.

👉 **C'est l'angle mort n°6 de ma revue.** Le plan implémente le push. Il n'implémente
**pas** le pull. Or sans pull, il n'y a pas de multi-appareil : tu te connectes sur ton
téléphone, il ne se passe rien, l'écran est vide. Le spec promet pourtant explicitement
« Multi-appareils ». C'est la moitié la plus difficile du travail, et elle est absente des
deux documents.

### Delta
« Ce qui a changé depuis la dernière fois ». Plutôt que de renvoyer les 200 CV à chaque
synchro, on ne renvoie que les 3 modifiés. La fonction `prepareSyncDelta()` du plan fait ça.

### `synced_at`
Un marqueur posé sur chaque élément : « dernière fois où cet élément a été copié vers le
serveur ». La règle du delta est simple : si `updated_at` (dernière modification) est plus
récent que `synced_at` (dernier envoi), c'est qu'il faut renvoyer l'élément.

### Soft delete (« suppression douce ») et tombstone (« pierre tombale »)
Au lieu d'effacer réellement une ligne, on inscrit une date dans une colonne `deleted_at`,
et l'interface fait comme si elle n'existait plus. La ligne morte qui reste s'appelle une
tombstone.

Pourquoi ce détour ? Parce que **la suppression est la seule action qui ne laisse aucune
trace à synchroniser**. Si tu supprimes vraiment un CV sur ton PC, ton téléphone n'a aucun
moyen d'apprendre qu'il a disparu — il ne voit qu'une absence, qu'il interprète comme « ce
CV n'a jamais été envoyé » et le **renvoie**. Le CV supprimé ressuscite.

👉 **C'est l'angle mort n°7 de ma revue.** Le plan ajoute bien la colonne `deleted_at`,
mais le code actuel continue de supprimer réellement (`db.history.delete` à la ligne 331 de
`db.ts`, `db.applications.delete` à la ligne 630). Aucune tâche ne convertit ces
suppressions. Résultat garanti : **les CV supprimés reviendront**.

### Conflit et « last-write-wins »
Tu modifies le même CV sur ton PC et sur ton téléphone, hors-ligne. Les deux se
reconnectent. Laquelle des deux versions gagne ?

« Last-write-wins » (le dernier qui écrit gagne) est la réponse la plus simple : on garde
la version dont la date est la plus récente, et on jette l'autre sans prévenir. C'est
acceptable pour ce projet, mais **il faut le décider explicitement** — les deux documents
ne mentionnent pas le sujet, ce qui veut dire que l'agent inventera quelque chose.

Nuance importante : cette approche repose sur **l'horloge du PC de l'utilisateur**. Un
poste mal réglé (décalé de 2 heures) fera systématiquement gagner ou perdre ses
modifications. C'est pour ça que je recommande un garde-fou côté base qui repose l'heure
au moment de l'écriture.

### Le trou de sécurité du changement de compte
Un scénario que ni le spec ni le plan ne traitent : tu te déconnectes, ton colocataire se
connecte sur le même navigateur. Le code du plan vide l'état de connexion **mais ne vide
pas IndexedDB**. Ton colocataire voit donc tes CV, et la synchro les **envoie sur son
compte Supabase à lui**. C'est une fuite de données réelle, pas théorique. Décision à
prendre : purger le local à la déconnexion, ou cloisonner le local par utilisateur.

---

## 5. Le vocabulaire Next.js / React

### React
La bibliothèque qui construit l'interface. Tu décris à quoi l'écran doit ressembler en
fonction des données, et React se charge de le redessiner quand les données changent.

### Composant
Un morceau d'interface réutilisable, avec son code et son apparence. `<UserMenu />` est le
composant « bouton Se connecter / avatar + menu ». Les composants s'imbriquent comme des
Lego.

### Next.js
Le cadre (framework) qui organise l'application React : les pages, les adresses, le code
serveur. ⚠️ Le projet utilise **Next.js 16**, une version récente dont les conventions
diffèrent de ce que la plupart des agents IA « connaissent » — c'est précisément
l'avertissement de `web/AGENTS.md`.

### Route
Une adresse de l'application. `/editeur` est une route de page. `/api/tailor-resume` est
une **route API**.

### Route API (« endpoint »)
Une adresse qui ne renvoie pas une page mais une réponse machine. C'est le guichet par
lequel le navigateur demande un service au serveur. Le projet en a 13 aujourd'hui
(`adapt-letter`, `ats-score`, `editor-chat`, `tailor-resume`, `extract-job`…). Chacune est
un fichier `route.ts`.

**« Endpoint » est le mot le plus important de la partie quota**, parce que le compteur du
spec compte **par endpoint**. Voir §11.

### App Router
La façon dont Next.js 16 organise les routes : chaque dossier est un segment d'adresse.
`src/app/auth/callback/route.ts` répond donc à l'adresse `/auth/callback`.

### Server Component / Client Component
Next.js exécute une partie du code sur le serveur (avant l'envoi au navigateur) et une
partie dans le navigateur. Un composant qui a besoin de réagir aux clics doit être un
composant client — d'où la ligne `'use client'` en tête de `UserMenu.tsx`.

Pourquoi ça compte ici : **le code serveur n'a accès ni au navigateur, ni à la mémoire du
navigateur**. C'est la racine du bug expliqué au §5-« hydraté ».

### Middleware
Un **poste de contrôle** placé avant toutes les routes. Chaque requête passe par lui avant
d'atteindre sa destination, et il peut la laisser passer, la modifier, ou la rediriger.

👉 **C'est le bloquant n°5 de ma revue.** Aujourd'hui, `web/src/middleware.ts` contient la
protection par mot de passe du déploiement distant (`REMOTE_AUTH_PASSWORD`) : sans le bon
cookie, tu es redirigé vers `/login`. La tâche 1 du plan **remplace intégralement ce
fichier** par le code de session Supabase. Résultat : si l'app est déployée avec le mot de
passe activé, **cette protection disparaît sans aucun message**, et les pages `/login` et
`/api/login` deviennent des vestiges morts. Ce n'est mentionné nulle part dans le plan. Il
faut choisir consciemment : soit on combine les deux contrôles, soit on supprime
proprement l'ancien.

### Matcher
La liste des adresses auxquelles le middleware s'applique. Le matcher proposé par le plan
couvre aussi les routes `/api/*`, ce qui ajoute un appel réseau vers Supabase à **chaque**
appel IA — de la latence gratuite sur les fonctions les plus lentes de l'app.

### Layout
Le cadre commun à toutes les pages : l'en-tête, la navigation, le pied de page. C'est là
qu'on monte les choses qui doivent exister partout.

👉 Point de la revue : le plan **crée** le composant `<UserMenu />` mais ne le place dans
aucun layout. Personne ne le verra jamais. C'est un composant orphelin.

### Build vs Runtime
- **Build** = la phase de compilation, avant le déploiement. C'est là que les erreurs de
  type sont détectées.
- **Runtime** = quand l'app tourne pour de vrai chez l'utilisateur.

Un problème détecté au build coûte 2 minutes. Le même problème détecté au runtime, c'est un
utilisateur qui voit un écran blanc.

### Variables d'environnement, et le préfixe `NEXT_PUBLIC_`
Des réglages fournis à l'application au démarrage plutôt qu'écrits dans le code : URL de
Supabase, clés d'API. Elles vivent dans `.env.local` en local, et dans les réglages de
l'hébergeur en production.

**La règle à connaître** : dans Next.js, une variable préfixée `NEXT_PUBLIC_` est
**recopiée dans le code envoyé au navigateur**. Elle est donc publique, définitivement.
`NEXT_PUBLIC_SUPABASE_ANON_KEY` est légitimement publique. Mais **ne jamais** préfixer
`NEXT_PUBLIC_` une clé Gemini, une clé Anthropic ou la clé `service_role`.

Deuxième conséquence, plus subtile : ces variables sont figées **au moment du build**, pas
lues au démarrage. Les changer en production impose de reconstruire l'application.

👉 Point de la revue lié : le code du plan écrit `process.env.NEXT_PUBLIC_SUPABASE_URL!`.
Ce point d'exclamation signifie en TypeScript « fais-moi confiance, cette valeur existe ».
Si elle n'existe pas — cas normal pour quelqu'un qui lance le projet sans compte Supabase —
le code plante. Or une contrainte explicite du plan dit que **le mode local doit continuer
à fonctionner sans casse pour les invités**. Le plan se contredit lui-même : son
middleware vérifie prudemment que les variables existent, mais ses deux autres fichiers
non.

---

## 6. Zustand, et ce que veut dire « le store n'est pas hydraté »

Tu m'as cité ce terme, et c'est le plus important à comprendre, parce qu'il explique le
**bloquant n°1** — celui qui fait que le quota ne fonctionnera pas du tout.

### Zustand
Une petite bibliothèque qui range **l'état de l'application dans le navigateur** : est-ce
que l'utilisateur est connecté ? quel modèle d'IA a-t-il choisi ? quelle clé API a-t-il
saisie dans les Paramètres ? Ce rangement s'appelle un **store**. Le projet en a plusieurs :
`settingsStore` (les paramètres), `uiStore` (les fenêtres), et le plan ajoute `authStore`.

### « Hydrater »
Remplir le store avec les vraies valeurs de l'utilisateur (lues depuis le navigateur) au
démarrage de l'application. Avant l'hydratation, le store contient ses **valeurs par
défaut** : vide, nul, zéro.

### Le bug, concrètement

Le store Zustand vit **dans le navigateur**. Le serveur ne le voit pas — il ne peut pas, il
n'a pas accès au navigateur de l'utilisateur.

Or voici le code réel du projet, dans `web/src/lib/ai/clients.ts` :

```ts
const { activeModel, geminiKey } = useSettingsStore.getState();  // ← côté SERVEUR
// ...
const key = geminiKey || process.env.GEMINI_API_KEY || "";
```

Ce code s'exécute sur le serveur. Il demande au store la clé de l'utilisateur. Mais sur le
serveur, **le store n'est jamais hydraté** : il renvoie sa valeur par défaut, c'est-à-dire
une chaîne vide. Le `||` (« ou sinon ») bascule donc systématiquement sur
`process.env.GEMINI_API_KEY` — **la clé Gemini de l'application, celle que tu paies**.

C'est pour ça que le code envoie la clé de l'utilisateur dans un en-tête HTTP (`X-Api-Key`,
voir §11) : c'est le seul moyen de la faire voyager du navigateur vers le serveur.

**Traduction en langage business** : aujourd'hui, n'importe quel visiteur anonyme, sans
compte et sans clé personnelle, utilise ta clé Gemini gratuitement. Le spec écrit
explicitement que c'est interdit (règle §1.1). Et **après avoir exécuté les 5 tâches du
plan, ce sera toujours le cas**, parce qu'aucune tâche ne modifie ce fichier ni aucune des
13 routes API.

Le plan crée bien une fonction `evaluateQuotaRules()` qui décide correctement qui a le
droit de quoi… mais **personne ne l'appelle jamais**. C'est un videur embauché, formé,
payé, et laissé dans le vestiaire. Le plan annonce même dans ses « Interfaces » produire
une fonction `checkAndIncrementAiQuota()` qui n'est écrite nulle part.

C'est le point que je corrigerais en priorité absolue.

---

## 7. Le vocabulaire de l'authentification

### Authentification vs Autorisation
- **Authentification** : *qui es-tu ?* (la connexion Google).
- **Autorisation** : *as-tu le droit de faire ça ?* (le RLS, les quotas).

Les deux sont indépendants. On peut parfaitement savoir qui tu es et te refuser l'accès.

### OAuth
Le protocole standard du « Se connecter avec Google ». L'intérêt : **ton application ne
voit jamais le mot de passe Google de l'utilisateur**. Google authentifie la personne de
son côté, puis renvoie à ton app un jeton disant « c'est bien elle ». Tu n'as donc aucun
mot de passe à stocker, ni à protéger, ni à réinitialiser.

### Le flux, étape par étape
1. L'utilisateur clique « Se connecter ».
2. Il est envoyé chez Google.
3. Il s'identifie et accepte le partage de son nom/email/photo.
4. Google le renvoie sur **une adresse de ton app** avec un `code` temporaire.
5. Ton serveur échange ce `code` contre une **session**.

### Callback (`/auth/callback`)
L'adresse de l'étape 4. La page où Google raccompagne l'utilisateur. Elle doit être
déclarée à l'avance dans la Console Google (c'est la « redirect URI »), sinon Google refuse
la connexion — c'est l'erreur la plus fréquente lors de la configuration.

### Session, JWT, cookie
- La **session** est la preuve que l'utilisateur est connecté.
- Elle prend la forme d'un **JWT** (JSON Web Token) : un long jeton signé
  cryptographiquement. Signé = on peut le lire, mais pas le falsifier sans se faire
  détecter. C'est ce jeton qui permet à PostgreSQL de savoir *qui* demande, et donc
  d'appliquer le RLS.
- Il est stocké dans un **cookie**, un petit fichier que le navigateur renvoie
  automatiquement à chaque requête.

### `@supabase/ssr`
Le paquet officiel qui gère cette mécanique de cookies proprement entre le serveur et le
navigateur (SSR = Server-Side Rendering). C'est le bon choix, il n'y a rien à redire là-dessus.

### Open redirect
Une faille classique : si ton callback accepte un paramètre « où aller après connexion »
sans le vérifier, un attaquant peut fabriquer un lien qui connecte l'utilisateur puis le
propulse sur un site malveillant maquillé aux couleurs de ton app. Dans le cas présent le
risque est faible (le code produit malgré tout une adresse interne), mais la vérification
coûte une ligne — autant la mettre.

### PKCE
Une sécurité supplémentaire du flux OAuth qui empêche l'interception du `code` de l'étape 4.
`@supabase/ssr` le gère tout seul, tu n'as rien à faire. Je le cite juste pour que le mot
ne t'inquiète pas si tu le croises.

---

## 8. Le vocabulaire des appels HTTP

### Requête / Réponse
Le navigateur envoie une **requête** au serveur, le serveur renvoie une **réponse**.

### Header (« en-tête »)
Des informations attachées à la requête, à côté du contenu principal. C'est par un header
que le navigateur transmet la clé API personnelle de l'utilisateur : `X-Api-Key`. Le
serveur la lit dans `web/src/lib/ai/http.ts`.

⚠️ Un header est fabriqué par le navigateur, donc **par l'utilisateur**. Il peut y mettre
n'importe quoi. Toute décision fondée sur un header doit rester vérifiable : ici, si
quelqu'un envoie une fausse clé pour contourner le quota, l'appel à Gemini échouera de
toute façon — donc ce n'est pas exploitable. Mais le raisonnement doit être fait
consciemment, pas par chance.

### Codes de statut
Le petit numéro que renvoie le serveur pour dire comment ça s'est passé :
- **200** : tout va bien.
- **401 Unauthorized** : « je ne sais pas qui tu es » → connecte-toi. C'est ce que le spec
  veut renvoyer à un invité sans clé personnelle.
- **429 Too Many Requests** : « je sais qui tu es, mais tu as épuisé ton quota ». C'est le
  code du quota mensuel dépassé.
- **502** : « l'IA en amont m'a répondu n'importe quoi ».

Distinguer 401 et 429 compte, parce que l'interface doit afficher deux messages
radicalement différents : « connectez-vous » vs « votre quota est épuisé, ajoutez votre clé
ou passez à Pro ».

### BYOK — « Bring Your Own Key »
Le modèle où l'utilisateur apporte sa propre clé d'API. Tu ne paies rien, il paie son
fournisseur directement. C'est le mode prévu pour les invités et pour les utilisateurs qui
ont épuisé leur quota gratuit.

👉 Point de la revue lié : le spec dit à la fois que la clé personnelle voyage par le header
`X-Api-Key` (donc stockée dans le navigateur) **et** ajoute une colonne `custom_ai_key`
dans la base pour la stocker en clair. Ces deux affirmations se contredisent, et personne
n'a tranché. Stocker les clés d'API de tes utilisateurs dans ta base est une décision
lourde (responsabilité en cas de fuite) qui ne doit pas arriver par accident.

Autre oubli : le code supporte **trois** fournisseurs (Gemini, Anthropic **et DeepSeek**),
le spec n'en connaît que deux.

---

## 9. Le vocabulaire des outils de vérification

### TypeScript
Une surcouche de JavaScript qui ajoute des **types** : « cette variable est un texte »,
« cette fonction attend un nombre ». Un vérificateur relit tout le code avant exécution et
signale les incohérences. C'est ce qui attrape « tu as écrit `updated_at` ici et
`updatedAt` là-bas » — précisément le problème n°11 de ma revue, où le moteur de synchro
attend un nom de champ que les tables `applications` et `jobs` n'utilisent pas.

### `any`, `@ts-ignore`, et le `!`
Trois façons de dire à TypeScript « tais-toi ». Elles neutralisent la protection à l'endroit
exact où on ne comprend pas ce qu'on fait — donc exactement là où on en avait le plus
besoin. Le plan les interdit dans ses contraintes… et les utilise dans son propre code.

### Typecheck (`npx tsc --noEmit`)
La commande qui lance cette vérification sans rien produire. Rapide, et elle attrape une
grande partie des erreurs avant qu'elles n'atteignent l'utilisateur.

### Vitest / test unitaire
Vitest est l'outil de tests du projet. Un **test unitaire** vérifie une fonction isolée :
« si je donne ces entrées, j'attends cette sortie ».

⚠️ **Vitest ne fait pas de typecheck.** Une suite de tests toute verte peut cacher du code
qui ne compile même pas. C'est pour ça que la vérification du projet exige
`npm run build` **en plus** des tests.

### Test d'intégration
Un test qui vérifie que plusieurs morceaux fonctionnent **ensemble**, avec une vraie base
de données.

👉 Point important de la revue : le spec promet un test d'étanchéité (« l'utilisateur A ne
peut pas lire le CV de B ») et un test « refus au 16ᵉ appel ». Ce sont des tests
d'intégration, qui nécessitent une vraie base Supabase. Le plan ne livre que des tests
unitaires de fonctions pures. **Ne prends donc pas une suite verte pour une preuve
d'étanchéité** — la question la plus critique du chantier ne sera testée par personne.

### TDD
« Test-Driven Development » : écrire le test **avant** le code, le voir échouer, puis écrire
le code qui le fait passer. C'est la structure du plan (« Step 1: write failing test »).
Bonne discipline sur le principe ; ici les tests écrits sont trop superficiels pour
apporter grand-chose (l'un d'eux vérifie seulement qu'un objet « existe »).

### ESLint
Un correcteur de style et de mauvaises pratiques. Il ne teste rien, il relit.

### Commit
Un point de sauvegarde daté dans l'historique du code (Git). Le plan committe après chaque
tâche : c'est bien, ça permet de revenir en arrière tâche par tâche.

---

## 10. Récapitulatif : les 5 bloquants en une phrase chacun

| # | Le problème | En français simple | Conséquence si on ignore |
|---|---|---|---|
| 1 | Le quota n'est branché nulle part | Le videur est embauché mais reste au vestiaire | Ta clé Gemini reste gratuite pour tout internet |
| 2 | Aucune tâche ne crée la base | Le plan de la maison existe, pas la maison | Les 5 tâches parlent à une base inexistante |
| 3 | Les règles RLS sont trop permissives | L'utilisateur peut remettre son compteur à zéro et se déclarer Pro | Le modèle économique ne tient pas |
| 4 | Une fonction SQL a une faute de syntaxe | Le script s'arrête en cours d'installation | Installation échouée, message obscur |
| 5 | Le middleware actuel est écrasé | Le vigile de l'entrée est remplacé sans prévenir | La protection du déploiement distant disparaît en silence |

---

## 11. Le piège des « 15 crédits »

Un point qui n'est pas un bug mais un problème de conception produit, et qui te concerne
directement en tant que décideur.

Le spec annonce **« 15 adaptations de CV par mois »**. Mais le compteur, lui, s'incrémente
**à chaque appel de route API**. Or une seule « adaptation de CV » vue par l'utilisateur
déclenche en réalité plusieurs appels : extraire l'offre, adapter le CV, calculer le score
ATS, éventuellement une question au chat de l'éditeur…

Donc l'utilisateur qui adapte **trois** CV verra son quota de 15 épuisé, alors qu'on lui a
promis 15 adaptations. Il aura le sentiment très net de s'être fait avoir, et il aura
raison.

Deux réponses possibles, à trancher avant l'implémentation :
- **Option A** : ne facturer qu'un seul endpoint (le « vrai » travail, `tailor-resume`), et
  laisser les autres gratuits.
- **Option B** : passer à un système de **crédits pondérés** — une adaptation coûte 3
  crédits, un chat en coûte 1 — et communiquer en crédits plutôt qu'en adaptations.

Sujet connexe : le compteur se réinitialise le **1er du mois calendaire**. Quelqu'un qui
s'inscrit le 28 a donc 15 crédits… puis un reset 3 jours plus tard. C'est cadeau, mais
c'est aussi une incohérence perçue. L'alternative est un reset 30 jours après l'inscription.

---

## 12. Le piège des photos en base64

### Base64
Une façon de transformer une image en une très longue chaîne de texte, pour pouvoir la
ranger dans un endroit qui n'accepte que du texte. Le coût : le texte pèse **~33 % de plus**
que l'image d'origine.

Le CV est stocké dans une colonne `JSONB`, c'est-à-dire un document texte. Si la photo de
profil y est incluse en base64, chaque CV pèse plusieurs centaines de kilo-octets au lieu de
quelques kilo-octets.

Le tier gratuit de Supabase offre 500 Mo de base. À 100 utilisateurs × 5 CV avec photo, tu
approches déjà de la limite — et chaque synchronisation télécharge ces photos, donc tu
consommes aussi du trafic sortant, qui est facturé.

**La bonne pratique** : les fichiers vont dans Supabase **Storage** (un service de stockage
de fichiers, à côté de la base), et la base ne contient qu'un lien vers le fichier. C'est
une décision de schéma, donc **à prendre avant la première migration** — la changer après
coup obligerait à migrer les données de tous les utilisateurs.

---

## 13. RGPD : ce que la loi ajoute dès qu'on stocke

Tant que tout restait dans le navigateur de l'utilisateur, tu ne détenais rien. À la seconde
où Supabase stocke des CV, tu deviens **responsable de traitement** au sens du RGPD, avec
des obligations concrètes.

Ce qui est stocké est loin d'être anodin : nom, adresse, email, téléphone, parcours
professionnel, parfois photo, parfois clés d'API. Un CV est un condensé de données
personnelles.

Ce qui manque aujourd'hui dans les deux documents :
- **Suppression de compte** : un bouton qui efface réellement tout. Techniquement facile
  grâce au `ON DELETE CASCADE` déjà prévu — mais il faut le bouton, et il faut décider du
  sort des soft deletes (les tombstones du §4 ne doivent pas survivre à une demande de
  suppression).
- **Export de ses données** : le droit à la portabilité. Le module `backup.ts` existe déjà,
  c'est donc surtout un travail de branchement.
- **Politique de confidentialité** : qui stocke quoi, où, combien de temps, pourquoi.
- **Base légale** et information à la connexion.
- **Localisation** : le guide en Annexe A recommande la région Francfort, ce qui est le bon
  réflexe (données dans l'UE).

Rien de tout ça n'est bloquant techniquement. Mais c'est beaucoup plus coûteux à ajouter
une fois que tu as des utilisateurs réels que maintenant, où tu n'en as aucun.

---

## 14. Deux limites du tier gratuit Supabase à connaître

- **Mise en pause après 7 jours d'inactivité.** Un projet gratuit que personne ne sollicite
  pendant une semaine est suspendu. Le réveil prend une minute et se fait à la main dans
  l'interface. À anticiper avant une démo.
- **500 Mo de base, 1 Go de fichiers, trafic sortant limité.** Suffisant pour démarrer,
  saturable vite si les photos partent en base64 (§12).

---

## Annexe A — Configuration pas-à-pas (repris du guide précédent)

> ⚠️ L'étape 3 ci-dessous (« colle le SQL et clique Run ») fonctionne pour un premier test,
> mais c'est exactement l'anti-pattern décrit au §1 « Migration ». Dès que le projet est
> sérieux, ce SQL doit vivre dans un fichier `supabase/migrations/0001_init.sql` versionné
> dans Git. Et il ne doit **pas** être appliqué tel quel : les correctifs RLS (§2) et
> l'erreur de syntaxe (bloquant n°4) doivent être intégrés avant.

### Étape 1 — Créer le projet Supabase
1. Créer un compte gratuit sur [supabase.com](https://supabase.com).
2. **New Project**.
3. Nom (ex. `cvmatchr-db`), mot de passe de base fort, région **Frankfurt (eu-central-1)**.
4. Dans **Project Settings > API**, récupérer l'**URL** et l'**anon public key**.

### Étape 2 — Activer la connexion Google
1. [Console Google Cloud](https://console.cloud.google.com/) → créer un projet.
2. **APIs & Services > OAuth consent screen**.
3. **Credentials > Create Credentials > OAuth client ID** (type : Web application).
4. Déclarer l'URL de callback Supabase : `https://<ton-projet>.supabase.co/auth/v1/callback`.
   (C'est l'oubli n°1 des configurations ratées — voir §7 « Callback ».)
5. Copier **Client ID** et **Client Secret** dans
   **Supabase > Authentication > Providers > Google**.

### Étape 3 — Créer les tables
SQL Editor de Supabase → coller le script de
`docs/superpowers/specs/2026-08-10-auth-database-design.md` **corrigé** → Run.

### Étape 4 — Variables d'environnement
Dans `web/.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ta-cle-anon-ici
```

Rappel du §5 : ces deux variables sont **publiques par conception** (préfixe
`NEXT_PUBLIC_`). Ne jamais y mettre la clé `service_role`, ni une clé Gemini ou Anthropic.
Et penser à les déclarer aussi côté hébergeur pour la production — `.env.local` ne part pas
avec le code.

---

## Annexe B — Antisèche du vocabulaire

| Terme | En une phrase |
|---|---|
| **PostgreSQL / Postgres** | Le logiciel de base de données |
| **Supabase** | PostgreSQL hébergé + gestion des comptes |
| **Schéma** | Le plan de la base (tables, colonnes, règles) |
| **Migration** | Un fichier versionné qui décrit un changement de schéma |
| **Clé primaire** | L'identifiant unique d'une ligne |
| **Index** | Un répertoire qui accélère les recherches |
| **JSONB** | Une colonne qui contient un document entier |
| **RLS** | La base filtre elle-même : chacun ne voit que ses lignes |
| **Policy** | Une règle RLS concrète (qui peut faire quoi) |
| **Clé `anon`** | Clé publique du navigateur, protégée par le RLS |
| **Clé `service_role`** | Clé maîtresse, serveur uniquement, jamais exposée |
| **SECURITY DEFINER** | Fonction qui s'exécute avec les droits de l'admin |
| **Trigger** | « Quand X arrive, fais Y » automatiquement |
| **Atomique** | Opération indivisible, insensible aux clics simultanés |
| **IndexedDB** | La base de données intégrée au navigateur |
| **Dexie** | La bibliothèque qui rend IndexedDB utilisable |
| **Offline-first** | On écrit en local d'abord, on synchronise après |
| **Push / Pull** | Envoyer vers le serveur / télécharger depuis le serveur |
| **Delta** | Uniquement ce qui a changé depuis la dernière synchro |
| **Soft delete / tombstone** | Marquer comme supprimé au lieu d'effacer |
| **Last-write-wins** | En cas de conflit, la version la plus récente gagne |
| **Route / endpoint** | Une adresse de l'application |
| **Middleware** | Poste de contrôle traversé par toutes les requêtes |
| **Layout** | Le cadre commun à toutes les pages |
| **Zustand / store** | Le rangement de l'état dans le navigateur |
| **Hydraté** | Le store a été rempli avec les vraies valeurs |
| **OAuth** | Le protocole du « Se connecter avec Google » |
| **Callback** | L'adresse où Google raccompagne l'utilisateur |
| **JWT** | Le jeton signé qui prouve l'identité |
| **Header** | Information attachée à une requête (ex. `X-Api-Key`) |
| **401 / 429** | « Connecte-toi » / « Quota épuisé » |
| **BYOK** | L'utilisateur apporte sa propre clé d'API |
| **Base64** | Une image transformée en texte, +33 % de poids |
| **TypeScript** | JavaScript avec vérification des types |
| **Typecheck / build** | La vérification avant déploiement |
| **Vitest** | L'outil de tests (qui ne vérifie **pas** les types) |
