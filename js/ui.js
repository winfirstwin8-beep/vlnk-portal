/* Портал ВЛНК — каркас інтерфейсу: маршрути, форми, вхід, головна, меню, налаштування */
'use strict';

const ROUTES = {};
const FORMS = {};
const ACTS = {};
const ONCHANGE = {};
const UI = { draft: {}, limit: 40, dirty: false };
let HEAD = { title: 'Портал ВЛНК', back: '' };
let curRoute = '';
let installPrompt = null;

// ───────── маршрутизація ─────────
function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const parts = raw.split('/').map(decodeURIComponent);
  return { name: parts[0], args: parts.slice(1), raw };
}
function go(h) { if (location.hash === h) render(); else location.hash = h; }
const NAV_GROUP = {
  home: 'home', tasks: 'tasks', taskform: 'tasks', tobj: 'tasks', brigades: 'tasks',
  reports: 'reports', reportform: 'reports', report: 'reports',
  mon: 'mon'
};

function render() {
  if (!ME) return;
  const r = route();
  const fn = ROUTES[r.name] || ROUTES.home;
  const changed = r.raw !== curRoute;
  if (changed) { UI.limit = 40; UI.dirty = false; }
  curRoute = r.raw;
  HEAD = { title: 'Портал ВЛНК', back: '' };
  let html;
  try { html = fn(...r.args); } catch (e) { console.error(e); html = `<div class="card"><p class="bad">Помилка відображення: ${esc(e.message)}</p></div>`; }
  const y = window.scrollY;
  const focus = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.set
    ? { k: document.activeElement.dataset.set, pos: document.activeElement.selectionStart } : null;
  $('#main').innerHTML = html;
  $('#title').textContent = HEAD.title;
  updateChip();
  const rf = $('form[data-form=report]'); if (rf && typeof updateGenPreview === 'function') updateGenPreview(rf);
  const back = $('#back');
  back.hidden = !HEAD.back;
  back.onclick = () => go(HEAD.back);
  const g = NAV_GROUP[r.name] || 'menu';
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.g === g));
  window.scrollTo(0, changed ? 0 : y);
  if (focus) {
    const el = $(`[data-set="${focus.k}"]`);
    if (el) { el.focus(); try { el.setSelectionRange(focus.pos, focus.pos); } catch (e) { /* не текст */ } }
  }
}

/** Оновити екран після зміни даних, не збиваючи введення у форму. */
function onData(force) {
  updateChip();
  if (!ME || !$('#app') || $('#app').hidden) return;
  if (UI.dirty) return; // не перебиваємо введення у форму
  render();
}

function page(title, body, back) { HEAD = { title, back: back || '' }; return body; }
function notFound() { return page('Не знайдено', '<div class="card"><p>Запис не знайдено або видалено.</p></div>', '#/home'); }
function denied() { return page('Немає доступу', '<div class="card"><p>Недостатньо прав для цього розділу.</p></div>', '#/home'); }

// ───────── елементи інтерфейсу ─────────
function card(title, body, extra = '') {
  return `<section class="card">${title ? `<div class="card-h"><h2>${title}</h2>${extra}</div>` : ''}${body}</section>`;
}
function empty(t) { return `<p class="empty">${t}</p>`; }
function badge(t, cls = '') { return `<span class="badge ${cls}">${t}</span>`; }
function kv(rows) {
  return `<dl class="kv">${rows.filter(r => r && r[1] !== undefined && r[1] !== null && r[1] !== '').map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
}
function fab(href, label = '+') { return `<a class="fab" href="${href}" aria-label="Додати">${label}</a>`; }
function more(total) { return total > UI.limit ? `<button class="btn ghost wide" data-act="more">Показати ще (${total - UI.limit})</button>` : ''; }
function seg(key, opts, value) {
  return `<div class="seg">${opts.map(([v, t]) => `<button type="button" class="${String(v) === String(value) ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${esc(v)}">${t}</button>`).join('')}</div>`;
}
function monthNav(key, m) {
  return `<div class="monthnav"><button class="btn icon" data-act="mnav" data-k="${key}" data-d="-1" aria-label="Попередній">‹</button>
    <b>${monthName(m)}</b><button class="btn icon" data-act="mnav" data-k="${key}" data-d="1" aria-label="Наступний">›</button></div>`;
}
function bar(p) { p = Math.max(0, Math.min(100, p || 0)); return `<div class="bar"><i style="width:${p}%"></i></div>`; }
function kpis(list) { return `<div class="kpis">${list.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>`; }
function table(head, rows, cls = '') {
  return `<div class="tw"><table class="${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ───────── поля форм ─────────
function opt(options, value) {
  return options.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
}
function fInp(label, name, value, o = {}) {
  return `<label class="f ${o.cls || ''}"><span>${label}${o.req ? ' *' : ''}</span><input name="${name}" type="${o.type || 'text'}" value="${esc(value ?? '')}" ${o.req ? 'required' : ''} ${o.step ? `step="${o.step}"` : ''} ${o.min !== undefined ? `min="${o.min}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.re ? 'data-re' : ''} ${o.mode ? `inputmode="${o.mode}"` : ''} ${o.list ? `list="${o.list}"` : ''} autocomplete="off">${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
}
function fNum(label, name, value, o = {}) { return fInp(label, name, value, { type: 'number', step: 'any', min: 0, mode: 'decimal', ...o }); }
function fSel(label, name, options, value, o = {}) {
  return `<label class="f ${o.cls || ''}"><span>${label}${o.req ? ' *' : ''}</span><select name="${name}" ${o.req ? 'required' : ''} ${o.re ? 'data-re' : ''}>${o.none !== undefined ? `<option value="">${esc(o.none)}</option>` : ''}${opt(options, value)}</select>${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
}
function fArea(label, name, value, o = {}) {
  return `<label class="f ${o.cls || ''}"><span>${label}</span><textarea name="${name}" rows="${o.rows || 3}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>${esc(value ?? '')}</textarea></label>`;
}
function fChk(label, name, checked, o = {}) {
  return `<label class="chk ${o.cls || ''}"><input type="checkbox" name="${name}" ${truthy(checked) ? 'checked' : ''} ${o.re ? 'data-re' : ''}><span>${label}</span></label>`;
}
function fMulti(label, name, options, values, o = {}) {
  const vs = arr(values).map(String);
  return `<fieldset class="f"><legend>${label}</legend><div class="chips">${options.map(x => { const [v, t] = Array.isArray(x) ? x : [x, x]; return `<label class="chip"><input type="checkbox" name="${name}[]" value="${esc(v)}" ${vs.includes(String(v)) ? 'checked' : ''} ${o.re ? 'data-re' : ''}><span>${esc(t)}</span></label>`; }).join('')}</div></fieldset>`;
}
function form(name, id, body, o = {}) {
  return `<form class="form" data-form="${name}" data-id="${esc(id || '')}" novalidate>${body}
    <div class="form-actions">${o.del ? `<button type="button" class="btn danger" data-act="del" data-t="${o.del.t}" data-id="${esc(o.del.id)}" data-back="${o.del.back}">Видалити</button>` : ''}
    <button type="submit" class="btn primary">${o.submit || 'Зберегти'}</button></div></form>`;
}
function formData(f) {
  const d = {};
  for (const el of f.elements) {
    if (!el.name) continue;
    if (el.name.endsWith('[]')) { const k = el.name.slice(0, -2); d[k] = d[k] || []; if (el.checked) d[k].push(el.value); }
    else if (el.type === 'checkbox') d[el.name] = el.checked;
    else d[el.name] = el.value.trim();
  }
  return d;
}
function need(d, keys) {
  const miss = keys.filter(([k]) => d[k] === '' || d[k] === undefined || (Array.isArray(d[k]) && !d[k].length));
  if (miss.length) { toast('Заповніть: ' + miss.map(m => m[1]).join(', ')); return false; }
  return true;
}
const staffOpts = () => staff().map(p => [p.id, p.pib]);
const objOpts = () => objectsSorted().map(o => [o.id, o.short || o.name]);
const carOpts = () => all('Авто').map(c => [c.id, c.name + (c.plate ? ' · ' + c.plate : '')]);

// ───────── діалог підтвердження (замість системного confirm) ─────────
function ask(text, ok = 'Так', cancel = 'Скасувати') {
  return new Promise(res => {
    const w = document.createElement('div');
    w.className = 'modal';
    w.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><p class="pre">${esc(text)}</p><div class="row gap"><button class="btn ghost" data-r="0">${esc(cancel)}</button><button class="btn primary" data-r="1">${esc(ok)}</button></div></div>`;
    const done = v => { w.remove(); res(v); };
    w.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1'); else if (e.target === w) done(false); });
    document.body.appendChild(w);
    w.querySelector('[data-r="1"]').focus();
  });
}

// ───────── повідомлення ─────────
let toastT;
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3800);
}
function savedMsg(what) {
  const off = MODE === 'live' && !navigator.onLine;
  toast(what + (off ? ' на телефоні — надішлеться, коли зʼявиться інтернет' : ''));
}
function updateChip() {
  const c = $('#chip'); if (!c) return;
  let t, cls;
  if (MODE === 'demo') { t = 'Демо'; cls = 'demo'; }
  else if (DB.syncing) { t = 'Синхронізація…'; cls = 'busy'; }
  else if (!navigator.onLine) { const q = DB.pending + DB.upTasks.size + DB.mailQ.size; t = 'Офлайн' + (q ? ' · ' + q : ''); cls = 'off'; }
  else if (DB.error) { t = 'Помилка'; cls = 'err'; }
  else if (DB.pending || DB.upTasks.size || DB.mailQ.size) { t = 'Черга ' + (DB.pending + DB.upTasks.size + DB.mailQ.size); cls = 'busy'; }
  else { t = DB.lastSync ? '✓ ' + new Date(DB.lastSync).toTimeString().slice(0, 5) : 'Онлайн'; cls = 'ok'; }
  c.textContent = t; c.className = 'chip-s ' + cls;
}

// ───────── обробники подій ─────────
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTS[el.dataset.act];
  if (fn) { e.preventDefault(); await fn(el.dataset, el, e); }
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form];
  if (!fn) return;
  const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  try { await fn(formData(f), f.dataset.id, f); }
  catch (err) { console.error(err); toast('Помилка: ' + err.message); }
  finally { if (btn) btn.disabled = false; }
});
document.addEventListener('input', e => {
  if (e.target.closest('form[data-form]')) UI.dirty = true;
  const rf = e.target.closest('form[data-form=report]'); if (rf && /^v_\d+_/.test(e.target.name || '')) updateMatPreview(rf);
  if (rf && /^gen(Hours|Refuel|Fuel)$/.test(e.target.name || '')) updateGenPreview(rf);
  if (e.target.dataset.set && e.target.type === 'search') setLive(e.target.dataset.set, e.target.value);
});
const setLive = debounce((k, v) => { UI[k] = v; UI.limit = 40; render(); }, 250);
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.upload && el.files && el.files[0]) {
    const f = el.files[0]; el.value = '';
    queueOrder(el.dataset.upload, f).then(r => {
      toast(r === 'saved' ? 'Наказ збережено (демо)' : navigator.onLine ? 'Наказ відправляється…' : 'Наказ збережено на телефоні — відправиться, коли зʼявиться інтернет');
      render();
    }).catch(err => toast('Помилка: ' + err.message));
    return;
  }
  if (el.dataset.certup && el.files && el.files[0]) {
    const f = el.files[0]; el.value = '';
    queueRowFile('Сертифікати', el.dataset.certup, f).then(r => {
      toast(r === 'saved' ? 'Сертифікат збережено (демо)' : navigator.onLine ? 'Сертифікат відправляється…' : 'Сертифікат збережено на телефоні — відправиться, коли зʼявиться інтернет');
      render();
    }).catch(err => toast('Помилка: ' + err.message));
    return;
  }
  if (el.id === 'doctxtfile' && el.files && el.files[0]) {
    const fr = new FileReader(); fr.onload = () => { const ta = $('textarea[name=text]'); if (ta) { ta.value = String(fr.result || ''); UI.dirty = true; toast('Текст вставлено — перевірте та збережіть'); } }; fr.readAsText(el.files[0], 'utf-8'); el.value = '';
    return;
  }
  if (el.dataset.set && el.type !== 'search') { UI[el.dataset.set] = el.value; UI.limit = 40; render(); return; }
  if (el.hasAttribute('data-re')) {
    const f = el.closest('form[data-form]');
    const key = f.dataset.form + ':' + (f.dataset.id || 'new');
    const d = { ...(UI.draft[key] || {}), ...formData(f) };
    const field = el.name.replace(/\[\]$/, '');
    if (ONCHANGE[f.dataset.form]) ONCHANGE[f.dataset.form](d, field);
    UI.draft[key] = d;
    UI.dirty = false; render(); UI.dirty = true;
  }
});

ACTS.set = d => { UI[d.k] = d.v; UI.limit = 40; render(); };
ACTS.more = () => { UI.limit += 60; UI.dirty = false; render(); };
ACTS.mnav = d => { UI[d.k] = addMonths(UI[d.k] || ym(today()), Number(d.d)); render(); };
ACTS.del = async d => {
  if (!await ask('Видалити запис? Дію не можна скасувати.')) return;
  await remove(d.t, d.id);
  UI.dirty = false; toast('Видалено'); go(d.back || '#/home');
};
ACTS.sync = () => sync(true);
ACTS.wnclose = () => { UI.whatsNew = null; LS.set('seenVer', VER); render(); };

// ───────── оновлення застосунку: повідомлення «Доступна нова версія» ─────────
const UPD = { worker: null, asked: false, hidden: false };
function initUpdates(reg) {
  if (!reg) return;
  const offer = w => { if (w && navigator.serviceWorker.controller) { UPD.worker = w; UPD.hidden = false; showUpdateBar(); } };
  if (reg.waiting) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing; if (!w) return;
    w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (UPD.asked) location.reload(); });
  // перевірка оновлень: при поверненні в застосунок і кожні 30 хв
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {}); if (UPD.worker && document.visibilityState === 'visible') { UPD.hidden = false; showUpdateBar(); } });
  setInterval(() => { if (navigator.onLine) reg.update().catch(() => {}); }, 30 * 60 * 1000);
}
function showUpdateBar() {
  let bar = $('#updbar');
  if (UPD.hidden || !UPD.worker) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'updbar'; bar.setAttribute('role', 'status'); document.body.appendChild(bar); }
  bar.innerHTML = `<span>🔄 Доступна нова версія порталу</span><button class="btn small primary" data-act="updnow">Оновити</button><button class="btn small ghost" data-act="updlater">Пізніше</button>`;
}
ACTS.updnow = async () => {
  if (!UPD.worker) return;
  if (UI.dirty && !await ask('Є незбережена форма — після оновлення введене зникне. Оновити зараз?', 'Оновити')) return;
  UPD.asked = true;
  LS.set('seenVer', LS.get('seenVer') || VER);
  UPD.worker.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => location.reload(), 3000); // запасний варіант, якщо подія controllerchange не прийде
};
ACTS.updlater = () => { UPD.hidden = true; showUpdateBar(); toast('Оновлення встановиться при наступному відкритті порталу'); };
ACTS.fullsync = async () => { await IDB.putMany('meta', [['since', 0]]); sync(true); };

window.addEventListener('hashchange', () => { UI.dirty = false; render(); });
window.addEventListener('online', () => { updateChip(); sync(); });
window.addEventListener('offline', updateChip);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
ACTS.install = async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; render(); };

// ───────── вхід ─────────
function showLogin(reauth) {
  $('#app').hidden = true;
  const L = $('#login'); L.hidden = false;
  const api = LS.get('api') || CFG.api || '';
  L.innerHTML = `<div class="login">
    <img class="login-logo" src="icons/logo.png" alt="NDT ВЛНК">
    <h1>Портал ВЛНК</h1>
    <p class="mute">Контроль завдань лабораторії неруйнівного контролю</p>
    ${reauth ? '<p class="warn">Сесія завершилась. Увійдіть знову — незбережені дані залишаться в черзі.</p>' : ''}
    <form id="lf" class="form">
      ${CFG.api ? '' : fInp('Адреса API (вебзастосунок Apps Script)', 'api', api, { ph: 'https://script.google.com/macros/s/…/exec' })}
      ${fInp('Email', 'email', LS.get('email') || '', { type: 'email', mode: 'email' })}
      ${fInp('PIN-код', 'pin', '', { type: 'password', mode: 'numeric' })}
      <button class="btn primary wide" type="submit">Увійти</button>
      <div id="gbtn" class="gbtn"></div>
    </form>
    ${reauth ? '' : '<button class="btn ghost wide" id="demo">Переглянути демо без підключення</button>'}
    <p class="mute small">Версія ${VER} · працює без інтернету після першого входу</p>
  </div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const d = formData(e.target);
    if (d.api !== undefined) LS.set('api', d.api);
    CFG.api = LS.get('api') || CFG.api;
    if (!CFG.api) return toast('Вкажіть адресу API');
    LS.set('email', d.email);
    await doLogin({ email: d.email, pin: d.pin });
  };
  const dm = $('#demo'); if (dm) dm.onclick = startDemo;
  if (CFG.googleClientId) loadGoogle();
}
function loadGoogle() {
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => {
    google.accounts.id.initialize({ client_id: CFG.googleClientId, callback: r => doLogin({ idToken: r.credential }) });
    google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'uk', width: 280 });
  };
  document.head.appendChild(s);
}
async function doLogin(body) {
  if (!navigator.onLine) return toast('Для першого входу потрібен інтернет');
  toast('Вхід…');
  try {
    const res = await api({ action: 'login', ...body });
    if (!res.ok) return toast(res.error || 'Помилка входу');
    const prev = LS.json('user');
    if (prev && prev.email !== res.user.email && MODE === 'live') { await IDB.clear('rows'); await IDB.putMany('meta', [['since', 0]]); }
    MODE = 'live'; ME = res.user;
    LS.set('token', res.token); LS.set('user', JSON.stringify(res.user)); LS.set('mode', 'live');
    await start();
  } catch (e) { toast('Не вдалося зʼєднатися з сервером: ' + e.message); }
}
async function startDemo() {
  MODE = 'demo'; ME = { ...DEMO_USER };
  LS.set('mode', 'demo');
  LS.set('user', JSON.stringify(DEMO_USER));
  await start();
}
async function logout() {
  if (DB.pending && !await ask(`У черзі ${DB.pending} неперевантажених змін. Вони будуть втрачені. Вийти?`)) return;
  if (MODE === 'live' && navigator.onLine) { try { await api({ action: 'logout' }, 8000); } catch (e) { /* неважливо */ } }
  if (MODE === 'live') { await IDB.clear('rows'); await IDB.clear('outbox'); await IDB.clear('meta'); }
  LS.set('token', null); LS.set('user', null); LS.set('mode', null);
  location.hash = ''; location.reload();
}
ACTS.logout = logout;

// ───────── запуск ─────────
async function start() {
  MODE = LS.get('mode') || MODE; ME = LS.json('user') || ME;
  CFG = { ...(window.VLNK_CONFIG || {}) };
  CFG.api = LS.get('api') || CFG.api || '';
  if ((!MODE || !ME) && window.VLNK_AUTODEMO) return startDemo();
  if (!MODE || !ME) { showLogin(); return; }
  await IDB.open(MODE === 'demo' ? 'vlnk-demo' : 'vlnk');
  DB.data = {}; DB.cache = {};
  await loadLocal();
  if (MODE === 'demo' && (!all('Персонал').length || (await IDB.get('meta', 'demoVer')) !== DEMO_VER)) {
    // нова версія демо — перезаписати демо-дані, щоб зʼявились нові можливості (накази, діаметри тощо)
    await IDB.clear('rows'); DB.data = {}; DB.cache = {};
    ME = { ...DEMO_USER }; LS.set('user', JSON.stringify(ME));
    await seedDemo(); await IDB.putMany('meta', [['demoVer', DEMO_VER]]);
  }
  $('#login').hidden = true; $('#app').hidden = false;
  const seen = LS.get('seenVer');
  if (seen && cmpVer(seen, VER) < 0) UI.whatsNew = Object.keys(CHANGES).filter(v => cmpVer(v, seen) > 0 && cmpVer(v, VER) <= 0).sort((a, b) => cmpVer(b, a));
  if (!seen || UI.whatsNew && !UI.whatsNew.length) LS.set('seenVer', VER);
  if (await autoStartTasks()) toast('Заплановані завдання нового місяця переведено в роботу');
  render();
  if (MODE === 'live') { sync(); setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 5 * 60 * 1000); }
}

// ═════════ ГОЛОВНА ═════════
ROUTES.home = () => {
  const d = today();
  const mb = myBrigade(d);
  const tk = tasksOn(d);
  const reps = all('Звіти').filter(r => r.date === d);
  let h = `<div class="hello"><div><b>${esc(ME.name)}</b><div class="mute">${esc(roleName(ME.role))} · ${uaDate(d)}</div></div>${mb ? badge(brName(mb.num), 'pri') : ''}</div>`;
  // новини — на початку сторінки
  const news = all('Новини').slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3);
  h += card('Новини', news.length ? news.map(n => `<a class="item" href="#/news"><b>${esc(n.title)}</b><span class="mute small">${uaDate(n.date)}</span><p class="clamp">${esc(n.text)}</p></a>`).join('') : empty('Новин немає'), `<a class="small" href="#/news">Усі ›</a>`);
  if (UI.whatsNew && UI.whatsNew.length) h += `<div class="note whatsnew"><div class="row between"><b>🎉 Портал оновлено до версії ${VER}</b><button class="btn small ghost" data-act="wnclose" aria-label="Закрити">✕</button></div>
    <ul>${UI.whatsNew.flatMap(v => CHANGES[v]).slice(0, 8).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  if (MODE === 'demo') h += `<div class="note demo-note"><b>Демо-режим</b> · дані вигадані. Зараз ви: <b>${esc(roleName(ME.role))}</b>.<br>Подивитися портал очима іншої ролі:
    <div class="row gap">${ROLES.filter(r => r !== ME.role).map(r => `<button class="btn small primary" data-act="demorole" data-v="${r}">Увійти як ${roleName(r)}</button>`).join('')}</div>
    ${ME.role === 'працівник' ? '<p class="small">Наказ до завдання — у блоці «Моє завдання на сьогодні» нижче: кнопки «⬇ Завантажити» і «✉ На пошту».</p>' : ME.role === 'керівник' ? '<p class="small">Завантажити наказ: Ще → Обʼєкти → обʼєкт → блок «Завдання» → «⬆ Завантажити наказ».</p>' : ''}</div>`;

  if (canReport()) {
    const mine = mb ? tk.filter(t => String(t.brigade) === String(mb.num)) : [];
    const done = mb && reps.some(r => String(r.brigade) === String(mb.num));
    h += card('Моє завдання на сьогодні',
      (mine.length ? mine.map(taskLine).join('') : empty(mb ? 'На сьогодні завдань для вашої бригади немає' : 'Вас не включено до бригади цього місяця')) +
      `<div class="row gap">${done ? badge('✓ Звіт подано', 'ok') : (mine.length ? badge('Звіт ще не подано', 'warn') : '')}
       <a class="btn primary" href="#/reportform/new">Подати щоденний звіт</a></div>`);
  }

  // проблемні питання зі щоденних звітів за останні 7 днів
  const prob = all('Звіти').filter(r => String(r.problems || '').trim() && r.date >= addDays(d, -6) && r.date <= d)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || num(b.updatedAt) - num(a.updatedAt));
  h += card('Проблемні питання', prob.length ? prob.slice(0, 10).map(r => `<a class="item" href="#/report/${esc(r.id)}"><div class="row between"><b>${esc(objShort(r.objectId))}</b><span class="small mute">${uaDate(r.date)} · Б${esc(r.brigade)}</span></div><p class="pre small">${esc(r.problems)}</p></a>`).join('') + (prob.length > 10 ? `<p class="small mute">і ще ${prob.length - 10}…</p>` : '')
    : empty('За останні 7 днів проблемних питань у звітах немає'), '<span class="small mute">за 7 днів</span>');

  h += card('Бригади сьогодні', table(['Бригада', 'Обʼєкт', 'Звіт'], BRIGADES.map(n => {
    const t = tk.filter(x => +x.brigade === n);
    const rp = reps.filter(x => +x.brigade === n);
    const st = rp.length ? badge('✓ ' + rp.length, 'ok') + (rp.some(r => r.problems) ? ' ' + badge('⚠', 'warn') : '') : (t.length ? badge('немає', 'bad') : '<span class="mute">—</span>');
    const b = brigadeOf(ym(d), n) || {}, mem = brigadeMembers(b);
    const crew = mem.length ? `<div class="small brcrew">${mem.map(id => { const p = get('Персонал', id) || {}; return esc(shortName(p.pib || '—')) + (id === b.leaderId ? ' <span class="mute">(ст.)</span>' : '') + (truthy(p.isDriver) ? ' 🚐' : ''); }).join('<br>')}</div>` : '<div class="small mute">склад не призначено</div>';
    return [`<b>${brName(n).replace(' · резерв', ' (рез.)')}</b>${crew}`, t.map(x => esc(objShort(x.objectId))).join('<br>') || '<span class="mute">без завдання</span>', st];
  })), `<a class="small" href="#/mon">Моніторинг ›</a>`);

  const al = alerts();
  if (al.length) h += card('Потребує уваги', `<ul class="alerts">${al.map(a => `<li class="${a.cls}"><a href="${a.href}">${a.text}</a></li>`).join('')}</ul>`);

  return page('Портал ВЛНК', h);
};

function taskLine(t) {
  const o = get('Обʼєкти', t.objectId);
  return `<div class="item"><a class="item-link" href="#/tobj/${esc(t.id)}"><b>${esc(o ? o.short : '—')}</b>
    <span class="mute small">${uaDate(t.dateFrom)} – ${uaDate(t.dateTo)} · ${esc(t.workType || '')}</span>
    <span class="small">${methodsOf(t.methods).map(m => badge(esc(m))).join(' ')} ${t.diameters ? 'Ø ' + esc(arr(t.diameters).join(', ')) : ''} ${t.requestNo ? '· заявка № ' + esc(t.requestNo) : ''}${t.orderNo ? ' · наказ № ' + esc(t.orderNo) : ''}</span></a>${orderBlock(t, true) || '<span class="small mute">наказ ще не завантажено</span>'}</div>`;
}

function alerts() {
  const out = [];
  const lead = isLead();
  const people = lead ? staff() : staff().filter(p => p.id === ME.personId);
  for (const c of all('Сертифікати')) {
    if (!people.some(p => p.id === c.personId)) continue;
    const v = validity(c.validTo);
    if (v.cls === 'bad' || v.cls === 'warn') out.push({ cls: v.cls, href: '#/person/' + c.personId, text: `Сертифікат ${esc(c.method)} — ${esc(shortName(personName(c.personId)))}: ${v.text}` });
  }
  for (const p of people) {
    if (truthy(p.isDriver) && p.licenseTo) { const v = validity(p.licenseTo); if (v.cls !== 'ok') out.push({ cls: v.cls, href: '#/person/' + p.id, text: `Посвідчення водія — ${esc(shortName(p.pib))}: ${v.text}` }); }
  }
  if (lead && MODE === 'live' && DB.apiVer && cmpVer(DB.apiVer, NEED_API) < 0) out.push({ cls: 'bad', href: '#/settings', text: `Серверний код (Code.gs) застарів: версія ${esc(DB.apiVer === '0' ? 'невідома' : DB.apiVer)}, потрібна ${NEED_API}. Вставте новий Code.gs і зробіть «Нова версія» розгортання.` });
  if (lead) {
    const bo = briefs().filter(b => briefOverdue(b) && briefStat(b).left);
    const bw = briefs().reduce((s, b) => s + briefStat(b).wait, 0);
    if (bw) out.push({ cls: 'warn', href: '#/brief', text: `Інструктажі: чекають вашого підтвердження проведення — ${bw}` });
    if (bo.length) out.push({ cls: 'bad', href: '#/brief', text: `Інструктажі не пройдені в строк: ${bo.map(b => esc(b.title) + ' (' + briefStat(b).left + ')').join('; ')}` });
    for (const e of all('Обладнання')) { if (!e.calibTo) continue; const v = validity(e.calibTo); if (v.cls !== 'ok') out.push({ cls: v.cls, href: '#/equip', text: `Повірка: ${esc(e.name)} ${esc(e.invNo || '')} — ${v.text}` }); }
    const req = all('Документи').filter(d => truthy(d.required));
    let miss = 0; staff().filter(p => p.role !== 'відвідувач').forEach(p => req.forEach(d => { if (!ackOf(d.id, p.id)) miss++; }));
    if (miss) out.push({ cls: 'warn', href: '#/ackmatrix', text: `Не підтверджено ознайомлень: ${miss}` });
    const t = today(), Y = t.slice(0, 4);
    const ppl = staff().filter(p => p.role !== 'відвідувач');
    const off = ppl.filter(p => onVacation(p.id, t));
    if (off.length) out.push({ cls: 'info', href: '#/vac', text: `У відпустці: ${off.map(p => esc(shortName(p.pib)) + ' (до ' + uaDate(vacRange(onVacation(p.id, t))[1]) + ')').join(', ')}` });
    const soon = ppl.filter(p => !onVacation(p.id, t) && all('Відпустки').some(v => v.personId === p.id && vacRange(v)[0] > t && vacRange(v)[0] <= addDays(t, 14)));
    if (soon.length) out.push({ cls: 'info', href: '#/vac', text: `Відпустка протягом 14 днів: ${soon.map(p => esc(shortName(p.pib))).join(', ')}` });
    const noAck = ppl.filter(p => vacsOf(p.id, Y).length && !vacAck(p.id, Y)).length;
    if (noAck) out.push({ cls: 'warn', href: '#/vac', text: `Не ознайомлені з графіком відпусток ${Y}: ${noAck}` });
    let pBad = 0, pWarn = 0; ppl.forEach(p => ppeOf(p.id).forEach(x => { if (x.st.cls === 'bad') pBad++; if (x.st.cls === 'warn') pWarn++; }));
    if (pBad) out.push({ cls: 'bad', href: '#/ppe', text: `ЗІЗ: потрібно видати ${pBad} поз. (не видано або сплив строк)` });
    if (pWarn) out.push({ cls: 'warn', href: '#/ppe', text: `ЗІЗ: строк носіння спливає протягом 30 днів — ${pWarn} поз.` });
  } else if (ME.personId) {
    const bt = briefTodo(ME.personId);
    if (bt.length) out.push({ cls: bt.some(briefOverdue) ? 'bad' : 'warn', href: bt.length === 1 ? '#/briefing/' + bt[0].id : '#/brief', text: `Потрібно пройти інструктаж: ${bt.map(b => esc(b.title)).join('; ')}` });
    const missD = all('Документи').filter(d => truthy(d.required) && !ackOf(d.id, ME.personId));
    const mi = missD.filter(d => !isND(d)).length, mn = missD.filter(isND).length;
    if (mi) out.push({ cls: 'warn', href: '#/docs', text: `Потрібно ознайомитися з інструкціями: ${mi}` });
    if (mn) out.push({ cls: 'warn', href: '#/nd', text: `Потрібно ознайомитися з НД: ${mn}` });
    const t = today(), Y = t.slice(0, 4);
    const myPpe = ppeOf(ME.personId).filter(x => x.st.cls !== 'ok');
    if (myPpe.length) out.push({ cls: 'warn', href: '#/ppe', text: `ЗІЗ до заміни або отримання: ${myPpe.map(x => esc(x.item.name)).join(', ')}` });
    const un = ppeIssues(ME.personId).filter(i => !ppeAck(i.id)).length;
    if (un) out.push({ cls: 'warn', href: '#/ppe', text: `Підтвердіть отримання ЗІЗ: ${un} поз.` });
    if (vacsOf(ME.personId, Y).length && !vacAck(ME.personId, Y)) out.push({ cls: 'warn', href: '#/vac', text: `Ознайомтеся з графіком відпусток на ${Y} рік` });
    const next = all('Відпустки').filter(v => v.personId === ME.personId).map(vacRange).filter(([, b]) => b && b >= t).sort()[0];
    if (next && next[0] <= addDays(t, 45)) out.push({ cls: 'info', href: '#/vac', text: next[0] <= t ? `Ви у відпустці до ${uaDate(next[1])}` : `Ваша відпустка: ${uaDate(next[0])}–${uaDate(next[1])} (${vacLen(next[0], next[1])} дн.)` });
  }
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.cls] - rank[b.cls]);
}

// ═════════ МЕНЮ ═════════
ROUTES.menu = () => {
  const lead = isLead(), vis = isVisitor();
  const tiles = [
    ['#/objects', '🏗️', 'Обʼєкти', true],
    ['#/plan', '🗓️', 'Планування', !vis],
    ['#/protocols', '🧾', 'Протоколи НК', true],
    ['#/staff', '🪪', 'Персонал', !vis],
    ['#/certs', '📜', 'Сертифікати НК', !vis],
    ['#/vac', '🌴', 'Відпустки', !vis],
    ['#/ppe', '🦺', 'ЗІЗ', !vis],
    ['#/equip', '🧰', 'Обладнання', !vis],
    ['#/kit', '🚐', 'Комплектація авто', !vis],
    ['#/brief', '🎓', 'Інструктажі', !vis],
    ['#/docs', '📚', 'Інструкції', !vis],
    ['#/nd', '📘', 'НД', !vis],
    ['#/fuel', '⛽', 'Паливо', !vis],
    ['#/norms', '📐', 'Норми витрат матеріалів', !vis],
    ['#/gen', '📄', 'Формування документів', !vis],
    ['#/news', '📰', 'Новини', true],
    ['#/fleet', '🚗', 'Авто та генератори', lead],
    ['#/settings', '⚙️', 'Налаштування', true]
  ];
  return page('Меню', `<div class="tiles">${tiles.filter(t => t[3]).map(t => `<a href="${t[0]}"><span>${t[1]}</span>${t[2]}</a>`).join('')}</div>`);
};

// ═════════ НАЛАШТУВАННЯ ═════════
ROUTES.settings = () => {
  let h = card('Профіль', kv([['Імʼя', esc(ME.name)], ['Email', esc(ME.email)], ['Роль', esc(roleName(ME.role))]]) +
    (MODE === 'demo' ? `<div class="f"><span>Роль у демо</span>${seg('demoRole', ROLE_OPTS, ME.role).replace(/data-act="set"/g, 'data-act="demorole"')}</div>` : ''));
  h += card('Синхронізація', kv([
    ['Режим', MODE === 'demo' ? 'демо (без сервера)' : 'робочий'],
    ['Мережа', navigator.onLine ? 'онлайн' : 'офлайн'],
    ['Остання синхронізація', DB.lastSync ? new Date(DB.lastSync).toLocaleString('uk-UA') : '—'],
    ['У черзі на відправку', String(DB.pending) + (DB.upTasks.size ? ' + файлів: ' + DB.upTasks.size : '')],
    ['Помилка', DB.error ? `<span class="bad">${esc(DB.error)}</span>` : '']
  ]) + (MODE === 'live' ? `<div class="row gap"><button class="btn primary" data-act="sync">Синхронізувати зараз</button>${isLead() ? '<button class="btn ghost" data-act="fullsync">Повне оновлення</button>' : ''}</div>` : ''));
  if (installPrompt) h += card('Застосунок', `<p>Встановіть портал на телефон — він відкриватиметься як звичайний застосунок і працюватиме без інтернету.</p><button class="btn primary" data-act="install">Встановити на телефон</button>`);
  else h += card('Встановлення на телефон', `<p class="small">Android (Chrome): меню ⋮ → «Додати на головний екран».<br>iPhone (Safari): «Поділитися» → «На екран Додому».</p>`);
  if (isLead()) {
    const keys = [['labName', 'Назва підрозділу'], ['orgName', 'Назва підприємства'], ['headPosition', 'Посада керівника'], ['headName', 'ПІБ керівника (для підписів)'], ['rtNormHours', 'Запасна норма люд-год RT на 1 стик (якщо для діаметра немає норми)'], ['vacDaysDefault', 'Норма щорічної відпустки, календ. днів'], ['baseName', 'Населений пункт бази (для СЗ, напр. «с. Юрівка»)'], ['docsEmail', 'Email для СЗ і відомостей на вахту'], ['lodgingPrice', 'Вартість проживання за замовчуванням, грн/добу']];
    h += card('Параметри лабораторії', form('settings', '', keys.map(([k, l]) => fInp(l, k, setting(k), ['rtNormHours', 'vacDaysDefault', 'lodgingPrice'].includes(k) ? { type: 'number', step: 'any', mode: 'decimal' } : {})).join('')));
  }
  h += card('', `<button class="btn danger wide" data-act="logout">${MODE === 'demo' ? 'Вийти з демо' : 'Вийти'}</button><p class="mute small center">Портал ВЛНК · версія ${VER}</p>`);
  return page('Налаштування', h, '#/menu');
};
FORMS.settings = async d => {
  for (const [k, v] of Object.entries(d)) {
    const cur = all('Налаштування').find(x => x.key === k);
    if (cur && String(cur.value) === v) continue;
    await save('Налаштування', cur ? { ...cur, value: v } : { key: k, value: v });
  }
  UI.dirty = false; savedMsg('Параметри збережено'); render();
};
ACTS.demorole = d => {
  // у демо роль «працівник» — Мельник С.І. з бригади 1 (є завдання з наказом), «відвідувач» — без картки
  const as = { 'керівник': ['p1', DEMO_USER.name], 'працівник': ['p3', 'Мельник С.І. (демо)'], 'відвідувач': ['', 'Відповідальний від замовника (демо)'] }[d.v];
  ME.role = d.v; ME.personId = as[0]; ME.name = as[1];
  LS.set('user', JSON.stringify(ME)); UI.draft = {}; go('#/home'); toast('Роль: ' + d.v);
};
