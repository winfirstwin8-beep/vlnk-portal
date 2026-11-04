/**
 * Портал ВЛНК — сервер push-сповіщень на телефон (окремий проєкт Apps Script).
 *
 * Розгортання: script.google.com → «Новий проєкт» → вставити цей файл → «Розгорнути» → «Нове розгортання» →
 *   тип «Вебзастосунок», «Виконувати від імені»: Я, «Хто має доступ»: Усі → скопіювати адресу (…/exec)
 *   і вставити її в порталі: Сповіщення → «Сервер сповіщень на телефон» (керівник).
 *
 * Як працює:
 *  • Вхід перевіряється через основне API порталу (той самий сесійний токен) — паролі й дані тут не зберігаються.
 *  • Підписки телефонів (Web Push) зберігаються у властивостях скрипта.
 *  • Коли працівник змінює завдання / публікує новину / додає PDF-матеріали, портал надсилає подію сюди,
 *    сервер кладе повідомлення у «вхідні» кожного адресата і будить його телефон порожнім push (VAPID, ES256).
 *    Телефон забирає текст повідомлення з «вхідних» і показує його.
 */
const MAIN_API = 'https://script.google.com/macros/s/AKfycbxpxED3ug2dEPem9MX7MFOXPEuzdrPHo6zrbPWBVxp3n8zi0cjTatIWrveInoc9TctX/exec';
const PUSH_VER = '1.0.0';
const SUBJECT = 'https://winfirstwin8-beep.github.io/vlnk-portal/';
const INBOX_MAX = 25, INBOX_TTL = 21600; // 6 год

function doGet() { return out_({ ok: true, name: 'Портал ВЛНК — сповіщення', version: PUSH_VER, key: vapidPub_() }); }
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    if (req.action === 'info') return out_({ ok: true, version: PUSH_VER, key: vapidPub_() });
    const user = verify_(req.token);
    if (!user) return out_({ ok: false, error: 'AUTH' });
    if (req.action === 'setvapid') return out_(setVapid_(user, req));
    if (req.action === 'subscribe') return out_(subscribe_(user, req));
    if (req.action === 'unsubscribe') return out_(unsubscribe_(user, req));
    if (req.action === 'notify') return out_(notify_(user, req));
    if (req.action === 'inbox') return out_(inbox_(user));
    if (req.action === 'test') return out_(test_(user));
    return out_({ ok: false, error: 'Невідома дія' });
  } catch (err) { console.error(err && err.stack || err); return out_({ ok: false, error: 'Помилка сервера сповіщень' }); }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function props_() { return PropertiesService.getScriptProperties(); }
function cache_() { return CacheService.getScriptCache(); }
function sha_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }

/** Перевірка сесії через основне API (кеш 10 хв). */
function verify_(token) {
  if (!token || !/^[A-Za-z0-9_.-]{20,300}$/.test(String(token))) return null;
  const k = 'U_' + sha_(token), hit = cache_().get(k);
  if (hit) return JSON.parse(hit);
  const r = UrlFetchApp.fetch(MAIN_API, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ action: 'sync', token: token, since: 9e15, changes: [] }) });
  let j = null; try { j = JSON.parse(r.getContentText()); } catch (e) { return null; }
  if (!j || !j.ok || !j.user || !j.user.personId) return null;
  const u = { personId: j.user.personId, role: j.user.role, name: j.user.name, email: j.user.email };
  cache_().put(k, JSON.stringify(u), 600);
  return u;
}

// ───────── підписки ─────────
function subsAll_() { try { return JSON.parse(props_().getProperty('SUBS') || '{}') || {}; } catch (e) { return {}; } }
function subsSave_(m) { props_().setProperty('SUBS', JSON.stringify(m)); }
function subscribe_(user, req) {
  const s = req.sub || {};
  if (!/^https:\/\//.test(String(s.endpoint || '')) || !s.keys) return { ok: false, error: 'Немає підписки' };
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const m = subsAll_();
    Object.keys(m).forEach(function (pid) { m[pid] = (m[pid] || []).filter(function (x) { return x.endpoint !== s.endpoint; }); if (!m[pid].length) delete m[pid]; });
    const list = m[user.personId] || [];
    list.push({ endpoint: s.endpoint, prefs: req.prefs || {}, at: Date.now(), dev: String(req.device || '').slice(0, 60) });
    m[user.personId] = list.slice(-4); // до 4 пристроїв на людину
    subsSave_(m);
  } finally { lock.releaseLock(); }
  return { ok: true };
}
function unsubscribe_(user, req) {
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const m = subsAll_();
    m[user.personId] = (m[user.personId] || []).filter(function (x) { return req.endpoint ? x.endpoint !== req.endpoint : false; });
    if (!m[user.personId].length) delete m[user.personId];
    subsSave_(m);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

// ───────── вхідні повідомлення ─────────
function inboxAdd_(pid, msg) {
  const k = 'IN_' + pid, cur = JSON.parse(cache_().get(k) || '[]');
  cur.push(msg);
  cache_().put(k, JSON.stringify(cur.slice(-INBOX_MAX)), INBOX_TTL);
}
function inbox_(user) {
  const k = 'IN_' + user.personId, cur = JSON.parse(cache_().get(k) || '[]');
  cache_().remove(k);
  return { ok: true, items: cur };
}

/** Подія від порталу → «вхідні» адресатів + push на їхні телефони. */
function notify_(user, req) {
  if (user.role === 'відвідувач') return { ok: false, error: 'Немає доступу' };
  const evs = (req.events || []).slice(0, 30).filter(function (e) { return e && e.title; });
  if (!evs.length) return { ok: true, sent: 0 };
  const m = subsAll_(), wake = {};
  Object.keys(m).forEach(function (pid) {
    if (pid === user.personId) return; // свої зміни не сповіщаються
    (m[pid] || []).forEach(function (sub) {
      const p = sub.prefs || {};
      evs.forEach(function (e) {
        if (e.kind === 'news' && p.news === false) return;
        if (e.kind === 'mat' && p.mats === false) return;
        if (e.kind === 'task' || e.kind === 'mat') {
          const mode = p.tasks || 'mine';
          if (e.kind === 'task' && mode === 'off') return;
          if (mode === 'mine' && (e.mine || []).length && (e.mine || []).indexOf(pid) < 0) return;
        }
        const key = pid + '|' + e.title + '|' + (e.body || '');
        if (!wake[pid]) wake[pid] = { subs: {}, msgs: {} };
        wake[pid].subs[sub.endpoint] = sub;
        wake[pid].msgs[key] = { title: String(e.title).slice(0, 120), body: String(e.body || '').slice(0, 400), href: String(e.href || '#/notifs').slice(0, 120), kind: e.kind, by: shortName_(user.name), at: Date.now() };
      });
    });
  });
  const reqs = [], subsFlat = [];
  Object.keys(wake).forEach(function (pid) {
    Object.keys(wake[pid].msgs).forEach(function (k) { inboxAdd_(pid, wake[pid].msgs[k]); });
    Object.keys(wake[pid].subs).forEach(function (ep) { reqs.push(pushReq_(ep)); subsFlat.push([pid, ep]); });
  });
  if (!reqs.length) return { ok: true, sent: 0 };
  const res = UrlFetchApp.fetchAll(reqs);
  const gone = [];
  res.forEach(function (r, i) { const c = r.getResponseCode(); if (c === 404 || c === 410) gone.push(subsFlat[i]); });
  if (gone.length) dropSubs_(gone);
  return { ok: true, sent: reqs.length - gone.length, gone: gone.length };
}
function test_(user) {
  const m = subsAll_(), mine = m[user.personId] || [];
  if (!mine.length) return { ok: false, error: 'На цьому акаунті немає підписаних телефонів' };
  inboxAdd_(user.personId, { title: '🔔 Портал ВЛНК — тестове сповіщення', body: 'Сповіщення на телефон працюють.', href: '#/notifs', kind: 'test', at: Date.now() });
  const res = UrlFetchApp.fetchAll(mine.map(function (s) { return pushReq_(s.endpoint); }));
  const codes = res.map(function (r) { return r.getResponseCode(); });
  const gone = mine.filter(function (s, i) { return codes[i] === 404 || codes[i] === 410; }).map(function (s) { return [user.personId, s.endpoint]; });
  if (gone.length) dropSubs_(gone);
  return { ok: true, codes: codes };
}
function dropSubs_(pairs) {
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const m = subsAll_();
    pairs.forEach(function (x) { m[x[0]] = (m[x[0]] || []).filter(function (s) { return s.endpoint !== x[1]; }); if (!m[x[0]].length) delete m[x[0]]; });
    subsSave_(m);
  } finally { lock.releaseLock(); }
}
function shortName_(pib) { const a = String(pib || '').trim().split(/\s+/); return a.length >= 3 ? a[0] + ' ' + a[1][0] + '.' + a[2][0] + '.' : String(pib || ''); }

// ───────── VAPID: ключі (створює керівник у порталі) і підпис ES256 ─────────
function vapidPub_() { return props_().getProperty('VAPID_PUB') || ''; }
function setVapid_(user, req) {
  if (user.role !== 'керівник') return { ok: false, error: 'Ключі створює керівник' };
  const j = req.jwk || {};
  if (j.kty !== 'EC' || j.crv !== 'P-256' || !j.d || !j.x || !j.y) return { ok: false, error: 'Невірний ключ' };
  if (vapidPub_() && !req.replace) return { ok: false, error: 'Ключі вже створено', key: vapidPub_() };
  const pub = b64u_([4].concat(unb64u_(j.x), unb64u_(j.y)));
  props_().setProperties({ VAPID_D: j.d, VAPID_PUB: pub });
  if (req.replace) { props_().deleteProperty('SUBS'); } // старі підписки з іншим ключем недійсні
  return { ok: true, key: pub };
}
function pushReq_(endpoint) {
  const aud = endpoint.match(/^https:\/\/[^\/]+/)[0];
  return { url: endpoint, method: 'post', muteHttpExceptions: true, payload: '',
    headers: { TTL: '86400', Urgency: 'high', Authorization: 'vapid t=' + vapidJwt_(aud) + ', k=' + vapidPub_() } };
}
function vapidJwt_(aud) {
  const ck = 'JWT_' + sha_(aud), hit = cache_().get(ck);
  if (hit) return hit;
  const d = props_().getProperty('VAPID_D'); if (!d) throw new Error('Не створено ключі VAPID');
  const head = b64u_(bytesOf_('{"typ":"JWT","alg":"ES256"}'));
  const body = b64u_(bytesOf_(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 3600, sub: SUBJECT })));
  const input = head + '.' + body;
  const jwt = input + '.' + b64u_(es256Sign_(unb64u_(d), bytesOf_(input)));
  cache_().put(ck, jwt, 3000); // 50 хв (Apple: не більше 1 год)
  return jwt;
}

// ── допоміжне: байти, base64url
function bytesOf_(s) { return Utilities.newBlob(String(s)).getBytes().map(function (b) { return b & 255; }); }
function b64u_(bytes) { return Utilities.base64EncodeWebSafe(bytes.map(function (b) { return b > 127 ? b - 256 : b; })).replace(/=+$/, ''); }
function unb64u_(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Utilities.base64Decode(s).map(function (b) { return b & 255; }); }
function sha256b_(bytes) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes.map(function (b) { return b > 127 ? b - 256 : b; })).map(function (b) { return b & 255; }); }
function hmac_(key, msg) { return Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, msg.map(function (b) { return b > 127 ? b - 256 : b; }), key.map(function (b) { return b > 127 ? b - 256 : b; })).map(function (b) { return b & 255; }); }

// ── ECDSA P-256 (детермінований k за RFC 6979)
const EC_P = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
const EC_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const EC_A = EC_P - BigInt(3);
const EC_G = [BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'), BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')];
function mod_(a, m) { const r = a % m; return r < BigInt(0) ? r + m : r; }
function inv_(a, m) { let lm = BigInt(1), hm = BigInt(0), low = mod_(a, m), high = m; while (low > BigInt(1)) { const r = high / low; const nm = hm - lm * r, nw = high - low * r; hm = lm; high = low; lm = nm; low = nw; } return mod_(lm, m); }
// Якобієві координати
function jDouble_(P) {
  const X = P[0], Y = P[1], Z = P[2]; if (Y === BigInt(0)) return [BigInt(0), BigInt(1), BigInt(0)];
  const ysq = mod_(Y * Y, EC_P), S = mod_(BigInt(4) * X * ysq, EC_P), M = mod_(BigInt(3) * X * X + EC_A * Z * Z * Z * Z, EC_P);
  const nx = mod_(M * M - BigInt(2) * S, EC_P), ny = mod_(M * (S - nx) - BigInt(8) * ysq * ysq, EC_P), nz = mod_(BigInt(2) * Y * Z, EC_P);
  return [nx, ny, nz];
}
function jAdd_(P, Q) {
  if (P[2] === BigInt(0)) return Q; if (Q[2] === BigInt(0)) return P;
  const U1 = mod_(P[0] * Q[2] * Q[2], EC_P), U2 = mod_(Q[0] * P[2] * P[2], EC_P), S1 = mod_(P[1] * Q[2] * Q[2] * Q[2], EC_P), S2 = mod_(Q[1] * P[2] * P[2] * P[2], EC_P);
  if (U1 === U2) return S1 !== S2 ? [BigInt(0), BigInt(1), BigInt(0)] : jDouble_(P);
  const H = mod_(U2 - U1, EC_P), R = mod_(S2 - S1, EC_P), H2 = mod_(H * H, EC_P), H3 = mod_(H * H2, EC_P), U1H2 = mod_(U1 * H2, EC_P);
  const nx = mod_(R * R - H3 - BigInt(2) * U1H2, EC_P), ny = mod_(R * (U1H2 - nx) - S1 * H3, EC_P), nz = mod_(H * P[2] * Q[2], EC_P);
  return [nx, ny, nz];
}
function jMul_(k) {
  let R = [BigInt(0), BigInt(1), BigInt(0)], Q = [EC_G[0], EC_G[1], BigInt(1)];
  while (k > BigInt(0)) { if (k & BigInt(1)) R = jAdd_(R, Q); Q = jDouble_(Q); k >>= BigInt(1); }
  const zi = inv_(R[2], EC_P); return [mod_(R[0] * zi * zi, EC_P), mod_(R[1] * zi * zi * zi, EC_P)];
}
function big_(bytes) { let h = '0x'; bytes.forEach(function (b) { h += ('0' + b.toString(16)).slice(-2); }); return BigInt(h); }
function be32_(n) { let h = n.toString(16); while (h.length < 64) h = '0' + h; const out = []; for (let i = 0; i < 64; i += 2) out.push(parseInt(h.substr(i, 2), 16)); return out; }
function es256Sign_(dBytes, msg) {
  const d = big_(dBytes), h = sha256b_(msg), z = mod_(big_(h), EC_N);
  // RFC 6979
  const x = be32_(d), hb = be32_(z);
  let V = [], K = []; for (let i = 0; i < 32; i++) { V.push(1); K.push(0); }
  K = hmac_(K, V.concat([0], x, hb)); V = hmac_(K, V);
  K = hmac_(K, V.concat([1], x, hb)); V = hmac_(K, V);
  for (;;) {
    V = hmac_(K, V);
    const k = big_(V);
    if (k > BigInt(0) && k < EC_N) {
      const r = mod_(jMul_(k)[0], EC_N);
      if (r !== BigInt(0)) {
        let s = mod_(inv_(k, EC_N) * (z + r * d), EC_N);
        if (s !== BigInt(0)) { if (s > EC_N / BigInt(2)) s = EC_N - s; return be32_(r).concat(be32_(s)); }
      }
    }
    K = hmac_(K, V.concat([0])); V = hmac_(K, V);
  }
}
/** Перевірка з редактора: виберіть «selfTest» → «Виконати» (у журналі має бути «підпис OK»). */
function selfTest() {
  const t0 = Date.now(); const sig = es256Sign_(be32_(BigInt(12345)), bytesOf_('test'));
  Logger.log('Підпис ES256 (' + sig.length + ' байт) за ' + (Date.now() - t0) + ' мс; ключі VAPID: ' + (vapidPub_() ? 'є' : 'ще не створено') + '; підписок: ' + Object.keys(subsAll_()).length);
}
