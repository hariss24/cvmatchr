/**
 * ui-dialogs.js — Dialogues unifiés (remplace alert/confirm/prompt natifs).
 *
 * Expose sur window :
 *   uiAlert(message, {title})                          → Promise<void>
 *   uiConfirm(message, {title, confirmLabel, cancelLabel, danger}) → Promise<boolean>
 *   uiPrompt(message, {title, multiline, placeholder, validate})   → Promise<string|null>
 *     validate(value) retourne un message d'erreur (string) ou null si OK ;
 *     le dialogue reste ouvert tant que la valeur est invalide.
 *
 * Style : classes Tailwind mappées sur le thème néomorphique (bg-bg, shadow-neu-*…),
 * suit automatiquement light/dark. Échap = annuler, Entrée = confirmer (hors textarea).
 */
(function () {
  'use strict';

  function _open(cfg) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-[1100] flex items-center justify-center bg-black/45 p-4';

      const box = document.createElement('div');
      box.className = 'bg-bg text-text rounded-2xl shadow-neu-lg p-6 w-[440px] max-w-full max-h-[85vh] flex flex-col gap-4';
      box.setAttribute('role', cfg.mode === 'alert' ? 'alertdialog' : 'dialog');
      box.setAttribute('aria-modal', 'true');

      if (cfg.title) {
        const h = document.createElement('div');
        h.className = 'text-[15px] font-bold';
        h.textContent = cfg.title;
        box.appendChild(h);
      }

      const msg = document.createElement('div');
      msg.className = 'text-[13px] leading-relaxed whitespace-pre-line text-muted';
      msg.textContent = cfg.message || '';
      box.appendChild(msg);

      let field = null;
      let errEl = null;
      if (cfg.mode === 'prompt') {
        field = document.createElement(cfg.multiline ? 'textarea' : 'input');
        if (cfg.multiline) field.rows = 8;
        field.placeholder = cfg.placeholder || '';
        field.className = 'w-full rounded-[10px] border-none p-3 text-[13px] font-[inherit] bg-bg text-text shadow-neu-inset outline-none resize-y';
        box.appendChild(field);
        errEl = document.createElement('div');
        errEl.className = 'text-[12px] text-error min-h-[16px]';
        box.appendChild(errEl);
      }

      const row = document.createElement('div');
      row.className = 'flex justify-end gap-2.5';
      box.appendChild(row);

      const btnBase = 'rounded-[9px] border-none cursor-pointer px-4 py-2 text-[13px] font-[inherit]';
      let cancelBtn = null;
      if (cfg.mode !== 'alert') {
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = btnBase + ' bg-bg text-muted shadow-neu-sm hover:text-text';
        cancelBtn.textContent = cfg.cancelLabel || 'Annuler';
        row.appendChild(cancelBtn);
      }
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = btnBase + ' text-white font-semibold shadow-neu-sm ' + (cfg.danger ? 'bg-error' : 'bg-orange');
      okBtn.textContent = cfg.confirmLabel || 'OK';
      row.appendChild(okBtn);

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const prevFocus = document.activeElement;
      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (_) {} }
        resolve(result);
      }

      function confirmVal() {
        if (cfg.mode === 'prompt') {
          const v = field.value;
          if (cfg.validate) {
            const err = cfg.validate(v);
            if (err) { errEl.textContent = err; field.focus(); return; }
          }
          close(v);
        } else {
          close(true);
        }
      }
      const cancelVal = () => close(cfg.mode === 'prompt' ? null : cfg.mode !== 'alert' ? false : undefined);

      okBtn.onclick = confirmVal;
      if (cancelBtn) cancelBtn.onclick = cancelVal;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cancelVal(); });

      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); cancelVal(); }
        else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.stopPropagation(); confirmVal(); }
      }
      document.addEventListener('keydown', onKey, true);

      // Focus initial : champ en prompt, Annuler si action dangereuse, sinon OK
      (field || (cfg.danger && cancelBtn) || okBtn).focus();
    });
  }

  window.uiAlert   = (message, opts) => _open({ mode: 'alert', message, confirmLabel: 'OK', ...(opts || {}) });
  window.uiConfirm = (message, opts) => _open({ mode: 'confirm', message, ...(opts || {}) });
  window.uiPrompt  = (message, opts) => _open({ mode: 'prompt', message, confirmLabel: 'Valider', ...(opts || {}) });
})();
