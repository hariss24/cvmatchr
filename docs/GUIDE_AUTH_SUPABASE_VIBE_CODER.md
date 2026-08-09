# 🚀 Guide Supabase & Google Auth (Spécial Vibe-Coder)

> **À destination du "Vibe Coder"** : Ce document explique exactement ce que nous avons conçu, pourquoi c'est la meilleure architecture possible, et comment tout configurer facilement sans connaissances techniques poussées !

---

## 💡 1. C'est quoi le problème qu'on résout ?

Jusqu'à présent, CVMatchr fonctionnait à **100 % dans ton navigateur web** (via une technologie appelée IndexedDB / Dexie) :
- ❌ Si tu vidais le cache de ton navigateur, tu perdais tous tes CV, lettres et candidatures.
- ❌ Si tu ouvrais l'application sur ton téléphone, tes CV créés sur ton ordinateur n'étaient pas là.
- ❌ Le compteur d'appels IA était stocké localement, donc facile à tricher en effaçant le cache.

---

## 🛡️ 2. La Solution : Supabase + Google Auth + Synchronisation Hybride

### A. Supabase : Ton Coffre-Fort Cloud Gratuit
**Supabase** est une base de données PostgreSQL dans le cloud, 100 % gratuite (dans la limite de 500 Mo de données et 50 000 utilisateurs actifs par mois, ce qui est énorme pour démarrer).
C'est elle qui va sauvegarder tes CV, tes lettres et tes candidatures en lieu sûr.

### B. Google Auth : Connexion en 1 Clic
Tes utilisateurs (et toi-même) pourront s'authentifier en un clic avec leur compte Google. Pas besoin de créer un énième mot de passe ni de gérer les emails d'activation.

### C. La Synchronisation Hybride (Magic Offline + Cloud)
C'est le **gros point fort** de notre architecture :
- **0 latence en édition** : Quand tu tapes dans ton CV, l'application écrit instantanément dans la mémoire locale de ton navigateur. C'est fluide, rapide à 0 milliseconde.
- **Sauvegarde transparente** : En arrière-plan, un petit moteur de synchronisation (`SyncEngine`) envoie silencieusement les modifications vers Supabase.
- **Multi-appareils** : Tu te connectes sur un nouvel ordinateur ? Tes CV se téléchargent automatiquement depuis Supabase.

---

## 🔑 3. Guide de Configuration en 4 Étapes (Pas-à-pas)

Quand nous commencerons l'implémentation du plan, voici les seules étapes visuelles que tu auras à faire :

### Étape 1 : Créer ton projet Supabase (2 min)
1. Rends-toi sur [supabase.com](https://supabase.com) et crée un compte gratuit.
2. Clique sur **"New Project"**.
3. Choisis un nom (ex: `cvmatchr-db`), un mot de passe de base de données fort, et sélectionne la région **Frankfurt (eu-central-1)** pour la France.
4. Une fois créé, va dans **Project Settings > API** et récupère :
   - `URL` (ex: `https://xyz.supabase.co`)
   - `anon public key` (une longue clé qui commence par `eyJ...`)

### Étape 2 : Activer Google Auth (3 min)
1. Va sur la [Console Google Cloud](https://console.cloud.google.com/).
2. Crée un projet, va dans **APIs & Services > OAuth consent screen** et valide les infos de base.
3. Va dans **Credentials > Create Credentials > OAuth client ID**.
4. Choisis **Web application** et ajoute dans *Authorized redirect URIs* l'URL fournie par Supabase (ex: `https://xyz.supabase.co/auth/v1/callback`).
5. Copie le **Client ID** et le **Client Secret** générés par Google.
6. Dans ton tableau de bord **Supabase**, va dans **Authentication > Providers > Google**, colle le Client ID et Client Secret, puis clique sur **Enable**.

### Étape 3 : Créer les tables SQL (1 min)
1. Dans Supabase, clique sur l'onglet **SQL Editor** sur la gauche.
2. Colle le script SQL complet qui se trouve dans `docs/superpowers/specs/2026-08-10-auth-database-design.md`.
3. Clique sur **Run**. Toutes les tables (`resumes`, `letters`, `profiles`, `applications`...) et leurs sécurités (RLS) sont créées instantanément !

### Étape 4 : Renseigner les variables dans ton fichier `.env.local`
Dans le dossier `web/` de ton projet, nous ajouterons ces deux lignes :
```env
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ta-cle-anon-ici
```

---

## 🔒 4. Qu'en est-il de la sécurité des données (RLS) ?

Grâce au **RLS (Row Level Security)** activé sur Supabase, **chaque utilisateur est totalement isolé**.
Même si un pirate connaissait la clé publique de ton application, la base de données de Supabase refuse catégoriquement de servir les CV d'un utilisateur à un autre. La règle est : `Si l'ID de la session ne correspond pas à l'auteur du CV -> Accès Refusé`.

---

## 🏁 En résumé
Tu as une solution **gratuite, ultra-sécurisée, rapide comme l'éclair, sans aucune gestion de serveur à faire**, et prête pour le multi-utilisateur !
