# CV Tailor (Next.js Edition)

> **Note (Juillet 2026)** : Ce projet a été entièrement réécrit en **Next.js** et **React PDF**. 
> L'ancienne version Python/Flask n'est plus d'actualité. Tous les codes sources sont désormais situés dans le sous-dossier `web/`.

## Architecture Actuelle

- **Frontend & Backend** : Next.js 16 (App Router)
- **Génération PDF** : `@react-pdf/renderer` (100% côté client/navigateur, rendu immédiat)
- **Stockage** : Dexie.js (IndexedDB local)
- **IA** : Intégration Gemini & SDK Vercel AI
- **Hébergement** : Déployé sur Vercel (serverless)

## Instructions

Merci de vous référer au fichier **[web/README.md](web/README.md)** pour savoir comment lancer l'application localement, lancer les tests (Vitest / Playwright) et contribuer.
