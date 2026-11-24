/* Портал ВЛНК — робота з Microsoft 365: вхід корпоративним обліковим записом, дані в списках SharePoint,
   файли в бібліотеці сайту, листи з пошти працівника (Microsoft Graph). Замінює Apps Script, коли backend = 'm365'. */
'use strict';

const M365_VER = '2.0.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
/* Мінімальні делеговані дозволи (погоджено з ІТ):
   Sites.Selected — лише сайт SharePoint «ВЛНК», на який адміністратор надав застосунку доступ (списки й бібліотека сайту);
   Mail.Send — надсилання документів і запрошень з пошти працівника, що увійшов (без читання пошти);
   offline_access — оновлення входу без повторного введення пароля (лише в браузері цього пристрою);
   openid / profile / email — ім'я та адреса працівника, що увійшов. User.Read і Files.ReadWrite.All не потрібні. */
const MS_SCOPES = 'openid profile email offline_access Sites.Selected Mail.Send';
const SP_ROOT = 'Портал ВЛНК';
/** Таблиці порталу → короткі латинські назви списків SharePoint (vlnk_<назва>). */
const SP_LISTS = {
  'Персонал': 'staff', 'Авто': 'cars', 'Бригади': 'brigades', 'Обʼєкти': 'objects', 'Завдання': 'tasks', 'Звіти': 'reports',
  'НормиМатеріалів': 'matnorms', 'Документи': 'docs', 'Ознайомлення': 'acks', 'Протоколи': 'protocols', 'Інструктажі': 'briefings',
  'ПроходженняІнструктажів': 'briefpass', 'Сертифікати': 'certs', 'ЗІЗ': 'ppe', 'НормиЗІЗ': 'ppenorms', 'ВидачаЗІЗ': 'ppeissue',
  'Відпустки': 'vacations', 'Обладнання': 'equipment', 'Переміщення': 'moves', 'Комплектація': 'kits', 'Генератори': 'generators',
  'Новини': 'news', 'Коментарі': 'comments', 'Налаштування': 'settings', 'ПланДнів': 'dayplan', 'ВимогиМатеріалів': 'matreq',
  'СписанняПММ': 'pmm', 'ЗвітиЗамовнику': 'custreports', 'ДокументиВахт': 'shiftdocs', 'ФотоОбладнання': 'eqphotos'
};
const TR = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia' };
/** Назва списку для таблиці; для невідомих таблиць — транслітерація. */
function spSlug(t) {
  if (SP_LISTS[t]) return SP_LISTS[t];
  return 'x' + String(t).toLowerCase().split('').map(c => TR[c] !== undefined ? TR[c] : /[a-z0-9]/.test(c) ? c : '').join('').slice(0, 40);
}
const spTable = slug => Object.keys(SP_LISTS).find(t => SP_LISTS[t] === slug) || null;

const isM365 = () => (LS.get('backend') || CFG.backend || 'gas') === 'm365';
const m365Cfg = () => CFG.m365 || {};
const m365Ready = () => !!(m365Cfg().tenant && m365Cfg().clientId && m365Cfg().site);

// ───────── вхід: OAuth 2.0 з PKCE (без сторонніх бібліотек) ─────────
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const msAuthBase = () => 'https://login.microsoftonline.com/' + encodeURIComponent(m365Cfg().tenant) + '/oauth2/v2.0';
/** Адреса повернення після входу — тека порталу (саме її реєструє ІТ у застосунку). */
const msRedirect = () => m365Cfg().redirect || (location.origin + location.pathname.replace(/[^/]*$/, ''));
function jwtPayload(t) { try { return JSON.parse(decodeURIComponent(escape(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; } }

async function msLogin(opt = {}) {
  if (!m365Ready()) throw new Error('Не налаштовано Microsoft 365: потрібні tenant, clientId і адреса сайту в config.js');
  const v = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const ch = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  LS.set('msPkce', JSON.stringify({ v, state, at: Date.now(), hash: location.hash || '' }));
  const q = new URLSearchParams({
    client_id: m365Cfg().clientId, response_type: 'code', redirect_uri: msRedirect(), response_mode: 'query',
    scope: MS_SCOPES, state, code_challenge: ch, code_challenge_method: 'S256'
  });
  if (opt.hint) q.set('login_hint', opt.hint);
  if (opt.prompt) q.set('prompt', opt.prompt);
  location.assign(msAuthBase() + '/authorize?' + q);
}
async function msTokenRequest(params) {
  const r = await fetch(msAuthBase() + '/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: m365Cfg().clientId, scope: MS_SCOPES, ...params })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { const e = new Error(j.error_description ? String(j.error_description).split('\r')[0] : 'Помилка входу Microsoft'); e.code = j.error || 'AUTH'; throw e; }
  const tok = { at: j.access_token, rt: j.refresh_token || (LS.json('msTok') || {}).rt || '', exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  if (j.id_token) { const p = jwtPayload(j.id_token); tok.email = String(p.preferred_username || p.email || '').toLowerCase(); tok.name = p.name || ''; }
  else { const o = LS.json('msTok') || {}; tok.email = o.email; tok.name = o.name; }
  LS.set('msTok', JSON.stringify(tok));
  return tok;
}
/** Повернення зі сторінки входу Microsoft: обмін коду на токени. Повертає {email, name} або null. */
async function msHandleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.get('code') && !q.get('error')) return null;
  const pk = LS.json('msPkce') || {};
  const clean = () => history.replaceState(null, '', location.pathname + (pk.hash || ''));
  if (q.get('error')) { clean(); LS.set('msPkce', null); throw new Error(q.get('error_description') || q.get('error')); }
  if (!pk.v || q.get('state') !== pk.state) { clean(); throw new Error('Вхід не підтверджено (застарілий запит) — спробуйте ще раз'); }
  const tok = await msTokenRequest({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: msRedirect(), code_verifier: pk.v });
  LS.set('msPkce', null); clean();
  return { email: tok.email, name: tok.name };
}
let MS_REFRESH = null;
/** Дійсний токен доступу до Graph (оновлюється автоматично). Якщо оновити не вдалося — помилка AUTH. */
async function msToken(force) {
  const t = LS.json('msTok');
  if (!t || !t.at) { const e = new Error('Потрібен вхід'); e.code = 'AUTH'; throw e; }
  if (!force && t.exp - 120000 > Date.now()) return t.at;
  if (!t.rt) { const e = new Error('Потрібен вхід'); e.code = 'AUTH'; throw e; }
  if (!MS_REFRESH) MS_REFRESH = msTokenRequest({ grant_type: 'refresh_token', refresh_token: t.rt })
    .catch(err => { if (/invalid_grant|interaction_required|AUTH/.test(err.code || '')) { const e = new Error('Сесія Microsoft завершилась'); e.code = 'AUTH'; throw e; } throw err; })
    .finally(() => { MS_REFRESH = null; });
  return (await MS_REFRESH).at;
}
function msLogout() { LS.set('msTok', null); LS.set('msPkce', null); }

// ───────── Microsoft Graph ─────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function gx(method, path, body, opt = {}) {
  const url = /^https:/.test(path) ? path : GRAPH + path;
  const raw = body instanceof Blob || body instanceof ArrayBuffer || body instanceof Uint8Array;
  for (let i = 0; i < 5; i++) {
    const tok = await msToken(i > 0 && opt._401);
    const h = { Authorization: 'Bearer ' + tok, ...(opt.headers || {}) };
    if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
    const r = await fetch(url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
    if (r.status === 429 || r.status === 503 || r.status === 504) { await sleep(Math.min(30, Number(r.headers.get('Retry-After')) || 2 ** i) * 1000); continue; }
    if (r.status === 401 && !opt._401) { opt._401 = true; continue; }
    if (opt.raw) return r;
    const txt = await r.text();
    let j = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = { text: txt }; }
    if (!r.ok) throw gErr(r.status, j);
    return j;
  }
  throw new Error('Сервер Microsoft перевантажений — спробуйте пізніше');
}
function gErr(status, j) {
  const e = new Error((j && j.error && j.error.message) || ('Microsoft Graph: помилка ' + status));
  e.status = status; e.code = j && j.error && j.error.code;
  if (status === 401) e.code = 'AUTH';
  return e;
}
/** Пакетні запити (по 20 за раз). reqs: [{method, url, body?}] → відповіді в тому ж порядку {status, body}. */
async function gbatch(reqs) {
  const out = new Array(reqs.length);
  let todo = reqs.map((r, i) => i);
  for (let round = 0; todo.length && round < 6; round++) {
    const again = [];
    for (let s = 0; s < todo.length; s += 20) {
      const part = todo.slice(s, s + 20);
      const j = await gx('POST', '/$batch', {
        requests: part.map(i => {
          const r = reqs[i], u = String(r.url).replace(GRAPH, '');
          return { id: String(i), method: r.method || 'GET', url: u, ...(r.body !== undefined ? { body: r.body, headers: { 'Content-Type': 'application/json' } } : {}) };
        })
      });
      let wait = 0;
      (j.responses || []).forEach(x => {
        const i = Number(x.id);
        if (x.status === 429 || x.status === 503) { again.push(i); wait = Math.max(wait, Number((x.headers || {})['Retry-After']) || 2); }
        else out[i] = { status: x.status, body: x.body || {} };
      });
      if (wait) await sleep(Math.min(30, wait) * 1000);
    }
    todo = again;
  }
  todo.forEach(i => { out[i] = { status: 429, body: { error: { message: 'Сервер Microsoft перевантажений' } } }; });
  return out;
}

// ───────── сайт і списки ─────────
const SP = { site: null, lists: null };
async function spSite() {
  if (SP.site) return SP.site;
  const c = LS.json('spSite');
  if (c && c.url === m365Cfg().site && c.id) return (SP.site = c.id);
  const u = new URL(m365Cfg().site);
  const path = u.pathname.replace(/\/(SitePages|Lists|Shared%20Documents)\/.*$/i, '').replace(/\/$/, '');
  const j = await gx('GET', `/sites/${u.hostname}:${path}?$select=id,webUrl,displayName`);
  LS.set('spSite', JSON.stringify({ url: m365Cfg().site, id: j.id, name: j.displayName }));
  return (SP.site = j.id);
}
/** {slug: listId} для списків порталу на сайті. */
async function spLists(force) {
  if (SP.lists && !force) return SP.lists;
  const sid = await spSite(), m = {};
  let url = `/sites/${sid}/lists?$select=id,displayName&$top=999`;
  while (url) {
    const j = await gx('GET', url);
    (j.value || []).forEach(l => { const n = String(l.displayName || ''); if (n.startsWith('vlnk_')) m[n.slice(5)] = l.id; });
    url = j['@odata.nextLink'] || '';
  }
  return (SP.lists = m);
}
/** Створює відсутні списки (потрібні права власника сайту). Повертає кількість створених. */
async function spCreateLists(onStep) {
  const sid = await spSite(), have = await spLists(true);
  const need = Object.keys(SP_LISTS).filter(t => !have[SP_LISTS[t]]);
  let n = 0;
  for (const t of need) {
    if (onStep) onStep(`Створюю список «${t}» (${n + 1} з ${need.length})…`);
    await gx('POST', `/sites/${sid}/lists`, {
      displayName: 'vlnk_' + SP_LISTS[t],
      description: 'Портал ВЛНК: ' + t + ' (дані порталу, не редагувати вручну)',
      columns: [{ name: 'data', text: { allowMultipleLines: true, textType: 'plain', linesForEditing: 6 } }],
      list: { template: 'genericList' }
    });
    n++;
  }
  await spLists(true);
  return n;
}

// ───────── відповідність рядків порталу і елементів списків ─────────
let SPX = null; // {idx: {"t|rowId": itemId}, delta: {slug: url}, nodelta: {slug: 1}}
async function spState() {
  if (!SPX) SPX = (await IDB.get('meta', 'sp')) || { idx: {}, delta: {} };
  if (!SPX.nodelta) SPX.nodelta = {};
  return SPX;
}
async function spSave() { if (SPX) await IDB.putMany('meta', [['sp', SPX]]); }
async function spReset() { SPX = { idx: {}, delta: {}, nodelta: {} }; await spSave(); }
const MAX_DATA = 60000;
/** Рядок → JSON для поля data (вбудовані файли data:… не зберігаються в списку — вони йдуть у бібліотеку). */
function spPack(r) {
  let s = JSON.stringify(r);
  if (s.length > MAX_DATA) {
    const c = { ...r };
    Object.keys(c).forEach(k => { if (typeof c[k] === 'string' && c[k].startsWith('data:') && c[k].length > 2000) c[k] = ''; });
    s = JSON.stringify(c);
  }
  return s;
}
function spUnpack(fields) {
  if (!fields || typeof fields.data !== 'string') return null;
  try { const r = JSON.parse(fields.data); if (r && typeof r === 'object') { if (!r.id) r.id = fields.Title; return r; } } catch (e) { /* пошкоджений рядок */ }
  return null;
}

/** Читання змін зі списків (delta). Повертає {table: [rows]}. full — повне перечитування. */
async function spPull(full) {
  const st = await spState(), sid = await spSite(), lists = await spLists();
  if (full) { st.delta = {}; }
  const data = {};
  const sel = '$expand=fields($select=Title,data)';
  const tables = Object.keys(SP_LISTS).filter(t => lists[SP_LISTS[t]]);
  const firstUrl = (t, slug) => st.nodelta[slug]
    ? `${GRAPH}/sites/${sid}/lists/${lists[slug]}/items?${sel}&$top=999`
    : (st.delta[slug] || `${GRAPH}/sites/${sid}/lists/${lists[slug]}/items/delta?${sel}&$top=500`);
  let pending = tables.map(t => ({ t, slug: SP_LISTS[t], url: firstUrl(t, SP_LISTS[t]), seen: st.nodelta[SP_LISTS[t]] ? new Set() : null }));
  const lackFields = [];
  for (let guard = 0; pending.length && guard < 200; guard++) {
    const res = await gbatch(pending.map(p => ({ method: 'GET', url: p.url })));
    const next = [];
    res.forEach((x, i) => {
      const p = pending[i];
      if (x.status === 410 || (x.status >= 400 && x.status < 500 && !st.nodelta[p.slug] && /delta|notSupported|invalidRequest|resyncRequired/i.test(JSON.stringify(x.body || {})))) {
        // delta недоступна або токен застарів: повне читання цього списку
        if (x.status !== 410) st.nodelta[p.slug] = 1;
        delete st.delta[p.slug];
        next.push({ ...p, url: firstUrl(p.t, p.slug), seen: st.nodelta[p.slug] ? new Set() : null });
        return;
      }
      if (x.status === 403) return; // немає доступу до цього списку (напр., відвідувач)
      if (x.status >= 300) throw gErr(x.status, x.body);
      const b = x.body || {};
      (b.value || []).forEach(it => {
        if (it.deleted) {
          const key = Object.keys(st.idx).find(k => st.idx[k] === it.id && k.startsWith(p.t + '|'));
          if (key) { (data[p.t] = data[p.t] || []).push({ id: key.slice(p.t.length + 1), deleted: true, updatedAt: Date.now() }); delete st.idx[key]; }
          return;
        }
        const r = spUnpack(it.fields);
        if (!r) { if (!it.fields) lackFields.push({ t: p.t, slug: p.slug, itemId: it.id }); return; }
        st.idx[p.t + '|' + r.id] = it.id;
        (data[p.t] = data[p.t] || []).push(r);
      });
      if (b['@odata.nextLink']) next.push({ ...p, url: b['@odata.nextLink'] });
      else if (b['@odata.deltaLink']) st.delta[p.slug] = b['@odata.deltaLink'];
    });
    pending = next;
  }
  // delta без полів — дочитуємо елементи окремо
  if (lackFields.length) {
    const res = await gbatch(lackFields.map(x => ({ method: 'GET', url: `/sites/${sid}/lists/${lists[x.slug]}/items/${x.itemId}?$expand=fields($select=Title,data)` })));
    res.forEach((x, i) => {
      const r = x.status < 300 && spUnpack(x.body.fields); if (!r) return;
      const t = lackFields[i].t; st.idx[t + '|' + r.id] = lackFields[i].itemId; (data[t] = data[t] || []).push(r);
    });
  }
  await spSave();
  return data;
}

/** Запис рядків у списки. changes: [{t, r}]. Повертає {rejected: [{t, id}]}. */
async function spPush(changes) {
  const st = await spState(), sid = await spSite(), lists = await spLists();
  const rejected = [];
  const reqs = [], meta = [];
  for (const c of changes) {
    const slug = spSlug(c.t), lid = lists[slug];
    if (!lid) { rejected.push({ t: c.t, id: c.r.id }); continue; }
    const key = c.t + '|' + c.r.id, item = st.idx[key];
    const fields = { Title: String(c.r.id), data: spPack(c.r) };
    if (item) reqs.push({ method: 'PATCH', url: `/sites/${sid}/lists/${lid}/items/${item}/fields`, body: fields });
    else reqs.push({ method: 'POST', url: `/sites/${sid}/lists/${lid}/items`, body: { fields } });
    meta.push({ c, key, lid, fields, patch: !!item });
  }
  if (!reqs.length) return { rejected };
  const res = await gbatch(reqs);
  const retry = [];
  let fail = null;
  res.forEach((x, i) => {
    const m = meta[i];
    if (x.status < 300) { if (!m.patch && x.body && x.body.id) st.idx[m.key] = x.body.id; return; }
    if (x.status === 404 && m.patch) { delete st.idx[m.key]; retry.push(m); return; } // елемент видалили в SharePoint — створюємо знову
    if (x.status === 403 || x.status === 401 && x.body && /accessDenied/i.test(JSON.stringify(x.body))) { rejected.push({ t: m.c.t, id: m.c.r.id }); return; }
    if (x.status === 400) { rejected.push({ t: m.c.t, id: m.c.r.id }); console.warn('SharePoint відхилив рядок', m.c, x.body); return; }
    fail = fail || gErr(x.status, x.body);
  });
  if (retry.length) {
    const r2 = await gbatch(retry.map(m => ({ method: 'POST', url: `/sites/${sid}/lists/${m.lid}/items`, body: { fields: m.fields } })));
    r2.forEach((x, i) => { if (x.status < 300 && x.body.id) st.idx[retry[i].key] = x.body.id; else fail = fail || gErr(x.status, x.body); });
  }
  await spSave();
  if (fail) throw fail; // решта змін лишається в черзі й повториться
  return { rejected };
}
/** Записати один рядок і одразу оновити його на телефоні. */
async function spUpsert(t, row) {
  const r = { ...row, updatedAt: Date.now(), updatedBy: ME && ME.email || '' };
  const res = await spPush([{ t, r }]);
  if (res.rejected.length) throw new Error('Недостатньо прав для запису');
  await applyLocal(t, r);
  return r;
}

/** Хто увійшов: працівник із «Персоналу» за email (або службова/корпоративна адреса). */
function m365User(tok) {
  const email = String(tok.email || '').toLowerCase();
  const ppl = all('Персонал');
  const p = ppl.find(x => [x.email, x.emailCorp].some(e => String(e || '').trim().toLowerCase() === email));
  if (p) return { email, name: p.pib || tok.name || email, personId: p.id, role: ROLES.includes(p.role) ? p.role : 'відвідувач' };
  // порожній сайт (ще без працівників) — перший вхід власника сайту для налаштування
  return { email, name: tok.name || email, personId: '', role: ppl.length ? 'відвідувач' : 'керівник' };
}

// ───────── файли в бібліотеці сайту ─────────
const spName = s => String(s || '').replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').slice(0, 180) || 'Файл';
function b64ToBytes(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function bytesToB64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
/** Завантажує файл у «Документи» сайту: Портал ВЛНК / folders… / name. Повертає driveItem. */
async function spUploadFile(folders, name, mime, b64) {
  const sid = await spSite();
  const path = [SP_ROOT, ...folders.map(spName), spName(name)].map(encodeURIComponent).join('/');
  const bytes = b64ToBytes(b64);
  if (bytes.length <= 4 * 1024 * 1024) {
    return gx('PUT', `/sites/${sid}/drive/root:/${path}:/content?@microsoft.graph.conflictBehavior=rename`, new Blob([bytes], { type: mime || 'application/octet-stream' }));
  }
  const ses = await gx('POST', `/sites/${sid}/drive/root:/${path}:/createUploadSession`, { item: { '@microsoft.graph.conflictBehavior': 'rename' } });
  const CH = 320 * 1024 * 10; // 3,2 МБ, кратно 320 КБ
  let last = null;
  for (let s = 0; s < bytes.length; s += CH) {
    const e = Math.min(bytes.length, s + CH);
    const r = await fetch(ses.uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${s}-${e - 1}/${bytes.length}` }, body: bytes.subarray(s, e) });
    if (!r.ok && r.status !== 202) throw new Error('Не вдалося завантажити файл (' + r.status + ')');
    last = await r.json().catch(() => null);
  }
  return last;
}
async function spDownload(itemId) {
  const sid = await spSite();
  const it = await gx('GET', `/sites/${sid}/drive/items/${itemId}?$select=name,file,@microsoft.graph.downloadUrl`);
  const url = it['@microsoft.graph.downloadUrl'];
  if (!url) throw new Error('Файл недоступний');
  const r = await fetch(url);
  if (!r.ok) throw new Error('Файл не завантажився (' + r.status + ')');
  return { name: it.name, mime: (it.file && it.file.mimeType) || r.headers.get('Content-Type') || 'application/octet-stream', data: bytesToB64(await r.arrayBuffer()) };
}
const extOf = (name, mime) => (String(name || '').match(/\.[A-Za-z0-9]{2,5}$/) || [''])[0] || (/pdf/.test(mime) ? '.pdf' : /jpe?g/.test(mime) ? '.jpg' : /png/.test(mime) ? '.png' : '');
/** Чи рядок уже є в SharePoint (файл чіпляємо лише до збереженого рядка). */
async function spHas(t, id) { const st = await spState(); return !!st.idx[t + '|' + id]; }

/** Лист собі з пошти працівника; файл до 3 МБ — вкладенням, більший — посиланням. */
async function spMailSelf(subject, text, file, link) {
  const to = String(ME && ME.email || '').trim();
  if (!/@/.test(to)) return { ok: false, error: 'Невідома адреса пошти' };
  const att = file && file.data && file.data.length < 4 * 1024 * 1024 ? [{ '@odata.type': '#microsoft.graph.fileAttachment', name: file.name, contentType: file.mime, contentBytes: file.data }] : [];
  const body = 'Добрий день, ' + (ME.name || '') + '!\n\n' + text + (file && !att.length && link ? '\n\nФайл завеликий для вкладення — відкрийте за посиланням:\n' + link : '') + '\n\nНадіслано з порталу ВЛНК.';
  await gx('POST', '/me/sendMail', { message: { subject, body: { contentType: 'Text', content: body }, toRecipients: [{ emailAddress: { address: to } }], attachments: att }, saveToSentItems: false });
  return { ok: true, to };
}

// ───────── дії API (ті самі відповіді, що й в Apps Script) ─────────
const M365_NOT_YET = 'Ця дія ще не перенесена на Microsoft 365 (формування документів на сервері). Скористайтеся «Формування документів» або поверніться на Google-портал у Налаштуваннях.';
async function m365Api(body) {
  const a = body.action;
  try {
    if (!m365Ready()) return { ok: false, error: 'Microsoft 365 не налаштовано (config.js)' };
    if (a === 'sync') return await m365Sync(body);
    if (a === 'logout') { msLogout(); return { ok: true }; }
    if (a === 'upload') return await m365UploadOrder(body);
    if (/^upload(proto|doc|cert|calib|pass|eqphoto)$/.test(a)) return await m365UploadRow(body);
    if (a === 'getorder') { const t = get('Завдання', body.taskId); if (!t || !t.orderFileId) return { ok: false, error: 'Наказ не знайдено' }; const f = await spDownload(t.orderFileId); return { ok: true, fileId: t.orderFileId, ...f, name: t.orderFileName || f.name }; }
    if (a === 'getfile') return await m365GetFile(body);
    if (a === 'mailproto' || a === 'maildoc' || a === 'mailcert') return await m365MailRow(a, body);
    if (a === 'mailorder') {
      const t = get('Завдання', body.taskId); if (!t || !t.orderFileId) return { ok: false, error: 'Наказ не знайдено' };
      const o = get('Обʼєкти', t.objectId) || {}, f = await spDownload(t.orderFileId);
      return await spMailSelf('Наказ' + (t.orderNo ? ' № ' + t.orderNo : '') + ' — ' + (o.short || ''), 'У вкладенні наказ на відрядження (пересувний характер робіт).\nОбʼєкт: ' + (o.short || '') + '\nБригада ' + t.brigade + ', період: ' + (t.dateFrom || '') + ' – ' + (t.dateTo || ''), { ...f, name: t.orderFileName || f.name }, t.orderFile);
    }
    if (a === 'invite') return { ok: false, error: 'У Microsoft 365 доступ надається через групи сайту SharePoint: додайте працівника в групу «Учасники» (працівник) або «Відвідувачі» сайту ВЛНК.' };
    return { ok: false, error: M365_NOT_YET };
  } catch (e) {
    if (e.code === 'AUTH') return { ok: false, error: 'AUTH' };
    return { ok: false, error: String(e.message || e) };
  }
}
async function m365Sync(body) {
  const lists = await spLists();
  if (!Object.keys(lists).length) return { ok: false, error: 'SETUP' };
  const changes = (body.changes || []).slice();
  // передача обладнання змінює власника в «Обладнанні» (раніше це робив сервер)
  changes.filter(c => c.t === 'Переміщення' && !truthy(c.r.deleted)).forEach(c => {
    const e = get('Обладнання', c.r.equipId);
    if (e && !changes.some(x => x.t === 'Обладнання' && x.r.id === e.id)) {
      const ne = { ...e, holderType: c.r.toType, holderId: c.r.toId, condition: c.r.condition, updatedAt: Date.now(), updatedBy: ME.email };
      changes.push({ t: 'Обладнання', r: ne }); applyLocal('Обладнання', ne);
    }
  });
  const data = await spPull(!Number(body.since));
  const mine = new Set(changes.map(c => c.t + '|' + c.r.id));
  Object.keys(data).forEach(t => { data[t] = data[t].filter(r => !mine.has(t + '|' + r.id)); if (!data[t].length) delete data[t]; });
  const { rejected } = await spPush(changes);
  // користувач — за «Персоналом» (з урахуванням щойно отриманих рядків)
  (data['Персонал'] || []).forEach(r => putMem('Персонал', r));
  const tok = LS.json('msTok') || {};
  return { ok: true, serverTime: Date.now(), apiVer: M365_VER, user: m365User(tok), data, rejected };
}
async function m365UploadOrder(b) {
  const t = get('Завдання', b.taskId);
  if (!t || !(await spHas('Завдання', t.id))) return { ok: false, error: 'NOTASK' };
  const o = get('Обʼєкти', t.objectId) || {};
  const name = 'Наказ' + (t.orderNo ? ' № ' + t.orderNo : '') + ' — ' + (o.short || '') + ' — Б' + t.brigade + ' ' + (t.dateFrom || '') + extOf(b.name, b.mime);
  const it = await spUploadFile(['Накази', o.short || 'Без обʼєкта'], name, b.mime, b.data);
  const row = { id: t.id, orderFile: it.webUrl, orderFileName: it.name || name, orderFileId: it.id };
  await spUpsert('Завдання', { ...t, ...row });
  return { ok: true, file: row };
}
async function m365UploadRow(b) {
  const kind = b.action.replace('upload', '');
  const t = { proto: 'Протоколи', doc: 'Документи', cert: 'Сертифікати', calib: 'Обладнання', pass: 'Обладнання', eqphoto: 'ФотоОбладнання' }[kind];
  const p = get(t, b.id);
  if (!p || !(await spHas(t, p.id))) return { ok: false, error: 'NOROW' };
  let folders, name, row;
  if (kind === 'proto') {
    const o = get('Обʼєкти', p.objectId) || {};
    const base = 'Протокол' + (p.number ? ' № ' + p.number : '') + ' — ' + (p.method || 'НК') + ' — ' + (o.short || '') + ' ' + (p.date || '');
    const isUpd = !!p.fileId, vers = arr(p.versions), v = vers.length + 2, by = String(b.by || ME.name || '').trim();
    name = (isUpd ? base + ' — оновлена версія ' + v + ' від ' + uaDate(today()) + (by ? ' (' + by + ')' : '') : base) + extOf(b.name, b.mime);
    folders = ['Протоколи НК', o.short || 'Без обʼєкта'];
    const it = await spUploadFile(folders, name, b.mime, b.data);
    row = { file: it.webUrl, fileName: it.name || name, fileId: it.id };
    if (isUpd) { vers.push({ v: v - 1, fileName: p.fileName || '', fileId: p.fileId, file: p.file || '', at: p.verAt || '', by: p.verBy || p.enteredBy || '' }); Object.assign(row, { versions: JSON.stringify(vers), verAt: Date.now(), verBy: by }); }
  } else {
    if (kind === 'doc') { folders = ['Інструкції та НД', p.kind || 'Інше']; name = String(p.title || 'Документ').slice(0, 120) + (p.version ? ' (ред. ' + p.version + ')' : ''); }
    else if (kind === 'cert') { const pp = get('Персонал', p.personId) || {}; folders = ['Сертифікати НК', pp.pib || 'Без ПІБ']; name = 'Сертифікат ' + (p.method || 'НК') + (p.level ? ' ' + p.level + ' рів.' : '') + (p.number ? ' № ' + p.number : '') + ' — ' + (pp.pib || ''); }
    else if (kind === 'eqphoto') { folders = ['Обладнання', 'Фото']; name = 'Фото ' + (p.stage || '') + ' ' + (p.date || '') + ' ' + p.id; }
    else { folders = ['Обладнання', p.name || p.invNo || 'Без назви']; name = (kind === 'pass' ? 'Паспорт ' : 'Свідоцтво про калібрування ') + (p.name || '') + (p.invNo ? ' інв. ' + p.invNo : ''); }
    name += extOf(b.name, b.mime);
    const it = await spUploadFile(folders, name, b.mime, b.data);
    row = kind === 'pass' ? { passFile: it.webUrl, passFileName: it.name || name, passFileId: it.id } : { file: it.webUrl, fileName: it.name || name, fileId: it.id };
  }
  await spUpsert(t, { ...p, ...row });
  return { ok: true, file: { id: p.id, ...row }, label: row.fileName || row.passFileName, cacheId: row.fileId || row.passFileId };
}
async function m365GetFile(b) {
  const p = get(b.table, b.id);
  if (!p) return { ok: false, error: 'Файл не знайдено' };
  let fid = b.slot === 'pass' ? p.passFileId : b.slot === 'act' ? p.actFileId : p.fileId, fname = b.slot === 'pass' ? p.passFileName : p.fileName;
  if (b.ver) { const hit = arr(p.versions).find(x => String(x.v) === String(b.ver)); if (!hit) return { ok: false, error: 'Версію не знайдено' }; fid = hit.fileId; fname = hit.fileName; }
  if (!fid) return { ok: false, error: 'Файл не знайдено' };
  const f = await spDownload(fid);
  return { ok: true, fileId: fid, ...f, name: fname || f.name };
}
async function m365MailRow(a, b) {
  const t = { mailproto: 'Протоколи', maildoc: 'Документи', mailcert: 'Сертифікати' }[a];
  const p = get(t, b.id);
  if (!p) return { ok: false, error: 'NOROW' };
  if (!p.fileId && a !== 'maildoc') return { ok: false, error: 'NOFILE' };
  const f = p.fileId ? { ...(await spDownload(p.fileId)), name: p.fileName } : null;
  if (a === 'mailproto') { const o = get('Обʼєкти', p.objectId) || {}; return spMailSelf('Протокол ' + (p.method || '') + (p.number ? ' № ' + p.number : '') + ' — ' + (o.short || ''), 'У вкладенні протокол неруйнівного контролю.\nОбʼєкт: ' + (o.short || '') + '\nМетод: ' + (p.method || '') + ', дата: ' + (p.date || '') + (p.note ? '\n' + p.note : ''), f, p.file); }
  if (a === 'mailcert') { const pp = get('Персонал', p.personId) || {}; return spMailSelf('Сертифікат ' + (p.method || '') + (p.number ? ' № ' + p.number : '') + ' — ' + (pp.pib || ''), 'У вкладенні сертифікат з неруйнівного контролю.\nПрацівник: ' + (pp.pib || '') + '\nМетод: ' + (p.method || '') + (p.validTo ? '\nДійсний до: ' + p.validTo : ''), f, p.file); }
  return spMailSelf((p.kind || 'Документ') + ': ' + (p.title || ''), (p.kind || 'Документ') + ': ' + (p.title || '') + (p.version ? '\nРедакція: ' + p.version : '') + (p.link ? '\nПосилання: ' + p.link : '') + (p.text ? '\n\n' + p.text : ''), f, p.file);
}

// ───────── перенесення даних з Google-порталу ─────────
/** Запит до старого API Apps Script (токен збережено при перемиканні). */
async function gasCall(body, timeoutMs = 120000) {
  const url = LS.get('gasApi'), token = LS.get('gasToken');
  if (!url || !token) throw new Error('Немає сесії Google-порталу на цьому пристрої: увійдіть у Google-портал і перемкніться на Microsoft 365 зі сторінки «Microsoft 365»');
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', redirect: 'follow', signal: ctl.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, token }) });
    return await r.json();
  } finally { clearTimeout(tm); }
}
/** Переносить усі рядки, потім файли. Можна перезапускати: уже перенесене пропускається. */
async function m365Migrate(log) {
  log('Читаю всі дані з Google-порталу…');
  const res = await gasCall({ action: 'sync', since: 0, changes: [] }, 300000);
  if (!res.ok) throw new Error(res.error === 'AUTH' ? 'Сесія Google-порталу завершилась — увійдіть у Google-портал знову і повторіть' : res.error);
  const src = res.data || {};
  const have = await spLists(true);
  const miss = Object.keys(src).filter(t => !have[spSlug(t)]);
  if (miss.length) throw new Error('На сайті немає списків для: ' + miss.join(', ') + '. Спершу натисніть «Створити списки».');
  await spPull(true); // щоб знати, що вже перенесено
  const st = await spState();
  const rows = [];
  Object.keys(src).forEach(t => src[t].forEach(r => rows.push({ t, r })));
  const todo = rows.filter(x => !st.idx[x.t + '|' + x.r.id]);
  log(`Рядків: ${rows.length}, ще не перенесено: ${todo.length}`);
  for (let i = 0; i < todo.length; i += 100) {
    const part = todo.slice(i, i + 100);
    const r = await spPush(part);
    if (r.rejected.length) log(`Не прийнято рядків: ${r.rejected.length} (перевірте права власника сайту)`);
    log(`Перенесено рядків: ${Math.min(todo.length, i + 100)} з ${todo.length}`);
  }
  // файли: накази, протоколи (з версіями), документи, сертифікати, обладнання
  const done = new Set(JSON.parse(LS.get('migFiles') || '[]'));
  const mark = k => { done.add(k); LS.set('migFiles', JSON.stringify([...done])); };
  const jobs = [];
  (src['Завдання'] || []).forEach(r => { if (r.orderFileId && !truthy(r.deleted)) jobs.push({ t: 'Завдання', r, kind: 'order' }); });
  ['Протоколи', 'Документи', 'Сертифікати', 'Обладнання', 'ФотоОбладнання'].forEach(t => (src[t] || []).forEach(r => {
    if (truthy(r.deleted)) return;
    if (r.fileId) jobs.push({ t, r, kind: 'file' });
    if (t === 'Обладнання' && r.passFileId) jobs.push({ t, r, kind: 'pass' });
  }));
  log(`Файлів до перенесення: ${jobs.filter(j => !done.has(j.t + '|' + j.r.id + '|' + j.kind)).length}`);
  let n = 0, bad = 0;
  for (const j of jobs) {
    const k = j.t + '|' + j.r.id + '|' + j.kind;
    if (done.has(k)) continue;
    try {
      const cur = { ...j.r };
      const g = j.kind === 'order' ? await gasCall({ action: 'getorder', taskId: j.r.id }) : await gasCall({ action: 'getfile', table: j.t, id: j.r.id, ...(j.kind === 'pass' ? { slot: 'pass' } : {}) });
      if (!g.ok) throw new Error(g.error);
      const o = get('Обʼєкти', cur.objectId) || (src['Обʼєкти'] || []).find(x => x.id === cur.objectId) || {};
      const folders = j.kind === 'order' ? ['Накази', o.short || 'Без обʼєкта'] : j.t === 'Протоколи' ? ['Протоколи НК', o.short || 'Без обʼєкта'] : j.t === 'Документи' ? ['Інструкції та НД', cur.kind || 'Інше'] : j.t === 'Сертифікати' ? ['Сертифікати НК'] : ['Обладнання'];
      const fname = j.kind === 'order' ? (cur.orderFileName || g.name) : j.kind === 'pass' ? (cur.passFileName || g.name) : (cur.fileName || g.name);
      const it = await spUploadFile(folders, fname, g.mime, g.data);
      if (j.kind === 'order') Object.assign(cur, { orderFile: it.webUrl, orderFileId: it.id });
      else if (j.kind === 'pass') Object.assign(cur, { passFile: it.webUrl, passFileId: it.id });
      else Object.assign(cur, { file: it.webUrl, fileId: it.id });
      if (j.t === 'Протоколи' && arr(cur.versions).length) {
        const vs = arr(cur.versions);
        for (const v of vs) {
          if (!v.fileId) continue;
          const gv = await gasCall({ action: 'getfile', table: 'Протоколи', id: j.r.id, ver: v.v });
          if (!gv.ok) continue;
          const iv = await spUploadFile(folders, v.fileName || gv.name, gv.mime, gv.data);
          Object.assign(v, { fileId: iv.id, file: iv.webUrl });
        }
        cur.versions = JSON.stringify(vs);
      }
      const rj = await spPush([{ t: j.t, r: cur }]);
      if (rj.rejected.length) throw new Error('рядок не прийнято');
      mark(k); n++;
      if (n % 5 === 0) log(`Перенесено файлів: ${n}`);
    } catch (e) { bad++; log(`Файл не перенесено (${j.t}, ${cur0(j)}): ${e.message}`); }
  }
  log(`Готово. Рядків перенесено: ${todo.length}, файлів: ${n}${bad ? ', з помилками: ' + bad + ' (натисніть «Перенести» ще раз)' : ''}.`);
  return { rows: todo.length, files: n, bad };
}
const cur0 = j => j.r.fileName || j.r.orderFileName || j.r.title || j.r.number || j.r.id;

// ───────── екран «Microsoft 365» (налаштування і перехід) ─────────
ROUTES.m365 = () => {
  const c = m365Cfg(), on = isM365();
  const st = LS.json('spSite') || {};
  let h = card('Підключення', `
    <div class="f"><span>Зараз портал працює з</span><b>${on ? 'Microsoft 365 (SharePoint)' : 'Google (Apps Script)'}</b></div>
    <div class="f"><span>Організація (tenant ID)</span><code class="small">${esc(c.tenant || '— не вказано —')}</code></div>
    <div class="f"><span>Застосунок (client ID)</span><code class="small">${esc(c.clientId || '— очікується від ІТ —')}</code></div>
    <div class="f"><span>Сайт SharePoint</span><code class="small">${esc(c.site || '— не вказано —')}</code>${st.name ? `<div class="small mute">${esc(st.name)}</div>` : ''}</div>
    <div class="f"><span>Адреса повернення (для реєстрації в ІТ)</span><code class="small">${esc(msRedirect())}</code></div>
    ${m365Ready() ? '' : '<p class="small warn">Щоб увімкнути Microsoft 365, у config.js мають бути tenant, clientId і адреса сайту.</p>'}`);
  if (!on) {
    h += card('Перехід на Microsoft 365', `
      <ol class="small"><li>Створіть списки на сайті й перенесіть дані (кнопки зʼявляться після входу через Microsoft 365).</li><li>Поки йде перенесення, Google-портал працює як і раніше.</li><li>Повернутися на Google можна будь-коли на цій сторінці.</li></ol>
      <button type="button" class="btn primary" data-act="m365on"${m365Ready() && MODE === 'live' ? '' : ' disabled'}>Увійти через Microsoft 365 на цьому пристрої</button>
      ${MODE !== 'live' ? '<p class="small mute">Доступно лише на робочому порталі (не в демо).</p>' : ''}`);
  } else {
    h += card('Списки SharePoint', `<p class="small" id="m365lists">Перевіряю…</p>
      <div class="row gap wrap"><button type="button" class="btn small primary" data-act="m365lists">Створити відсутні списки</button><button type="button" class="btn small ghost" data-act="m365check">Перевірити</button></div>
      <p class="small mute">Створювати списки може власник сайту. Кожен рядок порталу — окремий елемент списку (поле data), тож правити списки вручну не потрібно.</p>`);
    h += card('Перенесення даних з Google-порталу', `
      <p class="small">${LS.get('gasToken') ? 'Сесію Google-порталу збережено на цьому пристрої — можна переносити.' : '<span class="warn">Сесії Google-порталу на цьому пристрої немає. Поверніться на Google, увійдіть і знову перемкніться сюди.</span>'}</p>
      <button type="button" class="btn small primary" data-act="m365migrate"${LS.get('gasToken') ? '' : ' disabled'}>Перенести дані й файли</button>
      <pre class="small" id="m365log" style="white-space:pre-wrap;max-height:260px;overflow:auto"></pre>
      <p class="small mute">Можна запускати повторно: перенесене раніше пропускається. Формування СЗ, табелів для замовника, списань ПММ і матеріалів на сервері поки доступне лише на Google-порталі.</p>`);
    h += card('Повернення', `<button type="button" class="btn small ghost" data-act="m365off">Повернутися на Google-портал</button>`);
  }
  setTimeout(() => { if (on && $('#m365lists')) ACTS.m365check(); }, 0);
  return page('Microsoft 365', h, '#/settings');
};
ACTS.m365check = async () => {
  const el = $('#m365lists'); if (!el) return;
  try {
    const l = await spLists(true), n = Object.keys(SP_LISTS).filter(t => l[SP_LISTS[t]]).length;
    el.innerHTML = `Списків порталу на сайті: <b>${n} з ${Object.keys(SP_LISTS).length}</b>` + (n < Object.keys(SP_LISTS).length ? ' — <span class="warn">створіть відсутні</span>' : ' — <span class="ok">усі на місці</span>');
  } catch (e) { el.innerHTML = '<span class="bad">' + esc(e.code === 'AUTH' ? 'Потрібен вхід через Microsoft 365' : e.message) + '</span>'; }
};
ACTS.m365lists = async () => {
  const el = $('#m365lists');
  try { const n = await spCreateLists(t => { if (el) el.textContent = t; }); toast(n ? 'Створено списків: ' + n : 'Усі списки вже є'); ACTS.m365check(); }
  catch (e) { toast('Не вдалося: ' + (e.status === 403 ? 'потрібні права власника сайту' : e.message)); ACTS.m365check(); }
};
ACTS.m365migrate = async () => {
  const el = $('#m365log'); const log = t => { if (el) { el.textContent += t + '\n'; el.scrollTop = el.scrollHeight; } };
  if (!await ask('Перенести всі дані й файли з Google-порталу на сайт SharePoint? Це може тривати кілька хвилин; не закривайте сторінку.', 'Перенести')) return;
  try { await m365Migrate(log); await IDB.putMany('meta', [['since', 0]]); sync(true); }
  catch (e) { log('Помилка: ' + e.message); toast(e.message); }
};
ACTS.m365on = async () => {
  if (!await ask('Перемкнути цей пристрій на Microsoft 365? Відкриється вхід Microsoft. Незбережені зміни спершу буде відправлено на Google-портал.', 'Перемкнути')) return;
  if (DB.pending) { await sync(true); if (DB.pending) return toast('Спершу дочекайтеся відправки змін (немає звʼязку?)'); }
  LS.set('gasToken', LS.get('token')); LS.set('gasApi', CFG.api); LS.set('gasUser', LS.get('user'));
  LS.set('backend', 'm365');
  await IDB.clear('rows'); await IDB.clear('outbox'); await IDB.putMany('meta', [['since', 0]]); await spReset();
  LS.set('mode', null); LS.set('user', null);
  await msLogin({ hint: ME && ME.email, }).catch(e => toast(e.message));
};
ACTS.m365off = async () => {
  if (!await ask('Повернутися на Google-портал на цьому пристрої?', 'Повернутися')) return;
  if (DB.pending) await sync(true);
  msLogout(); LS.set('backend', 'gas');
  await IDB.clear('rows'); await IDB.clear('outbox'); await IDB.putMany('meta', [['since', 0]]); await spReset();
  if (LS.get('gasToken')) { LS.set('token', LS.get('gasToken')); LS.set('user', LS.get('gasUser')); LS.set('mode', 'live'); }
  else { LS.set('mode', null); LS.set('user', null); }
  location.hash = ''; location.reload();
};
