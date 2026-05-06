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

Everything runs on `127.0.0.1` — your HTML never leaves your machine.

## License

MIT — see [LICENSE](LICENSE).
