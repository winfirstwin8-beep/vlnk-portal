/* Портал ВЛНК — обʼєкти, персонал, сертифікати, обладнання, комплектація, документи ОП, паливо, новини */
'use strict';

// ═════════ ОБʼЄКТИ ═════════
/** Наказ до завдання: завантажити на телефон, надіслати собі на пошту, поділитися; керівнику — ще завантажити/замінити. */
/** Виїзди бригади на обʼєкти в межах одного місяця оформлюються одним наказом: усі завдання бригади за місяць. */
const taskMonth = x => x.month || ym(x.dateFrom);
function tripTasks(t) {
  return all('Завдання').filter(x => String(x.brigade) === String(t.brigade) && taskMonth(x) === taskMonth(t))
    .sort((a, b) => String(a.dateFrom).localeCompare(String(b.dateFrom)));
}
/** № наказу виїзду: з будь-якого завдання бригади за місяць. */
function tripOrderNo(t) { const x = tripTasks(t).find(y => String(y.orderNo || '').trim()); return x ? String(x.orderNo).trim() : ''; }
/** Завдання, до якого фактично прикріплено файл наказу цього виїзду. */
function orderTask(t) { return t.orderFile || DB.upTasks.has(t.id) ? t : tripTasks(t).find(x => x.orderFile || DB.upTasks.has(x.id)) || t; }
function orderBlock(t0, compact) {
  const t = orderTask(t0);
  const pend = DB.upTasks.has(t.id);
  const has = !!t.orderFile;
  let h = '';
  if (has) {
    const saved = String(t.orderFile).startsWith('data:') || DB.cachedFiles.has(t.orderFileId);
    h += `<span class="small ordername">📄 ${esc(t.orderFileName || 'Наказ')}${saved ? ' <span class="ok" title="Збережено на телефоні">✓ офлайн</span>' : ''}</span>`;
    if (!isVisitor()) {
      h += `<button type="button" class="btn small primary" data-act="orderdl" data-id="${esc(t.id)}">⬇ Завантажити</button>`;
      h += DB.mailQ.has(t.id) ? badge('✉ лист у черзі', 'warn') : `<button type="button" class="btn small ghost" data-act="ordermail" data-id="${esc(t.id)}">✉ На пошту</button>`;
      if (navigator.canShare) h += `<button type="button" class="btn small ghost" data-act="ordershare" data-id="${esc(t.id)}">↗ Поділитися</button>`;
    }
  }
  if (pend) h += badge('⏳ наказ очікує відправки', 'warn');
  if (isLead() && !compact) h += `<label class="btn small ${has || pend ? 'ghost' : 'primary'} upl">${has ? 'Замінити наказ' : '⬆ Завантажити наказ'}<input type="file" accept="application/pdf,image/*,.doc,.docx" data-upload="${esc(t.id)}"></label>`;
  if (!compact) { const tr = tripTasks(t0); if (tr.length > 1) h += `<span class="small mute">один наказ на місяць для всіх обʼєктів бригади: ${[...new Set(tr.map(x => objShort(x.objectId)))].map(esc).join(', ')}</span>`; }
  else if (!has && !pend && !compact) h += '<span class="small mute">наказ ще не завантажено</span>';
  return h ? `<div class="row gap order">${h}</div>` : '';
}
/** Наказ на відрядження одразу під назвою бригади: номер + завантажити / на пошту. */
function orderInfo(t) {
  return `<div class="orderinfo"><span class="small"><b>Наказ на відрядження${tripOrderNo(t) ? ' № ' + esc(tripOrderNo(t)) : ''}</b></span>${orderBlock(t)}</div>`;
}
// ───────── протоколи НК на картці обʼєкта: бачать керівник, працівник і відвідувач ─────────
const PROTO_METHODS = [...METHODS, 'ДДК'];
/** Рядок протоколу (картка обʼєкта і реєстр). withObj — показати назву обʼєкта. */
function protoItem(p, withObj) {
    const pend = DB.upTasks.has(p.id);
    const canDel = isLead() || (!isVisitor() && p.authorId && p.authorId === ME.personId);
    const has = !!(p.file || p.fileId) || pend;
    return `<div class="item"><div class="row between"><b>Протокол${p.number ? ' № ' + esc(p.number) : ''}${withObj ? ` · <a href="#/object/${esc(p.objectId)}">${esc(objShort(p.objectId))}</a>` : ''}</b>${badge(esc(p.method || 'НК'), 'pri')}</div>
      <span class="small mute">${uaDate(p.date)}${p.brigade ? ' · ' + brName(p.brigade) : ''}${p.enteredBy ? ' · вніс: ' + esc(p.enteredBy) : p.authorId ? ' · ' + esc(shortName(personName(p.authorId))) : ''}${p.note ? ' · ' + esc(p.note) : ''}</span>
      ${p.fileName ? `<span class="small ordername">📄 ${esc(p.fileName)}${String(p.file || '').startsWith('data:') || DB.cachedFiles.has(p.fileId) || DB.cachedFiles.has('local-' + p.id) ? ' <span class="ok">✓ офлайн</span>' : ''}</span>` : ''}
      <div class="row gap order">${has ? `<button type="button" class="btn small primary" data-act="protodl" data-id="${esc(p.id)}">⬇ Завантажити</button>${DB.mailQ.has(p.id) ? badge('✉ лист у черзі', 'warn') : `<button type="button" class="btn small ghost" data-act="protomail" data-id="${esc(p.id)}">✉ На пошту</button>`}${navigator.canShare ? `<button type="button" class="btn small ghost" data-act="protoshare" data-id="${esc(p.id)}">↗ Поділитися</button>` : ''}` : '<span class="small mute">файл не додано</span>'}
      ${has && !pend && !isVisitor() ? `<label class="btn small ghost upl">⬆ Оновлена версія<input type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" data-protoupd="${esc(p.id)}"></label>` : ''}
      ${pend ? badge('⏳ відправляється', 'warn') : ''}${canDel ? `<button type="button" class="btn small ghost" data-act="del" data-t="Протоколи" data-id="${esc(p.id)}" data-back="${esc(location.hash)}">Видалити</button>` : ''}</div>${protoVersions(p)}</div>`;
}
/** Попередні версії протоколу (після завантаження оновленої). */
function protoVersions(p) {
  const vs = arr(p.versions);
  if (!vs.length) return '';
  const cur = vs.length + 1;
  return `<div class="protovers small"><span>${badge('версія ' + cur, 'ok')} ${p.verBy ? 'оновив ' + esc(p.verBy) : ''}${p.verAt ? ' · ' + esc(fmtDT(p.verAt)) : ''}</span>
    <span class="mute">Попередні версії:</span>${vs.slice().reverse().map(x => `<span class="pv">v${esc(x.v)} · ${esc(x.fileName || 'файл')}${x.by ? ' · ' + esc(x.by) : ''} <button type="button" class="btn small ghost" data-act="protovdl" data-id="${esc(p.id)}" data-v="${esc(x.v)}">⬇</button></span>`).join('')}</div>`;
}
ACTS.protovdl = async d => {
  const p = get('Протоколи', d.id); if (!p) return;
  const x = arr(p.versions).find(v => String(v.v) === String(d.v)); if (!x) return toast('Версію не знайдено');
  try {
    let f;
    if (String(x.file || '').startsWith('data:')) { const [head, data] = x.file.split(','); f = { name: x.fileName, mime: head.slice(5).replace(';base64', ''), data }; }
    else {
      const hit = x.fileId ? await IDB.get('files', x.fileId) : null;
      if (hit) f = hit;
      else {
        if (!navigator.onLine) return toast('Немає інтернету');
        toast('Готую файл…');
        const res = await api({ action: 'getfile', table: 'Протоколи', id: p.id, ver: x.v }, 120000);
        if (!res.ok) return toast(res.error);
        f = { name: res.name, mime: res.mime, data: res.data };
        await IDB.putMany('files', [[res.fileId, f]]); DB.cachedFiles.add(res.fileId);
      }
    }
    const r = await saveFile(f.name || 'Протокол', fileToBlob(f));
    toast(r === 'declined' ? 'Збереження скасовано' : 'Завантажено: ' + (f.name || ''));
  } catch (e) { toast(e.message); }
};
function protoSection(oid, taskId) {
  const all_ = protoRows().filter(p => p.objectId === oid)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number), 'uk', { numeric: true }));
  const f = UI.pmeth && all_.some(p => p.method === UI.pmeth) ? UI.pmeth : 'all';
  const list = f === 'all' ? all_ : all_.filter(p => p.method === f);
  const used = PROTO_METHODS.filter(m => all_.some(p => p.method === m));
  let h = used.length > 1 ? seg('pmeth', [['all', 'Усі ' + all_.length], ...used.map(m => [m, m + ' ' + all_.filter(p => p.method === m).length])], f).replace('class="seg"', 'class="seg wrap"') : '';
  h += list.length ? list.slice(0, UI.plimit || 20).map(p => protoItem(p)).join('') + (list.length > (UI.plimit || 20) ? `<button class="btn ghost wide" data-act="pmore">Показати ще</button>` : '') : empty('Протоколів ще немає');
  if (!isVisitor()) {
    const o = get('Обʼєкти', oid) || {};
    const t = taskId ? get('Завдання', taskId) : null;
    const ms = [...new Set([...methodsOf(t ? t.methods : o.methods), ...PROTO_METHODS])];
    h += `<details class="addproto"${UI.protoOpen ? ' open' : ''}><summary class="btn primary">⬆ Додати протокол</summary>
      <form class="form" data-form="proto" data-id="${esc(oid)}" data-task="${esc(taskId || '')}" novalidate>
        <div class="grid2">${fSel('Метод контролю', 'method', ms, UI.pmeth && UI.pmeth !== 'all' ? UI.pmeth : ms[0], { req: true })}${fInp('№ протоколу', 'number', '', { req: true })}</div>
        <div class="grid2">${fInp('Дата', 'date', today(), { type: 'date', req: true })}${fSel('Бригада', 'brigade', BRIGADES.map(n => [n, brName(n)]), t ? t.brigade : ((myBrigade(today()) || {}).num || ''), { none: '—' })}</div>
        <label class="f"><span>Файл протоколу *</span><input type="file" name="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"${SCAN.pages.length ? ' disabled' : ''}><small>${SCAN.pages.length ? '<b>Вибрано скан камерою — файл не потрібен.</b> ' : 'Або відскануйте паперовий протокол камерою телефону — нижче. '}PDF, фото, Word або Excel до 15 МБ; фото стискається автоматично</small></label>
        ${fInp('Примітка', 'note', '', { ph: 'напр. стики № 12–24, Ø 530' })}
        <div class="form-actions"><button type="submit" class="btn primary">Зберегти протокол</button></div></form></details>`;
  }
  return card('Протоколи НК' + (all_.length ? ' · ' + all_.length : ''), h);
}
FORMS.proto = async (d, oid, f) => {
  if (d.objectId) { oid = d.objectId; delete d.objectId; }
  if (!oid) return toast('Оберіть обʼєкт');
  let file = f.querySelector('input[name=file]').files[0];
  if (!need(d, [['method', 'метод'], ['number', '№ протоколу'], ['date', 'дата']])) return;
  if (!file && SCAN.pages.length) { toast('Формую PDF…'); file = await scanPdfFile(`Протокол ${d.number || ''} ${d.method || ''}`.trim()); }
  if (!file) return toast('Оберіть файл протоколу або відскануйте його камерою');
  const dup = protoRows().find(p => p.objectId === oid && p.method === d.method && String(p.number).trim() === String(d.number).trim());
  if (dup && !await ask(`Протокол ${d.method} № ${d.number} на цьому обʼєкті вже є. Додати ще один?`)) return;
  delete d.file;
  const by = ME.personId && get('Персонал', ME.personId) ? meShort() : String(d.enteredBy || '').trim();
  if (f.querySelector('[name=enteredBy]') && !by) return toast('Вкажіть прізвище працівника, який вносить дані');
  const row = await save('Протоколи', { ...d, enteredBy: by || meShort(), objectId: oid, taskId: f.dataset.task || UI.regTask || '', authorId: ME.personId || '' });
  try {
    const r = await queueProto(row.id, file);
    toast(r === 'saved' ? 'Протокол збережено' : navigator.onLine ? 'Протокол відправляється…' : 'Протокол збережено на телефоні — відправиться, коли зʼявиться інтернет');
  } catch (e) { toast('Файл не додано: ' + e.message); }
  delete UI.draft['proto:' + (f.dataset.id || 'new')];
  scanReset();
  UI.dirty = false; UI.protoOpen = false; UI.regObj = oid; UI.regMeth = ''; render();
};
// ───────── скан протоколу камерою телефону → PDF (без сторонніх бібліотек) ─────────
const SCAN = { pages: [], mode: 'doc', busy: false };
function scanBox() {
  const n = SCAN.pages.length;
  return `<div class="scanbox" id="scanbox">
    <div class="row between"><b class="small">📷 Скан камерою → PDF</b>${n ? `<span class="small mute">${n} ${plural(n, 'сторінка', 'сторінки', 'сторінок')}</span>` : ''}</div>
    ${n ? `<div class="scanpages">${SCAN.pages.map((pg, i) => `<div class="scanpg"><img src="${pg.thumb}" alt="сторінка ${i + 1}" data-act="scanview" data-i="${i}"><span class="scanno">${i + 1}</span>
      <div class="scanops"><button type="button" class="btn small ghost" data-act="scancrop" data-i="${i}" title="Обрізати">✂</button><button type="button" class="btn small ghost" data-act="scanrot" data-i="${i}" title="Повернути на 90°">↻</button>${i ? `<button type="button" class="btn small ghost" data-act="scanup" data-i="${i}" title="Перемістити вліво">←</button>` : ''}<button type="button" class="btn small ghost" data-act="scandel" data-i="${i}" title="Видалити сторінку">✕</button></div></div>`).join('')}</div>` : '<p class="small mute">Покладіть протокол на рівну темну поверхню, сфотографуйте кожну сторінку при доброму освітленні. Межі аркуша визначаються автоматично; кнопка ✂ — обрізати вручну (перетягнути кути). Сторінки обʼєднаються в один PDF.</p>'}
    <div class="row gap wrap">
      <label class="btn small primary">📷 ${n ? 'Додати сторінку' : 'Сканувати камерою'}<input type="file" accept="image/*" capture="environment" data-scan hidden></label>
      <label class="btn small ghost">🖼 З галереї<input type="file" accept="image/*" multiple data-scan hidden></label>
      ${n ? `<button type="button" class="btn small ghost" data-act="scanpdf">👁 Переглянути PDF</button><button type="button" class="btn small ghost" data-act="scanclear">Очистити</button>` : ''}
    </div>
    <div class="seg scanmode">${[['doc', 'Документ (ч/б, чіткий)'], ['color', 'Кольоровий']].map(([v, l]) => `<button type="button" data-act="scanmode" data-v="${v}" class="${SCAN.mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${SCAN.busy ? '<p class="small">⏳ Обробка фото…</p>' : ''}
  </div>`;
}
function scanRefresh() { const b = $('#scanbox'); if (b) { b.outerHTML = scanBox(); } const fi = $('form[data-form=proto] input[name=file]'); if (fi) { fi.disabled = !!SCAN.pages.length; if (SCAN.pages.length) fi.value = ''; } }
function scanReset() { SCAN.pages = []; SCAN.busy = false; }
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Не вдалося відкрити фото')); i.src = src; });
/** Фото сторінки → обробка (поворот, режим «документ»: відтінки сірого + розтягування рівнів), JPEG ≤ 2000 px. */
/** Фото, повернуте на pg.rot і зменшене до ≤ max px (canvas). */
async function scanRotated(pg, max = 2000) {
  const img = await loadImg(pg.src);
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w0 = Math.round(img.naturalWidth * k), h0 = Math.round(img.naturalHeight * k);
  const rot = ((pg.rot || 0) % 360 + 360) % 360, sw = rot % 180 ? h0 : w0, sh = rot % 180 ? w0 : h0;
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, sw, sh);
  x.translate(sw / 2, sh / 2); x.rotate(rot * Math.PI / 180); x.drawImage(img, -w0 / 2, -h0 / 2, w0, h0); x.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}
/** Перспективне вирівнювання: чотирикутник quad (TL, TR, BR, BL; частки 0..1) → прямокутник. */
function scanWarp(src, quad) {
  const W0 = src.width, H0 = src.height, q = quad.map(([u, v]) => [u * W0, v * H0]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = Math.round(Math.max(dist(q[0], q[1]), dist(q[3], q[2]))), H = Math.round(Math.max(dist(q[0], q[3]), dist(q[1], q[2])));
  const kk = Math.min(1, 2000 / Math.max(W, H)); W = Math.max(8, Math.round(W * kk)); H = Math.max(8, Math.round(H * kk));
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g = 0, h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9 || Math.abs(den) < 1e-9) { a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; }
  else { g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0; }
  const sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W0, H0).data;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ox = out.getContext('2d', { willReadFrequently: true }), od = ox.createImageData(W, H), o = od.data;
  for (let j = 0; j < H; j++) {
    const v = (j + 0.5) / H;
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W, z = g * u + h * v + 1;
      let sx = (a * u + b * v + c) / z - 0.5, sy = (d * u + e * v + f) / z - 0.5;
      if (sx < 0) sx = 0; if (sy < 0) sy = 0; if (sx > W0 - 1.001) sx = W0 - 1.001; if (sy > H0 - 1.001) sy = H0 - 1.001;
      const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, p0 = (iy * W0 + ix) * 4, p1 = p0 + W0 * 4, t = (j * W + i) * 4;
      for (let k = 0; k < 3; k++) o[t + k] = (sd[p0 + k] * (1 - fx) + sd[p0 + 4 + k] * fx) * (1 - fy) + (sd[p1 + k] * (1 - fx) + sd[p1 + 4 + k] * fx) * fy;
      o[t + 3] = 255;
    }
  }
  ox.putImageData(od, 0, 0);
  return out;
}
/** Автопошук меж аркуша: світла область (поріг Оцу), найбільша звʼязна, кути — крайні точки за x±y. null — якщо не знайдено. */
function scanDetect(src) {
  const k = 320 / Math.max(src.width, src.height), w = Math.max(8, Math.round(src.width * k)), h = Math.max(8, Math.round(src.height * k));
  const t = document.createElement('canvas'); t.width = w; t.height = h; const tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(src, 0, 0, w, h);
  const d = tx.getImageData(0, 0, w, h).data, n = w * h, G = new Uint8Array(n), hist = new Float64Array(256);
  for (let i = 0, j = 0; j < n; i += 4, j++) { G[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; hist[G[j]]++; }
  let sum = 0; for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sB = 0, wB = 0, best = 0, thr = 128;
  for (let v = 0; v < 256; v++) { wB += hist[v]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += v * hist[v]; const mB = sB / wB, mF = (sum - sB) / wF, bt = wB * wF * (mB - mF) * (mB - mF); if (bt > best) { best = bt; thr = v; } }
  const lab = new Int32Array(n).fill(-1); let bestC = -1, bestN = 0; const stack = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (G[s0] <= thr || lab[s0] >= 0) continue;
    let cnt = 0; stack.push(s0); lab[s0] = s0;
    while (stack.length) { const p = stack.pop(); cnt++; const px = p % w, py = (p / w) | 0;
      for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]) if (q >= 0 && lab[q] < 0 && G[q] > thr) { lab[q] = s0; stack.push(q); } }
    if (cnt > bestN) { bestN = cnt; bestC = s0; }
  }
  if (bestN < n * 0.15 || bestN > n * 0.97) return null;
  let tl = [0, 0, 1e9], tr = [0, 0, -1e9], br = [0, 0, -1e9], bl = [0, 0, 1e9];
  for (let p = 0; p < n; p++) { if (lab[p] !== bestC) continue; const x = p % w, y = (p / w) | 0;
    if (x + y < tl[2]) tl = [x, y, x + y]; if (x + y > br[2]) br = [x, y, x + y]; if (x - y > tr[2]) tr = [x, y, x - y]; if (x - y < bl[2]) bl = [x, y, x - y]; }
  return [tl, tr, br, bl].map(([x, y]) => [Math.min(1, Math.max(0, (x + 0.5) / w)), Math.min(1, Math.max(0, (y + 0.5) / h))]);
}
async function scanProcess(pg) {
  let c = await scanRotated(pg);
  if (pg.quad) c = scanWarp(c, pg.quad);
  const sw = c.width, sh = c.height, x = c.getContext('2d', { willReadFrequently: true });
  if (SCAN.mode === 'doc') {
    const id = x.getImageData(0, 0, sw, sh), d = id.data, n = sw * sh, G = new Uint8Array(n);
    for (let i = 0, j = 0; j < n; i += 4, j++) G[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    // фон (освітлення) — максимум у блоках 24×24, згладжений; ділення на фон вирівнює тіні й світлові плями
    const B = 24, bw = Math.ceil(sw / B), bh = Math.ceil(sh / B); let bg = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let m = 0; const y1 = Math.min(sh, (by + 1) * B), x1 = Math.min(sw, (bx + 1) * B);
      for (let yy = by * B; yy < y1; yy += 2) for (let xx = bx * B, o = yy * sw + xx; xx < x1; xx += 2, o += 2) if (G[o] > m) m = G[o];
      bg[by * bw + bx] = m;
    }
    for (let pass = 0; pass < 3; pass++) {
      const t = new Float32Array(bw * bh);
      for (let y = 0; y < bh; y++) for (let xx = 0; xx < bw; xx++) {
        let sum = 0, c2 = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, x2 = xx + dx; if (yy >= 0 && yy < bh && x2 >= 0 && x2 < bw) { sum += bg[yy * bw + x2]; c2++; } }
        t[y * bw + xx] = sum / c2;
      }
      bg = t;
    }
    const hist = new Uint32Array(256), N = new Uint8Array(n);
    for (let y = 0; y < sh; y++) {
      const fy = Math.min(bh - 1, Math.max(0, y / B - 0.5)), y0 = fy | 0, y2 = Math.min(bh - 1, y0 + 1), ty = fy - y0;
      for (let xx = 0; xx < sw; xx++) {
        const fx = Math.min(bw - 1, Math.max(0, xx / B - 0.5)), x0 = fx | 0, x2 = Math.min(bw - 1, x0 + 1), tx = fx - x0;
        const b0 = bg[y0 * bw + x0] * (1 - tx) + bg[y0 * bw + x2] * tx, b1 = bg[y2 * bw + x0] * (1 - tx) + bg[y2 * bw + x2] * tx;
        const v = Math.min(255, G[y * sw + xx] * 255 / Math.max(24, b0 * (1 - ty) + b1 * ty)) | 0;
        N[y * sw + xx] = v; hist[v]++;
      }
    }
    const pct = q => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * q) return v; } return 255; };
    const lo = Math.min(pct(0.01), 200), hi = Math.max(lo + 30, Math.min(250, pct(0.6)));
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) { const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); lut[v] = 255 * Math.pow(t, 1.6); }
    for (let i = 0, j = 0; j < n; i += 4, j++) { const g = lut[N[j]]; d[i] = d[i + 1] = d[i + 2] = g; }
    x.putImageData(id, 0, 0);
  }
  pg.jpeg = c.toDataURL('image/jpeg', SCAN.mode === 'doc' ? 0.72 : 0.8); pg.w = sw; pg.h = sh;
  const t = document.createElement('canvas'), tk = 160 / Math.max(sw, sh); t.width = Math.round(sw * tk); t.height = Math.round(sh * tk);
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); pg.thumb = t.toDataURL('image/jpeg', 0.7);
}
async function scanAdd(files) {
  SCAN.busy = true; scanRefresh();
  try {
    for (const f of files) {
      if (!/^image\//.test(f.type) && !/\.(jpe?g|png|heic|heif|webp)$/i.test(f.name)) continue;
      const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const pg = { src, rot: 0 };
      try { pg.quad = scanDetect(await scanRotated(pg, 800)); } catch (e) { pg.quad = null; }
      await scanProcess(pg); SCAN.pages.push(pg);
    }
  } catch (e) { toast(e.message || 'Помилка обробки фото'); }
  SCAN.busy = false; UI.dirty = true; scanRefresh();
}
document.addEventListener('change', e => { const el = e.target; if (el.matches && el.matches('input[data-scan]') && el.files && el.files.length) { e.stopImmediatePropagation(); const fs = [...el.files]; el.value = ''; scanAdd(fs); } }, true);
ACTS.scanrot = async d => { const pg = SCAN.pages[+d.i]; if (!pg) return; pg.rot = (pg.rot || 0) + 90; if (pg.quad) { const r = pg.quad.map(([u, v]) => [1 - v, u]); pg.quad = [r[3], r[0], r[1], r[2]]; } await scanProcess(pg); scanRefresh(); };
/** Редактор обрізання: 4 кути, що перетягуються; «Авто» — пошук меж аркуша; «Весь кадр» — без обрізання. */
ACTS.scancrop = async d => {
  const pg = SCAN.pages[+d.i]; if (!pg) return;
  const src = await scanRotated(pg, 1400);
  let quad = (pg.quad || [[0, 0], [1, 0], [1, 1], [0, 1]]).map(p => p.slice());
  const ov = document.createElement('div'); ov.className = 'cropov';
  ov.innerHTML = `<div class="crophead"><b>✂ Обрізання · сторінка ${+d.i + 1}</b><span class="small">Перетягніть кути до країв аркуша</span></div>
    <div class="cropwrap"><canvas></canvas>${[0, 1, 2, 3].map(i => `<span class="croph" data-h="${i}"></span>`).join('')}</div>
    <div class="cropbtns"><button type="button" class="btn small ghost" data-c="auto">🔍 Авто</button><button type="button" class="btn small ghost" data-c="full">Весь кадр</button><button type="button" class="btn small ghost" data-c="cancel">Скасувати</button><button type="button" class="btn small primary" data-c="ok">✓ Застосувати</button></div>`;
  document.body.appendChild(ov);
  const cv = ov.querySelector('canvas'), wrap = ov.querySelector('.cropwrap'), hs = [...ov.querySelectorAll('.croph')];
  const maxW = Math.min(window.innerWidth - 24, 900), maxH = window.innerHeight - 150, k = Math.min(maxW / src.width, maxH / src.height);
  const W = Math.round(src.width * k), H = Math.round(src.height * k);
  cv.width = W; cv.height = H; wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
  const cx = cv.getContext('2d');
  const draw = () => {
    cx.clearRect(0, 0, W, H); cx.drawImage(src, 0, 0, W, H);
    cx.beginPath(); cx.rect(0, 0, W, H); cx.moveTo(quad[0][0] * W, quad[0][1] * H); for (let i = 3; i >= 1; i--) cx.lineTo(quad[i][0] * W, quad[i][1] * H); cx.closePath();
    cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fill('evenodd');
    cx.beginPath(); quad.forEach(([u, v], i) => i ? cx.lineTo(u * W, v * H) : cx.moveTo(u * W, v * H)); cx.closePath(); cx.lineWidth = 2; cx.strokeStyle = '#3b9cff'; cx.stroke();
    hs.forEach((el, i) => { el.style.left = quad[i][0] * W + 'px'; el.style.top = quad[i][1] * H + 'px'; });
  };
  hs.forEach(el => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId); const i = +el.dataset.h;
      const move = ev => { const r = cv.getBoundingClientRect(); quad[i] = [Math.min(1, Math.max(0, (ev.clientX - r.left) / W)), Math.min(1, Math.max(0, (ev.clientY - r.top) / H))]; draw(); };
      const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  });
  ov.addEventListener('click', async e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const c = b.dataset.c;
    if (c === 'auto') { const q = scanDetect(src); if (q) { quad = q; draw(); } else toast('Межі аркуша не знайдено — виставте кути вручну'); return; }
    if (c === 'full') { quad = [[0, 0], [1, 0], [1, 1], [0, 1]]; draw(); return; }
    if (c === 'ok') {
      const full = quad.every(([u, v], i) => Math.abs(u - [0, 1, 1, 0][i]) < 0.005 && Math.abs(v - [0, 0, 1, 1][i]) < 0.005);
      pg.quad = full ? null : quad; ov.remove(); SCAN.busy = true; scanRefresh(); await scanProcess(pg); SCAN.busy = false; scanRefresh(); return;
    }
    ov.remove();
  });
  draw();
};
ACTS.scandel = d => { SCAN.pages.splice(+d.i, 1); scanRefresh(); };
ACTS.scanup = d => { const i = +d.i; if (i > 0) { [SCAN.pages[i - 1], SCAN.pages[i]] = [SCAN.pages[i], SCAN.pages[i - 1]]; } scanRefresh(); };
ACTS.scanclear = async () => { if (!await ask('Видалити всі відскановані сторінки?', 'Видалити')) return; scanReset(); scanRefresh(); };
ACTS.scanmode = async d => { if (SCAN.mode === d.v) return; SCAN.mode = d.v; SCAN.busy = true; scanRefresh(); for (const pg of SCAN.pages) await scanProcess(pg); SCAN.busy = false; scanRefresh(); };
ACTS.scanview = d => { const pg = SCAN.pages[+d.i]; if (!pg) return; const ov = document.createElement('div'); ov.className = 'phov'; ov.innerHTML = `<img src="${pg.jpeg}" alt="сторінка"><p>Сторінка ${+d.i + 1} з ${SCAN.pages.length}</p><button type="button" class="btn">Закрити</button>`; ov.onclick = () => ov.remove(); document.body.appendChild(ov); };
ACTS.scanpdf = async () => {
  const f = await scanPdfFile('Скан протоколу');
  const url = URL.createObjectURL(f); const w = window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 120000);
  if (!w) await saveFile(f.name, f);
};
/** Сторінки скану → PDF-файл (кожна сторінка — JPEG на аркуші A4 відповідної орієнтації). */
async function scanPdfFile(name) {
  const pages = SCAN.pages.map(pg => { const b = atob(pg.jpeg.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return { jpeg: u, w: pg.w, h: pg.h }; });
  const blob = makePdf(pages);
  return new File([blob], String(name || 'Скан').replace(/[\\/:*?"<>|]/g, '_') + '.pdf', { type: 'application/pdf' });
}
function makePdf(pages) {
  const enc = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
  const parts = [], offs = []; let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc(x) : x; parts.push(b); len += b.length; };
  const obj = (n, ...body) => { offs[n] = len; push(n + ' 0 obj\n'); body.forEach(push); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const N = 2 + pages.length * 3;
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ')}] >>`);
  pages.forEach((p, i) => {
    const land = p.w > p.h, PW = land ? 842 : 595, PH = land ? 595 : 842;
    const k = Math.min(PW / p.w, PH / p.h), dw = +(p.w * k).toFixed(2), dh = +(p.h * k).toFixed(2), dx = +((PW - dw) / 2).toFixed(2), dy = +((PH - dh) / 2).toFixed(2);
    const n = 3 + i * 3, cs = `q ${dw} 0 0 ${dh} ${dx} ${dy} cm /Im0 Do Q`;
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    obj(n + 1, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    obj(n + 2, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream');
  });
  const xref = len;
  push(`xref\n0 ${N + 1}\n0000000000 65535 f \n` + Array.from({ length: N }, (_, i) => String(offs[i + 1]).padStart(10, '0') + ' 00000 n \n').join(''));
  push(`trailer\n<< /Size ${N + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
/** Наступний № протоколу для обʼєкта й методу (підказка; можна змінити). */
function nextProtoNo(oid, method) {
  const ns = protoRows().filter(p => p.objectId === oid && (!method || p.method === method)).map(p => parseInt((String(p.number).match(/\d+/) || ['0'])[0], 10)).filter(n => n > 0);
  return ns.length ? String(Math.max(...ns) + 1) : '1';
}
/** Реєстрація протоколів НК по обʼєктах: форма + реєстр. Файл зберігається на Диску в папці «Протоколи НК / <коротка назва обʼєкта>». */
/** Бригада, що зараз виконує роботи на обʼєкті (завдання в роботі), інакше — з останнього завдання. */
function objWorkBrigade(oid) {
  const ts = all('Завдання').filter(t => t.objectId === oid);
  const w = ts.find(isTaskInWork) || ts.sort((a, b) => String(b.dateFrom).localeCompare(String(a.dateFrom)))[0];
  return w ? String(w.brigade) : '';
}
ROUTES.protocols = tid => {
  const vis = isVisitor();
  const t = tid ? get('Завдання', tid) : null;
  // прийшли з картки обʼєкта на сторінці «Завдання»: обʼєкт і бригада — з завдання, метод — вручну
  if (t && UI.regTask !== tid) { UI.regTask = tid; UI.regObj = t.objectId; UI.regMeth = ''; delete UI.draft['proto:new']; }
  if (!t && UI.regTask) { UI.regTask = ''; }
  const m = UI.regMonth || '';
  const fo = UI.regObjF || '';
  let h = '';
  if (!vis) {
    // лише обʼєкти зі статусом «в роботі» (є завдання, що виконується зараз) + обʼєкт завдання, з якого перейшли
    const cur = new Set(all('Завдання').filter(isTaskInWork).map(x => x.objectId));
    if (t) cur.add(t.objectId);
    const opts = objOpts().filter(o => cur.has(o[0]));
    const oid = UI.regObj && cur.has(UI.regObj) ? UI.regObj : '';
    const meth = UI.regMeth || '';
    const dr = UI.draft['proto:new'] || {};
    const brig = dr.brigade !== undefined ? dr.brigade : t && t.objectId === oid ? String(t.brigade) : oid ? objWorkBrigade(oid) : ((myBrigade(today()) || {}).num || '');
    const own = ME.personId && get('Персонал', ME.personId);
    const by = own ? meShort() : (dr.enteredBy || '');
    const no = dr.number !== undefined && dr.number !== '' ? dr.number : oid && meth ? nextProtoNo(oid, meth) : '';
    h += card('Зареєструвати протокол', `<form class="form" data-form="proto" data-id="" novalidate>
      ${fSel('Обʼєкт', 'objectId', opts, oid, { req: true, none: opts.length ? '— оберіть обʼєкт у роботі —' : '— немає обʼєктів у роботі —', re: true, hint: t ? 'обʼєкт завдання бригади' : 'показано лише обʼєкти зі статусом «в роботі»; для інших — картка обʼєкта → «Протоколи НК»' })}
      <div class="grid2">${fSel('Метод контролю', 'method', PROTO_METHODS, meth, { req: true, re: true, none: '— оберіть метод —' })}${fInp('№ протоколу', 'number', no, { req: true })}</div>
      <div class="grid2">${fInp('Дата видачі', 'date', dr.date || today(), { type: 'date', req: true })}${fSel('Бригада', 'brigade', BRIGADES.map(n => [n, brName(n)]), brig, { none: '—', hint: oid ? 'бригада, що виконує роботи на обʼєкті' : '' })}</div>
      ${fInp('Дані вносить (прізвище працівника)', 'enteredBy', by, own ? { ro: true, hint: 'за вашим входом у портал' } : { req: true, ph: 'Прізвище І.Б.' })}
      <label class="f"><span>Файл протоколу *</span><input type="file" name="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"><small>Зберігається на Google Диску в папці «Протоколи НК / ${oid ? esc(objShort(oid)) : 'коротка назва обʼєкта'}» — папка створюється автоматично. Оновлену версію можна додати пізніше кнопкою «⬆ Оновлена версія» в реєстрі — обидві версії зберігаються в цій папці.</small></label>
      ${scanBox()}
      ${fInp('Примітка', 'note', dr.note || '', { ph: 'напр. стики № 12–24, Ø 530' })}
      <div class="form-actions"><button type="submit" class="btn primary">Зареєструвати</button></div></form>`);
  }
  let list = protoRows().slice();
  if (fo) list = list.filter(p => p.objectId === fo);
  if (m) list = list.filter(p => String(p.date).slice(0, 7) === m);
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number), 'uk', { numeric: true }));
  const months = [...new Set(protoRows().map(p => String(p.date).slice(0, 7)).filter(Boolean))].sort().reverse();
  const objs = [...new Set(protoRows().map(p => p.objectId))].map(id => [id, objShort(id)]).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'uk'));
  h += `<div class="filters">${fSel('Обʼєкт', 'rf', objs, fo, { none: 'Усі обʼєкти' }).replace('name="rf"', 'data-set="regObjF"')}${fSel('Місяць', 'rm', months.map(x => [x, monthName(x)]), m, { none: 'Усі місяці' }).replace('name="rm"', 'data-set="regMonth"')}</div>`;
  h += card('Реєстр протоколів · ' + list.length, list.length ? list.slice(0, UI.plimit || 30).map(p => protoItem(p, true)).join('') + (list.length > (UI.plimit || 30) ? `<button class="btn ghost wide" data-act="pmore">Показати ще</button>` : '') : empty('Протоколів не знайдено'));
  return page('Протоколи НК', h, tid ? '#/tasks' : '#/menu');
};
// ═════════ МОНІТОРИНГ ПРОТОКОЛІВ ПО ОБʼЄКТАХ ═════════
ROUTES.protomon = () => {
  const per = ['month', 'year', 'all'].includes(UI.pmPer) ? UI.pmPer : 'month'; UI.pmPer = per;
  let d = UI.pmDate || today(); if (d > today()) d = UI.pmDate = today();
  const [a, b, label] = per === 'all' ? ['0000-00-00', '9999-12-31', 'увесь час'] : per === 'month' ? [ym(d) + '-01', monthEnd(ym(d)), monthName(ym(d))] : [d.slice(0, 4) + '-01-01', d.slice(0, 4) + '-12-31', d.slice(0, 4) + ' рік'];
  const meth = UI.pmMeth || '', brig = UI.pmBrig || '', q = String(UI.pmQ || '').trim().toLowerCase(), onlyNo = UI.pmFile === 'no';
  const inPer = protoRows().filter(p => String(p.date) >= a && String(p.date) <= b);
  const list = inPer.filter(p => (!meth || (p.method || 'НК') === meth) && (!brig || String(p.brigade) === brig) &&
    (!q || [objShort(p.objectId), (get('Обʼєкти', p.objectId) || {}).name, p.number].join(' ').toLowerCase().includes(q)) &&
    (!onlyNo || !(p.file || p.fileId || DB.upTasks.has(p.id))));
  const hasFile = p => !!(p.file || p.fileId) || DB.upTasks.has(p.id);
  const atEnd = per === 'all' || (per === 'month' ? ym(d) >= ym(today()) : d.slice(0, 4) >= today().slice(0, 4));
  let h = seg('pmPer', [['month', 'Місяць'], ['year', 'Рік'], ['all', 'Увесь час']], per);
  if (per !== 'all') h += `<div class="monthnav"><button class="btn icon" data-act="pmshift" data-k="-1">‹</button><b>${label}</b><button class="btn icon" data-act="pmshift" data-k="1"${atEnd ? ' disabled' : ''}>›</button></div>`;
  const methods = [...new Set(inPer.map(p => p.method || 'НК'))].sort((x, y) => PROTO_METHODS.indexOf(x) - PROTO_METHODS.indexOf(y));
  h += `<div class="filters">${fSel('Метод', 'pm1', methods.map(m => [m, m]), meth, { none: 'Усі методи' }).replace('name="pm1"', 'data-set="pmMeth"')}${fSel('Бригада', 'pm2', BRIGADES.map(n => [String(n), brName(n)]), brig, { none: 'Усі бригади' }).replace('name="pm2"', 'data-set="pmBrig"')}</div>
    <input type="search" class="pmq" data-set="pmQ" value="${esc(UI.pmQ || '')}" placeholder="🔍 Обʼєкт або № протоколу">`;
  const byM = {}; list.forEach(p => { const m = p.method || 'НК'; byM[m] = (byM[m] || 0) + 1; });
  const objIds = [...new Set(list.map(p => p.objectId))];
  const noFile = list.filter(p => !hasFile(p)).length;
  h += kpis([['протоколів', list.length], ['обʼєктів', objIds.length], ...Object.keys(byM).sort((x, y) => PROTO_METHODS.indexOf(x) - PROTO_METHODS.indexOf(y)).map(m => [m, byM[m]]), ['без файлу', noFile ? `<span class="bad">${noFile}</span>` : '0']]);
  if (noFile || onlyNo) h += `<p class="small"><label class="chk"><input type="checkbox" data-act="pmnofile"${onlyNo ? ' checked' : ''}> показати лише протоколи без файлу</label></p>`;
  // обʼєкти, де за період є обсяги у звітах, але не зареєстровано жодного протоколу
  if (per !== 'all' && !isVisitor() && !q && !meth) {
    const withP = new Set(inPer.map(p => p.objectId));
    const miss = {};
    reportsIn(a, b, r => !isSummary(r) && (!brig || String(r.brigade) === brig) && ['rt', 'vt', 'vts', 'ut', 'uts', 'pt'].some(k => num(r[k]))).forEach(r => { if (r.objectId && !withP.has(r.objectId)) (miss[r.objectId] = miss[r.objectId] || new Set()).add(String(r.brigade)); });
    const ids = Object.keys(miss);
    if (ids.length) h += `<div class="noproto big"><b>⚠ Немає протоколів за період — є обсяги НК у звітах (${ids.length}):</b><br>${ids.map(id => `<a href="#/object/${esc(id)}">${esc(objShort(id))}</a> <span class="small">(${[...miss[id]].map(n => 'Б' + n).join(', ')})</span>`).join(' · ')}</div>`;
  }
  const open = UI.pmOpen || (UI.pmOpen = {});
  const groups = objIds.map(id => ({ id, ps: list.filter(p => p.objectId === id).sort((x, y) => String(y.date).localeCompare(String(x.date)) || String(y.number).localeCompare(String(x.number), 'uk', { numeric: true })) }))
    .sort((x, y) => String(y.ps[0].date).localeCompare(String(x.ps[0].date)));
  h += groups.length ? groups.map(g => {
    const o = get('Обʼєкти', g.id) || {};
    const cnt = {}; g.ps.forEach(p => { const m = p.method || 'НК'; cnt[m] = (cnt[m] || 0) + 1; });
    const nf = g.ps.filter(p => !hasFile(p)).length;
    const isOpen = !!open[g.id];
    return `<div class="card pmobj"><button type="button" class="pmhead" data-act="pmtoggle" data-id="${esc(g.id)}" aria-expanded="${isOpen}">
        <span class="pmt"><b>${esc(o.short || objShort(g.id))}</b><span class="small mute">${g.ps.length} ${plural(g.ps.length, 'протокол', 'протоколи', 'протоколів')} · останній ${uaDate(g.ps[0].date)}${o.settlement ? ' · 📍 ' + esc(o.settlement) : ''}</span>
        <span class="pmb">${Object.entries(cnt).map(([m, n]) => badge(esc(m) + ' · ' + n, 'pri')).join(' ')}${nf ? ' ' + badge('без файлу · ' + nf, 'bad') : ''}</span></span><span class="pmchev">${isOpen ? '▴' : '▾'}</span></button>
      ${isOpen ? `<div class="pmlist">${g.ps.map(p => {
        const has = hasFile(p), pend = DB.upTasks.has(p.id);
        return `<div class="ppitem"><div><b>${esc(p.method || 'НК')}${p.number ? ' № ' + esc(p.number) : ''}</b> <span class="small mute">${uaDate(p.date)}${p.brigade ? ' · ' + esc(brName(p.brigade)) : ''}${p.enteredBy ? ' · ' + esc(p.enteredBy) : ''}</span>${p.note ? `<div class="small mute">${esc(p.note)}</div>` : ''}${arr(p.versions).length ? `<div class="small mute">версій: ${arr(p.versions).length + 1}</div>` : ''}</div>
          <div class="row gap">${has && !pend ? `<button type="button" class="btn small primary" data-act="protodl" data-id="${esc(p.id)}" title="Завантажити">⬇</button>${DB.mailQ.has(p.id) ? badge('✉ у черзі', 'warn') : `<button type="button" class="btn small ghost" data-act="protomail" data-id="${esc(p.id)}" title="Надіслати на мою пошту">✉</button>`}` : pend ? badge('⏳ відправляється', 'warn') : '<span class="small bad">файл не додано</span>'}</div></div>`;
      }).join('')}<div class="row gap pmfoot"><a class="small" href="#/object/${esc(g.id)}">Картка обʼєкта ›</a></div></div>` : ''}</div>`;
  }).join('') : empty('За вибраний період протоколів немає');
  if (groups.length > 1) h = h.replace('<div class="card pmobj">', `<div class="row gap pmall"><button type="button" class="btn small ghost" data-act="pmall" data-v="1">Розгорнути всі</button><button type="button" class="btn small ghost" data-act="pmall" data-v="0">Згорнути всі</button></div><div class="card pmobj">`);
  return page('Моніторинг протоколів', h, '#/mon');
};
ACTS.pmtoggle = d => { const o = UI.pmOpen || (UI.pmOpen = {}); o[d.id] = !o[d.id]; render(); };
ACTS.pmall = d => { UI.pmOpen = {}; if (d.v === '1') $$('[data-act="pmtoggle"]').forEach(b => (UI.pmOpen[b.dataset.id] = true)); render(); };
ACTS.pmnofile = () => { UI.pmFile = UI.pmFile === 'no' ? '' : 'no'; render(); };
ACTS.pmshift = d => {
  const per = UI.pmPer, cur = UI.pmDate || today(), k = Number(d.k);
  let nx = per === 'month' ? addMonths(ym(cur), k) + '-01' : (Number(cur.slice(0, 4)) + k) + '-01-01';
  if (nx > today()) nx = today();
  UI.pmDate = nx; render();
};

ONCHANGE.proto = (d, field) => {
  if (field === 'objectId') { UI.regObj = d.objectId; d.brigade = d.objectId ? objWorkBrigade(d.objectId) : ''; }
  if (field === 'method') UI.regMeth = d.method;
  d.number = d.objectId && d.method ? nextProtoNo(d.objectId, d.method) : '';
};
ACTS.pmore = () => { UI.plimit = (UI.plimit || 20) + 20; render(); };
ACTS.protodl = async d => {
  try {
    toast('Готую файл…');
    const f = await getProtoFile(get('Протоколи', d.id));
    const r = await saveFile(f.name || 'Протокол.pdf', fileToBlob(f));
    toast(r === 'declined' ? 'Збереження скасовано' : 'Протокол завантажено: ' + (f.name || ''));
    render();
  } catch (e) { toast(e.message); }
};
ACTS.protomail = async d => {
  const p = get('Протоколи', d.id); if (!p) return;
  const me = get('Персонал', ME.personId) || {};
  const to = me.email || ME.email;
  if (!await ask(`Надіслати протокол «${p.fileName || 'Протокол'}» на вашу пошту ${to}?`, 'Надіслати')) return;
  try {
    const r = await mailProto(p);
    if (r.demo) {
      const o = get('Обʼєкти', p.objectId) || {};
      await ask(`ДЕМО: у робочій версії цей лист піде автоматично.\n\nКому: ${to}\nТема: Протокол ${p.method || ''}${p.number ? ' № ' + p.number : ''} — ${o.short || ''}\n\nДобрий день, ${me.pib || ME.name}!\nУ вкладенні протокол неруйнівного контролю.\nОбʼєкт: ${o.short || ''}\nМетод: ${p.method || ''}, дата: ${uaDate(p.date)}${p.note ? '\n' + p.note : ''}\n\nВкладення: 📎 ${p.fileName || 'Протокол.pdf'}`, 'Зрозуміло', 'Закрити');
      return;
    }
    toast(r.queued ? 'Лист піде автоматично, щойно файл і звʼязок будуть доступні' : 'Протокол надіслано на ' + r.to);
    render();
  } catch (e) { toast('Не вдалося надіслати: ' + e.message); }
};
ACTS.protoshare = async d => {
  try {
    const f = await getProtoFile(get('Протоколи', d.id));
    const file = new File([fileToBlob(f)], f.name || 'Протокол', { type: f.mime });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) return toast('Цей пристрій не підтримує надсилання файлів — скористайтеся «Завантажити»');
    await navigator.share({ files: [file], title: f.name });
  } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
};

async function orderFileOf(id) {
  const t = get('Завдання', id);
  if (!t) throw new Error('Завдання не знайдено');
  return { t, f: await getOrderFile(t) };
}
ACTS.orderdl = async d => {
  try {
    toast('Готую файл…');
    const { f } = await orderFileOf(d.id);
    const r = await saveFile(f.name || 'Наказ.pdf', fileToBlob(f));
    toast(r === 'declined' ? 'Збереження скасовано' : 'Наказ завантажено: ' + (f.name || ''));
    render();
  } catch (e) { toast(e.message); }
};
ACTS.ordershare = async d => {
  try {
    const { f } = await orderFileOf(d.id);
    const file = new File([fileToBlob(f)], f.name || 'Наказ', { type: f.mime });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) return toast('Цей пристрій не підтримує надсилання файлів — скористайтеся «Завантажити»');
    await navigator.share({ files: [file], title: f.name });
  } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
};
ACTS.ordermail = async d => {
  const t = get('Завдання', d.id);
  if (!await ask(`Надіслати наказ «${t.orderFileName || 'Наказ'}» на вашу пошту ${ME.email}?`, 'Надіслати')) return;
  try {
    const r = await mailOrder(t);
    if (r.demo) {
      const o = get('Обʼєкти', t.objectId) || {};
      const p = get('Персонал', ME.personId) || {};
      await ask(`ДЕМО: у робочій версії цей лист піде автоматично.\n\nКому: ${p.email || ME.email}\nТема: Наказ${t.orderNo ? ' № ' + t.orderNo : ''} — ${o.short || ''}\n\nДобрий день, ${p.pib || ME.name}!\nУ вкладенні наказ на відрядження (пересувний характер робіт).\nОбʼєкт: ${o.short || ''}\nБригада ${t.brigade}, період: ${uaDate(t.dateFrom)} – ${uaDate(t.dateTo)}\n\nВкладення: 📎 ${t.orderFileName || 'Наказ.pdf'}`, 'Зрозуміло', 'Закрити');
      return;
    }
    toast(r.demo ? 'У демо-режимі лист не надсилається' : r.queued ? 'Немає інтернету — лист піде автоматично, щойно зʼявиться звʼязок' : 'Наказ надіслано на ' + r.to);
    render();
  } catch (e) { toast('Не вдалося надіслати: ' + e.message); }
};
/** Сума обсягів і матеріалів по діаметрах; матеріали звіту розподіляються пропорційно нормі кожного діаметра. */
function diamBreakdown(reps) {
  const m = {};
  for (const r of reps) {
    if (truthy(r.travel)) continue;
    const rows = volRows(r);
    const normAll = matByNorm(rows);
    for (const v of rows) {
      const key = String(v.d || '');
      const x = m[key] = m[key] || { d: key, ...Object.fromEntries(MKEYS.map(k => [k, 0])), ...Object.fromEntries(MAT.map(t => [t[0], 0])) };
      MKEYS.forEach(k => (x[k] += num(v[k])));
      const nv = matByNorm([v]);
      MAT.forEach(([k]) => { const rv = repMat(r, k); x[k] += normAll[k] ? rv * nv[k] / normAll[k] : (rows.length === 1 ? rv : 0); });
    }
  }
  return Object.values(m).sort((a, b) => num(a.d) - num(b.d));
}
function factByObject() {
  const m = {};
  for (const r of all('Звіти')) { const x = m[r.objectId] = m[r.objectId] || { rt: 0, vt: 0, dm: 0 }; x.rt += num(r.rt); x.vt += num(r.vt); x.dm += num(r.vts) + num(r.uts); }
  return m;
}
ROUTES.objects = () => {
  const q = String(UI.oq || '').toLowerCase();
  const lv = UI.olv || '';
  const act = new Set(all('Завдання').filter(t => t.month === ym(today()) || taskCovers(t, today())).map(t => t.objectId));
  const facts = factByObject();
  const lvs = [...new Set(all('Обʼєкти').map(o => o.lvumg).filter(Boolean))].sort();
  let list = objectsSorted().filter(o => (!lv || o.lvumg === lv) && (!q || [o.short, o.name, o.icp, o.soOrder, o.settlement].join(' ').toLowerCase().includes(q)));
  // активні — є завдання (крім перенесених) або звіти за поточний рік; RT — де проводився рентгенконтроль
  const Y = today().slice(0, 4);
  const actv = new Set([...all('Завдання').filter(t => taskStatus(t) !== 'перенесено').map(t => t.objectId), ...all('Звіти').filter(r => String(r.date).slice(0, 4) === Y).map(r => r.objectId)]);
  const rtSet = new Set(Object.keys(facts).filter(id => num(facts[id].rt) > 0));
  if (UI.oact === '1') list = list.filter(o => act.has(o.id));
  if (UI.oact === 'a') list = list.filter(o => actv.has(o.id));
  if (UI.oact === 'rt') list = list.filter(o => rtSet.has(o.id));
  const ost = UI.ost || '';
  const stCnt = s => all('Обʼєкти').filter(o => s === '-' ? !o.status : o.status === s).length;
  if (ost) list = list.filter(o => ost === '-' ? !o.status : o.status === ost);
  list.sort((a, b) => (act.has(b.id) ? 1 : 0) - (act.has(a.id) ? 1 : 0));
  let h = `<input class="search" type="search" placeholder="Пошук: назва, ICP, замовлення…" value="${esc(UI.oq || '')}" data-set="oq">
    <div class="filters">${fSel('ЛВУМГ', 'x', lvs, lv, { none: 'Усі ЛВУМГ' }).replace('name="x"', 'data-set="olv"')}</div>
    ${seg('oact', [['', 'Усі ' + all('Обʼєкти').length], ['1', 'В роботі цього місяця · ' + all('Обʼєкти').filter(o => act.has(o.id)).length], ['a', 'Активні · ' + all('Обʼєкти').filter(o => actv.has(o.id)).length], ['rt', 'RT · ' + all('Обʼєкти').filter(o => rtSet.has(o.id)).length]], UI.oact || '').replace('class="seg"', 'class="seg wrap"')}
    ${UI.oact === 'a' ? `<p class="small mute">Активні — обʼєкти із завданнями (крім перенесених) або звітами за ${Y} рік.</p>` : UI.oact === 'rt' ? '<p class="small mute">Обʼєкти, де за звітами проводився рентгенконтроль (RT).</p>' : ''}
    <p class="small mute" style="margin:6px 0 2px">Статус обʼєкта</p>
    ${seg('ost', [['', 'Будь-який'], ...OBJ_STATUS.map(s => [s, s + ' · ' + stCnt(s)]), ...(stCnt('-') ? [['-', 'без статусу · ' + stCnt('-')]] : [])], ost).replace('class="seg"', 'class="seg wrap"')}`;
  if (isLead()) h += fab('#/objform/new');
  h += list.slice(0, UI.limit).map(o => {
    const len = num(o.length); const f = facts[o.id];
    return `<a class="item" href="#/object/${esc(o.id)}">
      <div class="row between"><b>${esc(o.short || o.name)}</b><span>${rtSet.has(o.id) ? badge('RT', 'ok') + ' ' : ''}${o.status ? objStBadge(o.status) : act.has(o.id) ? badge('в роботі', 'pri') : ''}</span></div>
      <span class="small mute clamp">${esc(o.name || '')}</span>
      <span class="small">${o.lvumg ? esc(o.lvumg) + ' ЛВУМГ · ' : ''}${o.diameter ? 'Ø' + esc(o.diameter) + ' · ' : ''}${len ? fmtN(len) + ' м' : ''}</span>
      ${objMeta(o)}
      ${f && (f.rt || f.vt || f.dm) ? `<span class="small mute">виконано: RT ${fmtN(f.rt)} ст. · VT-W ${fmtN(f.vt)} ст.${f.dm ? ' · ' + fmtN(f.dm) + ' дм²' : ''}</span>` : ''}</a>`;
  }).join('') + (list.length ? more(list.length) : empty('Обʼєктів не знайдено'));
  return page('Обʼєкти', h, '#/menu');
};

/** Відповідальний від замовника: ПІБ + телефон/картка, якщо він є в «Відповідальних від замовника». */
function respText(o) {
  const p = objResp(o), ph = respPhone(o);
  const tel = ph ? ` · <a href="tel:${esc(ph.replace(/[^\d+]/g, ''))}">📞 ${esc(ph)}</a>` : '';
  if (!p) return esc(o.contact) + tel;
  return (isVisitor() ? esc(o.contact) : `<a href="#/person/${esc(p.id)}">${esc(o.contact)}</a>`) + tel;
}
/** Автомобіль на обʼєкті: закріплений у картці, інакше — авто бригад, що мають завдання на обʼєкті в поточному місяці. */
function objCarText(o) {
  if (o.carId) return esc(carName(o.carId));
  const m = ym(today()), a = m + '-01', b = monthEnd(m);
  const ts = all('Завдання').filter(t => t.objectId === o.id && taskStatus(t) !== 'перенесено' && (t.month === m || (String(t.dateFrom) <= b && String(t.dateTo || t.dateFrom) >= a)));
  const cars = [];
  ts.forEach(t => { const br = brigadeOf(t.month || m, t.brigade); if (br && br.carId && !cars.some(c => c[0] === br.carId)) cars.push([br.carId, t.brigade]); });
  return cars.map(([id, n]) => esc(carName(id)) + ` <span class="small mute">(Б${esc(n)})</span>`).join('<br>');
}

// Картка обʼєкта зі сторінки «Завдання» (для працівника): паспорт, виконано/заплановано, накази
ROUTES.tobj = tid => {
  const t = get('Завдання', tid);
  if (!t) return notFound();
  const o = get('Обʼєкти', t.objectId);
  if (!o) return notFound();
  const len = num(o.length);
  const coords = num(o.lat) && num(o.lng) ? `<a href="https://maps.google.com/?q=${num(o.lat)},${num(o.lng)}" target="_blank" rel="noopener">${num(o.lat)}, ${num(o.lng)} ↗</a>` : '';
  let h = `<div class="objhead"><h2>${esc(o.short || '')}</h2><p>${esc(o.name || '')}</p></div>`;
  h += card('Паспорт обʼєкта', kv([
    ['Статус', objStBadge(o.status)], ['ЛВУМГ', esc(o.lvumg)], ['Промисловий майданчик', esc(o.site)], ['Населений пункт', esc(o.settlement)],
    ['Відповідальний від замовника', respText(o)], ['Посада відповідального', esc(o.contactPos || (objResp(o) || {}).posada || '')], ['Табельний № відповідального', esc(respTab(o)) || (o.contact ? '<span class="mute">—</span>' : '')], ['Дорога', [o.distBase ? 'від бази ' + esc(o.distBase) + ' км' : '', o.distObj ? 'до обʼєкта ' + esc(o.distObj) + ' км' : '', o.travelTime ? 'у дорозі ' + esc(o.travelTime) : ''].filter(Boolean).join(' · ')], ['Координати', coords],
    ['СО/ТОРО замовлення', esc(o.soOrder)], ['СО/ТОРО підзамовлення', esc(o.soSubOrder)], ['№ ICP', esc(o.icp)], ['Пропонований готель', esc(o.hotel)],
    ['Діаметр', o.diameter ? 'Ø ' + esc(o.diameter) + ' мм' : ''], ['Довжина ділянок ремонту', len ? fmtN(len) + ' м' : ''],
    ['Види робіт', esc(arr(o.workTypes).join(', '))], ['Методи НК', esc(methodsOf(o.methods).join(', '))], ['Примітка', esc(o.note)]
  ]));
  h += card('Бригада та автомобіль', taskCrewHtml(t));
  if (t.dateFrom) h += card('План робіт по днях · ' + uaDate(t.dateFrom) + ' – ' + uaDate(t.dateTo || t.dateFrom), dayPlanTable(t).replace(/^<div class="dayplan"><div class="row between">[\s\S]*?<\/div>/, '<div class="dayplan">') || empty('План не складено'));
  // усе — за поточний місяць: завдання обʼєкта цього місяця, їх план і звіти за місяць
  const m = ym(today());
  const mFrom = m + '-01', mTo = monthEnd(m);
  const tasks = all('Завдання').filter(x => x.objectId === o.id && (x.month === m || (String(x.dateFrom) <= mTo && String(x.dateTo || x.dateFrom) >= mFrom)))
    .sort((a, b) => String(a.dateFrom).localeCompare(String(b.dateFrom)));
  const fact = agg(all('Звіти').filter(r => r.objectId === o.id && ym(r.date) === m));
  const plan = {};
  tasks.forEach(x => Object.entries(planOf(x)).forEach(([k, v]) => { plan[k] = (plan[k] || 0) + v; }));
  const keys = donePlanKeys(fact, plan, tasks.flatMap(x => methodsOf(x.methods)));
  h += card('Виконання · ' + monthName(m), `<p class="small mute">${tasks.length ? tasks.map(x => brName(x.brigade) + ' · ' + uaDate(x.dateFrom) + ' – ' + uaDate(x.dateTo)).join('; ') : 'У цьому місяці завдань на обʼєкті немає'}</p>` +
    (keys.length ? kpis(keys.map(k => [MSHORT[k] + ', ' + MU(k), `${fmtN(num(fact[k]))}<small>/${plan[k] ? fmtN(plan[k]) : '—'}</small>`])) : empty('Обсяги не заплановано')) +
    '<p class="small mute">Формат: виконано / заплановано за поточний місяць. RT, VT-W, UT-W, PT, UTT, HB — у стиках; VT-S, UT-S — у дм².</p>');
  h += card('Завдання · ' + monthName(m), !tasks.length ? empty('Завдань на поточний місяць немає') : tasks.map(x => `<div class="item${x.id === t.id ? ' cur' : ''}"><b>${brName(x.brigade)}</b>${orderInfo(x)}<span class="small mute">${uaDate(x.dateFrom)} – ${uaDate(x.dateTo)} · ${esc(taskStatus(x))} · ${esc(methodsOf(x.methods).join(', '))}${x.requestNo ? ' · заявка № ' + esc(x.requestNo) : ''}</span></div>`).join(''));
  h += protoSection(o.id, t.id);
  return page('Обʼєкт', h, '#/tasks');
};

ROUTES.object = id => {
  const o = get('Обʼєкти', id);
  if (!o) return notFound();
  const reps = all('Звіти').filter(r => r.objectId === id);
  const s = agg(reps);
  const len = num(o.length);
  const Y = String(new Date().getFullYear());
  const monthly = obj(o.monthly);
  const coords = num(o.lat) && num(o.lng) ? `<a href="https://maps.google.com/?q=${num(o.lat)},${num(o.lng)}" target="_blank" rel="noopener">${num(o.lat)}, ${num(o.lng)} ↗</a>` : '';
  let h = `<div class="objhead"><h2>${esc(o.short || '')}</h2><p>${esc(o.name || '')}</p></div>`;
  h += card('Паспорт обʼєкта', kv([
    ['Статус', objStBadge(o.status)], ['ЛВУМГ', esc(o.lvumg)], ['Промисловий майданчик', esc(o.site)], ['Населений пункт', esc(o.settlement)],
    ['Відповідальний від замовника', respText(o)], ['Посада відповідального', esc(o.contactPos || (objResp(o) || {}).posada || '')], ['Автомобіль', objCarText(o)], ['Дорога', [o.distBase ? 'від бази ' + esc(o.distBase) + ' км' : '', o.distObj ? 'до обʼєкта ' + esc(o.distObj) + ' км' : '', o.travelTime ? 'у дорозі ' + esc(o.travelTime) : ''].filter(Boolean).join(' · ')], ['Координати', coords],
    ['СО/ТОРО замовлення', esc(o.soOrder)], ['СО/ТОРО підзамовлення', esc(o.soSubOrder)], ['ICP', esc(o.icp)], ['Пропонований готель', esc(o.hotel)],
    ['Діаметр', o.diameter ? 'Ø ' + esc(o.diameter) + ' мм' : ''], ['Довжина ділянок ремонту', len ? fmtN(len) + ' м' : ''],
    ['Види робіт', esc(arr(o.workTypes).join(', '))], ['Методи НК', esc(methodsOf(o.methods).join(', '))], ['Примітка', esc(o.note)]
  ]) + (isLead() ? `<a class="btn ghost" href="#/objform/${esc(id)}">Редагувати</a>` : ''));
  if (isLead()) h += card('Статус обʼєкта', `<div class="seg wrap">${OBJ_STATUS.map(st => `<button type="button" class="${o.status === st ? 'on' : ''}" data-act="objst" data-id="${esc(id)}" data-v="${esc(st)}">${esc(st)}</button>`).join('')}</div><p class="small mute">Натисніть, щоб змінити статус.</p>`);

  h += card('Виконання', kpis([...METHODS.map((m, i) => [mHead(m), mVals(s)[i]]), ['люд-год', fmtN(s.manH)], ['днів', s.days.size]]) +
    '<p class="small mute">Облік виконання: RT, VT-W, UT-W, PT, UTT, HB — у стиках; VT-S, UT-S — у дм².</p>');

  const plans = [['2025', o.plan2025], ['2026', o.plan2026], ['2027', o.plan2027]].filter(p => num(p[1]));
  const mrows = MONTHS.map((mn, i) => { const k = Y + '-' + z2(i + 1); const q = agg(reps.filter(r => ym(r.date) === k)); return [mn, num(monthly[k]), q.rt, q.vt, q.vts + q.uts]; }).filter(r => r[1] || r[2] || r[3] || r[4]);
  h += card('План робіт', kv([
    ...plans.map(p => ['План ' + p[0], fmtN(num(p[1])) + ' м']),
    ['Планова дата початку 2026', uaDate(o.start2026)], ['Планова дата початку 2027', uaDate(o.start2027)]
  ]) + (mrows.length ? `<h3>${Y}: план (м) і виконання по місяцях</h3>` + table(['Місяць', 'План, м', 'RT, ст.', 'VT-W, ст.', 'VT-S+UT-S, дм²'], mrows.map(r => [r[0], r[1] ? fmtN(r[1]) : '—', fmtN(r[2]), fmtN(r[3]), fmtN(r[4])]), 'num first') : ''));

  const byD = diamBreakdown(reps);
  if (byD.length) {
    const cols = METHODS.filter(m => byD.some(x => x[MKEY[m]]));
    h += card('Обсяг і матеріали по діаметрах', table(['Ø, мм', ...cols.map(mHead)], byD.map(x => [esc(x.d || '—'), ...cols.map(m => fmtN(x[MKEY[m]]))]), 'num first') +
      '<h3>Матеріали</h3>' + table(['Ø, мм', 'Плівка, дм²', 'Прояв., л', 'Фікс., л', 'PT, л'],
      byD.map(x => [esc(x.d || '—'), fmtN3(x.film), fmtN3(x.dev), fmtN3(x.fix), fmtN3(x.pts + x.ptp + x.ptd)]), 'num first') +
      '<p class="small mute">Матеріали — за нормами для діаметра (або фактичні, якщо їх вписали у звіті). Старі звіти без розбивки показано під першим діаметром.</p>');
  }
  h += card('Матеріали', table(['Матеріал', 'План', 'Використано', 'Залишок'], [
    ['Плівка RT, дм²', fmtN(num(o.filmPlan)), fmtN(s.film), num(o.filmPlan) ? fmtN(num(o.filmPlan) - s.film) : ''],
    ['Проявник, л', fmtN(num(o.devPlan)), fmtN(s.dev), num(o.devPlan) ? fmtN(num(o.devPlan) - s.dev) : ''],
    ['Фіксаж, л', fmtN(num(o.fixPlan)), fmtN(s.fix), num(o.fixPlan) ? fmtN(num(o.fixPlan) - s.fix) : ''],
    ['Розчинник PT, л', '—', fmtN3(s.pts), ''], ['Пенетрант PT, л', '—', fmtN3(s.ptp), ''], ['Проявник PT, л', '—', fmtN3(s.ptd), ''],
    ...(s.ptMat ? [['Матеріали PT, компл.', '—', fmtN(s.ptMat), '']] : [])
  ].filter(r => r[1] !== '—' || r[2] !== '0')) + kv([['Пальне на обʼєкті', Object.entries(s.fuel).map(([f, l]) => esc(f) + ': ' + fmtN(l) + ' л').join(', ') || '—'], ['Пробіг', fmtN(s.km) + ' км'], ['Мотогодини електростанцій', fmtN(s.genH)]]));

  const tasks = all('Завдання').filter(t => t.objectId === id).sort((a, b) => String(b.dateFrom).localeCompare(String(a.dateFrom)));
  h += card('Завдання', tasks.length ? tasks.map(t => `<div class="item"><b>${brName(t.brigade)}</b>${orderInfo(t)}<span class="small mute">${uaDate(t.dateFrom)} – ${uaDate(t.dateTo)} · ${esc(taskStatus(t))} · ${esc(methodsOf(t.methods).join(', '))}${t.requestNo ? ' · заявка № ' + esc(t.requestNo) : ''}</span></div>`).join('') : empty('Завдань не було'));
  h += protoSection(id);

  const ppl = {};
  reps.forEach(r => arr(r.workers).forEach(w => { (ppl[w] = ppl[w] || new Set()).add(r.date); }));
  if (Object.keys(ppl).length) h += card('Працювали на обʼєкті', `<p class="small">${Object.entries(ppl).map(([w, ds]) => esc(shortName(personName(w))) + ' — ' + ds.size + ' дн.').join('<br>')}</p>`);
  const last = reps.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  h += card('Звіти', last.length ? last.slice(0, 15).map(reportItem).join('') + (last.length > 15 ? `<p class="small mute">…ще ${last.length - 15}</p>` : '') : empty('Звітів ще немає'));
  if (!isVisitor()) h += `<div class="row gap"><a class="btn ghost" href="#/gen/tabel/${esc(id)}">Табель по обʼєкту</a><a class="btn ghost" href="#/gen/fuel/${esc(id)}">Акт палива</a></div>`;
  return page('Обʼєкт', h, '#/objects');
};

ROUTES.objform = (id = 'new') => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Обʼєкти', id) : null;
  if (id !== 'new' && !src) return notFound();
  const d = UI.draft['obj:' + id] || src || {};
  const body = fInp('Коротка назва', 'short', d.short, { req: true }) + fArea('Повна назва обʼєкта', 'name', d.name, { rows: 3 }) +
    `<div class="grid2">${fSel('Статус', 'status', OBJ_STATUS.includes(d.status) || !d.status ? OBJ_STATUS : [...OBJ_STATUS, d.status], d.status || (id === 'new' ? 'заплановано' : ''), { none: '— не вказано' })}${fInp('ЛВУМГ', 'lvumg', d.lvumg)}</div>
     ${fInp('Промисловий майданчик', 'site', d.site)}
     ${fInp('Пропонований готель', 'hotel', d.hotel, { ph: 'назва, адреса, телефон' })}
     ${fInp('Населений пункт', 'settlement', d.settlement)}
     <fieldset class="f"><legend>Відповідальний від замовника</legend><div class="grid2">${fInp('ПІБ', 'contact', d.contact, { list: 'resplist', hint: visitors().length ? 'оберіть зі списку «Відповідальні від замовника» або впишіть' : '' })}${fInp('Посада', 'contactPos', d.contactPos)}</div>
       ${fInp('Табельний номер відповідального', 'contactTabNo', d.contactTabNo, { mode: 'numeric', hint: objResp(d) && objResp(d).tabNo && !d.contactTabNo ? 'якщо не вказати — з картки відповідального: ' + objResp(d).tabNo : '' })}
       ${fInp('Телефон', 'contactPhone', d.contactPhone, { type: 'tel', ph: '+380…', hint: objResp(d) && objResp(d).phone && !d.contactPhone ? 'якщо не вказати — з картки відповідального: ' + objResp(d).phone : '' })}
       <datalist id="resplist">${visitors().map(p => `<option value="${esc(p.pib)}">${esc(p.posada || '')}</option>`).join('')}</datalist></fieldset>
     <fieldset class="f"><legend>Дорога (для службової записки)</legend><div class="grid3">${fInp('Від бази до місця проживання, км', 'distBase', d.distBase, { mode: 'decimal' })}${fInp('Від місця проживання до обʼєкта, км', 'distObj', d.distObj, { mode: 'decimal' })}${fInp('Час у дорозі', 'travelTime', d.travelTime, { ph: '7 год. 50 хв.' })}</div></fieldset>
     ${fSel('Автомобіль', 'carId', carOpts(), d.carId, { none: 'авто бригади — за завданням' })}
     <div class="grid2">${fInp('Широта N', 'lat', d.lat, { mode: 'decimal' })}${fInp('Довгота E', 'lng', d.lng, { mode: 'decimal' })}</div>
     <div class="grid2">${fInp('СО/ТОРО замовлення', 'soOrder', d.soOrder)}${fInp('СО/ТОРО підзамовлення', 'soSubOrder', d.soSubOrder)}</div>
     <div class="grid2">${fInp('ICP', 'icp', d.icp)}${fInp('Діаметр, мм', 'diameter', d.diameter)}</div>
     <div class="grid3">${fNum('Довжина, м', 'length', d.length)}${fNum('План 2026, м', 'plan2026', d.plan2026)}${fNum('План 2027, м', 'plan2027', d.plan2027)}</div>
     <div class="grid2">${fInp('Початок 2026', 'start2026', d.start2026, { type: 'date' })}${fInp('Початок 2027', 'start2027', d.start2027, { type: 'date' })}</div>
     <div class="grid3">${fNum('Плівка план, дм²', 'filmPlan', d.filmPlan)}${fNum('Проявник план, л', 'devPlan', d.devPlan)}${fNum('Фіксаж план, л', 'fixPlan', d.fixPlan)}</div>
     ${fMulti('Методи НК', 'methods', METHODS, methodsOf(d.methods))}${fMulti('Види робіт', 'workTypes', WORK_TYPES, d.workTypes)}
     ${fArea('Примітка', 'note', d.note, { rows: 2 })}`;
  return page(id === 'new' ? 'Новий обʼєкт' : 'Редагування обʼєкта', form('obj', id, body, src ? { del: { t: 'Обʼєкти', id, back: '#/objects' } } : {}), src ? '#/object/' + id : '#/objects');
};
ACTS.objst = async d => {
  if (!isLead()) return;
  const o = get('Обʼєкти', d.id); if (!o || o.status === d.v) return;
  await save('Обʼєкти', { ...o, status: d.v });
  savedMsg('Статус: ' + d.v); render();
};
FORMS.obj = async (d, id) => {
  if (!need(d, [['short', 'коротка назва']])) return;
  const src = id !== 'new' ? get('Обʼєкти', id) : {};
  const rp = objResp(d); if (rp && !String(d.contactPos || '').trim()) d.contactPos = rp.posada || '';
  if (rp && !String(d.contactPhone || '').trim()) d.contactPhone = rp.phone || '';
  const row = await save('Обʼєкти', { ...src, ...d, id: id !== 'new' ? id : undefined });
  delete UI.draft['obj:' + id]; UI.dirty = false; savedMsg('Обʼєкт збережено'); go('#/object/' + row.id);
};

// ═════════ ПЕРСОНАЛ ═════════
function certState(pid) {
  const cs = all('Сертифікати').filter(c => c.personId === pid);
  if (!cs.length) return '';
  const vs = cs.map(c => validity(c.validTo).cls);
  return vs.includes('bad') ? badge('серт. прострочено', 'bad') : vs.includes('warn') ? badge('серт. спливає', 'warn') : badge(cs.length + ' серт.', 'ok');
}
ROUTES.staff = () => {
  if (isVisitor()) return denied();
  const m = ym(today());
  const bOf = {}; BRIGADES.forEach(n => brigadeMembers(brigadeOf(m, n)).forEach(id => (bOf[id] = n)));
  const nv = visitors().length;
  let h = `<div class="row gap"><a class="btn ghost" href="#/certs">Сертифікати</a><a class="btn ghost" href="#/idk">☢ ІДК</a><a class="btn ghost" href="#/ackmatrix">Ознайомлення</a>${isLead() ? `<a class="btn ghost" href="#/visitors">Відповідальні від замовника${nv ? ' · ' + nv : ''}</a><a class="btn ghost" href="#/access">🔑 Доступ до порталу</a>` : ''}${isLead() && hiddenPeople().length ? `<a class="btn ghost" href="#/hiddenstaff">Приховані · ${hiddenPeople().length}</a>` : ''}</div>`;
  if (isLead()) h += fab('#/personform/new');
  const st = staff(), stOf = {}; st.forEach(p => (stOf[p.id] = personState(p)));
  const cnt = k => st.filter(p => stOf[p.id] === k).length;
  const work = st.filter(p => !stOf[p.id]).length;
  const f = UI.sfilt || '';
  h += `<div class="kpis staffkpi">${[['', 'Усього', st.length], ['work', 'На роботі', work], ['відпустка', '🌴 У відпустці', cnt('відпустка')], ['лікарняний', '🤒 На лікарняному', cnt('лікарняний')], ['ЗСУ', '🎖 В ЗСУ', cnt('ЗСУ')], ['навчання', '🎓 На навчанні', cnt('навчання')]]
    .map(([k, l, n]) => `<button type="button" class="kpi${f === k ? ' on' : ''}" data-act="sfilt" data-k="${esc(k)}"><b>${n}</b><span>${l}</span></button>`).join('')}</div>`;
  const list = f === 'work' ? st.filter(p => !stOf[p.id]) : f ? st.filter(p => stOf[p.id] === f) : st;
  h += list.map(p => `<a class="item" href="#/person/${esc(p.id)}">
    <div class="row between"><b>${esc(p.pib)}</b><span>${stOf[p.id] ? badge(esc(STATE_LABEL[stOf[p.id]] || stOf[p.id]), 'warn') + ' ' : ''}${bOf[p.id] ? badge('Б' + bOf[p.id], 'pri') : ''}</span></div>
    <span class="small mute">${esc(p.posada || '')}${p.role && p.role !== 'працівник' ? ' · ' + esc(roleName(p.role)) : ''}</span>
    <span class="small">${certState(p.id)} ${truthy(p.isDriver) ? badge('🚐 водій') : ''} ${p.schedule === '11' ? badge('11 год') : ''}</span></a>`).join('') || empty(f ? 'Немає працівників у цій категорії' : 'Персонал не внесено');
  return page('Персонал', h, '#/menu');
};
/** Приховані записи (вакансії, службовий обліковий запис) — лише для керівника, щоб їх можна було відредагувати. */
ACTS.sfilt = d => { UI.sfilt = UI.sfilt === d.k ? '' : d.k; render(); };
ACTS.importold = async () => {
  if (MODE === 'demo') return toast('У демо дані попереднього порталу недоступні');
  if (!navigator.onLine) return toast('Потрібен інтернет');
  if (!await ask('Підтягнути з попереднього порталу табельні номери, дати працевлаштування й роботи за фахом, корпоративну пошту та відсутність (ЗСУ / лікарняний / навчання)? Заповнюються лише порожні поля.', 'Підтягнути')) return;
  toast('Читаю дані попереднього порталу…');
  const r = await api({ action: 'importold' }, 120000).catch(e => ({ ok: false, error: e.message }));
  if (!r.ok) return toast('Не вдалося: ' + (r.error === 'Невідома дія' ? 'оновіть серверну частину порталу' : r.error));
  for (const u of r.rows || []) { const p = get('Персонал', u.id); if (p) await applyLocal('Персонал', { ...p, ...u }); }
  const f = r.found || {};
  await ask(`Оновлено працівників: ${(r.rows || []).length}\n\nТабельних номерів: ${f.tabNo || 0}\nДат працевлаштування: ${f.hireDate || 0}\nДат роботи за фахом: ${f.profSince || 0}\nКорпоративних пошт: ${f.emailCorp || 0}\nВідміток відсутності: ${f.absence || 0}${(r.columns || []).includes('prof') ? '' : '\n\nУ старому порталі немає колонки «працює за фахом» — цю дату внесіть вручну.'}`, 'Гаразд', 'Закрити');
  render();
};
ROUTES.hiddenstaff = () => {
  if (!isLead()) return denied();
  const list = hiddenPeople();
  const h = `<p class="small mute">Вакансії та службовий обліковий запис (ПІБ записано як email) не показуються в персоналі, бригадах, табелях, інструктажах і ЗІЗ. Щоб повернути запис у список, змініть ПІБ.</p>` +
    (list.length ? card('Приховані · ' + list.length, list.map(p => `<a class="item" href="#/person/${esc(p.id)}"><b>${esc(p.pib)}</b>
    <span class="small mute">${esc(p.posada || '')}${p.role ? (p.posada ? ' · ' : '') + esc(roleName(p.role)) : ''}</span></a>`).join('')) : empty('Прихованих записів немає'));
  return page('Приховані', h, '#/staff');
};
/** Відповідальні від замовника (роль «відвідувач») — окремо від персоналу: лише перегляд обʼєктів, завдань, звітів і протоколів. */
ROUTES.visitors = () => {
  if (!isLead()) return denied();
  const list = visitors();
  let h = `<p class="small mute">Відповідальні від замовника бачать обʼєкти, завдання, склад бригад, звіти, протоколи НК і новини; нічого не змінюють. Вони не входять до персоналу, бригад, табелів, інструктажів і ЗІЗ. Обʼєкти привʼязуються за ПІБ у полі «Відповідальний від замовника» картки обʼєкта.</p>` + fab('#/personform/new/visitor');
  h += list.length ? card('Відповідальні від замовника · ' + list.length, list.map(p => { const os = respObjects(p); return `<a class="item" href="#/person/${esc(p.id)}"><b>${esc(p.pib)}</b>
    <span class="small mute">${esc(p.posada || '')}${p.email ? (p.posada ? ' · ' : '') + esc(p.email) : ' · без email — вхід неможливий'}</span>
    <span class="small">${loginBadge(p)}</span>
    ${os.length ? `<span class="small">${os.map(o => esc(o.short || o.name) + (o.settlement ? ' (📍 ' + esc(o.settlement) + ')' : '')).join(', ')}</span>` : ''}</a>`; }).join('')) : empty('Відповідальних від замовника немає');
  return page('Відповідальні від замовника', h, '#/staff');
};

// ═════════ ДОСТУП ДО ПОРТАЛУ: запрошення, email і код, статус входу ═════════
/** Дані про входи (лише керівнику): logins[id] = [останній вхід, к-сть, перший, спосіб], seen[id] = остання активність, pins = у кого є код. */
function accessInfo() {
  if (MODE === 'demo') {
    if (!DB.access) {
      const lg = {}, sn = {}, now = Date.now();
      allPeople().forEach((p, i) => { if (p.email && i % 3 !== 2) { const t = now - (i * 37 % 200) * 3600e3; lg[p.id] = [t, 1 + i % 9, t - 20 * 864e5, 'email-code']; sn[p.id] = now - (i * 13 % 90) * 60e3 * (i % 4 ? 1 : 30); } });
      DB.access = { logins: lg, seen: sn, pins: [] };
    }
    return DB.access;
  }
  return DB.access || (DB.access = LS.json('access') || {});
}
/** Скільки часу тому: «5 хв тому», «3 год тому», «вчора», дата. */
function agoText(ms) {
  const d = Date.now() - num(ms); if (!num(ms)) return '';
  if (d < 90e3) return 'щойно';
  if (d < 3600e3) return Math.round(d / 60e3) + ' хв тому';
  if (d < 86400e3) return Math.round(d / 3600e3) + ' год тому';
  if (d < 2 * 86400e3) return 'вчора';
  if (d < 14 * 86400e3) return Math.round(d / 86400e3) + ' дн. тому';
  return fmtDT(ms).slice(0, 10);
}
/** Статус входу: ok — входив; warn — запрошено, ще не входив; '' — не запрошено; bad — немає email. */
function loginState(p) {
  const a = accessInfo(), L = (a.logins || {})[p.id], S = (a.seen || {})[p.id];
  if (!String(p.email || '').trim()) return { k: 'noemail', cls: 'bad', text: 'немає email — вхід неможливий' };
  if (L || S) return { k: 'in', cls: 'ok', text: (S ? 'активність ' + agoText(S) : 'входив ' + agoText(L[0])), L, S };
  if (num(p.invitedAt)) return { k: 'inv', cls: 'warn', text: 'запрошено ' + fmtDT(p.invitedAt).slice(0, 10) + ', ще не входив' };
  if ((a.pins || []).includes(p.id)) return { k: 'pin', cls: '', text: 'код видано, ще не входив' };
  return { k: 'none', cls: '', text: 'не запрошено' };
}
const loginBadge = p => { const s = loginState(p); return badge((s.k === 'in' ? '🟢 ' : s.k === 'inv' ? '✉ ' : s.k === 'noemail' ? '⚠ ' : '⚪ ') + esc(s.text), s.cls); };
ROUTES.access = () => {
  if (!isLead()) return denied();
  const f = UI.accf || 'all', grp = UI.accg || 'all';
  const ppl = allPeople().filter(p => !hiddenPeople().some(h => h.id === p.id));
  const st = {}; ppl.forEach(p => (st[p.id] = loginState(p)));
  const inG = p => grp === 'all' || (grp === 'vis' ? p.role === 'відвідувач' : p.role !== 'відвідувач');
  const base = ppl.filter(inG);
  const cnt = k => base.filter(p => k === 'all' || (k === 'out' ? st[p.id].k !== 'in' : st[p.id].k === k)).length;
  let h = `<p class="small mute">Вхід у портал — за одноразовим кодом, який людина щоразу отримує на свій email (PIN-коди скасовано). Запросіть працівника або відповідального від замовника: вкажіть email — на нього прийде лист із посиланням на портал. Відповідальні від замовника входять лише з корпоративної адреси @tsoua.com. Увійти можна і з корпоративної пошти, вказаної в картці працівника. Після зміни email попередні входи з тієї адреси завершуються.</p>`;
  const corp = setting('corpOnly', '') === '1';
  h += card('Корпоративні адреси', `<p class="small">${corp ? '<b class="ok">Увімкнено:</b> входити можна лише з адрес @tsoua.com (email або корпоративна пошта в картці).' : '<b>Вимкнено:</b> працівники можуть входити і з особистих адрес; відповідальні від замовника — лише з @tsoua.com.'}</p>
    <button type="button" class="btn small ${corp ? 'ghost' : 'primary'}" data-act="corponly" data-v="${corp ? '0' : '1'}">${corp ? 'Дозволити особисті адреси працівникам' : '🔒 Дозволити вхід лише з @tsoua.com'}</button>`);
  h += seg('accg', [['all', 'Усі · ' + ppl.length], ['staff', 'Працівники · ' + ppl.filter(p => p.role !== 'відвідувач').length], ['vis', 'Від замовника · ' + ppl.filter(p => p.role === 'відвідувач').length]], grp).replace('class="seg"', 'class="seg wrap"');
  h += `<div class="kpis staffkpi">${[['all', 'Усього'], ['in', '🟢 Входили'], ['out', 'Не входили'], ['inv', '✉ Запрошені'], ['noemail', '⚠ Без email']].map(([k, l]) => `<button type="button" class="kpi${f === k ? ' on' : ''}" data-act="set" data-k="accf" data-v="${k}"><b>${cnt(k)}</b><span>${l}</span></button>`).join('')}</div>`;
  const list = base.filter(p => f === 'all' || (f === 'out' ? st[p.id].k !== 'in' : st[p.id].k === f))
    .sort((a, b) => (a.role === 'відвідувач') - (b.role === 'відвідувач') || String(a.pib).localeCompare(String(b.pib), 'uk'));
  const item = p => { const s = st[p.id]; return `<div class="item"><div class="row between"><a href="#/person/${esc(p.id)}"><b>${esc(p.pib)}</b></a><a class="btn small ${s.k === 'in' ? 'ghost' : 'primary'}" href="#/invite/${esc(p.id)}">${s.k === 'none' || s.k === 'noemail' || s.k === 'pin' ? '✉ Запросити' : s.k === 'inv' ? '✉ Ще раз' : '✉ Змінити email'}</a></div>
    <span class="small mute">${esc(p.posada || roleName(p.role) || '')}${p.email ? ' · ' + esc(p.email) : ''}</span>
    <span class="small">${loginBadge(p)}${s.L ? ` <span class="mute">· входів: ${num(s.L[1])}, останній ${esc(fmtDT(s.L[0]))}</span>` : ''}</span></div>`; };
  const staffL = list.filter(p => p.role !== 'відвідувач'), visL = list.filter(p => p.role === 'відвідувач');
  if (staffL.length) h += card('Працівники · ' + staffL.length, staffL.map(item).join(''));
  if (visL.length) h += card('Відповідальні від замовника · ' + visL.length, visL.map(item).join(''), `<a class="small" href="#/personform/new/visitor">+ додати</a>`);
  if (!list.length) h += empty('Нікого в цій категорії');
  return page('Доступ до порталу', h, '#/menu');
};
ROUTES.invite = id => {
  if (!isLead()) return denied();
  const p = get('Персонал', id); if (!p) return notFound();
  const s = loginState(p), vis = p.role === 'відвідувач';
  const d = UI.draft['invite:' + id] || { email: p.email || (CORP_RE.test(p.emailCorp || '') ? p.emailCorp : ''), send: true };
  let h = card(esc(p.pib), kv([
    ['Хто', esc(vis ? 'Відповідальний від замовника' : (p.posada || 'Працівник'))], ['Роль у порталі', esc(roleName(p.role))],
    ['Email для входу', p.email ? esc(p.email) : '<span class="bad">не вказано</span>'],
    ['Статус входу', loginBadge(p)],
    ['Запрошено', num(p.invitedAt) ? esc(fmtDT(p.invitedAt)) + (p.invitedBy ? ' · ' + esc(p.invitedBy) : '') : '—'],
    ['Останній вхід', s.L ? esc(fmtDT(s.L[0])) + ` <span class="small mute">(${s.L[3] === 'google' ? 'через Google' : s.L[3] === 'email-code' ? 'код з пошти' : 'email + PIN'})</span>` : '—'],
    ['Усього входів', s.L ? String(num(s.L[1])) + (s.L[2] ? ` <span class="small mute">з ${esc(fmtDT(s.L[2]).slice(0, 10))}</span>` : '') : '—'],
    ['Остання активність', s.S ? esc(fmtDT(s.S)) + ' · ' + esc(agoText(s.S)) : '—']
  ]));
  h += card(p.email ? 'Змінити email / запросити ще раз' : 'Запросити до порталу', form('invite', id,
    fInp('Email для входу', 'email', d.email, { type: 'email', req: true, ph: 'name@tsoua.com', hint: vis ? 'лише корпоративна адреса @tsoua.com' : 'на цю адресу прийде запрошення і коди для входу' }) +
    fChk('Надіслати запрошення на email (посилання на портал та інструкція)', 'send', d.send) +
    `<p class="small mute">Вхід — за одноразовим кодом, що приходить на цей email. Після зміни email людина має увійти заново з новою адресою.</p>`,
    { submit: '✉ Зберегти й запросити' }));
  const from = myCorpEmail();
  h += card('📧 Надіслати з моєї корпоративної пошти', `<p class="small">Лист відкриється в Outlook уже заповненим${from ? ' — від <b>' + esc(from) + '</b>' : ''}: перевірте й натисніть «Надіслати». Лист іде всередині пошти ГТСУ і не потрапляє в «Небажану пошту» отримувача.</p>
    <p class="small mute">Email береться з поля вище${p.email ? '' : ' — спочатку збережіть його (кнопка «Зберегти й запросити», галочку можна зняти)'}. Якщо Outlook у браузері відкриється з іншого акаунта — увійдіть з корпоративної адреси.</p>
    <div class="row gap wrap"><button type="button" class="btn primary" data-act="outlookinv" data-id="${esc(id)}" data-via="owa">Outlook у браузері</button>
    <button type="button" class="btn ghost" data-act="outlookinv" data-id="${esc(id)}" data-via="mailto">Програма пошти</button>
    <button type="button" class="btn ghost" data-act="outlookinv" data-id="${esc(id)}" data-via="copy">Скопіювати текст</button></div>`);
  return page('Запрошення', h, '#/access');
};
/** Корпоративна адреса поточного користувача (@tsoua.com) — для підпису й підказки «від кого». */
function myCorpEmail() {
  const me = ME && ME.personId ? get('Персонал', ME.personId) || {} : {};
  return [ME && ME.email, me.emailCorp, me.email].find(e => CORP_RE.test(String(e || ''))) || '';
}
/** Текст запрошення для надсилання з власної пошти (Outlook). */
function inviteMail(p, email) {
  const vis = p.role === 'відвідувач', url = location.origin + location.pathname;
  const me = ME && ME.personId ? get('Персонал', ME.personId) || {} : {};
  const sign = ['З повагою,', me.pib ? shortName(me.pib) : (ME && ME.name) || '', me.posada || '', myCorpEmail()].filter(Boolean).join('\n');
  const body = [
    'Добрий день' + (p.pib ? ', ' + p.pib : '') + '!', '',
    vis ? 'Запрошую вас до порталу ВЛНК як відповідального від замовника. У порталі ви бачитимете терміни виконання робіт на ваших обʼєктах, склад бригад, щоденні звіти та протоколи неруйнівного контролю.'
        : 'Запрошую вас до порталу ВЛНК: завдання, щоденні звіти, обладнання та документи лабораторії.', '',
    'Як увійти:', '1. Відкрийте ' + url, '2. Вкажіть свою пошту ' + email + '.', '3. Введіть одноразовий код, який надійде на цю пошту.', '',
    'Якщо лист із кодом не зʼявився у «Вхідних» за кілька хвилин, перевірте папку «Небажана пошта» й позначте його «Не небажана пошта» — наступні коди надходитимуть як звичайні листи.', '',
    sign
  ].join('\n');
  return { to: email, subject: 'Запрошення до порталу ВЛНК', body };
}
ACTS.outlookinv = async (d, el) => {
  const p = get('Персонал', d.id); if (!p) return toast('Людину не знайдено');
  const inp = document.querySelector('form[data-form="invite"] [name="email"]');
  const email = String((inp && inp.value) || p.email || '').trim().toLowerCase();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) return toast('Вкажіть коректний email');
  if (p.role === 'відвідувач' && !CORP_RE.test(email)) return toast('Відповідальні від замовника входять лише з корпоративної адреси @tsoua.com');
  if (email !== String(p.email || '').trim().toLowerCase()) return toast('Спочатку збережіть цей email кнопкою «Зберегти й запросити» (галочку «Надіслати запрошення» можна зняти) — інакше людина не зможе увійти');
  const m = inviteMail(p, email);
  const q = s => encodeURIComponent(s);
  // відкриваємо одразу, у межах натискання (інакше браузер заблокує вікно)
  if (d.via === 'owa') window.open('https://outlook.office.com/mail/deeplink/compose?to=' + q(m.to) + '&subject=' + q(m.subject) + '&body=' + q(m.body), '_blank', 'noopener');
  else if (d.via === 'mailto') location.href = 'mailto:' + q(m.to) + '?subject=' + q(m.subject) + '&body=' + q(m.body.replace(/\n/g, '\r\n'));
  else {
    const t = 'Кому: ' + m.to + '\nТема: ' + m.subject + '\n\n' + m.body;
    try { await navigator.clipboard.writeText(t); }
    catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } finally { a.remove(); } }
    toast('Текст скопійовано — вставте його в новий лист в Outlook');
  }
  if (!await ask(d.via === 'copy' ? 'Позначити, що запрошення надіслано з вашої пошти?' : 'Лист відкрито в Outlook. Після того як натиснете там «Надіслати» — позначте запрошення як надіслане.', 'Позначити як надіслане', 'Пізніше')) return;
  await save('Персонал', { ...p, invitedAt: Date.now(), invitedBy: (ME.name || '') + ' (з пошти Outlook)' });
  toast('Позначено: запрошено'); render();
};
ACTS.corponly = async d => {
  const on = d.v === '1';
  if (on) {
    const me = get('Персонал', ME.personId) || {};
    if (!CORP_RE.test(ME.email || '') && !CORP_RE.test(me.emailCorp || '')) return toast('Спочатку вкажіть свою корпоративну адресу @tsoua.com у картці (поле «Корпоративна пошта») — інакше ви не зможете увійти');
    const no = allPeople().filter(p => p.role !== 'відвідувач' && p.email && !CORP_RE.test(p.email) && !CORP_RE.test(p.emailCorp || ''));
    if (!await ask(`Дозволити вхід лише з адрес @tsoua.com?${no.length ? `\n\nБез корпоративної адреси (не зможуть увійти): ${no.map(p => shortName(p.pib)).join(', ')}` : ''}\n\nПоточні сесії з особистих адрес буде завершено.`, 'Увімкнути')) return;
  }
  const cur = all('Налаштування').find(r => r.key === 'corpOnly');
  await save('Налаштування', cur ? { ...cur, value: on ? '1' : '0' } : { key: 'corpOnly', value: on ? '1' : '0' });
  savedMsg(on ? 'Вхід лише з корпоративних адрес' : 'Особисті адреси працівникам дозволено'); render();
};
FORMS.invite = async (d, id) => {
  const p = get('Персонал', id); if (!p) return toast('Людину не знайдено');
  const email = String(d.email || '').trim().toLowerCase();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) return toast('Вкажіть коректний email');
  if (all('Персонал').some(x => x.id !== id && [x.email, x.emailCorp].some(e => String(e || '').trim().toLowerCase() === email))) return toast('Цей email уже вказано в іншої людини');
  if (p.role === 'відвідувач' && !CORP_RE.test(email)) return toast('Відповідальні від замовника входять лише з корпоративної адреси @tsoua.com');
  if (setting('corpOnly', '') === '1' && !CORP_RE.test(email)) return toast('Увімкнено вхід лише з адрес @tsoua.com');
  const send = !!d.send;
  if (p.email && String(p.email).toLowerCase() !== email && !await ask(`Змінити email для входу ${p.pib}:\n${p.email} → ${email}?\n\nВходи зі старої адреси буде завершено.`, 'Змінити')) return;
  if (MODE === 'demo') {
    await save('Персонал', { ...p, email, ...(send ? { invitedAt: Date.now(), invitedBy: ME.name } : {}) });
    delete UI.draft['invite:' + id]; UI.dirty = false;
    await ask(`ДЕМО: збережено.\n\nEmail: ${email}${send ? `\n\nУ робочій версії на ${email} прийде лист «Запрошення до порталу ВЛНК» з посиланням на портал та інструкцією: вхід — за кодом, що приходить на пошту.` : ''}`, 'Зрозуміло', 'Закрити');
    return go('#/access');
  }
  if (!navigator.onLine) return toast('Потрібен інтернет');
  toast(send ? 'Надсилаю запрошення…' : 'Зберігаю…');
  const r = await api({ action: 'invite', personId: id, email, send }, 60000).catch(e => ({ ok: false, error: e.message }));
  if (!r.ok) return toast('Не вдалося: ' + (r.error === 'Невідома дія' ? 'оновіть серверну частину порталу' : r.error));
  await applyLocal('Персонал', r.row);
  if (r.access) { DB.access = r.access; LS.set('access', JSON.stringify(r.access)); }
  delete UI.draft['invite:' + id]; UI.dirty = false;
  await ask(`${r.mailed ? 'Запрошення надіслано на ' + email : 'Збережено'}.\n\nEmail для входу: ${email}\nВхід — за кодом, що приходить на цю пошту.`, 'Гаразд', 'Закрити');
  go('#/access');
};

// ───────── ІДК — індивідуальний дозиметричний контроль ─────────
const QN = ['I', 'II', 'III', 'IV'];
const idkData = pid => { try { return JSON.parse(setting('idk:' + pid, '{}')) || {}; } catch (e) { return {}; } };
const idkKey = (y, q) => y + '-' + q;
const qOfDate = d => Math.floor((+String(d).slice(5, 7) - 1) / 3) + 1;
const qEndDate = (y, q) => monthEnd(y + '-' + z2(q * 3));
const idkLimit = () => num(setting('idkLimit', '13')) || 13;
/** Чи підлягає працівник ІДК (персонал категорії А): явна позначка керівника, інакше — є сертифікат RT або вже є записи ІДК. */
function idkNeeded(pid) {
  let m = {}; try { m = JSON.parse(setting('idkcat', '{}')) || {}; } catch (e) { }
  if (m[pid] !== undefined) return truthy(m[pid]);
  return all('Сертифікати').some(c => c.personId === pid && /RT/i.test(c.method)) || Object.keys(idkData(pid)).length > 0;
}
const idkYearSum = (pid, y) => [1, 2, 3, 4].reduce((s, q) => s + num((idkData(pid)[idkKey(y, q)] || {}).dose), 0);
/** Нагадування ІДК: поточний квартал — за 15 днів до кінця; попередній — якщо не внесено. */
function idkDue(pid, t = today()) {
  const y = +t.slice(0, 4), q = qOfDate(t), d = idkData(pid), out = [];
  const end = qEndDate(y, q);
  if (!d[idkKey(y, q)] && t >= addDays(end, -15)) out.push({ cls: 'warn', y, q, end, text: `провести до ${uaDate(end)}` });
  const py = q === 1 ? y - 1 : y, pq = q === 1 ? 4 : q - 1;
  if (!d[idkKey(py, pq)]) out.push({ cls: 'bad', y: py, q: pq, end: qEndDate(py, pq), text: 'не внесено' });
  return out;
}
function idkCard(p) {
  UI.idkBack = false;
  const pid = p.id, lead = isLead(), need = idkNeeded(pid), d = idkData(pid);
  if (!need && !lead && !Object.keys(d).length) return '';
  const Y = +today().slice(0, 4), lim = idkLimit();
  const years = [...new Set([Y, ...Object.keys(d).map(k => +k.slice(0, 4))])].sort((a, b) => b - a).slice(0, 3);
  const tbl = years.map(y => { const sum = idkYearSum(pid, y);
    return `<tr><td><b>${y}</b></td>${[1, 2, 3, 4].map(q => { const r = d[idkKey(y, q)]; const due = y === Y && q === qOfDate(today()) && !r && today() >= addDays(qEndDate(y, q), -15);
      return `<td class="${due ? 'warn' : ''}">${r ? `<b>${fmtN3(num(r.dose))}</b>${r.date ? `<br><span class="small mute">${uaDate(r.date).slice(0, 5)}</span>` : ''}` : (y < Y || (y === Y && q < qOfDate(today())) ? '<span class="bad">—</span>' : '<span class="mute">·</span>')}${lead ? `<br><a class="small" href="#/idkform/${esc(pid)}/${idkKey(y, q)}">✎</a>` : ''}</td>`; }).join('')}<td class="${sum > lim ? 'bad' : sum >= lim * 0.8 ? 'warn' : 'ok'}"><b>${fmtN3(sum)}</b></td></tr>`; }).join('');
  const dues = need ? idkDue(pid) : [];
  return card('ІДК — індивідуальний дозиметричний контроль',
    (need ? '' : '<p class="small mute">Працівник не віднесений до персоналу категорії А — ІДК не обовʼязковий.</p>') +
    `<div class="tblwrap"><table class="tbl num idktbl"><thead><tr><th>Рік</th>${QN.map(q => `<th>${q} кв.</th>`).join('')}<th>За рік</th></tr></thead><tbody>${tbl}</tbody></table></div>` +
    `<p class="small mute">Доза, мЗв (ефективна, за даними ІДК). Контрольний рівень для персоналу категорії А — ${fmtN(lim)} мЗв/рік. ІДК проводиться щокварталу; нагадування — за 15 днів до кінця кварталу.</p>` +
    dues.map(x => `<p class="${x.cls}">${x.cls === 'bad' ? '⛔' : '⏰'} ІДК за ${QN[x.q - 1]} кв. ${x.y}: ${x.text}</p>`).join('') +
    (lead ? `<div class="row gap"><a class="btn ghost small" href="#/idkform/${esc(pid)}/${idkKey(Y, qOfDate(today()))}">+ Внести дозу</a><button type="button" class="btn ghost small" data-act="idkcat" data-id="${esc(pid)}" data-v="${need ? '0' : '1'}">${need ? 'Не підлягає ІДК' : 'Підлягає ІДК (кат. А)'}</button></div>` : ''));
}
ACTS.idkcat = async d => {
  let m = {}; try { m = JSON.parse(setting('idkcat', '{}')) || {}; } catch (e) { }
  m[d.id] = d.v === '1'; await saveSetting('idkcat', JSON.stringify(m)); savedMsg('Збережено'); render();
};
// ───────── Протокол ІДК по всіх працівниках категорії А ─────────
const IDK_FON = '__fon';
const IDK_HDR = {
  apprL: 'В. о. Завідувача лабораторії фізичних факторів Відділу організації лабораторної роботи, системи управління якості та метрологічного забезпечення ДУ «КИЇВСЬКИЙ ОЦКПХ МОЗ»', apprLName: 'Тетяна ГУЗЬ',
  apprR: 'Затверджую:\nНачальник ОРУ ТОВ «ОГТСУ»', apprRName: 'Андрій ТОРОПОВ',
  subj: 'працівників категорії «А» ОРУ ТОВ «ОГТСУ»',
  resp: 'Відповідальний за ІДК начальник ВЛНК', respName: 'Михайло МАНЗЯ',
  dep: 'Заступник директора-завідувач відділу дослідження фізичних та хімічних факторів', depName: ''
};
const idkHdr = () => { let m = {}; try { m = JSON.parse(setting('idkhdr', '{}')) || {}; } catch (e) { } return Object.assign({}, IDK_HDR, m); };
const idkInfoAll = () => { try { return JSON.parse(setting('idkinfo', '{}')) || {}; } catch (e) { return {}; } };
const idkInfo = pid => idkInfoAll()[pid] || {};
/** ПІБ для протоколу: прізвище великими літерами. */
const pibCaps = s => { const a = String(s || '').trim().split(/\s+/); if (!a[0]) return ''; a[0] = a[0].toUpperCase(); return a.join(' '); };
const idkYears = () => { const Y = +today().slice(0, 4); const ys = new Set([Y]); staff().concat([{ id: IDK_FON }]).forEach(p => Object.keys(idkData(p.id)).forEach(k => ys.add(+k.slice(0, 4)))); return [...ys].sort((a, b) => b - a); };
/** Рядки протоколу за рік: працівники категорії А + ФОН. */
function idkRows(y) {
  const ppl = staff().filter(p => p.role !== 'відвідувач' && (idkNeeded(p.id) || [1, 2, 3, 4].some(q => idkData(p.id)[idkKey(y, q)])))
    .sort((a, b) => String(a.pib).localeCompare(String(b.pib), 'uk'));
  const rows = ppl.map(p => { const i = idkInfo(p.id), d = idkData(p.id); return { id: p.id, pib: p.pib, birth: i.birth || '', place: i.place || '', posada: i.posada || p.posada || '', dos: i.dos || '', q: [1, 2, 3, 4].map(q => d[idkKey(y, q)]), sum: idkYearSum(p.id, y) }; });
  const fi = idkInfo(IDK_FON), fd = idkData(IDK_FON);
  return { rows, fon: { id: IDK_FON, dos: fi.dos || '', q: [1, 2, 3, 4].map(q => fd[idkKey(y, q)]), sum: idkYearSum(IDK_FON, y) } };
}
ROUTES.idk = () => {
  if (isVisitor()) return denied();
  const lead = isLead(), ys = idkYears(); const y = ys.includes(+UI.idky) ? +UI.idky : ys[0]; UI.idky = y;
  const { rows, fon } = idkRows(y), lim = idkLimit(), H = idkHdr(), Y = +today().slice(0, 4), cq = qOfDate(today());
  const qcell = (pid, r, q) => { const v = r ? `<b>${fmtN3(num(r.dose))}</b>` : (y < Y || (y === Y && q < cq) ? '<span class="bad">—</span>' : '<span class="mute">·</span>');
    return lead ? `<a href="#/idkform/${esc(pid)}/${idkKey(y, q)}" data-act="idkback" title="Внести / змінити дозу">${v}</a>` : v; };
  const info = r => [r.posada, r.dos ? 'дозиметр № ' + r.dos : '', lead && r.birth ? 'н. ' + uaDate(r.birth) : '', lead ? r.place : ''].filter(Boolean).map(esc).join(' · ');
  const trs = rows.map((r, i) => `<tr><td>${i + 1}</td><td class="l"><a href="#/person/${esc(r.id)}"><b>${esc(pibCaps(r.pib))}</b></a><br><span class="small mute">${info(r) || '<i>дані не внесено</i>'}</span>${lead ? ` <a class="small" href="#/idkinfo/${esc(r.id)}">✎</a>` : ''}</td>` +
    r.q.map((x, k) => `<td>${qcell(r.id, x, k + 1)}</td>`).join('') +
    `<td class="${r.sum > lim ? 'bad' : r.sum >= lim * 0.8 ? 'warn' : ''}"><b>${fmtN3(r.sum)}</b></td></tr>`).join('') +
    `<tr class="fon"><td>${rows.length + 1}</td><td class="l"><b>ФОН</b><br><span class="small mute">${fon.dos ? 'дозиметр № ' + esc(fon.dos) : 'фоновий дозиметр'}</span>${lead ? ` <a class="small" href="#/idkinfo/${IDK_FON}">✎</a>` : ''}</td>` +
    fon.q.map((x, k) => `<td>${qcell(IDK_FON, x, k + 1)}</td>`).join('') + `<td><b>${fmtN3(fon.sum)}</b></td></tr>`;
  const thead = `<thead><tr><th rowspan="2">№</th><th rowspan="2" class="l">П.І.Б., посада, № дозиметра</th><th colspan="4">Квартальні дози, мЗв</th><th rowspan="2">За рік, мЗв</th></tr><tr>${QN.map(q => `<th>${q}</th>`).join('')}</tr></thead>`;
  let h = `<div class="row gap">${seg('idky', ys.map(v => [v, String(v)]), y)}</div>`;
  h += card(`Протокол ІДК ${esc(H.subj)} в ${y} році`,
    `<div class="tw"><table class="idkprot">${thead}<tbody>${trs}</tbody></table></div>` +
    `<p class="small mute">«За рік» — сумарна річна доза без урахування фону. ${lead ? 'Натисніть на дозу, щоб внести або змінити її; ✎ — дані працівника для протоколу. ' : ''}Контрольний рівень — ${fmtN(lim)} мЗв/рік. До протоколу входять працівники категорії А (позначка в картці працівника, сертифікат RT або наявні записи ІДК).</p>` +
    (rows.some(r => r.sum > lim) ? `<p class="bad">⛔ Перевищено контрольний рівень: ${rows.filter(r => r.sum > lim).map(r => esc(shortName(r.pib))).join(', ')}</p>` : ''));
  h += `<div class="row gap"><a class="btn primary" href="#/gen/idk">⬇ Експорт протоколу (.xlsx)</a>${lead ? '<a class="btn ghost" href="#/idkhdr">Реквізити протоколу</a>' : ''}</div>`;
  return page('ІДК — протокол', h, '#/staff');
};
ACTS.idkback = (d, el) => { UI.idkBack = true; go(el.getAttribute('href')); };
ROUTES.idkinfo = pid => {
  if (!isLead()) return denied();
  const fon = pid === IDK_FON, p = fon ? { pib: 'ФОН (фоновий дозиметр)' } : get('Персонал', pid); if (!p) return notFound();
  const i = idkInfo(pid);
  const body = `<div class="note">${esc(p.pib)}${p.posada ? ' · ' + esc(p.posada) : ''}</div>` +
    (fon ? '' : `<div class="grid2">${fInp('Дата народження', 'birth', i.birth || '', { type: 'date' })}${fInp('Посада в протоколі (якщо відрізняється)', 'posada', i.posada || '')}</div>` +
      fInp('Місце проживання', 'place', i.place || '')) +
    fInp('Номер дозиметра', 'dos', i.dos || '');
  return page('ІДК · дані працівника', form('idkinfo', pid, body), '#/idk');
};
FORMS.idkinfo = async (d, pid) => {
  const m = idkInfoAll(); m[pid] = { birth: d.birth || '', place: (d.place || '').trim(), posada: (d.posada || '').trim(), dos: (d.dos || '').trim() };
  await saveSetting('idkinfo', JSON.stringify(m)); UI.dirty = false; savedMsg('Збережено'); go('#/idk');
};
ROUTES.idkhdr = () => {
  if (!isLead()) return denied();
  const H = idkHdr();
  const body = fArea('Погоджено (ліворуч) — посада', 'apprL', H.apprL) + fInp('ПІБ', 'apprLName', H.apprLName) +
    fArea('Затверджую (праворуч) — посада', 'apprR', H.apprR) + fInp('ПІБ', 'apprRName', H.apprRName) +
    fInp('Назва в заголовку («…працівників категорії «А» …»)', 'subj', H.subj) +
    fInp('Підпис 1 — посада', 'resp', H.resp) + fInp('ПІБ', 'respName', H.respName) +
    fInp('Підпис 2 — посада', 'dep', H.dep) + fInp('ПІБ', 'depName', H.depName);
  return page('Реквізити протоколу ІДК', form('idkhdr', 'h', body), '#/idk');
};
FORMS.idkhdr = async d => {
  const m = {}; Object.keys(IDK_HDR).forEach(k => (m[k] = d[k] ?? ''));
  await saveSetting('idkhdr', JSON.stringify(m)); UI.dirty = false; savedMsg('Збережено'); go('#/idk');
};
ROUTES.idkform = (pid, key) => {
  if (!isLead()) return denied();
  const p = pid === IDK_FON ? { id: IDK_FON, pib: 'ФОН (фоновий дозиметр)' } : get('Персонал', pid); if (!p) return notFound();
  const k = /^\d{4}-[1-4]$/.test(key || '') ? key : idkKey(+today().slice(0, 4), qOfDate(today()));
  const r = idkData(pid)[k] || {};
  const d = UI.draft['idk:' + pid] || { year: k.slice(0, 4), q: k.slice(5), dose: r.dose ?? '', date: r.date || today(), note: r.note || '' };
  const ys = [0, -1, -2].map(i => String(+today().slice(0, 4) + i));
  const body = `<div class="note">${esc(p.pib)}${p.posada ? ' · ' + esc(p.posada) : ''}</div>` +
    `<div class="grid2">${fSel('Рік', 'year', ys, d.year)}${fSel('Квартал', 'q', [1, 2, 3, 4].map(q => [String(q), QN[q - 1] + ' квартал']), String(d.q))}</div>` +
    `<div class="grid2">${fNum('Доза, мЗв', 'dose', d.dose, { req: true, step: '0.001' })}${fInp('Дата вимірювання / отримання результату', 'date', d.date, { type: 'date' })}</div>` +
    fInp('Примітка (№ дозиметра ТЛД, організація)', 'note', d.note) +
    `<p class="small mute">Порожня доза при збереженні видаляє запис за квартал.</p>`;
  return page('ІДК · внесення дози', form('idk', pid, body), pid === IDK_FON ? '#/idk' : '#/person/' + pid);
};
FORMS.idk = async (d, pid) => {
  const all_ = idkData(pid), k = idkKey(d.year, d.q);
  if (String(d.dose).trim() === '') delete all_[k]; else all_[k] = { dose: num(d.dose), date: d.date || '', note: d.note || '' };
  await saveSetting('idk:' + pid, JSON.stringify(all_));
  delete UI.draft['idk:' + pid]; UI.dirty = false;
  const sum = idkYearSum(pid, +d.year), lim = idkLimit();
  savedMsg(sum > lim ? `Збережено. Увага: сума за ${d.year} — ${fmtN3(sum)} мЗв, перевищено ${lim} мЗв` : 'Дозу збережено'); go(pid === IDK_FON || UI.idkBack ? '#/idk' : '#/person/' + pid); UI.idkBack = false;
};
ROUTES.person = id => {
  if (isVisitor()) return denied();
  const p = get('Персонал', id);
  if (!p) return notFound();
  const lead = isLead();
  const vis = p.role === 'відвідувач';
  let h = card(esc(p.pib), kv([
    ['Посада', esc(p.posada)], ['Табельний номер', esc(p.tabNo || '')],
    ...(vis ? [] : [['Стан', personState(p) ? `<b class="warn">${esc(STATE_LABEL[personState(p)] || personState(p))}</b>${p.absence === personState(p) && (p.absenceFrom || p.absenceTo) ? ` <span class="small mute">${p.absenceFrom ? 'з ' + uaDate(p.absenceFrom) : ''}${p.absenceTo ? ' до ' + uaDate(p.absenceTo) : ''}</span>` : ''}` : '<span class="ok">на роботі</span>']]),
    ['Роль у порталі', esc(roleName(p.role))], ['Email (вхід)', esc(p.email)], ['Корпоративна пошта', p.emailCorp ? `<a href="mailto:${esc(p.emailCorp)}">${esc(p.emailCorp)}</a>` : ''],
    ['Телефон', p.phone ? `<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ''],
    ...(vis ? [] : [['Графік', p.schedule === '11' ? '11 год (07:00–19:00)' : '8 год (08:00–17:00)'],
      ['Водій', truthy(p.isDriver) ? 'так' : ''], ['Посвідчення водія', esc(p.driverLicense) + (p.licenseTo ? ' · ' + validity(p.licenseTo).text : '')],
      ['Допуск до авто', arr(p.carAccess).map(c => esc(carName(c))).join(', ')],
      ['Працевлаштований', p.hireDate ? uaDate(p.hireDate) : ''], ['Стаж на підприємстві', esc(seniority(p.hireDate))],
      ['Працює за фахом з', p.profSince ? uaDate(p.profSince) : ''], ['Стаж за професією', esc(seniority(p.profSince))]]),
    ['Примітка', esc(p.note)]
  ]) + (lead ? `<div class="row gap"><a class="btn ghost" href="#/personform/${esc(id)}">Редагувати</a><a class="btn ghost" href="#/invite/${esc(id)}">🔑 Запросити / змінити email і код</a></div><p class="small">Вхід у портал: ${loginBadge(p)}</p>` : '') + (p.role === 'відвідувач' ? '<p class="small mute">Відповідальний від замовника — не входить до персоналу лабораторії, має доступ лише на перегляд.</p>' : ''));
  if (p.role === 'відвідувач') {
    const os = respObjects(p);
    h += card('Обʼєкти · ' + os.length, os.length ? os.map(o => `<a class="item" href="#/object/${esc(o.id)}"><b>${esc(o.short || o.name)}</b>${objMeta(o)}</a>`).join('') : empty('Немає обʼєктів, де цю особу вказано відповідальним'));
    return page('Відповідальний від замовника', h, '#/visitors');
  }
  const cs = all('Сертифікати').filter(c => c.personId === id).sort((a, b) => String(a.method).localeCompare(String(b.method)));
  const canCert = lead || id === ME.personId;
  h += card('Сертифікати з НК', (cs.length ? cs.map(c => certItem(c, canCert, lead)).join('') : empty('Сертифікатів не внесено')) +
    (cs.length ? '<p class="small mute">Скан сертифіката (PDF або фото) зберігається на Google Диску в папці «Сертифікати НК / ПІБ». «На пошту» — надсилає файл на ваш email.</p>' : ''),
    lead ? `<a class="small" href="#/certform/new/${esc(id)}">+ додати</a>` : '');
  h += idkCard(p);
  const docs = all('Документи').filter(needAck);
  const ok = docs.filter(d => ackOf(d.id, id)).length;
  const missDocs = docs.filter(d => !ackOf(d.id, id));
  h += card('Ознайомлення з документами', `<p>${ok} з ${docs.length} обовʼязкових</p>${bar(docs.length ? ok / docs.length * 100 : 0)}` +
    (missDocs.length && (lead || id === ME.personId) ? `<details><summary class="small">Не ознайомлений(-а): ${missDocs.length}</summary><ul class="plain small">${missDocs.map(d => `<li><a href="#/doc/${esc(d.id)}">${esc(d.title)}</a> <span class="mute">· ${esc(d.kind)}</span></li>`).join('')}</ul></details>` : '') +
    '<p class="small mute">Інструкції з охорони праці — через <a href="#/brief">інструктажі</a>.</p>');
  const eq = all('Обладнання').filter(e => e.holderType === 'працівник' && e.holderId === id);
  const Yv = today().slice(0, 4);
  const vs = vacSummary(id, Yv);
  h += card('Відпустка · ' + Yv, vacChips(vs) + (vs.parts.length ? vs.parts.map(vacLine).join('') : empty('Не заплановано')),
    `<a class="small" href="#/vac">Графік ›</a>`);
  h += card('Обладнання на руках', eq.length ? eq.map(e => `<div class="item"><b>${esc(e.name)}</b><span class="small mute">інв. ${esc(e.invNo || '—')} · ${esc(e.condition || '')}</span></div>`).join('') : empty('Немає'));
  const pp = ppeOf(id);
  if (pp.length || p.clothSize || p.shoeSize) h += card('ЗІЗ', `<details class="fold"><summary><span>${ppeCounts(pp)}</span><span class="small mute">детальніше</span></summary><p class="small">${sizesLine(p)}</p>` + (pp.filter(x => x.st.cls !== 'ok').map(x => ppeRow(x, id)).join('') || '<p class="small mute">Усі ЗІЗ в нормі</p>') + '</details>',
    isLead() ? `<a class="small" href="#/ppeissue/${esc(id)}">Видати ›</a>` : `<a class="small" href="#/ppe">ЗІЗ ›</a>`);
  return page(p.role === 'відвідувач' ? 'Відповідальний від замовника' : 'Працівник', h, p.role === 'відвідувач' ? '#/visitors' : '#/staff');
};

ROUTES.personform = (id = 'new', kind) => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Персонал', id) : null;
  if (id !== 'new' && !src) return notFound();
  const d = UI.draft['person:' + id] || src || { role: kind === 'visitor' ? 'відвідувач' : 'працівник', schedule: '8' };
  const vis0 = d.role === 'відвідувач';
  const body = fInp('ПІБ', 'pib', d.pib, { req: true, ph: 'Прізвище Імʼя По батькові' }) + (vis0 ? `<div class="grid2">${fInp('Посада', 'posada', d.posada)}${fInp('Табельний номер', 'tabNo', d.tabNo, { mode: 'numeric' })}</div>` : `<div class="grid2">${fInp('Посада', 'posada', d.posada)}${fInp('Табельний номер', 'tabNo', d.tabNo, { mode: 'numeric' })}</div>`) +
    `<div class="grid2">${fInp('Email (для входу)', 'email', d.email, { type: 'email', ph: vis0 ? 'name@tsoua.com' : '', hint: vis0 ? 'лише корпоративна адреса @tsoua.com' : 'на нього приходить код для входу' })}${fInp('Телефон', 'phone', d.phone, { type: 'tel' })}</div>
     ${vis0 ? '' : fInp('Корпоративна пошта', 'emailCorp', d.emailCorp, { type: 'email', ph: 'name@tsoua.com', hint: 'з неї теж можна входити в портал' })}
     ${fSel('Роль у порталі', 'role', ROLE_OPTS, d.role, { re: true })}` +
    // для відповідальних від замовника — лише ПІБ, посада, контакти, роль і примітка
    (vis0 ? fArea('Примітка', 'note', d.note, { rows: 2 }) : `
     ${fSel('Графік роботи', 'schedule', [['8', '8 год (08:00–17:00)'], ['11', '11 год (07:00–19:00)']], d.schedule)}
     <div class="grid2">${fInp('Працевлаштований (дата прийняття на роботу)', 'hireDate', d.hireDate, { type: 'date' })}${fInp('Працює за фахом з', 'profSince', d.profSince, { type: 'date', hint: 'дата, з якої працює за професією' })}</div>
     ${fNum('Норма відпустки, днів', 'vacDays', d.vacDays, { ph: setting('vacDaysDefault', '24') })}
     <fieldset class="f"><legend>Відсутність (лікарняний, ЗСУ, навчання)</legend><div class="grid3">${fSel('Причина', 'absence', ABSENCES, d.absence, { none: '— на роботі —' })}${fInp('З', 'absenceFrom', d.absenceFrom, { type: 'date' })}${fInp('По', 'absenceTo', d.absenceTo, { type: 'date', hint: 'порожньо — до зміни' })}</div><small class="mute">Щорічні відпустки за графіком враховуються автоматично.</small></fieldset>
     ${fChk('Водій службового авто', 'isDriver', d.isDriver)}
     <div class="grid2">${fInp('Посвідчення водія (категорії)', 'driverLicense', d.driverLicense)}${fInp('Дійсне до', 'licenseTo', d.licenseTo, { type: 'date' })}</div>
     ${fMulti('Допуск до авто', 'carAccess', carOpts(), d.carAccess)}
     ${fArea('Примітка', 'note', d.note, { rows: 2 })}`);
  const vis = d.role === 'відвідувач';
  return page(src ? 'Редагування' : vis ? 'Новий відповідальний від замовника' : 'Новий працівник', form('person', id, body, src ? { del: { t: 'Персонал', id, back: vis ? '#/visitors' : '#/staff' } } : {}), src ? '#/person/' + id : vis ? '#/visitors' : '#/staff');
};
FORMS.person = async (d, id) => {
  if (!need(d, [['pib', 'ПІБ']])) return;
  d.email = String(d.email || '').trim().toLowerCase();
  // email потрібен лише для входу в портал; без нього людина є в довідниках, але увійти не може
  if (d.email && all('Персонал').some(p => p.id !== id && String(p.email || '').trim().toLowerCase() === d.email)) return toast('Такий email вже є');
  if (!d.email && d.role !== 'відвідувач' && !await ask('Без email працівник не зможе увійти в портал. Зберегти без email?', 'Зберегти')) return;
  delete d.pin;
  if (d.role === 'відвідувач' && d.email && !CORP_RE.test(d.email)) return toast('Відповідальні від замовника входять лише з корпоративної адреси @tsoua.com');
  if (d.emailCorp && !CORP_RE.test(String(d.emailCorp).trim())) return toast('Корпоративна пошта — адреса @tsoua.com');
  const src = id !== 'new' ? get('Персонал', id) : {};
  const row = await save('Персонал', { ...src, ...d, id: id !== 'new' ? id : undefined });
  delete UI.draft['person:' + id];
  const was = src && src.role;
  UI.dirty = false; savedMsg(was && was !== row.role && row.role === 'відвідувач' ? 'Збережено — переміщено до «Відповідальних від замовника»' : was === 'відвідувач' && row.role !== 'відвідувач' ? 'Збережено — переміщено до «Персоналу»' : 'Збережено'); go('#/person/' + row.id);
};

// ═════════ СЕРТИФІКАТИ ═════════
ROUTES.certs = () => {
  if (isVisitor()) return denied();
  const cs = all('Сертифікати');
  const rows = staff().filter(p => p.role !== 'відвідувач').map(p => [
    `<a href="#/person/${esc(p.id)}">${esc(shortName(p.pib))}</a>`,
    ...CERT_TYPES.map(m => { const c = cs.filter(x => x.personId === p.id && (CERT_ALIAS[x.method] || x.method) === m).sort((a, b) => String(b.validTo).localeCompare(String(a.validTo)))[0]; if (!c) return '<span class="mute">—</span>'; const v = validity(c.validTo); return `<span class="${v.cls}" title="${esc(v.text)}">${esc(c.level || '✓')}<br><small>${uaDate(c.validTo).slice(0, 5)}${c.validTo ? '.' + String(c.validTo).slice(2, 4) : ''}</small></span>`; })
  ]);
  const exp = cs.filter(c => ['bad', 'warn'].includes(validity(c.validTo).cls)).sort((a, b) => String(a.validTo).localeCompare(String(b.validTo)));
  let h = `<p class="small mute">Рівень кваліфікації та дата закінчення. <span class="bad">Червоний</span> — прострочено, <span class="warn">жовтий</span> — ≤ 60 днів.</p>`;
  h += card('Матриця сертифікатів', table(['ПІБ', ...CERT_TYPES.map(m => m.replace('Спрямовані хвилі', 'GW').replace('Радіаційна безпека', 'РБ'))], rows, 'center first'));
  if (exp.length) h += card('Потребують переатестації', exp.map(c => `<div class="item"><b>${esc(personName(c.personId))} — ${esc(c.method)}</b>${badge(validity(c.validTo).text, validity(c.validTo).cls)}</div>`).join(''));
  h += `<div class="row gap"><a class="btn primary" href="#/gen/certs">⬇ Експорт сертифікатів (.xlsx)</a></div>`;
  if (isLead()) h += fab('#/certform/new');
  return page('Сертифікати НК', h, '#/menu');
};
ROUTES.certform = (id = 'new', pid) => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Сертифікати', id) : null;
  const d = src || { personId: pid || '', method: 'RT', level: '2' };
  const body = fSel('Працівник', 'personId', staffOpts(), d.personId, { req: true, none: '—' }) +
    `<div class="grid2">${fSel('Метод / вид', 'method', CERT_TYPES, CERT_ALIAS[d.method] || d.method, { req: true })}${fSel('Рівень', 'level', ['1', '2', '3'], d.level, { none: '—' })}</div>
     ${fInp('Сектори', 'sector', d.sector, { ph: '1-5; 7' })}
     <div class="grid2">${fInp('№ сертифіката', 'number', d.number)}${fInp('Орган сертифікації', 'body', d.body)}</div>
     <div class="grid2">${fInp('Дата видачі', 'issued', d.issued, { type: 'date' })}${fInp('Дійсний до', 'validTo', d.validTo, { type: 'date', req: true })}</div>
     <label class="f"><span>Скан сертифіката${src && (src.fileName || DB.upTasks.has(src.id)) ? ' — замінити файл' : ''}</span><input type="file" name="file" accept="application/pdf,image/*"><small>${src && src.fileName ? '📄 ' + esc(src.fileName) + ' · ' : ''}PDF або фото до 15 МБ; зберігається на Google Диску в папці «Сертифікати НК / ПІБ»</small></label>`;
  return page('Сертифікат', form('cert', id, body, src ? { del: { t: 'Сертифікати', id, back: '#/person/' + d.personId } } : {}), d.personId ? '#/person/' + d.personId : '#/certs');
};
FORMS.cert = async (d, id, f) => {
  if (!need(d, [['personId', 'працівник'], ['method', 'метод'], ['validTo', 'дійсний до']])) return;
  const inp = f && f.querySelector('input[name=file]'); const file = inp && inp.files[0]; delete d.file;
  const src = id !== 'new' ? get('Сертифікати', id) : {};
  const row = await save('Сертифікати', { ...src, ...d, id: id !== 'new' ? id : undefined });
  if (file) { try { await queueRowFile('Сертифікати', row.id, file); } catch (e) { toast('Файл не додано: ' + e.message); } }
  UI.dirty = false; savedMsg('Сертифікат збережено'); go('#/person/' + d.personId);
};
/** Сертифікат на картці працівника: дані, файл (завантажити / на пошту / поділитися), додати скан — керівник або сам працівник. */
function certItem(c, canUp, lead) {
  const v = validity(c.validTo);
  const pend = DB.upTasks.has(c.id);
  const has = !!(c.file || c.fileId) || pend;
  const off = String(c.file || '').startsWith('data:') || DB.cachedFiles.has(c.fileId) || DB.cachedFiles.has('local-' + c.id);
  return `<div class="item"><div class="row between"><b>${esc(c.method)} ${c.level ? '· ' + esc(c.level) + ' рівень' : ''}${c.sector ? ' · сектор ' + esc(c.sector) : ''}</b>${badge(v.text, v.cls)}</div>
    <span class="small mute">№ ${esc(c.number || '—')} ${c.body ? '· ' + esc(c.body) : ''} ${c.issued ? '· видано ' + uaDate(c.issued) : ''}</span>
    ${c.fileName ? `<span class="small ordername">📄 ${esc(c.fileName)}${off ? ' <span class="ok">✓ офлайн</span>' : ''}</span>` : ''}
    <div class="row gap order">${has ? `<button type="button" class="btn small primary" data-act="certdl" data-id="${esc(c.id)}">⬇ Завантажити</button>${DB.mailQ.has(c.id) ? badge('✉ лист у черзі', 'warn') : `<button type="button" class="btn small ghost" data-act="certmail" data-id="${esc(c.id)}">✉ На пошту</button>`}${navigator.canShare ? `<button type="button" class="btn small ghost" data-act="certshare" data-id="${esc(c.id)}">↗ Поділитися</button>` : ''}` : '<span class="small mute">скан не додано</span>'}
    ${pend ? badge('⏳ відправляється', 'warn') : ''}
    ${canUp ? `<label class="btn small ${has ? 'ghost' : 'primary'} upl">${has ? 'Замінити файл' : '⬆ Додати PDF'}<input type="file" accept="application/pdf,image/*" data-certup="${esc(c.id)}"></label>` : ''}
    ${lead ? `<a class="btn small ghost" href="#/certform/${esc(c.id)}">Редагувати</a>` : ''}</div></div>`;
}
const getCertFile = c => getRowFile('Сертифікати', c);
ACTS.certdl = async d => {
  try {
    toast('Готую файл…');
    const f = await getCertFile(get('Сертифікати', d.id));
    const r = await saveFile(f.name || 'Сертифікат.pdf', fileToBlob(f));
    toast(r === 'declined' ? 'Збереження скасовано' : 'Сертифікат завантажено: ' + (f.name || ''));
    render();
  } catch (e) { toast(e.message); }
};
ACTS.certmail = async d => {
  const c = get('Сертифікати', d.id); if (!c) return;
  const me = get('Персонал', ME.personId) || {};
  const to = me.email || ME.email;
  if (!await ask(`Надіслати сертифікат «${c.fileName || c.method}» на вашу пошту ${to}?`, 'Надіслати')) return;
  try {
    const r = await mailCert(c);
    if (r.demo) {
      await ask(`ДЕМО: у робочій версії цей лист піде автоматично.\n\nКому: ${to}\nТема: Сертифікат ${c.method || ''}${c.number ? ' № ' + c.number : ''} — ${personName(c.personId)}\n\nДобрий день, ${me.pib || ME.name}!\nУ вкладенні сертифікат з неруйнівного контролю.\nПрацівник: ${personName(c.personId)}\nМетод: ${c.method || ''}${c.level ? ', ' + c.level + ' рівень' : ''}\nДійсний до: ${uaDate(c.validTo)}\n\nВкладення: 📎 ${c.fileName || 'Сертифікат.pdf'}`, 'Зрозуміло', 'Закрити');
      return;
    }
    toast(r.queued ? 'Лист піде автоматично, щойно файл і звʼязок будуть доступні' : 'Сертифікат надіслано на ' + r.to);
    render();
  } catch (e) { toast('Не вдалося надіслати: ' + e.message); }
};
ACTS.certshare = async d => {
  try {
    const f = await getCertFile(get('Сертифікати', d.id));
    const file = new File([fileToBlob(f)], f.name || 'Сертифікат', { type: f.mime });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) return toast('Цей пристрій не підтримує надсилання файлів — скористайтеся «Завантажити»');
    await navigator.share({ files: [file], title: f.name });
  } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
};

// ═════════ ОБЛАДНАННЯ ═════════
const KIT_COND = ['справне', 'несправне', 'відсутнє'];
/** Методи обладнання: «VT, UT-W» → ['VT', 'UT-W']. */
const eqMethods = e => String(e.method || '').split(/[,;]+|\s+/).map(x => normM(x.trim())).filter(Boolean);
/** Обладнання з методом «VT» (без сектора) підходить і до VT-W, і до VT-S. */
const eqHasMethod = (e, m) => { const ms = eqMethods(e); return ms.includes(m) || ms.includes(m.split('-')[0]); };
/** Групи для фільтра: RT, VT (VT-W, VT-S), UT (UT-W, UT-S), UTT, PT, HB; «Інше» — без методу або з іншим методом. */
const EQ_GROUPS = ['RT', 'VT', 'UT', 'UTT', 'PT', 'HB'];
const eqGroup = m => { const b = String(m || '').toUpperCase(); return b === 'UTT' || /ТОВЩИН/.test(b) ? 'UTT' : b.startsWith('VT') ? 'VT' : b.startsWith('UT') ? 'UT' : EQ_GROUPS.includes(b) ? b : 'Інше'; };
/** Методи обладнання групами для показу й форми: RT, VT, UT, UTT, PT, HB, Інше. */
const eqGroups = e => [...new Set(eqMethods(e).map(eqGroup).map(g => g === 'UT' && /товщином/i.test(e.name || '') ? 'UTT' : g))].sort((a, b) => [...EQ_GROUPS, 'Інше'].indexOf(a) - [...EQ_GROUPS, 'Інше'].indexOf(b));
const eqInGroup = (e, g) => { const gs = eqGroups(e); return g === 'Інше' ? !gs.length || gs.every(x => x === 'Інше') : gs.includes(g); };
const eqKit = e => arr(e.kit).filter(k => k && String(k.name || '').trim());
function kitSum(e) {
  const k = eqKit(e); if (!k.length) return null;
  const units = k.reduce((s, x) => s + (num(x.qty) || 1), 0);
  const bad = k.filter(x => x.condition === 'несправне').reduce((s, x) => s + (num(x.qty) || 1), 0);
  const miss = k.filter(x => x.condition === 'відсутнє').reduce((s, x) => s + (num(x.qty) || 1), 0);
  return { units, bad, miss, cls: bad || miss ? 'bad' : 'ok', text: `комплект: ${units} од.` + (bad ? `, несправних ${bad}` : '') + (miss ? `, відсутніх ${miss}` : '') + (!bad && !miss ? ', усі справні' : '') };
}
function calibState(e) {
  if (!e.calibTo) return { cls: '', text: 'калібрування не внесено' };
  const v = validity(e.calibTo);
  return { cls: v.cls, text: (v.cls === 'bad' ? 'калібрування прострочено ' : 'калібрування до ') + uaDate(e.calibTo) + (v.cls === 'warn' ? ' (' + v.text + ')' : '') };
}
const eqCond = e => { const c = e.condition || 'справне'; return badge(esc(c), c === 'несправне' ? 'bad' : c === 'потребує обслуговування' ? 'warn' : 'ok'); };
/** Де знаходиться: Склад / Авто: марка держномер / У користуванні: працівник з дати. */
function eqPlace(e) {
  if (e.holderType === 'авто') return 'Авто: ' + carName(e.holderId);
  if (e.holderType === 'працівник') return 'У користуванні: ' + (e.holderId ? shortName(personName(e.holderId)) : (e.holderName || '—')) + (e.handedAt ? ' з ' + uaDate(e.handedAt) : '');
  return 'Склад';
}
function holderOpts() {
  return [['склад', 'Склад'], ...all('Авто').map(c => ['авто:' + c.id, 'Авто: ' + carName(c.id)]), ...staff().filter(p => p.role !== 'відвідувач').map(p => ['працівник:' + p.id, 'У користування: ' + shortName(p.pib)])];
}
const workerOpts = () => staff().filter(p => p.role !== 'відвідувач').map(p => [p.id, shortName(p.pib)]);
ROUTES.equip = () => {
  if (isVisitor()) return denied();
  const tab = UI.etab || 'list';
  let h = seg('etab', [['list', 'Обладнання'], ['moves', 'Переміщення']], tab) + `<a class="btn ghost wide" href="#/kit">Комплектація автомобілів за методами ›</a>`;
  if (tab === 'moves') {
    const mv = all('Переміщення').slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.updatedAt || 0) - (a.updatedAt || 0));
    h += mv.slice(0, UI.limit).map(m => { const e = get('Обладнання', m.equipId) || {}; return `<a class="item" href="#/equipment/${esc(m.equipId)}"><div class="row between"><b>${esc(e.name || '—')}</b><span class="small">${uaDate(m.date)}</span></div>
      <span class="small">${esc(holderName(m.fromType, m.fromId, m.fromName))} → <b>${esc(holderName(m.toType, m.toId, m.receiverName))}</b></span>
      <span class="small mute">${m.receiverId && m.toType !== 'працівник' ? 'Отримав: ' + esc(shortName(personName(m.receiverId))) + ' · ' : ''}Стан: ${esc(m.condition || '—')}${m.note ? ' · ' + esc(m.note) : ''} · ${esc(personName(m.authorId))}</span></a>`; }).join('') + more(mv.length) || empty('Переміщень немає');
    return page('Обладнання', h, '#/menu');
  }
  const all_ = all('Обладнання');
  const q = String(UI.eq || '').toLowerCase(), hf = UI.eh || '', mf = UI.emeth || '', wf = UI.ew || '';
  let list = all_.filter(e => (!q || [e.name, e.invNo, e.serial, e.method, eqKit(e).map(k => k.name).join(' ')].join(' ').toLowerCase().includes(q)));
  if (mf) list = list.filter(e => eqInGroup(e, mf));
  if (hf === 'склад') list = list.filter(e => !e.holderType || e.holderType === 'склад');
  else if (hf === 'авто') list = list.filter(e => e.holderType === 'авто');
  else if (hf === 'працівник') list = list.filter(e => e.holderType === 'працівник');
  else if (hf) list = list.filter(e => (e.holderType + ':' + e.holderId) === hf);
  if (wf) list = list.filter(e => e.holderType === 'працівник' && (e.holderId || (e.holderName ? '~' + e.holderName : '')) === wf);
  list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'uk'));
  const cntM = m => all_.filter(e => eqInGroup(e, m)).length;
  const ukey = e => e.holderId || (e.holderName ? '~' + e.holderName : '');
  const users = [...new Set(all_.filter(e => e.holderType === 'працівник' && ukey(e)).map(ukey))]
    .map(k => [k, (k[0] === '~' ? k.slice(1) : shortName(personName(k))) + ' · ' + all_.filter(e => e.holderType === 'працівник' && ukey(e) === k).length]).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'uk'));
  const placeOpts = [['склад', 'Склад · ' + all_.filter(e => !e.holderType || e.holderType === 'склад').length], ['авто', 'Автомобілі (усі) · ' + all_.filter(e => e.holderType === 'авто').length],
    ...all('Авто').map(c => ['авто:' + c.id, 'Авто: ' + carName(c.id) + ' · ' + all_.filter(e => e.holderType === 'авто' && e.holderId === c.id).length]),
    ['працівник', 'Передано у користування · ' + all_.filter(e => e.holderType === 'працівник').length]];
  h += `<input class="search" type="search" placeholder="Пошук: назва, інв. №, зав. №, комплект" value="${esc(UI.eq || '')}" data-set="eq">`;
  h += seg('emeth', [['', 'Усі методи'], ...[...EQ_GROUPS, 'Інше'].map(m => [m, m + ' ' + cntM(m)])], [...EQ_GROUPS, 'Інше', ''].includes(mf) ? mf : '').replace('class="seg"', 'class="seg wrap"');
  h += `<div class="filters">${fSel('Де знаходиться', 'x', placeOpts, hf, { none: 'Усі місця' }).replace('name="x"', 'data-set="eh"')}${fSel('У користуванні', 'y', users, wf, { none: users.length ? 'Усі працівники' : '— нікому не передано —' }).replace('name="y"', 'data-set="ew"')}</div>`;
  if (isLead()) h += fab('#/equipform/new') + `<button class="btn ghost small" data-act="importkits">⬇ Комплекти з таблиці Портал_ВЛНК</button>`;
  h += `<p class="small mute">Знайдено: ${list.length}</p>`;
  h += list.slice(0, UI.limit).map(e => {
    const cal = calibState(e), ks = kitSum(e);
    return `<div class="item"><a class="item-link" href="#/equipment/${esc(e.id)}"><div class="row between"><b>${esc(e.name)}</b>${eqCond(e)}</div>
      <span class="small mute">інв. ${esc(e.invNo || '—')}${e.serial ? ' · зав. ' + esc(e.serial) : ''}${eqGroups(e).length ? ' · ' + esc(eqGroups(e).join(', ')) : ''}</span>
      <span class="small">📍 ${esc(eqPlace(e))}${eqPending(e.id) ? ' ' + badge('⏳ очікує підтвердження отримання', 'warn') : ''}</span>
      <span class="small">${ks ? badge('🧩 ' + esc(ks.text), ks.cls) + ' ' : ''}${badge('📏 ' + esc(cal.text), cal.cls)}${e.fileId || e.file ? ' ' + badge('📄 свідоцтво') : ''}</span></a>
      <div class="row gap">${canReport() ? `<a class="btn small" href="#/moveform/${esc(e.id)}">Передати</a>` : ''}${isLead() ? `<a class="btn small ghost" href="#/equipform/${esc(e.id)}">Змінити</a>` : ''}</div></div>`;
  }).join('') + (list.length ? more(list.length) : empty('Обладнання не знайдено'));
  return page('Обладнання', h, '#/menu');
};
ACTS.importkits = async () => {
  if (MODE === 'demo') return toast('У демо таблиця Портал_ВЛНК недоступна');
  if (!navigator.onLine) return toast('Потрібен інтернет');
  if (!await ask('Перенести склад комплектів з аркуша «ОбладнанняВЛНК» таблиці Портал_ВЛНК?\n\nРядки зі стовпцем «Входить до комплекту» стануть одиницями комплекту основного обладнання (зі заводським № і станом), а їхні окремі записи в списку обладнання буде прибрано. Склад комплекту в картках, де він є в таблиці, буде замінено.', 'Перенести')) return;
  toast('Читаю таблицю Портал_ВЛНК…');
  const r = await api({ action: 'importkits' }, 180000).catch(e => ({ ok: false, error: e.message }));
  if (!r.ok) return toast('Не вдалося: ' + (r.error === 'Невідома дія' ? 'оновіть серверну частину порталу' : r.error));
  for (const row of r.rows || []) await applyLocal('Обладнання', row);
  await ask(`Комплектів оновлено: ${r.sets}\nОдиниць у комплектах: ${r.units}\nОкремих записів одиниць прибрано: ${r.removed}` +
    (r.fixed.length ? `\n\nУ таблиці ${r.fixed.length} рядків мали неточний ID основного обладнання (зсув при протягуванні) — привʼязано автоматично:\n${r.fixed.slice(0, 12).join('\n')}${r.fixed.length > 12 ? '\n…' : ''}` : '') +
    (r.lost.length ? `\n\nНе знайдено основного обладнання для: ${r.lost.join(', ')}` : '') +
    (r.missing.length ? `\n\nОсновного обладнання немає на порталі: ${r.missing.join(', ')} — спершу імпортуйте обладнання.` : ''), 'Гаразд', 'Закрити');
  render();
};
/** Розширена картка обладнання: місце, комплект зі станом кожної одиниці, калібрування, історія переміщень. */
ROUTES.equipment = id => {
  if (isVisitor()) return denied();
  const e = get('Обладнання', id); if (!e) return notFound();
  const cal = calibState(e), kit = eqKit(e), ks = kitSum(e);
  let h = card(esc(e.name), kv([
    ['Методи контролю', esc(eqGroups(e).join(', ') || '—')], ['Інвентарний №', esc(e.invNo || '—')], ['Заводський №', esc(e.serial || '—')],
    ['Технічний стан', eqCond(e)], ['Де знаходиться', esc(eqPlace(e))],
    ...(e.holderType === 'працівник' ? [['Передано у користування', esc(e.holderId ? personName(e.holderId) : (e.holderName || '—')) + (e.handedAt ? ' · ' + uaDate(e.handedAt) : '')]] : []),
    ['Примітка', esc(e.note || '')]
  ]) + `<div class="row gap">${canReport() ? `<a class="btn small" href="#/moveform/${esc(id)}">Передати</a>` : ''}${isLead() ? `<a class="btn small ghost" href="#/equipform/${esc(id)}">Змінити</a>` : ''}</div>`);
  h += card('Калібрування / повірка', kv([
    ['Стан', badge(esc(cal.text), cal.cls)],
    ['Дата калібрування', e.calibDate ? uaDate(e.calibDate) : '—'],
    ['Дійсне до', e.calibTo ? uaDate(e.calibTo) + (validity(e.calibTo).cls !== 'ok' ? ` <span class="small ${validity(e.calibTo).cls}">${esc(validity(e.calibTo).text)}</span>` : '') : '—'],
    ['№ свідоцтва про калібрування', esc(e.calibCert || '—')], ['Ким виконано', esc(e.calibOrg || '—')]
  ]) + calibFileBlock(e));
  h += card('Паспорт обладнання', passFileBlock(e));
  h += eqPhotoCard(e);
  h += card('Комплект' + (ks ? ' · ' + ks.units + ' од.' : ''), kit.length ? `<div class="tblwrap"><table class="tbl kittbl"><thead><tr><th>№</th><th>Найменування</th><th>К-сть</th><th>Зав. №</th><th>Стан</th></tr></thead><tbody>${kit.map((k, i) => `<tr><td>${i + 1}</td><td>${esc(k.name)}</td><td>${num(k.qty) || 1}</td><td>${esc(k.serial || '')}</td><td>${badge(esc(k.condition || 'справне'), k.condition === 'несправне' || k.condition === 'відсутнє' ? 'bad' : 'ok')}</td></tr>`).join('')}</tbody></table></div><p class="small">${badge(esc(ks.text), ks.cls)}</p>` : empty('Склад комплекту не внесено') + (isLead() ? `<a class="small" href="#/equipform/${esc(id)}">Додати склад комплекту ›</a>` : ''));
  const mv = all('Переміщення').filter(m => m.equipId === id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  h += card('Історія переміщень · ' + mv.length, mv.length ? mv.map(m => `<a class="item" href="#/eqact/${esc(m.id)}"><div class="row between"><span class="small">${esc(holderName(m.fromType, m.fromId, m.fromName))} → <b>${esc(holderName(m.toType, m.toId, m.receiverName))}</b></span><span class="small">${uaDate(m.date)}</span></div><span class="small mute">${mvReceiver(m) ? 'Отримав: ' + esc(mvReceiver(m)) + ' · ' : ''}Стан: ${esc(m.recvAt && m.recvCondition ? m.recvCondition : m.condition || '—')}${m.note ? ' · ' + esc(m.note) : ''}${m.authorId ? ' · передав ' + esc(shortName(personName(m.authorId))) : ''}</span><span class="small">${mvStatusBadge(m)}${m.actNo ? ' · акт № ' + esc(m.actNo) : ''}</span></a>`).join('') : empty('Переміщень не було'));
  return page('Обладнання', h, '#/equip');
};
// ── свідоцтво про калібрування: файл, завантаження, надсилання
function calibFileBlock(e) {
  const pend = DB.upTasks.has(e.id);
  const has = !!(e.file || e.fileId) || pend;
  const off = String(e.file || '').startsWith('data:') || DB.cachedFiles.has(e.fileId) || DB.cachedFiles.has('local-' + e.id);
  return `${e.fileName ? `<p class="small ordername">📄 ${esc(e.fileName)}${off ? ' <span class="ok">✓ офлайн</span>' : ''}</p>` : '<p class="small mute">Скан свідоцтва не додано.</p>'}
    <div class="row gap order">${has && !pend ? `<button type="button" class="btn small primary" data-act="calibdl" data-id="${esc(e.id)}">⬇ Завантажити</button><a class="btn small ghost" href="#/eqdocmail/calib/${esc(e.id)}">✉ Надіслати</a>${navigator.canShare ? `<button type="button" class="btn small ghost" data-act="calibshare" data-id="${esc(e.id)}">↗ Поділитися</button>` : ''}` : ''}
    ${pend ? badge('⏳ відправляється', 'warn') : ''}
    ${isLead() ? `<label class="btn small ${has ? 'ghost' : 'primary'} upl">${has ? 'Замінити файл' : '⬆ Додати свідоцтво (PDF / фото)'}<input type="file" accept="application/pdf,image/*" data-calibup="${esc(e.id)}"></label>` : ''}</div>
    <p class="small mute">Файл зберігається на Google Диску в папці «Свідоцтва калібрування / ${esc(e.name || '')}${e.invNo ? ' інв. ' + esc(e.invNo) : ''}».</p>`;
}
const getCalibFile = e => getRowFile('Обладнання', e);
ACTS.calibdl = async d => {
  try {
    toast('Готую файл…');
    const f = await getCalibFile(get('Обладнання', d.id));
    const r = await saveFile(f.name || 'Свідоцтво.pdf', fileToBlob(f));
    toast(r === 'declined' ? 'Збереження скасовано' : 'Свідоцтво завантажено: ' + (f.name || ''));
    render();
  } catch (e) { toast(e.message); }
};
ACTS.calibshare = async d => {
  try {
    const f = await getCalibFile(get('Обладнання', d.id));
    const file = new File([fileToBlob(f)], f.name || 'Свідоцтво', { type: f.mime });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) return toast('Цей пристрій не підтримує надсилання файлів — скористайтеся «Завантажити»');
    await navigator.share({ files: [file], title: f.name });
  } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
};
/** Рядки комплекту з полів форми k_<i>_<поле>; ключі видаляються з d. */
function kitFromForm(d) {
  const rows = {};
  Object.keys(d).forEach(k => { const m = k.match(/^k_(\d+)_(name|qty|serial|condition)$/); if (m) { (rows[m[1]] = rows[m[1]] || {})[m[2]] = d[k]; delete d[k]; } });
  return Object.keys(rows).sort((a, b) => a - b).map(i => rows[i]);
}
ROUTES.equipform = (id = 'new') => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Обладнання', id) : null;
  if (id !== 'new' && !src) return notFound();
  const key = 'equip:' + id;
  const dr = UI.draft[key];
  const d = dr || { ...(src || { condition: 'справне', holderType: 'склад' }), holder: src && src.holderType && src.holderType !== 'склад' ? src.holderType + (src.holderType === 'працівник' ? '' : ':' + src.holderId) : 'склад', workerId: src && src.holderType === 'працівник' ? src.holderId : '' };
  const kit = dr && dr._kit ? dr._kit : eqKit(src || {});
  const ms = eqGroups(d);
  const places = [['склад', 'Склад'], ...all('Авто').map(c => ['авто:' + c.id, 'Авто: ' + carName(c.id)]), ['працівник', 'Передано у користування']];
  const kitRows = kit.map((k, i) => `<div class="kitrow"><div class="grid2">${fInp('Найменування', `k_${i}_name`, k.name, { ph: 'напр. перетворювач П121-5,0' })}<div class="grid2">${fNum('К-сть', `k_${i}_qty`, k.qty || 1)}${fSel('Стан', `k_${i}_condition`, KIT_COND, k.condition || 'справне')}</div></div>
    <div class="row gap">${fInp('Зав. №', `k_${i}_serial`, k.serial, { cls: 'grow' })}<button type="button" class="btn small ghost" data-act="kitdel" data-i="${i}" title="Видалити">✕</button></div></div>`).join('');
  const body = fInp('Найменування', 'name', d.name, { req: true }) +
    `<div class="grid2">${fInp('Інвентарний №', 'invNo', d.invNo)}${fInp('Заводський №', 'serial', d.serial)}</div>
     ${fMulti('Методи контролю', 'methods', [...EQ_GROUPS, 'Інше'], ms.length ? ms : [])}
     ${fSel('Технічний стан', 'condition', CONDITIONS, d.condition)}
     ${fSel('Де знаходиться', 'holder', places, d.holder, { re: true })}
     ${d.holder === 'працівник' ? `<div class="grid2">${fSel('Працівник (у користуванні)', 'workerId', [...workerOpts(), ['__other', 'Інший працівник (вписати ПІБ)']], d.workerId || (d.holderName ? '__other' : ''), { req: true, re: true, none: '— оберіть працівника —' })}${fInp('Дата передачі', 'handedAt', d.handedAt || today(), { type: 'date' })}</div>${(d.workerId || (d.holderName ? '__other' : '')) === '__other' ? fInp('ПІБ працівника', 'holderName', d.holderName, { req: true, ph: 'Прізвище Імʼя По батькові' }) : ''}` : ''}
     <fieldset class="f"><legend>Калібрування / повірка</legend><div class="grid2">${fInp('Дата калібрування', 'calibDate', d.calibDate, { type: 'date' })}${fInp('Дійсне до', 'calibTo', d.calibTo, { type: 'date' })}</div>
     <div class="grid2">${fInp('№ свідоцтва про калібрування', 'calibCert', d.calibCert)}${fInp('Ким виконано', 'calibOrg', d.calibOrg, { ph: 'напр. ДП «Укрметртестстандарт»' })}</div></fieldset>
     <fieldset class="f"><legend>Комплект · ${kit.length} поз.</legend>${kitRows || '<p class="small mute">Склад комплекту не внесено.</p>'}<button type="button" class="btn small ghost" data-act="kitadd">+ Додати одиницю комплекту</button></fieldset>
     ${fArea('Примітка', 'note', d.note, { rows: 2 })}`;
  return page(src ? 'Обладнання' : 'Нове обладнання', form('equip', id, body, src ? { del: { t: 'Обладнання', id, back: '#/equip' } } : {}), src ? '#/equipment/' + id : '#/equip');
};
/** Поточні значення форми обладнання → чернетка (щоб додавання/видалення рядка комплекту нічого не губило). */
function equipDraft(el) {
  const f = el.closest('form'); const key = 'equip:' + (f.dataset.id || 'new');
  const d = formData(f); d.methods = d.methods || []; d.method = d.methods.join(', ');
  d._kit = kitFromForm(d); UI.draft[key] = d; return d;
}
ACTS.kitadd = (x, el) => { const d = equipDraft(el); d._kit.push({ name: '', qty: 1, condition: 'справне' }); UI.dirty = false; render(); UI.dirty = true; };
ACTS.kitdel = (x, el) => { const d = equipDraft(el); d._kit.splice(Number(x.i), 1); UI.dirty = false; render(); UI.dirty = true; };
ONCHANGE.equip = (d) => { d._kit = kitFromForm(d); d.method = (d.methods || []).join(', '); };
FORMS.equip = async (d, id) => {
  if (!need(d, [['name', 'найменування']])) return;
  const kit = kitFromForm(d).filter(k => String(k.name || '').trim()).map(k => ({ name: k.name.trim(), qty: num(k.qty) || 1, serial: k.serial || '', condition: k.condition || 'справне' }));
  const src = id !== 'new' ? get('Обладнання', id) : {};
  let ht = 'склад', hid = '';
  let hname = '';
  if (d.holder === 'працівник') { if (!d.workerId) return toast('Оберіть працівника, якому передано обладнання'); ht = 'працівник'; hid = d.workerId === '__other' ? '' : d.workerId; if (!hid) { hname = String(d.holderName || '').trim(); if (!hname) return toast('Вкажіть ПІБ працівника'); } }
  else if (String(d.holder).startsWith('авто:')) { ht = 'авто'; hid = d.holder.slice(5); }
  const method = (d.methods || []).join(', ');
  const handedAt = ht === 'працівник' ? (d.handedAt || today()) : '';
  ['holder', 'workerId', 'methods', '_kit', 'holderName'].forEach(k => delete d[k]);
  const row = await save('Обладнання', { ...src, ...d, method, kit: JSON.stringify(kit), holderType: ht, holderId: hid, holderName: hname, handedAt, id: id !== 'new' ? id : undefined });
  // зміна місця з картки — фіксується як переміщення
  if (id !== 'new' && ((src.holderType || 'склад') !== ht || (src.holderId || '') !== hid || (src.holderName || '') !== hname))
    await save('Переміщення', { equipId: row.id, date: handedAt || today(), fromType: src.holderType || 'склад', fromId: src.holderId || '', fromName: src.holderName || '', toType: ht, toId: hid, receiverName: hname, condition: row.condition, note: 'змінено в картці обладнання', authorId: ME.personId });
  delete UI.draft['equip:' + id]; UI.dirty = false; savedMsg('Збережено'); go('#/equipment/' + row.id);
};
// ── передача обладнання з актом приймання-передачі
const mvReceiver = m => m.receiverId ? shortName(personName(m.receiverId)) : (m.receiverName || '');
const eqPending = eid => all('Переміщення').some(m => m.equipId === eid && m.status === 'очікує');
const mvStatusBadge = m => m.status === 'очікує' ? badge('⏳ очікує підтвердження', 'warn') : m.recvAt ? badge('✓ отримання підтверджено', 'ok') : '';
/** Наступний № акта в році: «7/2026». */
function nextActNo(date) {
  const y = String(date || today()).slice(0, 4);
  const ns = all('Переміщення').map(m => String(m.actNo || '')).filter(x => x.endsWith('/' + y)).map(x => parseInt(x, 10)).filter(n => n > 0);
  return (ns.length ? Math.max(...ns) + 1 : 1) + '/' + y;
}
ROUTES.moveform = id => {
  if (!canReport()) return denied();
  const e = get('Обладнання', id);
  if (!e) return notFound();
  const ks = kitSum(e), kit = eqKit(e);
  const d = UI.draft['move:' + id] || { place: '', toPerson: '', otherName: '', date: today(), condition: e.condition || 'справне', note: '' };
  const places = [['склад', 'Склад'], ...all('Авто').map(c => ['авто:' + c.id, 'Авто: ' + carName(c.id)]), ['працівник', 'У користування працівнику']];
  const use = d.place === 'працівник';
  const whoOpts = [...workerOpts(), ['__other', use ? 'Інший працівник (вписати ПІБ)' : 'Інший (вписати ПІБ)']];
  const body = `<div class="note">${esc(e.name)} · інв. ${esc(e.invNo || '—')}<br>Зараз: <b>${esc(eqPlace(e))}</b>${ks ? '<br>' + esc(ks.text) : ''}</div>` +
    `${fSel('Куди передати', 'place', places, d.place, { req: true, re: true, none: '— оберіть місце —' })}` +
    `${fSel(use ? 'Кому (у користування)' : 'Кому (хто отримав)', 'toPerson', whoOpts, d.toPerson, { req: use, re: true, none: use ? '— оберіть працівника —' : '— не вказано —', hint: use ? 'обладнання буде закріплено за працівником; він підтвердить отримання в порталі' : 'працівник порталу підтвердить отримання сам; для «Іншого» отримання фіксуєте ви' })}` +
    (d.toPerson === '__other' ? fInp(use ? 'ПІБ працівника, якому передається у користування' : 'ПІБ отримувача', 'otherName', d.otherName, { req: true, ph: 'Прізвище Імʼя По батькові, посада' }) : '') +
    `<div class="grid2">${fInp('Дата передачі', 'date', d.date || today(), { type: 'date', req: true })}${fSel('Стан при передачі', 'condition', CONDITIONS, d.condition || e.condition || 'справне')}</div>` +
    (kit.length ? `<fieldset class="f"><legend>Комплект при передачі · ${kit.length} поз.</legend>${kit.map((k, i) => `<div class="kitchk"><span>${i + 1}. ${esc(k.name)}${num(k.qty) > 1 ? ' × ' + num(k.qty) : ''}${k.serial ? ' <small class="mute">зав. ' + esc(k.serial) + '</small>' : ''}</span>${fSel('', 'sk_' + i, KIT_COND, d['sk_' + i] || k.condition || 'справне')}</div>`).join('')}</fieldset>` : '') +
    fArea('Примітка (комплектність, пошкодження)', 'note', d.note, { rows: 2 }) +
    `<label class="f"><span>📷 Фотофіксація стану при передачі</span><input type="file" name="photos" accept="image/*" capture="environment" multiple><small>Можна зробити кілька фото камерою телефона; фото стискаються автоматично й додаються до акта</small></label>`;
  return page('Передача обладнання', form('move', id, body, { submit: 'Передати й сформувати акт' }), '#/equipment/' + id);
};
FORMS.move = async (d, id, f) => {
  if (!need(d, [['place', 'куди передати'], ['date', 'дата']])) return;
  const e = get('Обладнання', id);
  let tt = 'склад', tid = '';
  if (d.place === 'працівник') { if (!d.toPerson) return toast('Оберіть працівника, якому передається обладнання'); tt = 'працівник'; tid = d.toPerson === '__other' ? '' : d.toPerson; }
  else if (String(d.place).startsWith('авто:')) { tt = 'авто'; tid = d.place.slice(5); }
  const other = d.toPerson === '__other';
  if ((e.holderType || 'склад') === tt && (e.holderId || '') === tid && (!other || (e.holderName || '') === String(d.otherName || '').trim())) return toast('Обладнання вже знаходиться тут');
  if (other && !String(d.otherName || '').trim()) return toast('Вкажіть ПІБ отримувача');
  const receiverId = other ? '' : (d.toPerson || '');
  const sendKit = eqKit(e).map((k, i) => ({ name: k.name, qty: num(k.qty) || 1, serial: k.serial || '', condition: d['sk_' + i] || k.condition || 'справне' }));
  // отримувач — працівник порталу (не я) підтверджує сам; інакше отримання фіксує той, хто передає
  const selfConfirm = !receiverId || receiverId === ME.personId;
  const now = Date.now();
  const mv = { equipId: id, date: d.date, fromType: e.holderType || 'склад', fromId: e.holderId || '', fromName: e.holderName || '', toType: tt, toId: tid, receiverId, receiverName: other ? d.otherName.trim() : '',
    condition: d.condition, note: d.note, authorId: ME.personId, actNo: nextActNo(d.date), sendKit: JSON.stringify(sendKit), status: selfConfirm ? 'підтверджено' : 'очікує',
    ...(selfConfirm ? { recvAt: now, recvBy: meShort() + (receiverId ? '' : ' (за отримувача)'), recvCondition: d.condition, recvKit: JSON.stringify(sendKit), recvNote: other ? 'Отримувач не є користувачем порталу' : '' } : {}) };
  const row = await save('Переміщення', mv);
  const upd = { ...e, holderType: tt, holderId: tid, holderName: tt === 'працівник' && !tid ? d.otherName.trim() : '', condition: d.condition, handedAt: tt === 'працівник' ? d.date : '', ...(selfConfirm && sendKit.length ? { kit: JSON.stringify(sendKit) } : {}) };
  if (isLead() || MODE === 'demo') await save('Обладнання', upd); else await applyLocal('Обладнання', upd);
  const files = [...((f && f.querySelector('input[name=photos]') || {}).files || [])];
  if (files.length) await addEqPhotos(files, { equipId: id, moveId: row.id, stage: 'передача' });
  delete UI.draft['move:' + id]; UI.dirty = false;
  savedMsg(selfConfirm ? 'Передачу зафіксовано, акт № ' + row.actNo : 'Передачу зафіксовано — очікує підтвердження ' + shortName(personName(receiverId)));
  if (MODE === 'live' && navigator.onLine) setTimeout(() => genActNow(row.id, true), 4000);
  go('#/eqact/' + row.id);
};
ONCHANGE.move = () => {};
/** Сформувати PDF акта на сервері (після синхронізації рядка). */
async function genActNow(moveId, quiet) {
  if (MODE !== 'live') return;
  try {
    if (DB.pending) await sync();
    const r = await api({ action: 'genact', moveId }, 120000);
    if (!r.ok) { if (!quiet) toast('Акт не сформовано: ' + (r.error === 'Невідома дія' ? 'оновіть серверну частину порталу' : r.error === 'NOROW' ? 'передача ще не дійшла на сервер, спробуйте за хвилину' : r.error)); return; }
    const m = get('Переміщення', moveId); if (m) await applyLocal('Переміщення', { ...m, ...r.row });
    if (!quiet) toast('Акт сформовано');
    onData(true);
  } catch (e) { if (!quiet) toast('Акт не сформовано: ' + e.message); }
}
/** Акт приймання-передачі: перегляд, підтвердження отримання, PDF, надсилання. */
ROUTES.eqact = mid => {
  if (isVisitor()) return denied();
  const m = get('Переміщення', mid); if (!m) return notFound();
  const e = get('Обладнання', m.equipId) || {};
  const pj = v => arr(v);
  const sendKit = pj(m.sendKit), recvKit = pj(m.recvKit);
  const giver = get('Персонал', m.authorId) || {}, rcv = get('Персонал', m.receiverId) || {};
  const rcvName = rcv.pib || m.receiverName || '';
  const photos = all('ФотоОбладнання').filter(p => p.moveId === mid);
  const kitN = Math.max(sendKit.length, recvKit.length);
  const rowsK = Array.from({ length: kitN }, (_, i) => { const k = sendKit[i] || recvKit[i] || {}; return `<tr class="kit"><td>${i + 1}. ${esc(k.name)}</td><td>${esc(k.serial || '')}</td><td>${num(k.qty) || 1}</td><td>${esc((sendKit[i] || {}).condition || '')}</td><td>${m.recvAt ? esc((recvKit[i] || {}).condition || '') : ''}</td></tr>`; }).join('');
  let h = `<div class="card actdoc"><h2>АКТ № ${esc(m.actNo || '—')}<br><small>приймання-передачі обладнання</small></h2>
    ${kv([['Дата передачі', uaDate(m.date)], ['Передав', esc(giver.pib || '—') + (giver.posada ? `<br><span class="small mute">${esc(giver.posada)}</span>` : '')], ['Звідки', esc(holderName(m.fromType, m.fromId, m.fromName))],
      ['Отримав', esc(rcvName || '—') + (rcv.posada ? `<br><span class="small mute">${esc(rcv.posada)}</span>` : '')], ['Куди', esc(holderName(m.toType, m.toId, m.receiverName))], ['Статус', mvStatusBadge(m) || '—']])}
    <div class="tblwrap"><table class="tbl kittbl"><thead><tr><th>Найменування</th><th>Зав. №</th><th>К-сть</th><th>Стан при передачі</th><th>Стан при отриманні</th></tr></thead><tbody>
      <tr><td><b>${esc(e.name || '')}</b>${e.invNo ? `<br><small>інв. ${esc(e.invNo)}</small>` : ''}</td><td>${esc(e.serial || '')}</td><td>1</td><td>${esc(m.condition || '')}</td><td>${m.recvAt ? esc(m.recvCondition || '') : ''}</td></tr>${rowsK}</tbody></table></div>
    ${m.note ? `<p class="small">Примітка передавального: ${esc(m.note)}</p>` : ''}${m.recvAt && m.recvNote ? `<p class="small">Примітка отримувача: ${esc(m.recvNote)}</p>` : ''}
    <p class="small"><i>${m.recvAt ? `Отримання підтверджено ${esc(fmtDT(m.recvAt))} — ${esc(m.recvBy || rcvName)}` : 'Отримання ще не підтверджено.'}</i></p>
    ${photos.length ? `<p class="small"><b>Фотофіксація · ${photos.length}</b></p>${photoGrid(photos)}` : ''}
    <div class="row gap">${m.actFileId ? `<button type="button" class="btn small primary" data-act="actdl" data-id="${esc(mid)}">⬇ Акт PDF</button><a class="btn small ghost" href="#/eqdocmail/act/${esc(mid)}">✉ Надіслати акт</a>` : ''}<button type="button" class="btn small ghost" data-act="actgen" data-id="${esc(mid)}">📄 ${m.actFileId ? 'Оновити PDF' : 'Сформувати акт (PDF)'}</button><a class="btn small ghost" href="#/equipment/${esc(m.equipId)}">Картка обладнання ›</a></div></div>`;
  // підтвердження отримання: отримувач або керівник
  if (m.status === 'очікує' && (m.receiverId === ME.personId || isLead())) {
    const d = UI.draft['eqrecv:' + mid] || { recvCondition: m.condition || 'справне', recvNote: '' };
    const other = m.receiverId !== ME.personId;
    h += card(other ? 'Підтвердити отримання за отримувача' : 'Підтвердіть отримання', form('eqrecv', mid,
      (other ? `<p class="small warn">Ви підтверджуєте за ${esc(rcvName)}. Краще, щоб отримувач підтвердив сам у своєму порталі.</p>` : '<p class="small">Перевірте обладнання й комплект та вкажіть фактичний стан при отриманні.</p>') +
      fSel('Стан обладнання при отриманні', 'recvCondition', CONDITIONS, d.recvCondition, { req: true }) +
      (sendKit.length ? `<fieldset class="f"><legend>Комплект при отриманні</legend>${sendKit.map((k, i) => `<div class="kitchk"><span>${i + 1}. ${esc(k.name)}${num(k.qty) > 1 ? ' × ' + num(k.qty) : ''}${k.serial ? ' <small class="mute">зав. ' + esc(k.serial) + '</small>' : ''}</span>${fSel('', 'rk_' + i, KIT_COND, d['rk_' + i] || k.condition || 'справне')}</div>`).join('')}</fieldset>` : '') +
      fArea('Зауваження (пошкодження, некомплект)', 'recvNote', d.recvNote, { rows: 2 }) +
      `<label class="f"><span>📷 Фото стану при отриманні</span><input type="file" name="photos" accept="image/*" capture="environment" multiple></label>`,
      { submit: '✅ Підтверджую отримання' }));
  }
  return page('Акт № ' + (m.actNo || ''), h, '#/equipment/' + m.equipId);
};
FORMS.eqrecv = async (d, mid, f) => {
  const m = get('Переміщення', mid); if (!m) return toast('Передачу не знайдено');
  const e = get('Обладнання', m.equipId) || {};
  const recvKit = arr(m.sendKit).map((k, i) => ({ ...k, condition: d['rk_' + i] || k.condition || 'справне' }));
  const by = meShort() + (m.receiverId && m.receiverId !== ME.personId ? ' (за отримувача)' : '');
  const upd = { ...m, status: 'підтверджено', recvAt: Date.now(), recvBy: by, recvCondition: d.recvCondition, recvKit: JSON.stringify(recvKit), recvNote: d.recvNote || '', confirmOnly: true };
  await save('Переміщення', upd);
  const eu = { ...e, condition: d.recvCondition, ...(recvKit.length ? { kit: JSON.stringify(recvKit) } : {}) };
  if (isLead() || MODE === 'demo') await save('Обладнання', eu); else await applyLocal('Обладнання', eu);
  const files = [...((f && f.querySelector('input[name=photos]') || {}).files || [])];
  if (files.length) await addEqPhotos(files, { equipId: m.equipId, moveId: mid, stage: 'отримання' });
  delete UI.draft['eqrecv:' + mid]; UI.dirty = false;
  savedMsg('Отримання підтверджено');
  if (MODE === 'live' && navigator.onLine) setTimeout(() => genActNow(mid, true), 4000);
  render();
};
ACTS.actgen = async d => {
  if (MODE === 'demo') return ask('ДЕМО: у робочій версії сервер сформує акт у PDF (з комплектом, станом і фото) і збереже його на Google Диску в папці «Акти передачі обладнання / рік-місяць». Тут показано його зміст.', 'Зрозуміло', 'Закрити');
  if (!navigator.onLine) return toast('Потрібен інтернет');
  toast('Формую акт…'); await genActNow(d.id, false);
};
ACTS.actdl = async d => {
  try { toast('Готую файл…'); const f = await getActFile(get('Переміщення', d.id)); const r = await saveFile(f.name || 'Акт.pdf', fileToBlob(f)); toast(r === 'declined' ? 'Збереження скасовано' : 'Акт завантажено'); } catch (e) { toast(e.message); }
};
// ── фотофіксація стану обладнання
async function addEqPhotos(files, o) {
  let n = 0;
  for (const file of files) {
    const row = await save('ФотоОбладнання', { equipId: o.equipId, moveId: o.moveId || '', stage: o.stage || 'огляд', date: today(), note: o.note || '', authorId: ME.personId || '' });
    await queueRowFile('ФотоОбладнання', row.id, file); n++;
  }
  return n;
}
const photoGrid = list => `<div class="phgrid">${list.map(p => `<figure><img class="eqph" data-ph="${esc(p.id)}" alt="фото" data-act="phview" data-id="${esc(p.id)}"><figcaption>${esc(p.stage || 'огляд')} · ${uaDate(p.date)}${p.authorId ? ' · ' + esc(shortName(personName(p.authorId))) : ''}</figcaption></figure>`).join('')}</div>`;
function eqPhotoCard(e) {
  const list = all('ФотоОбладнання').filter(p => p.equipId === e.id).sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.updatedAt || 0) - (a.updatedAt || 0));
  return card('Фотофіксація стану' + (list.length ? ' · ' + list.length : ''), (list.length ? photoGrid(list.slice(0, UI.phlimit || 12)) + (list.length > (UI.phlimit || 12) ? `<button class="btn ghost small" data-act="phmore">Показати ще</button>` : '') : '<p class="small mute">Фото ще немає.</p>') +
    (canReport() ? `<label class="btn small primary upl">📷 Додати фото стану<input type="file" accept="image/*" capture="environment" multiple data-eqphoto="${esc(e.id)}" data-stage="огляд"></label>` : '') +
    `<p class="small mute">Фото зберігаються на Google Диску в папці «Фото обладнання / ${esc(e.name || '')}${e.invNo ? ' інв. ' + esc(e.invNo) : ''}». Фото з передач — також в акті.</p>`);
}
ACTS.phmore = () => { UI.phlimit = (UI.phlimit || 12) + 12; render(); };
const PHCACHE = new Map();
function loadEqPhotos() {
  document.querySelectorAll('img.eqph:not([src])').forEach(async img => {
    const id = img.dataset.ph; if (PHCACHE.has(id)) { img.src = PHCACHE.get(id); return; }
    const p = get('ФотоОбладнання', id); if (!p) return;
    try { const f = await getRowFile('ФотоОбладнання', p); const url = 'data:' + f.mime + ';base64,' + f.data; PHCACHE.set(id, url); img.src = url; }
    catch (e) { img.alt = DB.upTasks.has(id) ? '⏳ відправляється' : 'фото недоступне'; img.classList.add('phmiss'); }
  });
}
ACTS.phview = d => {
  const url = PHCACHE.get(d.id); if (!url) return;
  const p = get('ФотоОбладнання', d.id) || {};
  const ov = document.createElement('div'); ov.className = 'phov';
  ov.innerHTML = `<img src="${url}" alt="фото"><p>${esc(p.stage || '')} · ${uaDate(p.date)}${p.note ? ' · ' + esc(p.note) : ''}</p><button type="button" class="btn">Закрити</button>`;
  ov.onclick = () => ov.remove(); document.body.appendChild(ov);
};
// ── паспорт обладнання
function passFileBlock(e) {
  const pend = DB.upTasks.has('pass:' + e.id);
  const has = !!(e.passFile || e.passFileId) || pend;
  const off = String(e.passFile || '').startsWith('data:') || DB.cachedFiles.has(e.passFileId) || DB.cachedFiles.has('local-pass-' + e.id);
  return `${e.passFileName ? `<p class="small ordername">📘 ${esc(e.passFileName)}${off ? ' <span class="ok">✓ офлайн</span>' : ''}</p>` : '<p class="small mute">Паспорт не додано.</p>'}
    <div class="row gap order">${has && !pend ? `<button type="button" class="btn small primary" data-act="passdl" data-id="${esc(e.id)}">⬇ Завантажити</button><a class="btn small ghost" href="#/eqdocmail/pass/${esc(e.id)}">✉ Надіслати</a>${navigator.canShare ? `<button type="button" class="btn small ghost" data-act="passshare" data-id="${esc(e.id)}">↗ Поділитися</button>` : ''}` : ''}
    ${pend ? badge('⏳ відправляється', 'warn') : ''}
    ${isLead() ? `<label class="btn small ${has ? 'ghost' : 'primary'} upl">${has ? 'Замінити файл' : '⬆ Додати паспорт (PDF / фото)'}<input type="file" accept="application/pdf,image/*" data-passup="${esc(e.id)}"></label>` : ''}</div>
    <p class="small mute">Зберігається на Google Диску в папці «Паспорти обладнання / ${esc(e.name || '')}${e.invNo ? ' інв. ' + esc(e.invNo) : ''}».</p>`;
}
ACTS.passdl = async d => {
  try { toast('Готую файл…'); const f = await getPassFile(get('Обладнання', d.id)); const r = await saveFile(f.name || 'Паспорт.pdf', fileToBlob(f)); toast(r === 'declined' ? 'Збереження скасовано' : 'Паспорт завантажено'); render(); } catch (e) { toast(e.message); }
};
ACTS.passshare = async d => {
  try {
    const f = await getPassFile(get('Обладнання', d.id));
    const file = new File([fileToBlob(f)], f.name || 'Паспорт', { type: f.mime });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) return toast('Цей пристрій не підтримує надсилання файлів — скористайтеся «Завантажити»');
    await navigator.share({ files: [file], title: f.name });
  } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
};
// ── надсилання документів обладнання: свідоцтво (calib), паспорт (pass), акт (act)
const EQDOC = { calib: 'Свідоцтво про калібрування', pass: 'Паспорт обладнання', act: 'Акт приймання-передачі' };
ROUTES.eqdocmail = (kind, id) => {
  if (isVisitor() || !EQDOC[kind]) return denied();
  const m = kind === 'act' ? get('Переміщення', id) : null;
  const e = get('Обладнання', m ? m.equipId : id); if (!e) return notFound();
  const fname = kind === 'act' ? (m.actName || '') : kind === 'pass' ? e.passFileName : e.fileName;
  const me = get('Персонал', ME.personId) || {};
  let h = card(EQDOC[kind], kv([['Обладнання', esc(e.name) + (e.invNo ? ' · інв. ' + esc(e.invNo) : '')], ...(kind === 'calib' ? [['№ свідоцтва', esc(e.calibCert || '—')], ['Дійсне до', e.calibTo ? uaDate(e.calibTo) : '—']] : []), ...(m ? [['Акт', '№ ' + esc(m.actNo || '') + ' від ' + uaDate(m.date)]] : []), ['Файл', esc(fname || '—')]]));
  h += card('Надіслати', form('eqdocmail', kind + '|' + id, emailField('Email, на який надіслати', (UI.draft['eqdocmail:' + kind + '|' + id] || {}).email || me.email || ME.email || '') + '<p class="small mute">Файл буде надіслано вкладенням.</p>', { submit: '✉ Надіслати' }));
  return page('Надіслати документ', h, m ? '#/eqact/' + id : '#/equipment/' + id);
};
ROUTES.calibmail = id => ROUTES.eqdocmail('calib', id);
FORMS.eqdocmail = async (d, key) => {
  const [kind, id] = key.split('|');
  const email = normEmails(d.email);
  if (!email) return toast('Вкажіть коректний email (кілька адрес — через кому)');
  const back = kind === 'act' ? '#/eqact/' + id : '#/equipment/' + id;
  if (MODE === 'demo') { UI.dirty = false; await ask(`ДЕМО: у робочій версії «${EQDOC[kind]}» буде надіслано на ${email} вкладенням.`, 'Зрозуміло', 'Закрити'); return go(back); }
  if (!navigator.onLine) return toast('Потрібен інтернет');
  toast('Надсилаю…');
  const r = await api({ action: 'maileqdoc', kind, id, email }, 120000).catch(x => ({ ok: false, error: x.message }));
  if (!r.ok) return toast('Не надіслано: ' + (r.error === 'Невідома дія' ? 'оновіть серверну частину порталу' : r.error));
  UI.dirty = false; savedMsg(EQDOC[kind] + ' надіслано на ' + r.to); go(back);
};

// ═════════ КОМПЛЕКТАЦІЯ АВТО ═════════
/** Позиції комплектації автомобіля: [ключ, назва, норма, од., регулярка для обліку обладнання в авто]. */
const KIT_POS = [
  ['gen', 'Електростанція', 1, 'шт'],
  ['xr325', 'Рентгенапарат (до Ø325 мм)', 1, 'шт', /рентген|арина|рпд|eresco|балтоспот|baltospot|cp ?160|ср ?160/i],
  ['xr325p', 'Рентгенапарат (більше Ø325 мм)', 1, 'шт', null],
  ['dos', 'Дозиметр', 1, 'шт', /дозиметр|радіометр|мкс|дкс/i],
  ['vok', 'Набір ВОК', 1, 'компл.', /\bвок\b|візуально-оптичн|vt-1|новотест/i],
  ['thm', 'Товщиномір металу', 1, 'шт', /товщиномір.*(метал|ультразв)|ультразвуков.*товщиномір/i],
  ['thc', 'Товщиномір (покриттів)', 1, 'шт', /товщиномір.*(покрит|ізоляц|фарб)/i],
  ['ut', 'Ультразвуковий дефектоскоп', 1, 'шт', /дефектоскоп.*(ультразв|уз)|sonocon|уд2|уд4/i],
  ['c1020', 'Касети 10×20 см', 10, 'шт', /касет.*10\s*[хx×]\s*20/i],
  ['c1030', 'Касети 10×30 см', 10, 'шт', /касет.*10\s*[хx×]\s*30/i],
  ['c1040', 'Касети 10×40 см', 10, 'шт', /касет.*10\s*[хx×]\s*40/i],
  ['c3040', 'Касети 30×40 см', 2, 'шт', /касет.*30\s*[хx×]\s*40/i],
  ['belt', 'Мірний пояс', 1, 'шт', /мірн.*пояс/i],
  ['iqi', 'Дефектометри', 1, 'компл.', /дефектометр|еталон.*чутлив/i],
  ['dens', 'Денситометр', 1, 'шт', /денситометр/i],
  ['neg', 'Негатоскоп', 1, 'шт', /негатоскоп/i],
  ['lamp', 'Неактинічний ліхтар', 1, 'шт', /неактині|ліхтар.*червон/i],
  ['tank', 'Ванночки для обробки плівки', 3, 'шт', /ванночк/i],
  ['film', 'Рентгенплівка', 1, 'уп.', null],
  ['chem', 'Реактиви (проявник, фіксаж)', 1, 'компл.', null],
  ['pt', 'Кольорова дефектоскопія (набір PT)', 1, 'компл.', null],
  ['sign', 'Знаки «Радіаційно небезпечна зона»', 1, 'компл.', /знак.*радіац/i]
];
/** Витратні матеріали та дрібне приладдя — вносяться кількістю вручну, у потребу обладнання не потрапляють. */
const KIT_CONS = ['c1020', 'c1030', 'c1040', 'c3040', 'tank', 'film', 'chem', 'pt', 'sign'];
const kitJson = k => { try { return JSON.parse(setting(k, '{}')) || {}; } catch (e) { return {}; } };
const kitNorm = () => { const n = kitJson('kitnorm'); return Object.fromEntries(KIT_POS.map(p => [p[0], n[p[0]] !== undefined && n[p[0]] !== '' ? num(n[p[0]]) : p[2]])); };
/** Позиція комплектації для одиниці обладнання: явне призначення керівником, інакше — за назвою. */
function kitPosOf(e) {
  const m = kitJson('kitmap')[e.id];
  if (m !== undefined) return m;
  const p = KIT_POS.find(x => x[4] && x[4].test(String(e.name || '') + ' ' + String(e.note || '')));
  return p ? p[0] : '';
}
const eqUsable = e => !['списано', 'несправне'].includes(e.condition);
/** Обладнання в авто за позиціями. */
function kitEquip(car) {
  const out = {}; KIT_POS.forEach(p => (out[p[0]] = []));
  const map = kitJson('kitmap'), norm = kitNorm();
  all('Обладнання').filter(e => e.holderType === 'авто' && e.holderId === car.id && e.condition !== 'списано').forEach(e => {
    let k = kitPosOf(e);
    // другий рентгенапарат без явного призначення — у позицію «більше Ø325»
    if (k === 'xr325' && map[e.id] === undefined && out.xr325.length >= norm.xr325) k = 'xr325p';
    if (k && out[k]) out[k].push(e);
  });
  return out;
}
function kitAuto(car) {
  const eq = kitEquip(car), out = {};
  KIT_POS.forEach(p => (out[p[0]] = eq[p[0]].length));
  out.gen += all('Генератори').filter(g => g.carId === car.id).length;
  return out;
}
/** Фактична комплектація: обладнання в авто (за обліком і передачами); якщо його немає — внесене вручну (витратні матеріали). */
function kitHave(car) {
  const man = kitJson('carkit:' + car.id), auto = kitAuto(car);
  return Object.fromEntries(KIT_POS.map(p => [p[0], auto[p[0]] > 0 || man[p[0]] === undefined || man[p[0]] === '' ? { v: num(auto[p[0]]), src: 'a' } : { v: num(man[p[0]]), src: 'm' }]));
}
/** Нестача по авто: позиції, де є менше норми; кандидати зі складу; де ще є (у працівників, в інших авто). */
function kitGaps(car) {
  const norm = kitNorm(), hv = kitHave(car);
  const free = all('Обладнання').filter(e => (!e.holderType || e.holderType === 'склад') && eqUsable(e) && !eqPending(e.id));
  return KIT_POS.filter(p => norm[p[0]] > hv[p[0]].v).map(p => {
    const k = p[0], lack = norm[k] - hv[k].v;
    const stock = free.filter(e => kitPosOf(e) === k || (k === 'xr325p' && kitPosOf(e) === 'xr325' && kitJson('kitmap')[e.id] === undefined));
    const elsewhere = all('Обладнання').filter(e => e.holderType === 'працівник' && kitPosOf(e) === k);
    return { p, k, lack, stock, elsewhere };
  });
}
/** Потреба: чого бракує в авто і немає на складі. */
function kitNeeds() {
  const out = [];
  for (const c of all('Авто')) kitGaps(c).forEach(g => { const n = g.lack - g.stock.length; if (n > 0 && !KIT_CONS.includes(g.k)) out.push({ car: c, p: g.p, n }); });
  return out;
}
async function saveSetting(key, value) {
  const r = all('Налаштування').find(x => x.key === key);
  await save('Налаштування', { ...(r || {}), key, value });
}
ROUTES.kit = () => {
  if (isVisitor()) return denied();
  const cars = all('Авто');
  if (!cars.length) return page('Комплектація авто', empty('Автомобілі не додані'), '#/equip');
  const norm = kitNorm(), need = KIT_POS.filter(p => norm[p[0]] > 0);
  const c = cars.find(x => x.id === UI.kcar) || cars[0];
  let h = seg('kcar', cars.map(x => { const hv = kitHave(x); const ok = need.filter(p => hv[p[0]].v >= norm[p[0]]).length; return [x.id, esc(x.name) + (x.plate ? ' · ' + esc(x.plate) : '') + ` <small>${ok}/${need.length}</small>`]; }), c.id).replace('class="seg"', 'class="seg wrap"');
  if (isLead()) h += `<div class="row gap"><a class="btn ghost small" href="#/kitnorm">⚙ Норма</a><a class="btn ghost small" href="#/kitcar/${esc(c.id)}">✎ Витратні матеріали</a></div>`;
  const hv = kitHave(c), eq = kitEquip(c), gens = all('Генератори').filter(g => g.carId === c.id);
  const ok = need.filter(p => hv[p[0]].v >= norm[p[0]]).length;
  const rows = KIT_POS.map(p => {
    const k = p[0], x = hv[k], n = norm[k], full = !n || x.v >= n;
    const items = (k === 'gen' ? gens.map(g => `<li>⚡ ${esc(g.name)}${g.invNo ? ' · інв. ' + esc(g.invNo) : ''}</li>`) : []).concat(eq[k].map(e => `<li><a href="#/equipment/${esc(e.id)}">${esc(e.name)}</a>${e.invNo ? ' · інв. ' + esc(e.invNo) : ''}${e.condition && e.condition !== 'справне' ? ' ' + badge(esc(e.condition), 'warn') : ''}${isLead() ? ` <a class="mute" href="#/kitmap/${esc(e.id)}" title="Змінити позицію">↔</a>` : ''}</li>`));
    return `<div class="kitrow${full ? '' : ' miss'}"><div class="row between"><span>${full ? (n ? '<span class="ok">✓</span>' : '<span class="mute">—</span>') : '<span class="bad">✗</span>'} <b>${esc(p[1])}</b></span><span class="small">${fmtN(x.v)}${n ? ' / ' + fmtN(n) : ''} ${p[3]}${x.src === 'm' ? ' ✎' : ''}</span></div>${items.length ? `<ul class="plain small">${items.join('')}</ul>` : ''}</div>`;
  }).join('');
  h += card('🚐 ' + esc(c.name) + (c.plate ? ' · ' + esc(c.plate) : ''), `<p class="small">Укомплектовано: <b>${ok} з ${need.length}</b> позицій</p>${bar(need.length ? ok / need.length * 100 : 0)}${rows}
    <p class="small mute">Позиції заповнюються обладнанням, що числиться в авто після передач (акти переміщення); ✎ — внесено вручну (витратні матеріали). ↔ — віднести обладнання до іншої позиції.</p>`);
  const gaps = kitGaps(c);
  if (gaps.length) h += card('Доукомплектування зі складу', gaps.map(g => `<div class="item"><div class="row between"><b>${esc(g.p[1])}</b>${badge('бракує ' + fmtN(g.lack) + ' ' + g.p[3], 'warn')}</div>` +
    (g.stock.length ? g.stock.slice(0, Math.max(g.lack, 3)).map(e => `<div class="row between small"><span>📦 ${esc(e.name)}${e.invNo ? ' · інв. ' + esc(e.invNo) : ''}${e.condition !== 'справне' ? ' · ' + esc(e.condition) : ''}</span>${canReport() ? `<button type="button" class="btn small primary" data-act="kitsug" data-id="${esc(e.id)}" data-car="${esc(c.id)}" data-k="${g.k}">Передати в авто</button>` : ''}</div>`).join('')
      : KIT_CONS.includes(g.k) ? `<span class="small mute">Витратні матеріали — після поповнення внесіть кількість (✎ Витратні матеріали)${g.stock.length ? '' : ''}</span>` : `<span class="small bad">На складі немає — потреба${g.elsewhere.length ? '; є у працівників: ' + g.elsewhere.map(e => esc(e.name) + ' (' + esc(shortName(personName(e.holderId) || e.holderName || '')) + ')').join(', ') : ''}</span>`) + '</div>').join('') +
    '<p class="small mute">«Передати в авто» відкриває передачу обладнання зі складу з актом і фото — як звичайне переміщення.</p>');
  const needs = kitNeeds();
  if (needs.length) h += card('⚠ Потреба в обладнанні (немає на складі)', `<ul class="plain small">${needs.map(x => `<li><b>${esc(x.p[1])}</b> — ${fmtN(x.n)} ${x.p[3]} · ${esc(x.car.name)}</li>`).join('')}</ul>` +
    `<p class="small"><b>Разом:</b> ${Object.values(needs.reduce((m, x) => { (m[x.p[0]] = m[x.p[0]] || { t: x.p[1], u: x.p[3], n: 0 }).n += x.n; return m; }, {})).map(v => esc(v.t) + ' — ' + fmtN(v.n) + ' ' + v.u).join('; ')}</p>` +
    (navigator.share || navigator.clipboard ? `<button type="button" class="btn ghost small" data-act="kitneedcopy">📋 Скопіювати потребу</button>` : ''));
  const req = all('Комплектація');
  if (req.length) h += card('Додатково: норми за методами НК', `<details><summary class="small">Позиції за методами (${req.length})</summary><ul class="plain small">${req.map(r => `<li>${esc(normM(r.method))} · ${esc(r.item)} — ${num(r.qty) || 1}${isLead() ? ` <a href="#" data-act="del" data-t="Комплектація" data-id="${esc(r.id)}" data-back="#/kit">×</a>` : ''}</li>`).join('')}</ul></details>`);
  return page('Комплектація авто', h, '#/equip');
};
ACTS.kitsug = async d => {
  const e = get('Обладнання', d.id); if (!e) return;
  if (isLead() && kitPosOf(e) !== d.k) { const m = kitJson('kitmap'); m[e.id] = d.k; await saveSetting('kitmap', JSON.stringify(m)); }
  const pos = (KIT_POS.find(p => p[0] === d.k) || [])[1] || '';
  UI.draft['move:' + e.id] = { place: 'авто:' + d.car, toPerson: '', otherName: '', date: today(), condition: e.condition || 'справне', note: 'Доукомплектування авто: ' + pos };
  go('#/moveform/' + e.id);
};
ACTS.kitneedcopy = async () => {
  const t = 'Потреба в обладнанні для комплектації автомобілів (' + uaDate(today()) + '):\n' + kitNeeds().map(x => `— ${x.p[1]}: ${fmtN(x.n)} ${x.p[3]} (${x.car.name}${x.car.plate ? ', ' + x.car.plate : ''})`).join('\n');
  try { if (navigator.share) await navigator.share({ title: 'Потреба в обладнанні', text: t }); else { await navigator.clipboard.writeText(t); toast('Скопійовано'); } } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
};
ROUTES.kitmap = id => {
  if (!isLead()) return denied();
  const e = get('Обладнання', id); if (!e) return notFound();
  const body = `<div class="note">${esc(e.name)} · інв. ${esc(e.invNo || '—')}</div>` + fSel('Позиція комплектації авто', 'pos', [['', '— не входить до комплектації —'], ...KIT_POS.map(p => [p[0], p[1]])], kitPosOf(e));
  return page('Позиція комплектації', form('kitmap', id, body), '#/kit');
};
FORMS.kitmap = async (d, id) => {
  const m = kitJson('kitmap'); m[id] = d.pos || ''; await saveSetting('kitmap', JSON.stringify(m)); UI.dirty = false; savedMsg('Збережено'); go('#/kit');
};
ROUTES.kitcar = id => {
  if (!isLead()) return denied();
  const c = get('Авто', id); if (!c) return notFound();
  const hv = kitHave(c), auto = kitAuto(c), norm = kitNorm();
  const body = `<p class="small mute">Для позицій, яких немає в обліку обладнання (касети, плівка, реактиви, знаки, ванночки тощо), вкажіть кількість. Якщо обладнання позиції числиться в авто — береться облік.</p>` +
    KIT_POS.map(p => fNum(p[1] + ', ' + p[3], 'k_' + p[0], hv[p[0]].src === 'm' ? hv[p[0]].v : '', { hint: `норма ${fmtN(norm[p[0]])} · за обліком ${fmtN(num(auto[p[0]]))}` })).join('');
  return page('Комплектація · ' + c.name, form('kitcar', id, body), '#/kit');
};
FORMS.kitcar = async (d, id) => {
  const v = {}; KIT_POS.forEach(p => { const x = d['k_' + p[0]]; if (x !== undefined && String(x).trim() !== '') v[p[0]] = num(x); });
  await saveSetting('carkit:' + id, JSON.stringify(v)); UI.dirty = false; savedMsg('Комплектацію збережено'); go('#/kit');
};
ROUTES.kitnorm = () => {
  if (!isLead()) return denied();
  const norm = kitNorm();
  const body = `<p class="small mute">Норма на один автомобіль. 0 — позиція не обовʼязкова.</p>` + KIT_POS.map(p => fNum(p[1] + ', ' + p[3], 'n_' + p[0], norm[p[0]])).join('');
  return page('Норма комплектації', form('kitnorm', 'n', body), '#/kit');
};
FORMS.kitnorm = async d => {
  const v = {}; KIT_POS.forEach(p => { const x = d['n_' + p[0]]; if (x !== undefined && String(x).trim() !== '') v[p[0]] = num(x); });
  await saveSetting('kitnorm', JSON.stringify(v)); UI.dirty = false; savedMsg('Норму збережено'); go('#/kit');
};
FORMS.kit = async d => {
  if (!need(d, [['item', 'найменування']])) return;
  await save('Комплектація', d); UI.dirty = false; savedMsg('Додано'); render();
};

// ═════════ ДОКУМЕНТИ: «Інструкції» (ОП, робочі, посадові, положення) і «НД» (загальна, по методах, ДДК) ═════════
const docReadable = d => !!(String(d.text || '').trim() || d.file || d.fileId);
/** Помітна «плитка» файлу документа: тип (PDF / Word / Excel / фото), назва, «Відкрити». */
function docFileTile(d, big) {
  const pend = DB.upTasks.has(d.id);
  if (!(d.file || d.fileId || pend)) return '';
  const n = d.fileName || 'Файл документа';
  const ext = (String(n).match(/\.([a-z0-9]{2,5})$/i) || [, ''])[1].toLowerCase();
  const t = ext === 'pdf' ? ['PDF', 'pdf'] : /^docx?$/.test(ext) ? ['DOC', 'doc'] : /^xlsx?$/.test(ext) ? ['XLS', 'xls'] : /^(jpe?g|png|webp|heic)$/.test(ext) ? ['ФОТО', 'img'] : ['ФАЙЛ', 'oth'];
  const off = String(d.file || '').startsWith('data:') || DB.cachedFiles.has(d.fileId) || DB.cachedFiles.has('local-' + d.id);
  return `<button type="button" class="filetile${big ? ' big' : ''}" data-act="docfile" data-id="${esc(d.id)}"${pend ? ' disabled' : ''}>
    <span class="ft-ic ft-${t[1]}">${t[0]}</span><span class="ft-body"><b>${esc(n.replace(/\.[a-z0-9]{2,5}$/i, ''))}</b><small>${pend ? '⏳ файл ще відправляється' : (ext ? ext.toUpperCase() + ' · ' : '') + (off ? 'збережено на телефоні · ' : '') + 'натисніть, щоб відкрити'}</small></span><span class="ft-go">Відкрити ›</span></button>`;
}
/** Останній пройдений інструктаж, до якого прикріплено інструкцію з ОП. */
function ohsBrief(docId, pid) {
  return all('Інструктажі').filter(b => !isAcq(b) && arr(b.docIds).includes(docId)).map(b => ({ b, p: briefPass(b.id, pid) })).filter(x => x.p).sort((x, y) => num(y.p.ts) - num(x.p.ts))[0] || null;
}
function docItem(d) {
  if (isOHS(d)) return docItemOHS(d);
  const a = ME.personId ? ackOf(d.id, ME.personId) : null;
  const rd = docReadable(d);
  return `<div class="item"><div class="row between">${rd ? `<a href="#/doc/${esc(d.id)}"><b>${esc(d.title)}</b></a>` : `<b>${esc(d.title)}</b>`}${needAck(d) ? badge('обовʼязкове ознайомлення') : ''}</div>
    <span class="small mute">${isND(d) ? esc(d.kind) + (d.version || d.date ? ' · ' : '') : ''}${d.version ? 'ред. ' + esc(d.version) : ''}${d.date ? ' від ' + uaDate(d.date) : ''}${String(d.text || '').trim() ? ' · текст у порталі' : ''}</span>
    ${docFileTile(d)}
    <div class="row gap">${rd ? `<a class="btn small ${a || !ME.personId ? 'ghost' : 'primary'}" href="#/doc/${esc(d.id)}">📖 ${a || !ME.personId ? 'Читати' : 'Читати й ознайомитися'}</a>` : ''}${d.link ? `<a class="btn small ghost" href="${esc(d.link)}" target="_blank" rel="noopener">Відкрити ↗</a>` : ''}${docSendBtns(d)}
    ${ME.personId ? (a ? badge('✓ ознайомлений ' + uaDate(a.date), 'ok') : rd ? '' : `<button class="btn small primary" data-act="ack" data-id="${esc(d.id)}">Ознайомлений</button>`) : ''}
    ${isLead() ? `<a class="btn small ghost" href="#/docform/${esc(d.id)}">Змінити</a>` : ''}</div></div>`;
}
function docItemOHS(d) {
  const rd = docReadable(d), x = ME.personId ? ohsBrief(d.id, ME.personId) : null;
  return `<div class="item"><div class="row between">${rd ? `<a href="#/doc/${esc(d.id)}"><b>${esc(d.title)}</b></a>` : `<b>${esc(d.title)}</b>`}${badge('через інструктаж')}</div>
    <span class="small mute">${d.version ? 'ред. ' + esc(d.version) : ''}${d.date ? ' від ' + uaDate(d.date) : ''}${String(d.text || '').trim() ? ' · текст у порталі' : ''}</span>
    ${docFileTile(d)}
    <div class="row gap">${rd ? `<a class="btn small ghost" href="#/doc/${esc(d.id)}">📖 Читати</a>` : ''}${d.link ? `<a class="btn small ghost" href="${esc(d.link)}" target="_blank" rel="noopener">Відкрити ↗</a>` : ''}${docSendBtns(d)}
    ${x ? badge('✓ інструктаж ' + uaDate(x.p.date), 'ok') : ''}
    ${isLead() ? `<a class="btn small ghost" href="#/docform/${esc(d.id)}">Змінити</a>` : ''}</div></div>`;
}
const byTitle = (a, b) => String(a.title).localeCompare(String(b.title), 'uk');
ROUTES.docs = () => {
  if (isVisitor()) return denied();
  const docs = all('Документи').filter(d => !isND(d));
  const LBL = ['Охорона праці', 'Робочі', 'Посадові', 'Положення', 'ДІВ'];
  const TTL = ['Інструкції з охорони праці', 'Робочі інструкції', 'Посадові інструкції', 'Положення про лабораторію', 'Інструкції ДІВ'];
  const f = INSTR_KINDS.includes(UI.dkg) ? UI.dkg : 'all', fi = INSTR_KINDS.indexOf(f);
  const cnt = k => docs.filter(d => d.kind === k).length;
  let h = seg('dkg', [['all', 'Усі'], ...INSTR_KINDS.map((k, i) => [k, LBL[i] + (cnt(k) ? ' ' + cnt(k) : '')])], f).replace('class="seg"', 'class="seg wrap"');
  if (isLead()) h += `<div class="row gap"><a class="btn ghost" href="#/acq">📋 Ознайомлення з документами</a><a class="btn ghost" href="#/ackmatrix">Журнал ознайомлення</a><a class="btn ghost" href="#/brief">🎓 Інструктажі (ОП)</a></div>` + fab('#/docform/new' + (fi >= 0 ? '/k' + fi : ''));
  h += `<p class="small mute">Робочі, посадові інструкції, положення та інструкції ДІВ — ознайомлення онлайн після прочитання. Інструкції з охорони праці — через інструктажі (журнал реєстрації інструктажів).</p>`;
  let any = false;
  INSTR_KINDS.forEach((k, i) => {
    if (f !== 'all' && f !== k) return;
    const ds = docs.filter(d => d.kind === k).sort(byTitle);
    if (!ds.length && f === 'all') return;
    any = true;
    h += card(TTL[i], ds.length ? ds.map(docItem).join('') : empty('Документів немає'));
  });
  if (!any) h += empty('Інструкції ще не додані');
  h += `<p class="small mute">Нормативні документи та методики контролю — у розділі <a href="#/nd">НД</a>.</p>`;
  return page('Інструкції', h, '#/menu');
};
ROUTES.nd = () => {
  if (isVisitor()) return denied();
  const docs = all('Документи').filter(isND);
  const f = UI.ndg || 'all';
  const cnt = g => docs.filter(d => ndGroupOf(d) === g).length;
  let h = seg('ndg', [['all', 'Усі'], ...ND_GROUPS.map(g => [g, (g === 'Загальна НД' ? 'Загальна' : g) + (cnt(g) ? ' ' + cnt(g) : '')])], f).replace('class="seg"', 'class="seg wrap"');
  if (isLead()) h += `<div class="row gap"><a class="btn ghost" href="#/ackmatrix/nd">Журнал ознайомлення</a></div>` + fab('#/docform/new/nd');
  let any = false;
  for (const g of ND_GROUPS) {
    if (f !== 'all' && f !== g) continue;
    const ds = docs.filter(d => ndGroupOf(d) === g).sort((a, b) => String(a.kind).localeCompare(String(b.kind), 'uk') || byTitle(a, b));
    if (!ds.length && f === 'all') continue;
    any = true;
    h += card(g === 'Загальна НД' ? 'Загальна НД' : g === 'ДДК' ? 'ДДК — додатковий дефектоскопічний контроль' : 'Метод ' + g, ds.length ? ds.map(docItem).join('') : empty('Документів немає'));
  }
  if (!any) h += empty('НД ще не додані');
  return page('НД', h, '#/menu');
};
// ───────── читання тексту інструкції / НД у порталі ─────────
/** Простий текст → HTML: рядок «# …» — заголовок, порожній рядок — новий абзац, «1.», «–», «•» — пункти. */
function docTextHtml(t) {
  return String(t || '').replace(/\r/g, '').split(/\n\s*\n/).map(b => {
    const lines = b.split('\n');
    return lines.map(l => /^#{1,3}\s+/.test(l) ? `<h3>${esc(l.replace(/^#{1,3}\s+/, ''))}</h3>` : `<p class="${/^\s*(\d+(\.\d+)*[.)]|[–\-•])\s/.test(l) ? 'li' : ''}">${esc(l)}</p>`).join('');
  }).join('<div class="gap"></div>');
}
ROUTES.doc = id => {
  const d = get('Документи', id);
  if (!d || isVisitor()) return notFound();
  const a = ME.personId ? ackOf(d.id, ME.personId) : null;
  const fs = UI.docfs || 16;
  const hasText = !!String(d.text || '').trim(), hasFile = !!(d.file || d.fileId || DB.upTasks.has(d.id));
  let h = `<div class="objhead"><h2>${esc(d.title)}</h2><p>${esc(d.kind)}${isND(d) ? ' · ' + esc(ndGroupOf(d)) : ''}${d.version ? ' · ред. ' + esc(d.version) : ''}${d.date ? ' від ' + uaDate(d.date) : ''}</p></div>`;
  h += `<div class="row gap docbar">${hasText ? `<button class="btn small ghost" data-act="docfs" data-v="-1" aria-label="Менший шрифт">A−</button><button class="btn small ghost" data-act="docfs" data-v="1" aria-label="Більший шрифт">A+</button>` : ''}
    ${d.link ? `<a class="btn small ghost" href="${esc(d.link)}" target="_blank" rel="noopener">Google Диск ↗</a>` : ''}${docSendBtns(d)}${isLead() ? `<a class="btn small ghost" href="#/docform/${esc(d.id)}">Змінити</a>` : ''}</div>`;
  if (hasFile) h += docFileTile(d, true);
  h += hasText ? `<article class="doctext" style="font-size:${fs}px">${docTextHtml(d.text)}</article><div id="docend" class="small mute center">— кінець документа —</div>` : (hasFile ? '' : `<div class="card"><p class="mute">Текст документа не внесено${d.link ? ' — відкрийте посилання' : ''}.</p></div>`);
  if (isOHS(d)) {
    const x = ME.personId ? ohsBrief(d.id, ME.personId) : null;
    h += card('', `<p class="center">${x ? `<b class="ok">✓ Інструктаж пройдено ${uaDate(x.p.date)}</b> · <a href="#/briefing/${esc(x.b.id)}">${esc(x.b.title)}</a>` : 'Ознайомлення з інструкціями з охорони праці фіксується під час інструктажу.'}</p><div class="row gap center"><a class="btn ghost" href="#/brief">🎓 Інструктажі</a></div>`);
  } else if (ME.personId) {
    h += a ? card('', `<p class="ok center"><b>✓ Ви ознайомились ${uaDate(a.date)}</b></p>`)
      : card('', `<button class="btn primary wide" id="docack" data-act="ack" data-id="${esc(d.id)}" ${hasText ? 'disabled' : hasFile ? 'disabled' : ''}>Ознайомлений(-а) з документом</button>
        <p class="small mute center" id="dochint">${hasText ? 'Кнопка стане активною, коли ви дочитаєте текст до кінця.' : hasFile ? 'Кнопка стане активною після відкриття файлу документа.' : ''}</p>`);
  }
  if (isLead() && needAck(d)) {
    const ppl = staff().filter(p => p.role !== 'відвідувач');
    const okN = ppl.filter(p => ackOf(d.id, p.id)).length;
    h += card(`Ознайомлення · ${okN}/${ppl.length}`, bar(ppl.length ? okN / ppl.length * 100 : 0) + `<ul class="plain small">${ppl.map(p => { const x = ackOf(d.id, p.id); return `<li>${x ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'} ${esc(shortName(p.pib))}${x ? ' <span class="mute">· ' + uaDate(x.date) + '</span>' : ''}</li>`; }).join('')}</ul>`);
  }
  if (hasText && !a && ME.personId && !isOHS(d)) setTimeout(docReaderWatch, 0);
  return page(isND(d) ? 'НД' : 'Інструкція', h, isND(d) ? '#/nd' : '#/docs');
};
function docReaderWatch() {
  const end = $('#docend'), btn = $('#docack');
  if (!end || !btn) return;
  const on = () => { btn.disabled = false; const hn = $('#dochint'); if (hn) hn.textContent = 'Текст прочитано — підтвердіть ознайомлення.'; };
  if (!('IntersectionObserver' in window)) return on();
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { on(); io.disconnect(); } }, { rootMargin: '0px 0px -40px 0px' });
  io.observe(end);
}
ACTS.docfs = d => { UI.docfs = Math.max(13, Math.min(24, (UI.docfs || 16) + (+d.v) * 2)); const el = $('.doctext'); if (el) el.style.fontSize = UI.docfs + 'px'; };
ACTS.docfile = async d => {
  try {
    toast('Готую файл…');
    const f = await getRowFile('Документи', get('Документи', d.id));
    const blob = fileToBlob(f);
    const btn = $('#docack'); if (btn && !$('.doctext')) { btn.disabled = false; const hn = $('#dochint'); if (hn) hn.textContent = 'Після перегляду файлу підтвердіть ознайомлення.'; }
    if (/pdf|image/.test(f.mime)) { const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 120000); if (w) return; }
    const r = await saveFile(f.name || 'Документ', blob);
    toast(r === 'declined' ? 'Збереження скасовано' : 'Файл збережено: ' + (f.name || ''));
  } catch (e) { toast(e.message); }
};
/** Кнопки надсилання документа: собі на пошту і «Поділитися» (месенджер, пошта телефона). */
function docSendBtns(d) {
  if (isVisitor() || !(docReadable(d) || d.link)) return '';
  return (DB.mailQ.has(d.id) ? badge('✉ лист у черзі', 'warn') : `<button type="button" class="btn small ghost" data-act="docmail" data-id="${esc(d.id)}">✉ На пошту</button>`) +
    (navigator.share ? `<button type="button" class="btn small ghost" data-act="docshare" data-id="${esc(d.id)}">↗ Поділитися</button>` : '');
}
ACTS.docmail = async x => {
  const d = get('Документи', x.id); if (!d) return;
  const me = get('Персонал', ME.personId) || {}; const to = me.email || ME.email;
  const what = [d.fileName || d.fileId ? 'файл' : '', String(d.text || '').trim() ? 'текст' : '', d.link ? 'посилання' : ''].filter(Boolean).join(', ');
  if (!await ask(`Надіслати «${d.title}» на вашу пошту ${to}?\nУ листі: ${what}.`, 'Надіслати')) return;
  try {
    const r = await mailDoc(d);
    if (r.demo) {
      await ask(`ДЕМО: у робочій версії цей лист піде автоматично.\n\nКому: ${to}\nТема: ${d.kind}: ${d.title}\n\nДобрий день, ${me.pib || ME.name}!\n${d.kind}: ${d.title}${d.version ? '\nРедакція: ' + d.version : ''}${d.link ? '\nПосилання: ' + d.link : ''}${String(d.text || '').trim() ? '\n\n' + String(d.text).slice(0, 300) + (String(d.text).length > 300 ? '…' : '') : ''}${d.fileName ? '\n\nВкладення: 📎 ' + d.fileName : ''}`, 'Зрозуміло', 'Закрити');
      return;
    }
    toast(r.queued ? 'Лист піде автоматично, щойно буде звʼязок' : 'Документ надіслано на ' + r.to);
    render();
  } catch (e) { toast('Не вдалося надіслати: ' + e.message); }
};
ACTS.docshare = async x => {
  const d = get('Документи', x.id); if (!d) return;
  try {
    if (d.file || d.fileId || DB.upTasks.has(d.id)) {
      const f = await getRowFile('Документи', d);
      const file = new File([fileToBlob(f)], f.name || 'Документ', { type: f.mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: d.title });
    }
    const text = [d.kind + ': ' + d.title, d.version ? 'ред. ' + d.version : '', String(d.text || '').trim() ? String(d.text).slice(0, 4000) : ''].filter(Boolean).join('\n');
    await navigator.share({ title: d.title, text, ...(d.link ? { url: d.link } : {}) });
  } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
};
ACTS.doctxt = () => $('#doctxtfile') && $('#doctxtfile').click();

ACTS.ack = async d => {
  const doc = get('Документи', d.id);
  if (!await ask(`Підтверджую, що ознайомився(-лась) з документом:\n«${doc.title}»`)) return;
  await save('Ознайомлення', { docId: d.id, personId: ME.personId, date: today() });
  savedMsg('Ознайомлення зафіксовано'); render();
};
ROUTES.docform = (id = 'new', sect) => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Документи', id) : null;
  const nd = src ? isND(src) : sect === 'nd';
  const d = src || { kind: nd ? ND_KINDS[0] : /^k\d$/.test(sect || '') && INSTR_KINDS[+sect.slice(1)] ? INSTR_KINDS[+sect.slice(1)] : INSTR_KINDS[0], ndGroup: UI.ndg && UI.ndg !== 'all' ? UI.ndg : 'Загальна НД', required: true, date: today() };
  const back = nd ? '#/nd' : '#/docs';
  const body = (nd
      ? `<div class="grid2">${fSel('Вид документа', 'kind', ND_KINDS, d.kind)}${fSel('Розділ НД', 'ndGroup', ND_GROUPS.map(g => [g, g === 'ДДК' ? 'ДДК' : g]), ndGroupOf(d))}</div>`
      : fSel('Вид документа', 'kind', INSTR_KINDS, d.kind)) + fInp('Назва', 'title', d.title, { req: true }) +
    fInp('Посилання (Google Диск)', 'link', d.link, { type: 'url', ph: 'https://drive.google.com/…' }) +
    fArea('Текст документа (для читання в порталі)', 'text', d.text, { rows: 14, ph: '# Загальні положення\n1. …\n2. …\n\n# Вимоги безпеки перед початком роботи\n…' }) +
    `<div class="row gap"><button type="button" class="btn small ghost" data-act="doctxt">Вставити текст з файлу .txt</button><input type="file" id="doctxtfile" accept=".txt,text/plain" hidden></div>
     <p class="small mute">Рядок, що починається з «# », — заголовок розділу; порожній рядок — новий абзац. Працівник зможе підтвердити ознайомлення лише після того, як дочитає текст до кінця.</p>
     <label class="f"><span>Файл документа (PDF, Word)${d.fileName ? ' — зараз: ' + esc(d.fileName) : ''}</span><input type="file" name="docfile" accept="application/pdf,.doc,.docx,image/*"><small>необовʼязково; відкривається з картки документа, зберігається на Диску</small></label>` +
    `<div class="grid2">${fInp('Редакція / версія', 'version', d.version)}${fInp('Дата введення', 'date', d.date, { type: 'date', hint: 'нова дата — повторне ознайомлення' })}</div>` +
    fChk('Обовʼязкове ознайомлення', 'required', d.required) + (nd ? '' : '<p class="small mute">Для інструкцій з охорони праці ознайомлення фіксується через інструктажі — прикріпіть інструкцію до інструктажу.</p>');
  return page(nd ? 'Нормативний документ' : 'Інструкція', form('doc', id, body, src ? { del: { t: 'Документи', id, back } } : {}), back);
};
FORMS.doc = async (d, id, f) => {
  if (!need(d, [['title', 'назва']])) return;
  const src = id !== 'new' ? get('Документи', id) : {};
  if (!isND(d)) d.ndGroup = '';
  const file = f && f.querySelector('input[name=docfile]') && f.querySelector('input[name=docfile]').files[0];
  delete d.docfile;
  const row = await save('Документи', { ...src, ...d, id: id !== 'new' ? id : undefined });
  if (file) { try { await queueRowFile('Документи', row.id, file); } catch (e) { toast('Файл не додано: ' + e.message); } }
  UI.dirty = false; savedMsg('Документ збережено'); go(isND(d) ? '#/nd' : '#/docs');
};
ROUTES.ackmatrix = sect => {
  if (isVisitor()) return denied();
  const nd = sect === 'nd', back = nd ? '#/nd' : '#/docs', ttl = 'Журнал ознайомлення · ' + (nd ? 'НД' : 'Інструкції');
  const ak = !nd && ACK_KINDS.includes(UI.akg) ? UI.akg : '';
  const flt = nd ? '' : seg('akg', [['', 'Усі'], ...ACK_KINDS.map(k => [k, { 'Робоча інструкція': 'Робочі', 'Посадова інструкція': 'Посадові', 'Інструкція ДІВ': 'Робота з ДІВ' }[k] || 'Положення'])], ak).replace('class="seg"', 'class="seg wrap"') +
    `<div class="row gap"><a class="btn ghost small" href="#/gen/ack">⬇ Журнал ознайомлення (.xlsx)</a><a class="btn ghost small" href="#/brief">🎓 Інструктажі з ОП</a></div>`;
  const docs = all('Документи').filter(d => needAck(d) && isND(d) === nd && (!ak || d.kind === ak))
    .sort((a, b) => nd ? ND_GROUPS.indexOf(ndGroupOf(a)) - ND_GROUPS.indexOf(ndGroupOf(b)) || byTitle(a, b) : String(a.kind).localeCompare(String(b.kind)) || byTitle(a, b));
  const ppl = staff().filter(p => p.role !== 'відвідувач');
  if (!docs.length) return page(ttl, flt + empty('Обовʼязкових документів немає'), back);
  const rows = docs.map(d => [`<span class="small" style="display:block;white-space:normal;min-width:170px;max-width:240px;text-align:left">${nd ? '<b>' + esc(ndGroupOf(d) === 'Загальна НД' ? 'Заг.' : ndGroupOf(d)) + '</b> · ' : ''}<a href="#/doc/${esc(d.id)}">${esc(d.title)}</a></span>`, ...ppl.map(p => { const a = ackOf(d.id, p.id); return a ? `<span class="ok" title="${uaDate(a.date)}">✓</span>` : '<span class="bad">✗</span>'; })]);
  const tot = ppl.map(p => docs.filter(d => ackOf(d.id, p.id)).length);
  rows.push(['<b>Разом</b>', ...tot.map(t => `<b>${t}/${docs.length}</b>`)]);
  return page(ttl, flt + table(['Документ', ...ppl.map(p => `<span class="vert">${esc(shortName(p.pib))}</span>`)], rows, 'center first'), back);
};

// ═════════ ПАЛИВО ═════════
ROUTES.fuel = () => {
  if (isVisitor()) return denied();
  const m = UI.fmonth || (UI.fmonth = ym(today()));
  const reps = reportsIn(m + '-01', monthEnd(m));
  let h = monthNav('fmonth', m);
  const mid = m + '-15';
  const cars = all('Авто').map(c => { const rs = reps.filter(r => r.carId === c.id); const sum = k => rs.reduce((s, r) => s + num(r[k]), 0); return [esc(c.name), esc(c.fuel || ''), fmtN(carNorm(c, mid)), fmtN(sum('km')), fmtN(sum('kmHeavy')), fmtN(sum('heaterH')), fmtN(rs.reduce((s, r) => s + calc(r).carL, 0)), new Set(rs.map(r => r.date)).size]; });
  h += card('Автомобілі', table(['Авто', 'Пальне', 'Норма, л/100км', 'Пробіг, км', 'з них важкі умови', 'Обігрівач, год', 'Витрата, л', 'Днів'], cars, 'num first') +
    `<p class="small mute">Витрата = пробіг × норма сезону + пробіг у важких дорожніх умовах × норма для важких умов + години автономного обігрівача × норма обігрівача. У таблиці норма — ${seasonName(mid)} (зимовий період ${mdText(winterRange().from)}–${mdText(winterRange().to)}); у кожному звіті береться норма на дату звіту.</p>`);
  // лише станції, що працювали в цьому місяці (є мотогодини або заправка у звітах)
  const used = g => reps.some(r => r.genId === g.id && !truthy(r.travel) && (num(r.genHours) || num(r.genRefuel)));
  const gens = all('Генератори').filter(used).map(g => {
    const rs = reps.filter(r => r.genId === g.id && !truthy(r.travel)); const hr = rs.reduce((s, r) => s + num(r.genHours), 0);
    const cons = z2l(rs.reduce((s, r) => s + num(r.genHours) * genNorm(g, r.date), 0)); const ref = z2l(rs.reduce((s, r) => s + (r.genRefuel === '' || r.genRefuel == null ? num(r.genHours) * genNorm(g, r.date) : num(r.genRefuel)), 0));
    const st = genState(g.id, addDays(monthEnd(m), 1), '', 0);
    return [esc(g.name), esc(g.fuel || ''), fmtN3(genNorm(g, mid)), fmtN(hr), fmtN3(cons), fmtN3(ref), `<b class="${st && st.bal === 0 ? 'ok' : 'warn'}">${fmtN3(st ? st.bal : 0)}</b>`, fmtN(st ? st.moto : 0)];
  });
  h += card('Електростанції', !gens.length ? empty('У цьому місяці електростанції не використовувались') : table(['Генератор', 'Пальне', 'Норма, л/год', 'Мотогод', 'Витрата, л', 'Заправлено, л', 'Залишок, л', 'Мотогод всього'], gens, 'num first') + `<p class="small mute">Витрата = мотогодини × норма на дату звіту (літня або зимова). Заправка в звітах — «під нуль», тож залишок має бути 0. Залишок і лічильник мотогодин — на кінець місяця.</p>`);
  const byO = {};
  reps.forEach(r => { const c = calc(r); const o = byO[r.objectId] = byO[r.objectId] || { ДП: 0, 'А-95': 0 }; if (c.carL) o[c.carFuel] = (o[c.carFuel] || 0) + c.carL; if (c.genL) o[c.genFuel] = (o[c.genFuel] || 0) + c.genL; });
  const rows = Object.entries(byO).map(([id, f]) => [`<a href="#/object/${esc(id)}">${esc(objShort(id))}</a>`, fmtN(f['ДП'] || 0), fmtN(f['А-95'] || 0), fmtN(Object.values(f).reduce((a, b) => a + b, 0))]);
  h += card('По обʼєктах', rows.length ? table(['Обʼєкт', 'ДП, л', 'А-95, л', 'Разом'], rows, 'num first') : empty('Немає даних'));
  h += `<div class="row gap"><a class="btn primary" href="#/gen/fuel">Сформувати акт і протокол</a>${isLead() ? '<a class="btn ghost" href="#/fleet">Норми витрат</a>' : ''}</div>`;
  return page('Паливо', h, '#/menu');
};

// ═════════ АВТО ТА ГЕНЕРАТОРИ ═════════
ROUTES.fleet = () => {
  if (!isLead()) return denied();
  const w = winterRange(); const nowW = isWinter(today());
  const nv = v => num(v) ? fmtN3(num(v)) : '—';
  let h = card('Сезон норм', `<p>Зараз діють <b>${nowW ? 'зимові' : 'літні'}</b> норми. Зимовий період: <b>${mdText(w.from)} – ${mdText(w.to)}</b>.</p>
    <p class="small mute">У звітах норма береться на дату звіту. Якщо зимову норму не задано — застосовується літня.</p>
    <form data-form="winter" class="grid2">${fInp('Початок зимового періоду', 'winterFrom', mdText(w.from), { ph: '01.11' })}${fInp('Кінець зимового періоду', 'winterTo', mdText(w.to), { ph: '31.03' })}<button class="btn ghost" type="submit">Зберегти період</button></form>`);
  h += card('Автомобілі', all('Авто').map(c => `<a class="item" href="#/carform/${esc(c.id)}"><div class="row between"><b>${esc(c.name)} ${esc(c.plate || '')}</b>${badge(esc(c.fuel || ''))}</div>${c.sapNo ? `<span class="small mute">SAP № ${esc(c.sapNo)}</span>` : ''}
    <div class="normgrid"><span></span><span>літня</span><span>зимова</span>
      <span>Норма, л/100 км</span><b class="${nowW ? '' : 'pri'}">${nv(c.norm100)}</b><b class="${nowW ? 'pri' : ''}">${nv(c.norm100W)}</b>
      <span>Важкі дорожні умови, л/100 км</span><b class="${nowW ? '' : 'pri'}">${nv(c.normHeavy)}</b><b class="${nowW ? 'pri' : ''}">${nv(c.normHeavyW)}</b>
      <span>Автономний обігрівач, л/год</span><b style="grid-column: span 2">${nv(c.heaterLh)}</b></div>
    <span class="small mute">${esc(c.status || '')}</span></a>`).join('') || empty('Немає'), `<a class="small" href="#/carform/new">+ додати</a>`);
  h += card('Електростанції', all('Генератори').map(g => `<a class="item" href="#/genform/${esc(g.id)}"><div class="row between"><b>${esc(g.name)}</b>${badge(esc(g.fuel || ''))}</div>
    <div class="normgrid"><span></span><span>літня</span><span>зимова</span>
      <span>Норма, л/год</span><b class="${nowW ? '' : 'pri'}">${nv(g.normLh)}</b><b class="${nowW ? 'pri' : ''}">${nv(g.normLhW)}</b></div>
    ${(st => st ? `<span class="small">Мотогодини: <b>${fmtN(st.moto)}</b> · у баку: <b>${fmtN3(st.bal)} л</b>${g.resetDate ? ` <span class="mute">(відлік після ${uaDate(g.resetDate)})</span>` : ''}</span>` : '')(genState(g.id, addDays(today(), 1), '', 0))}
    <span class="small mute">${g.carId ? 'в авто ' + esc(carName(g.carId)) : 'не закріплена за авто'}</span></a>`).join('') || empty('Немає'), `<a class="small" href="#/genform/new">+ додати</a>`);
  return page('Авто та генератори', h, '#/menu');
};
FORMS.winter = async d => {
  const md = v => { const m = String(v || '').trim().match(/^(\d{1,2})[.\-/](\d{1,2})$/); return m && +m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12 ? z2(+m[2]) + '-' + z2(+m[1]) : null; };
  const f = md(d.winterFrom), t = md(d.winterTo);
  if (!f || !t) return toast('Вкажіть дати у форматі ДД.ММ, напр. 01.11 і 31.03');
  for (const [k, v] of [['winterFrom', f], ['winterTo', t]]) { const cur = all('Налаштування').find(x => x.key === k); if (!cur || cur.value !== v) await save('Налаштування', cur ? { ...cur, value: v } : { key: k, value: v }); }
  UI.dirty = false; savedMsg('Зимовий період збережено'); render();
};
ROUTES.carform = (id = 'new') => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Авто', id) : null; const d = src || { fuel: 'ДП', status: 'в роботі' };
  return page('Автомобіль', form('car', id, fInp('Марка / назва', 'name', d.name, { req: true }) + `<div class="grid3">${fInp('Держ. номер', 'plate', d.plate)}${fInp('SAP-номер', 'sapNo', d.sapNo, { mode: 'numeric' })}${fSel('Пальне', 'fuel', FUELS, d.fuel)}</div><fieldset class="f"><legend>Норми витрат палива</legend>
    <div class="grid2">${fNum('Літня норма, л/100 км', 'norm100', d.norm100)}${fNum('Зимова норма, л/100 км', 'norm100W', d.norm100W)}</div>
    <div class="grid2">${fNum('Важкі дорожні умови (літо), л/100 км', 'normHeavy', d.normHeavy)}${fNum('Важкі дорожні умови (зима), л/100 км', 'normHeavyW', d.normHeavyW)}</div>
    ${fNum('Робота автономного обігрівача, л/год', 'heaterLh', d.heaterLh)}
    <small class="mute">Порожня зимова норма — застосовується літня. Порожня норма для важких умов — застосовується звичайна норма сезону.</small></fieldset>
    ${fInp('Стан', 'status', d.status)}` + fArea('Примітка', 'note', d.note, { rows: 2 }), src ? { del: { t: 'Авто', id, back: '#/fleet' } } : {}), '#/fleet');
};
FORMS.car = async (d, id) => { if (!need(d, [['name', 'назва']])) return; await save('Авто', { ...(get('Авто', id) || {}), ...d, id: id !== 'new' ? id : undefined }); UI.dirty = false; savedMsg('Збережено'); go('#/fleet'); };
ROUTES.genform = (id = 'new') => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Генератори', id) : null; const d = src || { fuel: 'А-95' };
  return page('Електростанція', form('genr', id, fInp('Назва / модель', 'name', d.name, { req: true }) + `<div class="grid2">${fInp('Інв. №', 'invNo', d.invNo)}${fSel('Пальне', 'fuel', FUELS, d.fuel)}</div><div class="grid2">${fNum('Літня норма, л/год', 'normLh', d.normLh)}${fNum('Зимова норма, л/год', 'normLhW', d.normLhW)}</div>${fSel('Закріплена за авто', 'carId', carOpts(), d.carId, { none: '—' })}<div class="grid2">${fNum('Мотогодини на початок обліку', 'motoStart', d.motoStart)}${fNum('Залишок пального на початок, л', 'fuelStart', d.fuelStart)}</div>` + fArea('Примітка', 'note', d.note, { rows: 2 }), src ? { del: { t: 'Генератори', id, back: '#/fleet' } } : {}) +
    (src ? (st => card('Обнулення лічильників', `<p class="small">Зараз: мотогодини <b>${fmtN(st.moto)}</b>, у баку <b>${fmtN3(st.bal)} л</b>.${src.resetDate ? ` Відлік іде після ${uaDate(src.resetDate)} (з ${fmtN(num(src.resetMoto))} год і ${fmtN3(num(src.resetFuel))} л). <button type="button" class="btn small ghost" data-act="genunreset" data-id="${esc(id)}">Скасувати обнулення</button>` : ''}</p>
      <p class="small mute">Звіти не змінюються: попередні мотогодини й витрата лишаються в звітах і актах палива, а лічильник станції починається заново — з наступного дня після вказаної дати.</p>` +
      form('genreset', id, `${fInp('Станом на кінець дня', 'resetDate', today(), { type: 'date' })}<div class="grid2">${fNum('Мотогодини після обнулення', 'resetMoto', 0)}${fNum('Залишок пального, л', 'resetFuel', 0)}</div>`, { submit: 'Обнулити' })))(genState(id, addDays(today(), 1), '', 0)) : ''), '#/fleet');
};
FORMS.genreset = async (d, id) => {
  const g = get('Генератори', id); if (!g) return;
  const dt = d.resetDate || today();
  if (!await ask(`Обнулити «${g.name}» станом на кінець ${uaDate(dt)}? Мотогодини і залишок почнуть рахуватися з ${fmtN(num(d.resetMoto))} год і ${fmtN3(num(d.resetFuel))} л. Звіти не змінюються.`, 'Обнулити')) return;
  await save('Генератори', { ...g, resetDate: dt, resetMoto: num(d.resetMoto), resetFuel: num(d.resetFuel) });
  UI.dirty = false; savedMsg('Лічильники обнулено'); go('#/fleet');
};
ACTS.genunreset = async d => {
  const g = get('Генератори', d.id); if (!g || !await ask('Скасувати обнулення? Облік знову йтиме з усіх звітів.', 'Скасувати обнулення', 'Ні')) return;
  await save('Генератори', { ...g, resetDate: '', resetMoto: '', resetFuel: '' }); savedMsg('Обнулення скасовано'); render();
};
FORMS.genr = async (d, id) => { if (!need(d, [['name', 'назва']])) return; await save('Генератори', { ...(get('Генератори', id) || {}), ...d, id: id !== 'new' ? id : undefined }); UI.dirty = false; savedMsg('Збережено'); go('#/fleet'); };

// ═════════ НОВИНИ ═════════
ROUTES.news = () => {
  const list = all('Новини').slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  let h = isLead() ? card('Нова новина', form('news', 'new', fInp('Заголовок', 'title', '', { req: true }) + fArea('Текст', 'text', '', { rows: 4 }), { submit: 'Опублікувати' })) : '';
  h += list.map(n => {
    const cm = all('Коментарі').filter(c => c.newsId === n.id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return card(esc(n.title), `<p class="small mute">${uaDate(n.date)} · ${esc(n.author || '')}</p><p class="pre">${esc(n.text)}</p>
      ${cm.length ? `<div class="comments">${cm.map(c => `<div><b>${esc(c.author)}</b> <span class="small mute">${uaDate(c.date)}</span><p class="pre">${esc(c.text)}</p></div>`).join('')}</div>` : ''}
      ${canReport() ? `<form class="form inline" data-form="comment" data-id="${esc(n.id)}"><input name="text" placeholder="Коментар…" autocomplete="off"><button class="btn small primary">➤</button></form>` : ''}
      ${isLead() ? `<button class="btn small danger" data-act="del" data-t="Новини" data-id="${esc(n.id)}" data-back="#/news">Видалити</button>` : ''}`);
  }).join('') || empty('Новин немає');
  return page('Новини', h, '#/menu');
};
FORMS.news = async d => { if (!need(d, [['title', 'заголовок']])) return; await save('Новини', { ...d, date: today(), author: ME.name }); UI.dirty = false; savedMsg('Опубліковано'); render(); };
FORMS.comment = async (d, id) => { if (!d.text) return; await save('Коментарі', { newsId: id, text: d.text, date: today(), author: ME.name }); UI.dirty = false; render(); };

// ═════════ НОРМИ ВИТРАТ МАТЕРІАЛІВ ═════════
ROUTES.norms = () => {
  if (isVisitor()) return denied();
  const list = normsList();
  let h = `<p class="small mute">Норми для кожного діаметра: RT і людино-години — на 1 стик, PT — на 1 дм² контрольованої поверхні. За ними портал рахує витрату плівки, реактивів і матеріалів PT у щоденних звітах, а також особливий характер робіт (люд-год RT). Для діаметра без точної норми береться найближчий.</p>`;
  h += list.length ? table(['Ø', 'Плівка, дм²', 'Прояв., л', 'Фікс., л', 'PT розч., л/дм²', 'PT пенетр., л/дм²', 'PT прояв., л/дм²', 'VT, л-год', 'RT, л-год'],
    list.map(n => [isLead() ? `<a href="#/normform/${esc(n.id)}"><b>${esc(n.diameter)}</b></a>` : `<b>${esc(n.diameter)}</b>`, ...['film', 'dev', 'fix', 'ptSolvent', 'ptPenetrant', 'ptDeveloper', 'vtHours', 'rtHours'].map(k => /^pt/.test(k) ? num(n[k]).toLocaleString('uk-UA', { maximumFractionDigits: 4 }) : fmtN3(num(n[k])))]), 'num first') :
    empty('Норми ще не внесено. Імпортуйте їх з аркуша «Норми_витрат» (функція importNorms) або додайте вручну.');
  if (isLead()) h += fab('#/normform/new');
  return page('Норми витрат матеріалів', h, '#/menu');
};
ROUTES.normform = (id = 'new') => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('НормиМатеріалів', id) : null;
  const d = src || {};
  const body = fNum('Діаметр, мм', 'diameter', d.diameter, { req: true }) +
    `<fieldset class="f"><legend>RT, на 1 стик</legend><div class="grid3">${fNum('Плівка, дм²', 'film', d.film)}${fNum('Проявник, л', 'dev', d.dev)}${fNum('Фіксаж, л', 'fix', d.fix)}</div></fieldset>
     <fieldset class="f"><legend>PT, на 1 дм²</legend><div class="grid3">${fNum('Розчинник, л', 'ptSolvent', d.ptSolvent)}${fNum('Пенетрант, л', 'ptPenetrant', d.ptPenetrant)}${fNum('Проявник, л', 'ptDeveloper', d.ptDeveloper)}</div></fieldset>
     <fieldset class="f"><legend>Людино-години на 1 стик</legend><div class="grid2">${fNum('VT', 'vtHours', d.vtHours)}${fNum('RT (особливий характер)', 'rtHours', d.rtHours)}</div></fieldset>`;
  return page('Норма для діаметра', form('norm', id, body, src ? { del: { t: 'НормиМатеріалів', id, back: '#/norms' } } : {}), '#/norms');
};
FORMS.norm = async (d, id) => {
  if (!need(d, [['diameter', 'діаметр']])) return;
  if (normsList().some(n => n.id !== id && num(n.diameter) === num(d.diameter))) return toast('Норма для цього діаметра вже є');
  await save('НормиМатеріалів', { ...(get('НормиМатеріалів', id) || {}), ...d, id: id !== 'new' ? id : undefined });
  UI.dirty = false; savedMsg('Норму збережено'); go('#/norms');
};
