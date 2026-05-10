"""HTML -> PDF rendering engine.

Deux backends :
- Playwright (local/desktop) : rendu Chromium haute fidélité.
- WeasyPrint (serverless/Vercel) : pur Python, pas de Chromium.

Sélection du backend :
  1. Variable d'env PDF_ENGINE=weasyprint  → WeasyPrint
  2. Playwright non installé               → WeasyPrint automatiquement
  3. Playwright installé                   → Playwright (défaut)
"""
import os

# ---- formats et marges autorisés (whitelist contre injections CSS) ----------
VALID_FORMATS: frozenset[str] = frozenset({"A4", "A3", "A5", "Letter", "Legal", "Tabloid"})
VALID_MARGINS: frozenset[str] = frozenset({"0", "5mm", "10mm", "15mm", "20mm", "25mm", "30mm"})

# ---- détection du backend au démarrage (une seule fois) ---------------------
_want_weasyprint: bool = os.environ.get("PDF_ENGINE", "").lower() == "weasyprint"

try:
    import playwright as _pw_pkg  # noqa: F401
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False


# ---- API publique ------------------------------------------------------------

def html_to_pdf_bytes(
    html: str,
    page_format: str = "A4",
    margin: str = "0",
    background: bool = True,
) -> bytes:
    """Convertit une chaîne HTML en bytes PDF.

    Raises:
        ValueError: si `page_format` ou `margin` n'est pas dans la liste blanche.
        RuntimeError: si le rendu échoue.
    """
    if page_format not in VALID_FORMATS:
        raise ValueError(f"Format non supporté : {page_format!r}. Valeurs acceptées : {sorted(VALID_FORMATS)}")
    if margin not in VALID_MARGINS:
        raise ValueError(f"Marge non supportée : {margin!r}. Valeurs acceptées : {sorted(VALID_MARGINS)}")

    if _want_weasyprint or not _PLAYWRIGHT_AVAILABLE:
        return _weasyprint_render(html, page_format, margin)
    return _playwright_render(html, page_format, margin, background)


# ---- backends privés --------------------------------------------------------

def _playwright_render(html: str, page_format: str, margin: str, background: bool) -> bytes:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            # Timeout de 30 s pour le chargement + 60 s pour la génération PDF
            page.set_content(html, wait_until="networkidle", timeout=30_000)
            return page.pdf(
                format=page_format,
                print_background=background,
                prefer_css_page_size=True,
                margin={"top": margin, "right": margin, "bottom": margin, "left": margin},
                timeout=60_000,
            )
        finally:
            browser.close()


def _weasyprint_render(html: str, page_format: str, margin: str) -> bytes:
    import weasyprint  # noqa: PLC0415

    stylesheets: list[weasyprint.CSS] = []
    # Injecter une règle @page uniquement quand l'utilisateur choisit
    # une marge explicite (≠ "0" = "CSS gère tout").
    # Quand margin == "0", on laisse le CSS du document contrôler @page.
    if margin and margin != "0":
        override = f"@page {{ margin: {margin}; }}"
        stylesheets.append(weasyprint.CSS(string=override))

    return weasyprint.HTML(string=html).write_pdf(
        stylesheets=stylesheets or None,
    )
