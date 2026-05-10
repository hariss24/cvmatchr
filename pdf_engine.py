"""HTML -> PDF rendering engine.

Supports two backends:
- Playwright (local/desktop): Chromium haute fidélité.
- WeasyPrint (serverless/Vercel): pur Python, pas de Chromium.

Sélection du backend :
  1. Variable d'env  PDF_ENGINE=weasyprint  → WeasyPrint
  2. Playwright non installé                → WeasyPrint automatiquement
  3. Playwright installé                    → Playwright (comportement par défaut)
"""
import os

_want_weasyprint = os.environ.get("PDF_ENGINE", "").lower() == "weasyprint"


def _playwright_available() -> bool:
    try:
        import playwright  # noqa: F401
        return True
    except ImportError:
        return False


def html_to_pdf_bytes(
    html: str,
    page_format: str = "A4",
    margin: str = "0",
    background: bool = True,
) -> bytes:
    """Convertit une chaîne HTML en bytes PDF."""
    if _want_weasyprint or not _playwright_available():
        return _weasyprint_render(html, page_format, margin)
    return _playwright_render(html, page_format, margin, background)


def _playwright_render(html: str, page_format: str, margin: str, background: bool) -> bytes:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            return page.pdf(
                format=page_format,
                print_background=background,
                prefer_css_page_size=True,
                margin={"top": margin, "right": margin, "bottom": margin, "left": margin},
            )
        finally:
            browser.close()


def _weasyprint_render(html: str, page_format: str, margin: str) -> bytes:
    import weasyprint  # noqa: PLC0415
    # Règle @page de base ; les templates peuvent la surcharger via leur propre CSS.
    base_css = (
        f"@page {{ size: {page_format}; "
        f"margin: {margin if margin and margin != '0' else '0'}; }}"
    )
    return weasyprint.HTML(string=html).write_pdf(
        stylesheets=[weasyprint.CSS(string=base_css)]
    )
