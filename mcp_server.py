"""MCP server exposing the HTML -> PDF converter to Claude desktop.

Configure in `%APPDATA%\\Claude\\claude_desktop_config.json` (or the
equivalent on macOS/Linux):

    {
      "mcpServers": {
        "html-to-pdf": {
          "command": "python",
          "args": ["C:\\\\Users\\\\tahet\\\\projects\\\\cv-tailor\\\\mcp_server.py"]
        }
      }
    }

Restart Claude desktop and the `convert_html_to_pdf` and
`list_recent_documents` tools become available.

Logs go to stderr — never to stdout, which is reserved for the MCP
protocol.
"""

import asyncio
import os
import sys

from mcp.server.fastmcp import FastMCP

import archive
from pdf_engine import html_to_pdf_bytes


def _log(msg: str) -> None:
    print(f"[html-to-pdf-mcp] {msg}", file=sys.stderr, flush=True)


mcp = FastMCP("html-to-pdf")


@mcp.tool()
async def convert_html_to_pdf(
    html: str,
    company: str = "",
    role: str = "",
    doc_type: str = "CV",
    page_format: str = "A4",
    margin: str = "0",
    notes: str = "",
    open_after: bool = True,
) -> dict:
    """Convert an HTML document into a PDF and archive it.

    Arguments:
        html: Full HTML document (CSS in <style> tags is supported).
        company: Target company name (used in the filename).
        role: Job title (used as filename fallback if company is empty).
        doc_type: One of "CV", "Lettre", "Autre".
        page_format: Page size: A4, Letter, Legal.
        margin: Outer margin (e.g. "0", "10mm"). Pass "0" to let the
            HTML's own @page CSS rules drive the layout.
        notes: Free-text notes saved with the archive entry.
        open_after: If true, open the generated PDF in the default viewer.

    Returns a dict with the saved entry: id, filename, pdf_path,
    html_path, created_at.
    """
    if not html or not html.strip():
        raise ValueError("html is empty")

    _log(f"converting doc_type={doc_type} company={company!r} role={role!r}")
    pdf_bytes = await asyncio.to_thread(
        html_to_pdf_bytes, html, page_format=page_format, margin=margin
    )

    entry = archive.save_document(
        html=html,
        pdf_bytes=pdf_bytes,
        doc_type=doc_type,
        company=company,
        role=role,
        notes=notes,
    )
    _log(f"archived as {entry['filename']}")

    if open_after:
        try:
            os.startfile(entry["pdf_path"])  # Windows-only; harmless to try elsewhere
        except (AttributeError, OSError) as e:
            _log(f"could not open PDF automatically: {e}")

    return entry


@mcp.tool()
def list_recent_documents(limit: int = 10) -> list[dict]:
    """List the most recent generated documents from the archive."""
    return archive.list_documents(limit=limit)


@mcp.tool()
def get_archive_dir() -> str:
    """Return the absolute path of the archive directory."""
    return str(archive.ensure_archive_dir())


if __name__ == "__main__":
    archive.ensure_archive_dir()
    _log(f"archive dir: {archive.ARCHIVE_DIR}")
    mcp.run()
