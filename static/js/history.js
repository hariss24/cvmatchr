// ============================================================
// history.js — page Historique (templates/history.html)
// ------------------------------------------------------------
// Liste les CV générés : métadonnées dans localStorage (cv-history),
// sources HTML dans IndexedDB (avec fallback serveur via
// /api/history/<id>/html). Permet de recharger un document dans
// l'éditeur ou de regénérer le PDF via POST /convert.
// ============================================================
const HISTORY_KEY = 'cv-history';
const IDB_DB      = 'html-to-pdf-snapshots';
const IDB_HTML    = 'cv-html-store';
let entries = [];

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function el(tag, attrs, children) {
  attrs    = attrs    || {};
  children = children || [];
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class')        node.className   = v;
    else if (k === 'onclick') node.onclick      = v;
    else if (k === 'text')    node.textContent  = v;
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

// ---- IndexedDB helpers (autonomes, sans dépendance à app.js) ---------------

function _openHistoryIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'ts' });
      }
      if (!db.objectStoreNames.contains(IDB_HTML)) {
        db.createObjectStore(IDB_HTML, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function _deleteHtmlFromIDB(id) {
  try {
    const db = await _openHistoryIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_HTML, 'readwrite');
      tx.objectStore(IDB_HTML).delete(id);
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  } catch (_) {}
}

async function _loadHtmlFromIDB(id) {
  try {
    const db = await _openHistoryIDB();
    return await new Promise((res, rej) => {
      const tx  = db.transaction(IDB_HTML, 'readonly');
      const req = tx.objectStore(IDB_HTML).get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror   = e => rej(e.target.error);
    });
  } catch (_) { return null; }
}

async function _getAllHtmlFromIDB() {
  try {
    const db = await _openHistoryIDB();
    return await new Promise((res, rej) => {
      const tx  = db.transaction(IDB_HTML, 'readonly');
      const req = tx.objectStore(IDB_HTML).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = e => rej(e.target.error);
    });
  } catch (_) { return []; }
}

// ---- Statistiques ---------------------------------------------------------

function trackStat(id, field) {
  try {
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const idx  = hist.findIndex(e => e.id === id);
    if (idx !== -1) {
      hist[idx][field] = (hist[idx][field] || 0) + 1;
      if (field === 'pdf_views') {
        hist[idx]['last_viewed_at'] = new Date().toISOString();
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    }
  } catch (_) {}
}

async function viewPdf(id) {
  const record = await _loadHtmlFromIDB(id);
  if (!record || !record.html) {
    alert("HTML introuvable. Chargez ce document dans l'éditeur et générez le PDF au moins une fois.");
    return;
  }
  try {
    const resp = await fetch('/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: record.html, format: 'A4', margin: '0', background: true }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      alert('Erreur lors de la génération du PDF : ' + (err.error || resp.statusText));
      return;
    }
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    trackStat(id, 'pdf_views');
    await load(); // rafraîchit les compteurs affichés
  } catch (err) {
    alert('Erreur réseau : ' + err.message);
  }
}

// ---- Rendu ----------------------------------------------------------------

function buildRow(e) {
  const id         = e.id;
  const reloadHref = '/?load=' + encodeURIComponent(id);

  const dateStr     = fmtDate(e.created_at);
  const [day, time] = dateStr.split(', ');
  const docType     = e.doc_type || '';
  const typeClass   = 'type-badge type-' + docType.toLowerCase();

  const pdfViews      = e.pdf_views      || 0;
  const editorReloads = e.editor_reloads || 0;

  const statChips = [];
  if (pdfViews > 0) {
    const label = e.last_viewed_at
      ? `Vu ${pdfViews} fois · dernier : ${fmtDate(e.last_viewed_at)}`
      : `Vu ${pdfViews} fois`;
    statChips.push(el('span', { class: 'stat-chip', title: label },
      ['👁 ' + pdfViews]
    ));
  }
  if (editorReloads > 0) {
    statChips.push(el('span', { class: 'stat-chip', title: 'Chargements dans l\'éditeur' },
      ['↩ ' + editorReloads]
    ));
  }

  return el('div', { class: 'history-card', 'data-id': id }, [
    el('div', { class: 'card-date' }, [
      el('div', { class: 'card-date-day',  text: day  || dateStr }),
      el('div', { class: 'card-date-time', text: time || '' }),
    ]),
    el('div', { class: 'card-type' }, [
      el('span', { class: typeClass, text: docType }),
    ]),
    el('div', { class: 'card-company' }, [
      el('div', { class: 'card-label', text: 'Entreprise' }),
      el('div', { class: 'card-val',   text: e.company || '-' }),
    ]),
    el('div', { class: 'card-role' }, [
      el('div', { class: 'card-label', text: 'Poste' }),
      el('div', { class: 'card-val', title: e.job_desc || '', text: e.role || '-' }),
    ]),
    el('div', { class: 'card-filename' }, [
      el('span', { title: e.filename || '', text: e.filename || '' }),
      statChips.length ? el('div', { class: 'card-stats' }, statChips) : null,
    ]),
    el('div', { class: 'card-actions' }, [
      el('button', { class: 'neu-btn-sm view-pdf', onclick: () => viewPdf(id), text: 'Voir PDF' }),
      el('a',      { class: 'neu-btn-sm', href: reloadHref,
                     onclick: () => trackStat(id, 'editor_reloads'), text: 'Recharger' }),
      el('button', { class: 'neu-btn-sm danger', onclick: () => del(id), text: 'Supprimer' }),
    ]),
  ]);
}

function render(filter) {
  filter = filter || '';
  const f        = filter.toLowerCase();
  const filtered = !f ? entries : entries.filter(e =>
    (e.company  || '').toLowerCase().includes(f) ||
    (e.role     || '').toLowerCase().includes(f) ||
    (e.doc_type || '').toLowerCase().includes(f) ||
    (e.notes    || '').toLowerCase().includes(f) ||
    (e.job_desc || '').toLowerCase().includes(f) ||
    (e.filename || '').toLowerCase().includes(f)
  );
  const root = document.getElementById('root');
  root.replaceChildren();
  if (!filtered.length) {
    root.appendChild(el('div', { class: 'empty', text: 'Aucun document.' }));
    return;
  }
  const list = el('div', { class: 'card-list' });
  filtered.forEach(e => list.appendChild(buildRow(e)));
  root.appendChild(list);
}

function showError(msg) {
  const root = document.getElementById('root');
  root.replaceChildren();
  root.appendChild(el('div', { class: 'error', text: msg }));
}

// ---- Chargement -----------------------------------------------------------

async function load() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    entries = raw ? JSON.parse(raw) : [];
    render(document.getElementById('search').value);
  } catch (_) {
    showError("Impossible de lire l'historique.");
  }
}

// ---- Suppression ----------------------------------------------------------

async function del(id) {
  if (!confirm('Supprimer cette entrée ?')) return;
  try {
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').filter(e => e.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  } catch (_) {}
  await _deleteHtmlFromIDB(id);
  await load();
}

// ---- Export ---------------------------------------------------------------

async function exportData() {
  const meta = [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) meta.push(...JSON.parse(raw));
  } catch (_) {}

  const htmlEntries = await _getAllHtmlFromIDB();
  const htmlMap = {};
  for (const h of htmlEntries) htmlMap[h.id] = { html: h.html, css: h.css, json: h.json || null, templateId: h.templateId || null };

  // Fallback serveur pour les entrées pré-migration (HTML sur disque, pas dans IDB)
  await Promise.all(meta.filter(e => !htmlMap[e.id]).map(async e => {
    try {
      const r = await fetch(`/api/history/${encodeURIComponent(e.id)}/html`);
      if (!r.ok) return;
      const html = await r.text();
      htmlMap[e.id] = { html, css: '' };
      await _saveHtmlToIDB(e.id, html, '');
    } catch (_) {}
  }));

  const payload = {
    exported_at: new Date().toISOString(),
    entries: meta.map(e => ({ ...e, ...(htmlMap[e.id] || {}) })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `cv-archive-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---- Import ---------------------------------------------------------------

async function importData(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (_) {
    alert("Fichier invalide : JSON mal formé.");
    return;
  }
  if (!Array.isArray(payload.entries)) {
    alert("Fichier invalide : clé « entries » manquante.");
    return;
  }

  // Fusionner les métadonnées dans localStorage (déduplique par id)
  const existing = [];
  try { existing.push(...JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); } catch (_) {}
  const existingIds = new Set(existing.map(e => e.id));
  let imported = 0;

  for (const entry of payload.entries) {
    if (!entry.id) continue;
    if (!existingIds.has(entry.id)) {
      const { html, css, json, templateId, ...meta } = entry;
      existing.push(meta);
      existingIds.add(entry.id);
      imported++;
    }
    // Toujours écrire le HTML (+ JSON structuré) dans IDB, même si les métadonnées existaient
    if (entry.html || entry.json) {
      await _saveHtmlToIDB(entry.id, entry.html || '', entry.css || '', entry.json || null, entry.templateId || null);
    }
  }

  existing.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(existing.slice(0, 100))); } catch (_) {}

  await load();
  alert(`Import terminé : ${imported} nouvelle(s) entrée(s) ajoutée(s).`);
}

async function _saveHtmlToIDB(id, html, css, json, templateId) {
  try {
    const db = await _openHistoryIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_HTML, 'readwrite');
      tx.objectStore(IDB_HTML).put({ id, html, css, json: json || null, templateId: templateId || null });
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  } catch (_) {}
}

// ---- Événements -----------------------------------------------------------

document.getElementById('search').addEventListener('input', e => render(e.target.value));
document.getElementById('btn-export').addEventListener('click', exportData);
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('file-import').click();
});
document.getElementById('file-import').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) importData(file);
  e.target.value = '';
});
load();
