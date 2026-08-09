# Mission 9 — Microservice de scraping Camoufox (`scraper-service/`)

Tu es un développeur chargé de créer un micro-service Python de scraping furtif
pour **CV Tailor**. Travaille sur la branche **`camoufox-scraper`** (créée
depuis `main` ; si le worktree `.worktrees/camoufox-scraper` existe déjà,
travaille dedans). Ne touche à **rien** dans `web/`.

## Contexte

L'extracteur d'offres de l'app Next.js (`web/src/lib/scraper/scraper.ts`)
échoue sur LinkedIn/Indeed (protections anti-bot). Ce micro-service utilise
**Camoufox** (Firefox modifié anti-détection, API Playwright) pour extraire le
texte d'une offre. Il tournera en local (`http://127.0.0.1:8765`) et sera
appelé par Next.js en fallback (Mission 10). Il doit être prêt pour un
hébergement futur : re-validation SSRF et token d'auth optionnel.

## Fichiers à créer

- `scraper-service/main.py`
- `scraper-service/requirements.txt`
- `scraper-service/README.md`
- `scraper-service/.gitignore`
- `scraper-service/Dockerfile`
- `scraper-service/.dockerignore`
- `Lancer Scraper (Camoufox).bat` (racine du repo)

## 1. `scraper-service/requirements.txt`

```
fastapi>=0.115
uvicorn[standard]>=0.30
camoufox[geoip]>=0.4
```

## 2. `scraper-service/main.py`

Code complet (respecte-le, y compris les messages d'erreur en français —
parité avec `web/src/lib/scraper/ssrf.ts`) :

```python
import ipaddress
import os
import socket
from urllib.parse import urlparse

from camoufox.async_api import AsyncCamoufox
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="cv-tailor scraper (Camoufox)")

MAX_CHARS = 15_000
NAV_TIMEOUT_MS = 30_000

# Mêmes sélecteurs candidats que web/src/lib/scraper/scraper.ts
CANDIDATE_SELECTORS = [
    '[class*="job-description"]',
    '[class*="offer-description"]',
    '[class*="jobDescription"]',
    '[class*="posting-description"]',
    '[data-qa="job-description"]',
    "article",
    "main",
    "body",
]


class ScrapeRequest(BaseModel):
    url: str


def assert_public_http_url(url: str) -> None:
    """Re-validation SSRF : même politique que web/src/lib/scraper/ssrf.ts."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL invalide : seuls http et https sont autorisés.")
    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail="URL invalide : hôte manquant.")
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Impossible de résoudre l'hôte.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        blocked = (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
            or (ip.version == 4 and ip in ipaddress.ip_network("100.64.0.0/10"))  # CGN
            or (ip.version == 4 and ip in ipaddress.ip_network("198.18.0.0/15"))  # benchmarking
        )
        if blocked:
            raise HTTPException(status_code=403, detail="URL non autorisée.")


def check_token(authorization: str | None) -> None:
    """Si SCRAPER_TOKEN est défini, exige `Authorization: Bearer <token>`."""
    expected = os.environ.get("SCRAPER_TOKEN")
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Token invalide.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/scrape")
async def scrape(req: ScrapeRequest, authorization: str | None = Header(default=None)) -> dict[str, str]:
    check_token(authorization)
    assert_public_http_url(req.url)

    try:
        async with AsyncCamoufox(headless=True) as browser:
            page = await browser.new_page()
            await page.goto(req.url, timeout=NAV_TIMEOUT_MS, wait_until="domcontentloaded")
            # Laisse le JS de la page (challenges, hydratation) se terminer.
            await page.wait_for_timeout(3000)
            title = await page.title()

            text = ""
            for sel in CANDIDATE_SELECTORS:
                locator = page.locator(sel)
                if await locator.count() > 0:
                    candidate = (await locator.first.inner_text()).strip()
                    if len(candidate) > 100:
                        text = candidate
                        break
    except HTTPException:
        raise
    except Exception as exc:  # timeout navigation, crash navigateur…
        raise HTTPException(status_code=502, detail=f"Échec du scraping : {exc}")

    if not text:
        raise HTTPException(status_code=422, detail="Aucun contenu exploitable extrait.")

    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS] + "... [TRONQUÉ]"

    return {"text": text, "title": title}
```

## 3. `scraper-service/.gitignore`

```
.venv/
__pycache__/
```

## 4. `scraper-service/README.md`

```markdown
# scraper-service — extraction d'offres via Camoufox

Micro-service local appelé par CV Tailor (`web/`) quand le fetch direct est
bloqué (LinkedIn, Indeed…). Voir la spec :
`docs/archive/superpowers/specs/2026-07-17-camoufox-scraper-design.md`.

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
```

## 5. `scraper-service/Dockerfile`

Prépare l'hébergement futur (Railway/Fly) — le service reste lancé en local
via le .bat au quotidien, mais l'image doit être constructible dès maintenant.

```dockerfile
FROM python:3.12-slim

# Dépendances système du navigateur Firefox/Camoufox (headless)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 libx11-xcb1 libasound2 libdbus-glib-1-2 libxtst6 \
    libxrandr2 libpci3 libegl1 libxcomposite1 libxdamage1 libxfixes3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Télécharge le navigateur Camoufox dans l'image
RUN python -m camoufox fetch

COPY main.py .

EXPOSE 8765
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8765"]
```

## 6. `scraper-service/.dockerignore`

```
.venv/
__pycache__/
README.md
```

## 7. `Lancer Scraper (Camoufox).bat` (racine)

```bat
@echo off
title Scraper Camoufox
echo ==========================================
echo Demarrage du scraper Camoufox (port 8765)...
echo ==========================================
echo.

cd scraper-service
call .venv\Scripts\activate.bat
python -m uvicorn main:app --host 127.0.0.1 --port 8765

pause
```

## Vérifications (obligatoires avant de conclure)

Depuis `scraper-service/` avec le venv activé :

1. `python -m uvicorn main:app --port 8765` démarre sans erreur.
2. `curl http://127.0.0.1:8765/health` → `{"status":"ok"}`.
3. `curl -X POST http://127.0.0.1:8765/scrape -H "Content-Type: application/json" -d "{\"url\": \"http://127.0.0.1/admin\"}"` → HTTP 403 `URL non autorisée.`
4. `curl -X POST http://127.0.0.1:8765/scrape -H "Content-Type: application/json" -d "{\"url\": \"ftp://example.com\"}"` → HTTP 400.
5. Scraping réel : `POST /scrape` avec une URL d'offre publique (ex. une offre
   Welcome to the Jungle) renvoie `{"text": "...", "title": "..."}` avec un
   texte substantiel.
6. Token : relancer avec `set SCRAPER_TOKEN=secret123` ; `POST /scrape` sans
   header → 401 ; avec `-H "Authorization: Bearer secret123"` → OK.
7. Docker (si Docker Desktop est disponible sur la machine) :
   `docker build -t cv-tailor-scraper scraper-service/` doit réussir, puis
   `docker run --rm -p 8765:8765 cv-tailor-scraper` +
   `curl http://127.0.0.1:8765/health` → `{"status":"ok"}`.
   Si Docker n'est pas installé, le signaler dans le rapport final sans
   bloquer la mission (le build sera vérifié au moment du déploiement).

## Commit

```
feat(scraper): microservice Camoufox local pour l'extraction d'offres bloquées

Nouveau service FastAPI (scraper-service/) : POST /scrape pilote un Firefox
furtif (Camoufox) pour extraire le texte des offres LinkedIn/Indeed que le
fetch direct ne peut pas atteindre. SSRF revalidé côté Python, token Bearer
optionnel et Dockerfile inclus pour l'hébergement futur (SaaS). Lancement
local via .bat dédié.
```
