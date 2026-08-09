# Plan général — Microservice de scraping Camoufox

> **For agentic workers:** ce plan est découpé en missions autonomes destinées
> à Gemini (workflow habituel : Claude rédige et vérifie, Gemini exécute).
> Chaque mission est auto-suffisante et se termine par des vérifications et un
> commit.

**Goal :** débloquer l'extraction d'offres LinkedIn/Indeed en ajoutant un
micro-service Python local (Camoufox, navigateur furtif) comme fallback
intermédiaire dans la cascade d'extraction existante.

**Architecture :** `scraper-service/` (FastAPI + camoufox) expose
`POST /scrape` ; `web/src/lib/scraper/scraper.ts` l'appelle entre le
fetch+cheerio et le fallback Jina, uniquement si `SCRAPER_URL` est définie.
Spec validée : `docs/archive/superpowers/specs/2026-07-17-camoufox-scraper-design.md`.

**Tech stack :** Python 3.11+, FastAPI, uvicorn, `camoufox[geoip]` ;
côté web : Next.js/TypeScript existant, Vitest.

## Contraintes globales

- Branche de travail : `camoufox-scraper` (créer depuis `main` si absente ;
  un worktree `.worktrees/camoufox-scraper` peut déjà exister — le réutiliser).
- Périmètre strict : ne rien modifier hors des fichiers listés dans chaque mission.
- Sans `SCRAPER_URL`, le comportement de l'app doit rester strictement identique
  à aujourd'hui (prod Vercel non impactée).
- Texte tronqué à 15 000 caractères avec suffixe `... [TRONQUÉ]` (parité avec
  `scraper.ts`).
- Le clone `C:\Users\tahet\projects\camoufox` (hors repo) est inutile :
  Camoufox s'installe via pip. Ne pas s'en servir.

## Ordre des missions

| Mission | Contenu | Dépend de |
|---|---|---|
| 9 | Microservice Python `scraper-service/` + script .bat + README | — |
| 10 | Intégration cascade dans `scraper.ts` + tests Vitest + env | 9 (pour la vérification bout en bout uniquement ; le code est indépendant) |

## Protocole de vérification (Claude, après chaque mission)

- Mission 9 : `uvicorn` démarre, `GET /health` répond, `POST /scrape` sur une
  URL réelle renvoie du texte, refus d'une URL privée (403) et d'un token
  invalide (401 si `SCRAPER_TOKEN` défini).
- Mission 10 : `npx tsc --noEmit`, `npm run lint`, `npm test` (dans `web/`),
  puis test manuel de bout en bout via l'UI avec le service lancé sur une
  offre LinkedIn/Indeed réelle.
