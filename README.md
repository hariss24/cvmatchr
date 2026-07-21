# CVMatchr

> Adaptez votre CV et votre Lettre de Motivation aux offres d'emploi grâce à l'IA.

**[🌐 Voir l'application en ligne](https://cvmatchr.fr)**

---

**CVMatchr** est une application web qui vous aide à adapter vos candidatures (CV et lettres de motivation) à des offres d'emploi spécifiques en utilisant l'intelligence artificielle (Gemini ou Anthropic). Elle intègre un éditeur en direct, plusieurs templates d'export PDF, et un chasseur d'offres intégré avec analyse sémantique.

## Fonctionnalités Principales

- **Adaptation par l'IA** : Ajustement du CV (compétences, expériences) et de la lettre de motivation selon la description d'une offre.
- **Rendu PDF 100% local** : Génération immédiate de PDF dans le navigateur via `@react-pdf/renderer` avec plusieurs templates (Sobre, Graphique, Kakuna, Marine).
- **Chasseur d'offres intégré** : Recherche via l'API France Travail, pré-filtre des offres, notation intelligente avec l'IA et estimation du temps de trajet (Google Maps).
- **Score ATS (Applicant Tracking System)** : Analyse des mots-clés de l'offre et vérification de l'adéquation du profil.
- **Confidentialité (Privacy First)** : Aucune base de données serveur. Toutes vos données sont stockées localement sur votre navigateur (IndexedDB via Dexie).
- **Import/Export facile** : Importez depuis un texte brut ou un PDF existant. Sauvegardez des snapshots (versions de travail) de votre CV.

## Stack Technique

- **Framework** : [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Frontend** : React 19, TypeScript strict, variables CSS pures (thèmes Light/Dark)
- **State Management** : Zustand (`docStore`, `uiStore`)
- **Stockage Local** : Dexie.js (IndexedDB)
- **Génération PDF** : `@react-pdf/renderer`, `pdfjs-dist` (pour l'aperçu)
- **IA** : SDK Vercel AI, `@google/genai` (Gemini), `@anthropic-ai/sdk` (Anthropic)
- **Déploiement** : [Vercel](https://vercel.com/) (Serverless)

---

## 🚀 Installation & Développement Local

Tout le code de l'application est situé dans le sous-dossier `web/`.

### Prérequis
- Node.js (v18+)
- Une clé API Google Gemini (ou Anthropic)

### 1. Cloner et installer
```bash
git clone https://github.com/votre-username/cvmatchr.git
cd cvmatchr/web
npm install
```

### 2. Variables d'environnement
Créez un fichier `.env.local` dans le dossier `web/` en vous inspirant des clés requises :

| Variable | Rôle | Requise pour |
|---|---|---|
| `GEMINI_API_KEY` | Clé Google Gemini (IA) | Adaptation CV, chat, ATS, notation d'offres |
| `AUTH_PASSWORD` | Mot de passe d'accès (facultatif) | Restreindre l'accès à l'app |
| `FT_CLIENT_ID` | Identifiant client France Travail | L'onglet **Offres** (recherche) |
| `FT_CLIENT_SECRET` | Secret client France Travail | L'onglet **Offres** (recherche) |
| `GOOGLE_MAPS_API_KEY` | Clé Google Maps (Distance Matrix)| L'onglet **Offres** (temps de trajet) |

*(Note : L'application fonctionnera sans les clés France Travail, mais l'onglet "Offres" affichera un message de configuration).*

### 3. Lancer le serveur de développement
```bash
npm run dev
# Ou utilisez le script à la racine : Lancer CV Builder (Next.js).bat
```
L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

## Tests (depuis `/web`)

```bash
npm run test          # Tests unitaires (Vitest)
npm run test:e2e      # Tests end-to-end (Playwright)
npx tsc --noEmit      # Vérification TypeScript
npm run lint          # Linting
```

---

*Note : Ce projet a été entièrement réécrit en Next.js (juin/juillet 2026). L'ancienne version Python/Flask n'est plus d'actualité.*
