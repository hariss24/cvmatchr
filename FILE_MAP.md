# 🗺️ FILE_MAP.md — Carte du dépôt

> Index de navigation rapide : **quel fichier lire pour quelle tâche**.
> Pour l'architecture détaillée et les angles morts métier, voir `PROJECT_INDEX.md`.
> Les tailles sont indicatives — fie-toi aux rôles, pas aux chiffres.

## Backend Python

| Fichier | ~Lignes | Rôle |
|---|---|---|
| `app.py` | 650 | Routes Flask (carte complète des routes dans sa docstring), auth/CSRF, quota, mode local (tkinter) vs remote (Gunicorn/ProxyFix) |
| `ai_engine.py` | 660 | Appels IA streaming — Gemini (clé `AIza…`) ou Anthropic (clé `sk-ant-…`), parsing JSON des réponses (`_loads_ai_json`), gestion 429/retry |
| `prompts.py` | 330 | Constantes uniquement : prompts système + squelettes HTML (import, tailoring 3 niveaux, pack candidature) |
| `scraper.py` | 230 | Scraping d'offres d'emploi : Playwright + guards SSRF/DNS-rebinding, fallback Jina Reader |
| `pdf_engine.py` | 105 | HTML → PDF : backend Playwright (local) ou WeasyPrint (`PDF_ENGINE=weasyprint`), whitelist formats/marges |
| `archive.py` | 300 | Historique des PDF générés : SQLite local, MongoDB ou SQLite `/tmp` en remote |
| `quota.py` | 35 | Compteur journalier thread-safe de la clé API serveur (`DAILY_QUOTA`) |
| `mcp_server.py` | 85 | Serveur FastMCP pour Claude Desktop (expose la conversion PDF) |

## Frontend (`static/`)

| Fichier | ~Lignes | Rôle |
|---|---|---|
| `js/app.js` | 2400 | Orchestrateur UI : Monaco, aperçu, conversion, chat IA, imports, tailoring, ATS (zones décrites dans son en-tête) |
| `js/resume-form.js` | 620 | Mode formulaire structuré — **source de vérité JSON** du CV, régénère le HTML du template « sobre » |
| `js/export-jsonresume.js` | 130 | Export vers le standard JSON Resume (Reactive Resume) |
| `js/history.js` | 310 | Page Historique : localStorage + IndexedDB, rechargement/regénération |
| `css/main.css` | 820 | Styles app + classes des templates CV (synchrones avec `prompts.py` et `resume-form.js`) |
| `css/history.css` | 185 | Styles de la page Historique |

## Templates Jinja (`templates/`)

`index.html` (app principale), `history.html`, `login.html` (mode remote).

## Tests (`tests/`)

- `pytest` : `test_endpoints.py`, `test_ai_engine.py`, `test_pdf_engine.py`, `test_archive.py`, `test_quota.py`, `test_auth.py`, `test_ats_score.py`, `test_pack.py`, `test_editor_chat.py` (+ `conftest.py`).
- Playwright JS : `test_resume_form.spec.js` + fixture `resume_form_test.html` (parité schéma JSON du formulaire).

## Config & déploiement

| Fichier | Rôle |
|---|---|
| `Dockerfile` + `render.yaml` | Déploiement **Render.com** (Gunicorn, `REMOTE_MODE=1`) |
| `.env.example` | Variables attendues (`GEMINI_API_KEY`, `APP_PASSWORD`, `DAILY_QUOTA`…) |
| `ruff.toml`, `pytest.ini` | Lint + tests (CI : `.github/workflows/`) |
| `requirements.txt` / `-dev.txt` | Dépendances prod / dev |

## Docs

`CLAUDE.md` (règles IA) → `PROJECT_INDEX.md` (architecture + angles morts) → `TODO.md` (roadmap) → `docs/AUDIT-2026-06-10.md` (audit).

## Quel fichier pour quelle tâche ?

- **Nouvel endpoint / bug API** → `app.py` (+ `quota.py` si IA)
- **Comportement IA / prompts** → `prompts.py` (texte) ou `ai_engine.py` (transport/parsing)
- **Bug d'affichage du CV** → `resume-form.js` + `css/main.css` (et `prompts.py` si les squelettes divergent)
- **Schéma JSON du CV** → `resume-form.js` (source de vérité) + `test_resume_form.spec.js`
- **PDF mal rendu** → `pdf_engine.py`
- **Scraping bloqué** → `scraper.py`
- **Historique** → `archive.py` (backend) + `history.js` (front)
