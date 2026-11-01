/* WaForSpeed — Bandeaux de notification pendant la course. */
'use strict';

/* ================= Toasts ================= */
const toasts = $('#toasts');
function toast(title, value, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.innerHTML = '<b></b><span></span>';
  el.firstChild.textContent = title; el.lastChild.textContent = value || '';
  toasts.prepend(el);
  while (toasts.children.length > 3) toasts.lastChild.remove();
  setTimeout(() => el.remove(), 1900);
}
