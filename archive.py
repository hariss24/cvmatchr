"""Archive of generated PDFs and their HTML sources.

Documents are stored in ~/Documents/CV-Archive/ alongside a history.json
index file. Both the web UI and the MCP server use this module to persist
generated documents.
"""

import json
import os
import re
import unicodedata
import uuid
from datetime import datetime
from pathlib import Path
from typing import Iterable

OWNER = "Hariss"

# Sur Vercel / Lambda le home n'est pas accessible en écriture → /tmp
_IS_SERVERLESS = bool(
    os.environ.get("VERCEL")
    or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
    or os.environ.get("PDF_ENGINE", "").lower() == "weasyprint"
)
ARCHIVE_DIR = (
    Path("/tmp") / "CV-Archive"
    if _IS_SERVERLESS
    else Path.home() / "Documents" / "CV-Archive"
)
HISTORY_FILE = ARCHIVE_DIR / "history.json"

DOC_TYPES = ("CV", "Lettre", "Autre")


def ensure_archive_dir() -> Path:
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    if not HISTORY_FILE.exists():
        _write_history([])
    return ARCHIVE_DIR


def _slug(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^\w\s-]", "", normalized).strip()
    return re.sub(r"[\s_-]+", "", cleaned)


def make_filename(
    doc_type: str,
    company: str = "",
    role: str = "",
    when: datetime | None = None,
    ext: str = "pdf",
) -> str:
    when = when or datetime.now()
    parts = [doc_type or "Document", OWNER]
    company_slug = _slug(company)
    role_slug = _slug(role)
    if company_slug:
        parts.append(company_slug)
    elif role_slug:
        parts.append(role_slug)
    parts.append(when.strftime("%Y-%m-%d"))
    base = "_".join(p for p in parts if p)
    return f"{base}.{ext}"


def _unique_path(directory: Path, filename: str) -> Path:
    candidate = directory / filename
    if not candidate.exists():
        return candidate
    stem = candidate.stem
    suffix = candidate.suffix
    n = 2
    while True:
        candidate = directory / f"{stem}_{n}{suffix}"
        if not candidate.exists():
            return candidate
        n += 1


def _read_history() -> list[dict]:
    ensure_archive_dir()
    try:
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_history(entries: Iterable[dict]) -> None:
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = HISTORY_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(list(entries), indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(HISTORY_FILE)


def save_document(
    html: str,
    pdf_bytes: bytes,
    doc_type: str = "CV",
    company: str = "",
    role: str = "",
    notes: str = "",
    custom_filename: str = "",
) -> dict:
    ensure_archive_dir()
    when = datetime.now()
    if doc_type not in DOC_TYPES:
        doc_type = "Autre"

    if custom_filename:
        pdf_filename = custom_filename if custom_filename.lower().endswith(".pdf") else f"{custom_filename}.pdf"
    else:
        pdf_filename = make_filename(doc_type, company, role, when, ext="pdf")

    pdf_path = _unique_path(ARCHIVE_DIR, pdf_filename)
    html_path = pdf_path.with_suffix(".html")

    pdf_path.write_bytes(pdf_bytes)
    html_path.write_text(html, encoding="utf-8")

    entry = {
        "id": str(uuid.uuid4()),
        "created_at": when.isoformat(timespec="seconds"),
        "doc_type": doc_type,
        "company": company,
        "role": role,
        "notes": notes,
        "filename": pdf_path.name,
        "pdf_path": str(pdf_path),
        "html_path": str(html_path),
    }

    history = _read_history()
    history.insert(0, entry)
    _write_history(history)
    return entry


def list_documents(limit: int | None = None) -> list[dict]:
    history = _read_history()
    return history[:limit] if limit else history


def get_document(doc_id: str) -> dict | None:
    for entry in _read_history():
        if entry.get("id") == doc_id:
            return entry
    return None


def delete_document(doc_id: str) -> bool:
    history = _read_history()
    remaining = []
    found = None
    for entry in history:
        if entry.get("id") == doc_id:
            found = entry
        else:
            remaining.append(entry)
    if not found:
        return False
    for key in ("pdf_path", "html_path"):
        path = Path(found.get(key, ""))
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass
    _write_history(remaining)
    return True
