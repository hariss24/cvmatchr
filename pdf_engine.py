"""HTML -> PDF rendering engine.

Pure function with no dependency on Flask or MCP — used by both the
web UI and the MCP server.
"""

from playwright.sync_api import sync_playwright


def html_to_pdf_bytes(
    html: str,
    page_format: str = "A4",
    margin: str = "0",
    background: bool = True,
) -> bytes:
    """Render an HTML string into PDF bytes via headless Chromium."""
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
