# 🚀 Guide Supabase, Google Auth & Quotas IA (Spécial Vibe-Coder)

> **À destination du "Vibe Coder"** : Ce document explique exactement ce que nous avons conçu, comment fonctionnent les règles d'accès IA (Invite vs Connecté vs Premium), et comment tout configurer facilement !

---

## 💰 1. Le Modèle Économique : Comment ça marche pour les Utilisateurs ?

Nous avons pensé la spécification pour te permettre de **monétiser ou contrôler les coûts d'IA** sans bloquer l'usage gratuit de base :

| Type d'Utilisateur | Stockage CV & Retouches | Clé IA Intégrée (Serveur) | Sa Propre Clé API (`BYOK`) |
| --- | --- | --- | --- |
| **1. Invité Local (Sans compte)** | 100% Gratuit dans le navigateur | ❌ Bloqué (Doit se connecter ou mettre sa clé) | ✅ Oui (Peut mettre sa clé Gemini/Anthropic) |
| **2. Connecté Gratuit (Google Auth)** | Sauvegardé & Synchro Cloud | ✅ **Quota mensuel gratuit** (ex: 15/mois) | ✅ Oui (Prend le relais si quota dépassé) |
| **3. Compte Premium (Futur Payant)** | Sauvegardé & Synchro Cloud | ✅ Quota Illimité ou étendu | ✅ Optionnel |

---

## 🛡️ 2. Supabase + Synchronisation Hybride

### A. Supabase : Ton Coffre-Fort Cloud Gratuit
**Supabase** est une base de données PostgreSQL dans le cloud, 100 % gratuite (jusqu'à 500 Mo de données et 50 000 utilisateurs actifs par mois).
C'est elle qui sauvegarde les CV, les lettres, les candidatures et qui **compte de manière infalsifiable les appels IA serveur**.

### B. Google Auth : Connexion en 1 Clic
Tes utilisateurs peuvent s'authentifier en un clic avec leur compte Google pour débloquer leur quota gratuit d'IA et la sauvegarde cloud.

### C. La Synchronisation Hybride (Magic Offline + Cloud)
- **0 latence en édition** : L'application écrit instantanément dans la mémoire locale du navigateur (IndexedDB/Dexie).
- **Sauvegarde transparente** : En arrière-plan, un petit moteur de synchronisation (`SyncEngine`) envoie les modifications vers Supabase.
- **Multi-appareils** : Tu te connectes sur ton téléphone ou un autre PC, tes CV se téléchargent automatiquement.

---

## 🔑 3. Guide de Configuration en 4 Étapes (Pas-à-pas)

### Étape 1 : Créer ton projet Supabase (2 min)
1. Rends-toi sur [supabase.com](https://supabase.com) et crée un compte gratuit.
2. Cliquez sur **"New Project"**.
3. Choisissez un nom (ex: `cvmatchr-db`), un mot de passe de base de données fort, et sélectionnez la région **Frankfurt (eu-central-1)**.
4. Dans **Project Settings > API**, récupérez l'**URL** et l'**anon public key**.

### Étape 2 : Activer Google Auth (3 min)
1. Allez sur la [Console Google Cloud](https://console.cloud.google.com/).
2. Créez un projet -> **APIs & Services > OAuth consent screen**.
3. Allez dans **Credentials > Create Credentials > OAuth client ID** (Web application).
4. Ajoutez l'URL de callback de Supabase (`https://xyz.supabase.co/auth/v1/callback`).
5. Copiez le **Client ID** et le **Client Secret** et collez-les dans **Supabase > Authentication > Providers > Google**.

### Étape 3 : Créer les tables SQL (1 min)
1. Dans Supabase, ouvrez le **SQL Editor**.
2. Collez le script SQL complet de `docs/superpowers/specs/2026-08-10-auth-database-design.md`.
3. Cliquez sur **Run**. Les 6 tables, les Triggers et les règles de quotas sont installés.

### Étape 4 : Variables d'environnement (`.env.local`)
Dans le dossier `web/` de ton projet :
```env
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ta-cle-anon-ici
```
