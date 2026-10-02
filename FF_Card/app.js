(() => {
  'use strict';
  let csrf = '';
  const $ = (selector) => document.querySelector(selector);
  const setMessage = (node, text, kind = 'error') => { if (!node) return; node.textContent = text || ''; node.className = `form-message${text ? ` ${kind}` : ''}`; };
  const api = async (path, options = {}) => {
    const response = await (window.FFPortal?.request || fetch)(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Сервис временно недоступен. Попробуйте ещё раз.');
    return data;
  };
  const session = async () => { const result = await api('/api/session', { headers: {} }); csrf = result.csrf || ''; return result; };
  const go = (url) => { window.FFPortal ? window.FFPortal.navigate(url) : window.location.assign(url); };
  const pinForm = $('#pin-form');
  if (pinForm) {
    const input = $('#pin');
    const pinSubmit = $('#pin-submit');
    const adminSubmit = $('#admin-submit');
    const query = new URLSearchParams(window.location.search);
    if (query.get('admin') === '1') $('#admin-disclosure').open = true;
    if (query.get('expired') === '1') setMessage($('#pin-message'), 'Срок действия этого доступа закончился. Запросите новый код.');
    input.addEventListener('input', () => { const digits = input.value.replace(/\D/g, '').slice(0, 12); input.value = digits.replace(/(.{4})(?=.)/g, '$1-'); });
    session().then((current) => { pinSubmit.disabled = false; adminSubmit.disabled = false; if (current.authenticated) { const target = current.role === 'admin' ? '/admin' : '/guide/'; const link = $('#active-session-link'); link.href = target; link.textContent = current.role === 'admin' ? 'Открыть панель администратора' : 'Открыть инструкцию'; link.hidden = false; setMessage($('#pin-message'), 'Сессия уже активна.', 'ok'); } }).catch(() => { pinSubmit.disabled = false; adminSubmit.disabled = false; setMessage($('#pin-message'), 'Не удалось проверить сессию. Повторите попытку.'); });
    pinForm.addEventListener('submit', async (event) => { event.preventDefault(); const pin = input.value.replace(/\D/g, ''); if (pin.length !== 12) return setMessage($('#pin-message'), 'Введите 12 цифр кода.'); pinSubmit.disabled = true; try { await api('/api/login', { method: 'POST', body: JSON.stringify({ pin }) }); go('/guide/'); } catch (error) { setMessage($('#pin-message'), error.message); pinSubmit.disabled = false; } });
    $('#admin-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!form.get('username') || !form.get('password')) return setMessage($('#admin-message'), 'Введите логин и пароль.'); adminSubmit.disabled = true; try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) }); go('/admin'); } catch (error) { setMessage($('#admin-message'), error.message); adminSubmit.disabled = false; } });
  }
  const formatDate = (value) => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
  const remaining = (expiry, now) => { if (!expiry) return 'Ожидает активации'; const ms = new Date(expiry).getTime() - new Date(now).getTime(); if (ms <= 0) return 'Срок истёк'; const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return `Осталось ${h} ч ${m} мин`; };
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const codesList = $('#codes-list');
  const renderCodes = (codes, now) => { codesList.innerHTML = codes.map((code) => `<tr><td><strong>${escapeHtml(code.recipient)}</strong>${code.note ? `<div class="date">${escapeHtml(code.note)}</div>` : ''}</td><td>${escapeHtml(code.contact)}</td><td class="date">${formatDate(code.createdAt)}</td><td><span class="status ${escapeHtml(code.status)}">${escapeHtml({ issued: 'Не активирован', active: 'Активен', expired: 'Истёк', revoked: 'Отозван' }[code.status] || code.status)}</span></td><td class="date">${code.activatedAt ? `Активирован: ${formatDate(code.activatedAt)}<br>${remaining(code.expiresAt, now)}<br>До: ${formatDate(code.expiresAt)}` : 'Ожидает первого входа'}</td><td>${!code.revokedAt && code.status !== 'expired' ? `<button class="text-button revoke" data-code-id="${escapeHtml(code.id)}">Отозвать</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="date">Кодов пока нет.</td></tr>'; };
  const admin = $('#code-form');
  if (!admin) return;
  let pendingRevoke = null;
  const loadCodes = async () => { try { const data = await api('/api/admin/codes', { headers: {} }); renderCodes(data.codes || [], data.serverNow); setMessage($('#codes-message'), ''); } catch (error) { setMessage($('#codes-message'), error.message); } };
  const loadAudit = async () => { try { const data = await api('/api/admin/audit', { headers: {} }); const events = data.events || []; const labels = { code_created: 'Код создан', code_activated: 'Код активирован', code_revoked: 'Код отозван', login: 'Вход выполнен', logout: 'Выход выполнен', admin_login: 'Вход администратора' }; $('#audit-list').innerHTML = events.length ? events.slice(0, 30).map((event) => `<li>${escapeHtml(labels[event.action || event.type] || event.action || event.type || 'Действие')}${event.codeId || event.accessId ? `<br><span class="date">Код: ${escapeHtml(event.codeId || event.accessId)}</span>` : ''}<br><span class="date">${formatDate(event.createdAt || event.at)}</span></li>`).join('') : '<li>Действий пока нет.</li>'; } catch (_) { $('#audit-list').innerHTML = '<li>Журнал пока недоступен.</li>'; } };
  (async () => { try { const data = await session(); if (!data.authenticated || data.role !== 'admin') return go('/'); $('#admin-session').textContent = 'Сессия администратора активна'; await Promise.all([loadCodes(), loadAudit()]); } catch (_) { go('/'); } })();
  admin.addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(admin); const submit = admin.querySelector('[type="submit"]'); if (!String(form.get('recipient') || '').trim()) return setMessage($('#code-message'), 'Укажите получателя.'); submit.disabled = true; try { const result = await api('/api/admin/codes', { method: 'POST', body: JSON.stringify({ recipient: form.get('recipient'), contact: form.get('contact'), note: form.get('note') }) }); const pin = result.pin || ''; $('#created-pin').textContent = pin.replace(/(.{4})(?=.)/g, '$1-'); $('#handoff-text').textContent = `КРАТА. Откройте ${window.FFPortal?.entryURL || window.location.origin + "/"} и введите код ${$('#created-pin').textContent}. После первого входа доступ действует 12 часов.`; $('#new-code').hidden = false; setMessage($('#code-message'), 'Код сохранён в базе.', 'ok'); admin.reset(); await Promise.all([loadCodes(), loadAudit()]); } catch (error) { setMessage($('#code-message'), error.message); } finally { submit.disabled = false; } });
  $('#copy-pin').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#created-pin').textContent.replace(/-/g, '')); $('#copy-pin').textContent = 'Скопировано'; setTimeout(() => { $('#copy-pin').textContent = 'Скопировать код'; }, 1800); } catch (_) { setMessage($('#code-message'), 'Не удалось скопировать. Код можно выделить вручную.'); } });
  $('#refresh-codes').addEventListener('click', () => { loadCodes(); loadAudit(); });
  codesList.addEventListener('click', (event) => { const button = event.target.closest('.revoke'); if (!button) return; pendingRevoke = button.dataset.codeId; $('#revoke-dialog').showModal(); });
  $('#revoke-dialog').addEventListener('close', async (event) => { if (event.target.returnValue !== 'confirm' || !pendingRevoke) return; try { await api(`/api/admin/codes/${encodeURIComponent(pendingRevoke)}/revoke`, { method: 'POST', body: '{}' }); await Promise.all([loadCodes(), loadAudit()]); } catch (error) { setMessage($('#codes-message'), error.message); } finally { pendingRevoke = null; } });
  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', async () => { try { await api('/api/logout', { method: 'POST', body: '{}' }); } finally { go('/'); } }));
})();
