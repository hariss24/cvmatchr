# html-to-pdf

A tiny local web app to convert HTML/CSS into a PDF.
Paste your HTML, click a button, the PDF downloads automatically.

Rendering is done by **headless Chromium** via Playwright, so the PDF
matches what you see in a browser.

## Features

- Paste a full HTML document (CSS in `<style>` works)
- Optional knobs: page format (A4 / Letter / Legal), margins, file name, backgrounds
- One-click conversion + auto-download
- Tiny tkinter control window with a "Quit" button to stop the server
- No console window on Windows (when run as `.pyw`)
- **MCP server** so Claude desktop can convert HTML to PDF directly,
  without copy-paste (see below)

## Requirements

- Python 3.10+
- Dependencies in `requirements.txt`
- Chromium browser bundled by Playwright

## Install

```bash
git clone https://github.com/hariss24/html-to-pdf.git
cd html-to-pdf
pip install -r requirements.txt
python -m playwright install chromium
```

## Run

```bash
python app.py
```

## Local and remote modes

The default mode is local and open source friendly: no login is required,
the server binds to `127.0.0.1`, and generated documents are archived under
`~/Documents/CV-Archive/`.

Remote deployments must be protected with a password. Enable remote mode with:

```bash
APP_MODE=remote
REMOTE_AUTH_PASSWORD=change-me
SECRET_KEY=replace-with-a-long-random-string
```

When remote mode is active, the app protects the UI, conversion endpoints,
AI endpoints, and history endpoints behind `/login`. If `APP_MODE=remote`
is set without `REMOTE_AUTH_PASSWORD`, protected routes return a setup error
instead of exposing private documents.

Render deployments are treated as remote automatically. For persistent remote
history, configure `MONGODB_URI`. Without it, archives fall back to temporary
storage and may disappear between container restarts.

See `.env.example` for the recommended environment variables.

Your browser opens on http://127.0.0.1:5050. A small Tk control window
also appears — close it (or click "Quitter") to stop the server.

### Windows: launch without a console window

Rename `app.py` to `app.pyw` (or copy it). Double-clicking the `.pyw`
file uses `pythonw.exe`, which has no terminal window.

To make a desktop shortcut: right-click `app.pyw` → **Send to** → **Desktop**.

## Usage

1. Paste a complete HTML document into the textarea
   (CSS in `<style>` is supported, external stylesheets via `<link>` too
   if they are reachable from your machine)
2. Optionally tweak the page format, margins, backgrounds, file name
3. Click **Convertir en PDF**
4. The PDF is generated and downloaded by your browser

### Tips for good rendering

- Set page size and margins via CSS using `@page`:
  ```css
  @page { size: A4; margin: 15mm; }
  ```
  Then leave the "Marges" option on *Aucune (CSS gère tout)* — the app
  passes `prefer_css_page_size: true` to Chromium.
- Use `print_background` (the **Inclure les arrière-plans** checkbox) if
  your design relies on background colors / images.
- Use `page-break-before` / `page-break-after` to control page breaks.

## How it works

- **Flask** serves a single HTML page with a textarea and a button.
- On submit, the HTML is sent to `/convert`.
- The server spins up **Chromium** via Playwright, calls `page.set_content`
  with your HTML, then `page.pdf(...)` to produce the PDF.
- The PDF bytes stream back to the browser as an attachment.
- The app stores data locally in your browser's **IndexedDB**.
- **Important**: The URL scraping feature uses an AI fallback via **Jina AI** if Playwright is blocked. By using the scraping feature, you consent to sending the URL to Jina's servers for extraction.

Everything runs on `127.0.0.1` — your HTML never leaves your machine, except when explicitly using AI tools or the Jina scraper.

## MCP server (Claude desktop integration)

The repo also ships an MCP server at `mcp_server.py` that exposes the
converter as a tool to Claude desktop. With it configured, Claude can
generate the HTML and convert it to a PDF in one move — no copy-paste.

### Tools exposed

- `convert_html_to_pdf(html, company, role, doc_type, page_format, margin, notes, open_after)`
  Converts HTML to PDF, archives it under `~/Documents/CV-Archive/`,
  and optionally opens the result.
- `list_recent_documents(limit)` lists recent entries from the archive.
- `get_archive_dir()` returns the absolute path of the archive folder.

### Configure Claude desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or
`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "html-to-pdf": {
      "command": "python",
      "args": ["C:\\path\\to\\html-to-pdf\\mcp_server.py"]
    }
  }
}
```

Restart Claude desktop. The new tools appear in the tool palette.

### Archive

Each conversion is saved alongside its HTML source under
`~/Documents/CV-Archive/`, with metadata kept in `history.json`. Filenames
follow the pattern `{doc_type}_Hariss_{company}_{YYYY-MM-DD}.pdf`.

## Export vers Reactive Resume

Le bouton **« Reactive Resume »** (barre d'outils du mode Formulaire, à côté de
« Coller JSON » / « JSON ») exporte le CV courant au format standard
[JSON Resume](https://jsonresume.org/). Reactive Resume sait importer ce format
quelle que soit sa version (il convertit lui-même à l'import).

Flux conseillé : on adapte le CV à une offre dans cette app (tailoring IA, pack),
on clique **Reactive Resume** pour télécharger le `.json`, puis dans Reactive
Resume on fait **Créer un CV → Importer → JSON Resume** et on choisit le fichier.

Champs non transférés (à compléter dans Reactive Resume) :
- **la photo** (Reactive Resume gère mieux les photos directement) ;
- **le type de contrat** d'une expérience (ex. « Stage ») — pas d'équivalent dans
  le standard ;
- les **dates** sont reprises telles quelles (texte) : vérifier qu'elles
  s'affichent bien et les ajuster si besoin.

## License

MIT — see [LICENSE](LICENSE).
