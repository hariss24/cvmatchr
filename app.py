"""
Convertisseur HTML/CSS -> PDF (interface web locale).

Utilisation :
    Double-cliquez sur ce fichier. Le navigateur s'ouvre sur http://127.0.0.1:5050
    Collez votre HTML (CSS inclus dans <style>), remplissez eventuellement
    les champs Type/Entreprise/Poste, cliquez "Convertir en PDF".

    Chaque conversion est archivee dans Documents/CV-Archive/ avec ses
    metadonnees. Page /history pour parcourir l'archive.

Pour quitter :
    Cliquez sur le bouton "Quitter" dans la petite fenetre de controle.
"""

import io
import json as _json
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

import tkinter as tk
from flask import Flask, abort, jsonify, render_template_string, request, send_file

import archive
from pdf_engine import html_to_pdf_bytes

PORT = 5050
URL = f"http://127.0.0.1:{PORT}"

PAGE = r"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>HTML -> PDF</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0f1115; color: #e6e6e6; overflow: hidden; }
  .wrap { display: flex; flex-direction: column; height: 100vh; padding: 16px 20px; gap: 10px; }
  .topbar { display: flex; justify-content: space-between; align-items: baseline; }
  h1 { font-size: 20px; margin: 0; }
  a { color: #4f8cff; text-decoration: none; }
  a:hover { text-decoration: underline; }

  .meta { display: grid; grid-template-columns: 110px 1fr 1fr; gap: 8px; }
  .field { display: flex; flex-direction: column; gap: 3px; }
  .field label { font-size: 11px; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px; }
  select, input[type=text], textarea {
    background: #1b1f27; color: #e6e6e6; border: 1px solid #2a2f3a;
    border-radius: 6px; padding: 7px 9px; font-size: 13px;
  }

  .split { display: flex; flex: 1 1 auto; min-height: 0; gap: 6px; }
  .pane { display: flex; flex-direction: column; min-height: 0; min-width: 0; border: 1px solid #2a2f3a; border-radius: 8px; overflow: hidden; }
  .pane-title { background: #14181f; color: #9aa0a6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 12px; border-bottom: 1px solid #2a2f3a; display: flex; justify-content: space-between; align-items: center; }
  .pane-title .actions-mini button { background: #2a2f3a; color: #e6e6e6; border: 0; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; margin-left: 4px; }
  .pane-title .actions-mini button:hover { background: #353b48; }
  #editor { flex: 1; min-height: 0; }
  #preview { flex: 1; border: 0; background: white; }
  .splitter { width: 6px; cursor: col-resize; background: transparent; }
  .splitter:hover { background: #2a2f3a; }

  .editor-pane { flex: 0 0 50%; }
  .preview-pane { flex: 1 1 50%; }

  details { color: #9aa0a6; font-size: 13px; }
  summary { cursor: pointer; padding: 4px 0; }
  .opts { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; align-items: center; }
  .opt { display: flex; gap: 6px; align-items: center; }
  .opt label { font-size: 13px; color: #c8c8c8; }
  .filename-preview { color: #9aa0a6; font-size: 12px; font-family: ui-monospace, Consolas, monospace; margin-top: 4px; }
  #notes { width: 100%; min-height: 38px; resize: vertical; margin-top: 8px; font-family: ui-monospace, Consolas, monospace; }

  .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  button.go {
    background: #4f8cff; color: white; border: 0; border-radius: 8px;
    padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  button.go:hover { background: #3d7af0; }
  button.go:disabled { background: #444; cursor: wait; }
  button.ghost { background: #2a2f3a; color: #e6e6e6; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 13px; cursor: pointer; }
  button.ghost:hover { background: #353b48; }
  #status { font-size: 13px; color: #9aa0a6; }
  #status.ok { color: #5dd39e; }
  #status.err { color: #ff6b6b; }
</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css" />
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <h1>HTML/CSS -> PDF</h1>
    <div><a href="/history">Historique &rsaquo;</a></div>
  </div>

  <div class="meta">
    <div class="field">
      <label for="doc_type">Type</label>
      <select id="doc_type">
        <option value="CV" selected>CV</option>
        <option value="Lettre">Lettre</option>
        <option value="Autre">Autre</option>
      </select>
    </div>
    <div class="field">
      <label for="company">Entreprise</label>
      <input type="text" id="company" placeholder="Acme Corp" />
    </div>
    <div class="field">
      <label for="role">Poste</label>
      <input type="text" id="role" placeholder="Software Engineer" />
    </div>
  </div>

  <div class="split" id="split">
    <div class="pane editor-pane" id="editor-pane">
      <div class="pane-title">
        <span>Editeur HTML</span>
        <div class="actions-mini">
          <button type="button" id="snippet-page">@page A4</button>
          <button type="button" id="snippet-pagebreak">page-break</button>
          <button type="button" id="format-btn" title="Formater (Alt+Shift+F)">Format</button>
        </div>
      </div>
      <div id="editor"></div>
    </div>
    <div class="splitter" id="splitter"></div>
    <div class="pane preview-pane">
      <div class="pane-title">
        <span>Prévisualisation</span>
        <div class="actions-mini">
          <button type="button" id="refresh-preview">Rafraichir</button>
        </div>
      </div>
      <iframe id="preview" sandbox="allow-same-origin"></iframe>
    </div>
  </div>

  <details>
    <summary>Options PDF (avancees)</summary>
    <div class="opts">
      <div class="opt">
        <label for="format">Format</label>
        <select id="format">
          <option value="A4" selected>A4</option>
          <option value="Letter">Letter</option>
          <option value="Legal">Legal</option>
        </select>
      </div>
      <div class="opt">
        <label for="margin">Marges</label>
        <select id="margin">
          <option value="0" selected>Aucune (CSS gere tout)</option>
          <option value="10mm">10 mm</option>
          <option value="15mm">15 mm</option>
          <option value="20mm">20 mm</option>
        </select>
      </div>
      <div class="opt">
        <label for="filename">Nom du fichier</label>
        <input type="text" id="filename" placeholder="auto" />
      </div>
      <div class="opt">
        <label><input type="checkbox" id="bg" checked /> Inclure les arrieres-plans</label>
      </div>
    </div>
    <div class="filename-preview" id="filename_preview"></div>
    <textarea id="notes" placeholder="Notes pour vous-meme, conservees dans l'archive..."></textarea>
  </details>

  <div class="actions">
    <button id="go" class="go">Convertir en PDF</button>
    <button id="clear" class="ghost" type="button">Effacer</button>
    <span id="status"></span>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
<script>
const $ = (id) => document.getElementById(id);
const setStatus = (msg, cls) => { const s = $('status'); s.textContent = msg; s.className = cls || ''; };

const STORAGE_KEY = 'html-to-pdf:draft';
const STARTER = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Mon CV</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: -apple-system, sans-serif; line-height: 1.4; color: #222; }
  h1 { color: #1a73e8; margin: 0 0 4px; }
  .sub { color: #666; }
</style>
</head>
<body>
  <h1>Prenom Nom</h1>
  <p class="sub">Titre / Poste recherche</p>
  <p>Decrivez-vous ici...</p>
</body>
</html>`;

let editor;

function slug(s) {
  if (!s) return '';
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
          .replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '');
}

function autoFilename() {
  const today = new Date().toISOString().slice(0, 10);
  const docType = $('doc_type').value || 'Document';
  const company = slug($('company').value);
  const role = slug($('role').value);
  const tail = company || role || '';
  return tail ? `${docType}_Hariss_${tail}_${today}.pdf` : `${docType}_Hariss_${today}.pdf`;
}

function refreshFilenamePreview() {
  const custom = $('filename').value.trim();
  const auto = autoFilename();
  $('filename_preview').textContent = custom ? `Nom : ${custom}` : `Nom auto : ${auto}`;
}

['doc_type', 'company', 'role', 'filename'].forEach(id => $(id).addEventListener('input', refreshFilenamePreview));
refreshFilenamePreview();

let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const value = editor ? editor.getValue() : '';
    $('preview').srcdoc = value;
    try { localStorage.setItem(STORAGE_KEY, value); } catch (_) { /* quota */ }
  }, 400);
}

require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
  const initial = localStorage.getItem(STORAGE_KEY) || STARTER;
  editor = monaco.editor.create($('editor'), {
    value: initial,
    language: 'html',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    fontSize: 13,
    tabSize: 2,
    scrollBeyondLastLine: false,
  });
  editor.onDidChangeModelContent(schedulePreview);
  $('preview').srcdoc = editor.getValue();

  $('format-btn').onclick = () => editor.getAction('editor.action.formatDocument').run();
  $('snippet-page').onclick = () => insertSnippet('@page { size: A4; margin: 15mm; }\n');
  $('snippet-pagebreak').onclick = () => insertSnippet('<div style="page-break-after: always;"></div>\n');
  $('refresh-preview').onclick = () => { $('preview').srcdoc = editor.getValue(); };

  const params = new URLSearchParams(location.search);
  const loadId = params.get('load');
  if (loadId) {
    fetch(`/api/history/${encodeURIComponent(loadId)}`).then(r => r.json()).then(entry => {
      if (!entry || !entry.id) return;
      $('doc_type').value = entry.doc_type || 'CV';
      $('company').value = entry.company || '';
      $('role').value = entry.role || '';
      $('notes').value = entry.notes || '';
      return fetch(`/api/history/${encodeURIComponent(loadId)}/html`).then(r => r.text()).then(html => {
        editor.setValue(html);
      });
    }).then(refreshFilenamePreview);
  }
});

function insertSnippet(text) {
  if (!editor) return;
  const sel = editor.getSelection();
  editor.executeEdits('snippet', [{ range: sel, text, forceMoveMarkers: true }]);
  editor.focus();
}

$('clear').onclick = () => {
  if (editor) editor.setValue('');
  ['company', 'role', 'filename', 'notes'].forEach(id => $(id).value = '');
  setStatus(''); refreshFilenamePreview();
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
};

$('go').onclick = async () => {
  const html = editor ? editor.getValue() : '';
  if (!html.trim()) { setStatus("Editez du HTML d'abord.", 'err'); return; }
  const btn = $('go'); btn.disabled = true; btn.textContent = 'Conversion...';
  setStatus('Generation du PDF...', '');
  try {
    const res = await fetch('/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        doc_type: $('doc_type').value,
        company: $('company').value.trim(),
        role: $('role').value.trim(),
        notes: $('notes').value.trim(),
        format: $('format').value,
        margin: $('margin').value,
        background: $('bg').checked,
        filename: $('filename').value.trim(),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
      setStatus('Erreur : ' + (err.error || res.statusText), 'err');
      return;
    }
    const meta = JSON.parse(res.headers.get('X-Archive-Entry') || '{}');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.filename || 'document.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF telecharge et archive sous ${meta.filename}`, 'ok');
  } catch (e) {
    setStatus('Erreur : ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Convertir en PDF';
  }
};

(function initSplitter() {
  const split = $('split');
  const splitter = $('splitter');
  const editorPane = $('editor-pane');
  let dragging = false;
  splitter.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); document.body.style.cursor = 'col-resize'; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = split.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(15, Math.min(85, (x / rect.width) * 100));
    editorPane.style.flexBasis = `${pct}%`;
  });
  window.addEventListener('mouseup', () => { dragging = false; document.body.style.cursor = ''; });
})();
</script>
</body>
</html>
"""

HISTORY_PAGE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Historique</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0f1115; color: #e6e6e6; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }
  .topbar { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0; }
  a { color: #4f8cff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  input#search { background: #1b1f27; color: #e6e6e6; border: 1px solid #2a2f3a; border-radius: 6px; padding: 8px 12px; font-size: 13px; width: 100%; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #2a2f3a; font-size: 13px; vertical-align: top; }
  th { color: #9aa0a6; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  td.actions { text-align: right; white-space: nowrap; }
  td.actions button, td.actions a.btn { margin-left: 6px; display: inline-block; }
  button.ghost, a.btn {
    background: #2a2f3a; color: #e6e6e6; border: 0; border-radius: 5px;
    padding: 5px 10px; font-size: 12px; cursor: pointer; text-decoration: none;
  }
  button.ghost:hover, a.btn:hover { background: #353b48; text-decoration: none; }
  button.danger { background: #5a1e1e; }
  button.danger:hover { background: #7a2828; }
  .empty { color: #9aa0a6; padding: 24px; text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #2a2f3a; color: #c8c8c8; }
  tr:hover { background: #14181f; }
  .filename { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #c8c8c8; }
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <h1>Historique</h1>
    <a href="/">&lsaquo; Retour</a>
  </div>
  <input type="text" id="search" placeholder="Rechercher entreprise, poste, notes..." />
  <div id="root"></div>
</div>
<script>
const $ = (id) => document.getElementById(id);
let entries = [];

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'onclick') node.onclick = v;
    else if (k === 'text') node.textContent = v;
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function buildRow(e) {
  const id = e.id;
  return el('tr', { 'data-id': id }, [
    el('td', { text: fmtDate(e.created_at) }),
    el('td', {}, [el('span', { class: 'badge', text: e.doc_type || '' })]),
    el('td', { text: e.company || '-' }),
    el('td', { text: e.role || '-' }),
    el('td', { class: 'filename', title: e.filename, text: e.filename || '' }),
    el('td', { class: 'actions' }, [
      el('a', { class: 'btn', href: `/api/history/${encodeURIComponent(id)}/pdf`, target: '_blank', text: 'Voir PDF' }),
      el('a', { class: 'btn', href: `/?load=${encodeURIComponent(id)}`, text: 'Recharger' }),
      el('button', { class: 'ghost', onclick: () => openLocal(id), text: 'Ouvrir local' }),
      el('button', { class: 'ghost danger', onclick: () => del(id), text: 'Supprimer' }),
    ]),
  ]);
}

function render(filter='') {
  const f = filter.toLowerCase();
  const filtered = !f ? entries : entries.filter(e =>
    (e.company || '').toLowerCase().includes(f) ||
    (e.role || '').toLowerCase().includes(f) ||
    (e.doc_type || '').toLowerCase().includes(f) ||
    (e.notes || '').toLowerCase().includes(f) ||
    (e.filename || '').toLowerCase().includes(f)
  );
  const root = $('root');
  root.replaceChildren();
  if (!filtered.length) {
    root.appendChild(el('div', { class: 'empty', text: 'Aucun document.' }));
    return;
  }
  const head = el('thead', {}, [el('tr', {}, [
    el('th', { text: 'Date' }),
    el('th', { text: 'Type' }),
    el('th', { text: 'Entreprise' }),
    el('th', { text: 'Poste' }),
    el('th', { text: 'Fichier' }),
    el('th'),
  ])]);
  const body = el('tbody', {}, filtered.map(buildRow));
  root.appendChild(el('table', {}, [head, body]));
}

async function load() {
  const r = await fetch('/api/history');
  entries = await r.json();
  render($('search').value);
}

async function del(id) {
  if (!confirm('Supprimer cette entree (PDF et HTML) ?')) return;
  const r = await fetch(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (r.ok) load();
}

async function openLocal(id) {
  await fetch(`/api/history/${encodeURIComponent(id)}/open`, { method: 'POST' });
}

$('search').addEventListener('input', e => render(e.target.value));
load();
</script>
</body>
</html>
"""

app = Flask(__name__)


@app.route("/")
def index():
    return render_template_string(PAGE)


@app.route("/history")
def history_page():
    return render_template_string(HISTORY_PAGE)


@app.route("/convert", methods=["POST"])
def convert():
    data = request.get_json(silent=True) or {}
    html = data.get("html", "")
    if not html.strip():
        return jsonify({"error": "HTML vide."}), 400

    fmt = data.get("format", "A4")
    margin = data.get("margin", "0")
    background = bool(data.get("background", True))
    doc_type = data.get("doc_type", "CV")
    company = (data.get("company") or "").strip()
    role = (data.get("role") or "").strip()
    notes = (data.get("notes") or "").strip()
    custom_filename = (data.get("filename") or "").strip()

    try:
        pdf_bytes = html_to_pdf_bytes(html, page_format=fmt, margin=margin, background=background)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    entry = archive.save_document(
        html=html,
        pdf_bytes=pdf_bytes,
        doc_type=doc_type,
        company=company,
        role=role,
        notes=notes,
        custom_filename=custom_filename,
    )

    response = send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=entry["filename"],
    )
    response.headers["X-Archive-Entry"] = _json.dumps({
        "id": entry["id"], "filename": entry["filename"], "created_at": entry["created_at"],
    })
    response.headers["Access-Control-Expose-Headers"] = "X-Archive-Entry"
    return response


@app.route("/api/history")
def api_history():
    return jsonify(archive.list_documents())


@app.route("/api/history/<doc_id>")
def api_history_get(doc_id):
    entry = archive.get_document(doc_id)
    if not entry:
        abort(404)
    return jsonify(entry)


@app.route("/api/history/<doc_id>/html")
def api_history_html(doc_id):
    entry = archive.get_document(doc_id)
    if not entry:
        abort(404)
    html_path = Path(entry["html_path"])
    if not html_path.exists():
        abort(404)
    return html_path.read_text(encoding="utf-8"), 200, {"Content-Type": "text/plain; charset=utf-8"}


@app.route("/api/history/<doc_id>/pdf")
def api_history_pdf(doc_id):
    entry = archive.get_document(doc_id)
    if not entry:
        abort(404)
    pdf_path = Path(entry["pdf_path"])
    if not pdf_path.exists():
        abort(404)
    return send_file(pdf_path, mimetype="application/pdf", as_attachment=False, download_name=entry["filename"])


@app.route("/api/history/<doc_id>/open", methods=["POST"])
def api_history_open(doc_id):
    entry = archive.get_document(doc_id)
    if not entry:
        abort(404)
    pdf_path = Path(entry["pdf_path"])
    if not pdf_path.exists():
        abort(404)
    try:
        os.startfile(str(pdf_path))
        return jsonify({"ok": True})
    except (AttributeError, OSError) as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/<doc_id>", methods=["DELETE"])
def api_history_delete(doc_id):
    if archive.delete_document(doc_id):
        return jsonify({"ok": True})
    abort(404)


def lancer_serveur():
    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)


def lancer_navigateur():
    time.sleep(1.0)
    webbrowser.open(URL)


def fenetre_controle():
    root = tk.Tk()
    root.title("Convertisseur HTML -> PDF")
    root.resizable(False, False)
    largeur, hauteur = 360, 160
    x = (root.winfo_screenwidth() - largeur) // 2
    y = (root.winfo_screenheight() - hauteur) // 2
    root.geometry(f"{largeur}x{hauteur}+{x}+{y}")

    tk.Label(root, text="Le serveur tourne sur :", pady=8).pack()
    lien = tk.Label(root, text=URL, fg="#1a73e8", cursor="hand2", font=("Segoe UI", 10, "underline"))
    lien.pack()
    lien.bind("<Button-1>", lambda _e: webbrowser.open(URL))

    tk.Label(root, text="Fermez cette fenetre pour arreter.", fg="#666", pady=8).pack()

    def quitter():
        root.destroy()
        sys.exit(0)

    tk.Button(root, text="Quitter", width=14, command=quitter).pack(pady=6)
    root.protocol("WM_DELETE_WINDOW", quitter)
    root.mainloop()


def main():
    archive.ensure_archive_dir()
    threading.Thread(target=lancer_serveur, daemon=True).start()
    threading.Thread(target=lancer_navigateur, daemon=True).start()
    fenetre_controle()


if __name__ == "__main__":
    main()
