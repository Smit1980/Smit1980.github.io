(() => {
  'use strict';
  const state = document.body.dataset;
  const embedded = window.parent !== window && !window.FFPortal?.isMainView;
  let csrf = '';
  let serverBase = Number(state.serverNow) || 0;
  let clientBase = performance.now();
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const api = async (path, options = {}) => { const response = await (window.FFPortal?.request || fetch)(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Доступ завершён'); return data; };
  const redirect = () => { document.body.replaceChildren(); window.FFPortal ? window.FFPortal.expire() : window.top.location.replace('/'); };
  const trustedNow = () => serverBase ? serverBase + (performance.now() - clientBase) : null;
  const formatLeft = (expiry, now) => { const ms = Math.max(0, Number(expiry) - Number(now)); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`; };
  let toolbar = null;
  if (!embedded) { toolbar = document.createElement('aside'); toolbar.className = 'access-toolbar'; toolbar.innerHTML = `<span>Доступ: <strong data-time>Проверка…</strong></span>${state.role === 'admin' ? '<a href="/admin">Панель</a>' : ''}<button type="button" data-pause>${paused ? 'Продолжить движение' : 'Пауза движения'}</button><button type="button" data-logout>Выйти</button>`; document.body.prepend(toolbar); }
  const marks = document.createElement('div'); marks.className = `reader-watermarks${paused ? ' paused' : ''}`; marks.setAttribute('aria-hidden', 'true'); const stamp = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(serverBase || Date.now())); const label = `${state.recipient || 'Персональный доступ'} · ${(state.accessId || '—').slice(-6)} · ${stamp}`; for (let i = 0; i < (embedded ? 6 : 16); i += 1) { const mark = document.createElement('span'); mark.textContent = label; marks.append(mark); } document.body.append(marks);
  const cover = document.createElement('div'); cover.className = 'privacy-cover'; cover.textContent = 'Проверка доступа…'; document.body.append(cover);
  const tick = () => { const now = trustedNow(); if (!now) return; if (toolbar && state.expiresAt) toolbar.querySelector('[data-time]').textContent = formatLeft(state.expiresAt, now); if (state.expiresAt && now >= Number(state.expiresAt)) redirect(); };
  const refresh = async (keepCovered = false) => { if (keepCovered) cover.classList.add('show'); try { const result = await api('/api/session', { headers: {} }); csrf = result.csrf || ''; if (!result.authenticated) return redirect(); Object.assign(state, result); serverBase = Number(result.serverNow) || serverBase; clientBase = performance.now(); tick(); cover.classList.remove('show'); } catch (_) { redirect(); } };
  if (toolbar) { toolbar.querySelector('[data-pause]').addEventListener('click', (event) => { paused = !paused; marks.classList.toggle('paused', paused); event.currentTarget.textContent = paused ? 'Продолжить движение' : 'Пауза движения'; }); toolbar.querySelector('[data-logout]').addEventListener('click', async () => { try { await api('/api/logout', { method: 'POST', body: '{}' }); } finally { redirect(); } }); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cover.classList.add('show'); return; } refresh(true); }); window.addEventListener('pageshow', () => refresh(true)); setInterval(() => refresh(false), 30000); setInterval(tick, 1000); refresh(true);
  if (state.role !== 'admin') { document.body.classList.add('reader-protected'); ['copy', 'contextmenu', 'dragstart'].forEach((name) => document.addEventListener(name, (event) => { if (!event.target.closest('input,textarea,select,button')) event.preventDefault(); })); document.addEventListener('keydown', (event) => { if (event.target.closest('input,textarea,select')) return; if ((event.ctrlKey || event.metaKey) && ['c', 'p', 's'].includes(event.key.toLowerCase())) event.preventDefault(); }); }
})();
