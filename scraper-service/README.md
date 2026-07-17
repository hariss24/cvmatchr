# scraper-service — extraction d'offres via Camoufox

Micro-service local appelé par CV Tailor (`web/`) quand le fetch direct est
bloqué (LinkedIn, Indeed…). Voir la spec :
`docs/superpowers/specs/2026-07-17-camoufox-scraper-design.md`.

## Installation (une fois)

```bash
cd scraper-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
camoufox fetch   # télécharge le navigateur Camoufox (~200 Mo)
```

## Lancement

Double-cliquer `Lancer Scraper (Camoufox).bat` à la racine du repo, ou :

```bash
cd scraper-service
.venv\Scripts\activate
python -m uvicorn main:app --host 127.0.0.1 --port 8765
```

## Test rapide

```bash
curl http://127.0.0.1:8765/health
curl -X POST http://127.0.0.1:8765/scrape -H "Content-Type: application/json" -d "{\"url\": \"https://www.welcometothejungle.com/fr/jobs\"}"
```

## Variables d'environnement

- `SCRAPER_TOKEN` (optionnel) : si défini, chaque requête `/scrape` doit
  porter le header `Authorization: Bearer <token>`. Obligatoire le jour où le
  service est hébergé sur Internet (Railway/Fly), inutile en local.
