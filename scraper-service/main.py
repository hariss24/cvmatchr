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
