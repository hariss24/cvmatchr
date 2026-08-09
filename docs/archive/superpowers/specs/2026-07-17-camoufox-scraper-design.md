# Design — Microservice de scraping Camoufox pour l'Extracteur d'Offre

**Date** : 2026-07-17
**Statut** : validé par Hariss (session de brainstorming Claude, suite à la
conversation exploratoire avec Gemini « Integrating Camoufox For CV-Tailor »)
**Branche cible** : `camoufox-scraper`

## Problème

L'extracteur d'offres (`POST /api/extract-job` → `web/src/lib/scraper/scraper.ts`)
échoue sur LinkedIn et Indeed : le fetch simple est bloqué par les protections
anti-bot (Cloudflare, challenges JS), et le fallback Jina AI est lui aussi
souvent bloqué sur ces sites. C'est un point « Priorité haute » du TODO.

## Solution retenue

Un **micro-service Python local** dédié au scraping furtif, basé sur
**Camoufox** (Firefox modifié anti-détection, piloté via Playwright), inséré
comme **fallback intermédiaire** dans la cascade d'extraction existante :

```
fetch + cheerio  →  microservice Camoufox  →  Jina AI
   (rapide)          (si bloqué + service       (dernier filet,
                      disponible)                comportement actuel)
```

### Décisions actées

| Question | Décision |
|---|---|
| Périmètre du service Python | **Scraping seul.** Toute l'IA (nettoyage Gemini via Vercel AI SDK) reste dans Next.js. |
| Place dans la cascade | **Fallback intermédiaire.** fetch+cheerio d'abord ; Camoufox si bloqué ; Jina en dernier filet. L'app reste 100 % fonctionnelle si le service n'est pas lancé. |
| Déploiement | **Local pour l'instant, mais prêt à héberger** (orientation SaaS) : URL et token en variables d'environnement, auth Bearer optionnelle, re-validation SSRF côté Python, **Dockerfile inclus dès maintenant**. Migration vers Railway/Fly = déploiement du conteneur + changement de config, zéro code. |
| Installation Camoufox | Via **pip** (`camoufox[geoip]`) + `camoufox fetch`. Le clone git `C:\Users\tahet\projects\camoufox` fait pendant la session Gemini est inutile et peut être supprimé. |
| Exécutant | Missions autonomes déléguées à Gemini, vérifiées par Claude. |

## Architecture

### 1. Microservice `scraper-service/` (racine du repo, hors `web/`)

- **Stack** : Python 3.11+, FastAPI + uvicorn, `camoufox[geoip]`.
- **`POST /scrape`** : corps `{"url": "https://..."}` → réponse
  `{"text": "...", "title": "..."}` ou `{"error": "..."}` avec code HTTP adapté.
  - Re-validation SSRF côté Python : résolution DNS de l'hôte, refus des IP
    privées/loopback/link-local (même politique que `web/src/lib/scraper/ssrf.ts`).
  - Si la variable d'environnement `SCRAPER_TOKEN` est définie, l'endpoint
    exige `Authorization: Bearer <token>` (401 sinon). Sans variable : accès
    libre (usage local).
  - Extraction : Camoufox headless (`humanize` désactivé, timeout navigation
    ~30 s), attente du chargement, puis ciblage des mêmes sélecteurs candidats
    que `scraper.ts` (`[class*="job-description"]`, `article`, `main`, `body`…)
    via `inner_text`, titre via `page.title()`.
  - Troncature à 15 000 caractères avec suffixe `... [TRONQUÉ]` (identique au
    comportement Next.js actuel).
- **`GET /health`** : `{"status": "ok"}` — permet à Next.js de vérifier
  rapidement la disponibilité.
- Fichiers : `main.py`, `requirements.txt`, `README.md` (installation et
  lancement), `.gitignore` local si besoin (venv).

### 2. Intégration Next.js (modification chirurgicale)

- `web/src/lib/scraper/scraper.ts` : dans le bloc de fallback actuel
  (`if (isBlocked || !text)`), tenter **d'abord** le microservice si
  `process.env.SCRAPER_URL` est définie :
  - `POST ${SCRAPER_URL}/scrape` avec l'URL déjà validée (`safeUrl`), header
    `Authorization: Bearer ${SCRAPER_TOKEN}` si le token est défini,
    timeout 60 s (lancement navigateur + pages lourdes).
  - Succès avec texte non vide → on utilise ce résultat (troncature comprise).
  - Échec, réponse vide ou service éteint → fallback Jina inchangé.
- `SCRAPER_URL` absente (prod Vercel actuelle) → **comportement strictement
  identique à aujourd'hui**.
- `web/.env.local` (et `.env.example` s'il existe) :
  `SCRAPER_URL=http://127.0.0.1:8765`, `SCRAPER_TOKEN` optionnel.

### 3. Lancement local

- Script `Lancer Scraper (Camoufox).bat` à la racine, sur le modèle de
  `Lancer CV Builder (Next.js).bat` : active le venv et lance
  `uvicorn main:app --host 127.0.0.1 --port 8765`.

## Gestion d'erreurs

- Service éteint / timeout / 4xx-5xx / texte vide → silencieux, on passe à
  Jina (log console côté serveur Next.js pour le diagnostic).
- Page bloquée malgré Camoufox (captcha dur) → le service renvoie une erreur
  explicite ; Next.js enchaîne sur Jina puis, en dernier recours, le message
  utilisateur actuel (« copiez-collez le texte manuellement »).

## Tests

- **Vitest** (`web/src/lib/scraper/scraper.test.ts`, mocks `fetch` existants) :
  1. site bloqué + `SCRAPER_URL` définie + microservice OK → texte du
     microservice, Jina non appelé ;
  2. microservice en échec → fallback Jina (comportement actuel) ;
  3. `SCRAPER_URL` non définie → cascade actuelle inchangée.
- **Python** : pas de suite pytest exigée (service minimal) ; vérification par
  appel réel documentée dans le README (`curl POST /scrape` sur une URL de test).
- **Bout en bout (manuel, par Claude en vérification)** : une vraie URL
  LinkedIn/Indeed via l'UI avec le service lancé.

## Hors périmètre

- Appel de l'IA depuis Python, hébergement distant effectif, proxies/geoip
  avancés, file d'attente ou pool de navigateurs, cache des résultats.
