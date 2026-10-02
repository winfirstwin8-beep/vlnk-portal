/* Портал ВЛНК — формування документів Excel (.xlsx) на телефоні, без сервера */
'use strict';

const EXCEL_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
];
function loadExcel() {
  if (window.ExcelJS) return Promise.resolve();
  return EXCEL_URLS.reduce((p, url) => p.catch(() => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = url; s.onload = () => window.ExcelJS ? res() : rej(); s.onerror = rej; document.head.appendChild(s);
  })), Promise.reject()).catch(() => { throw new Error('Бібліотека Excel ще не завантажена. Відкрийте цей розділ один раз з інтернетом — далі працюватиме офлайн.'); });
}

const GEN_TYPES = [
  ['sz', 'СЗ на відрядження + відомість на проживання'],
  ['move', 'Звіт про пересувний характер робіт'],
  ['tabel', 'Табель робочого часу персоналу по обʼєктах (з особливим характером)'],
  ['tech', 'Табель роботи техніки по обʼєктах'],
  ['fuel', 'Акт і протокол витрат палива по обʼєктах'],
  ['mat', 'Акт витрат матеріалів НК по обʼєктах (плівка, реактиви, PT)'],
  ['vac', 'Графік відпусток (з підписами про ознайомлення)'],
  ['ppecard', 'Особова картка обліку ЗІЗ'],
  ['ppeneed', 'Заявка (потреба) на ЗІЗ'],
  ['brief', 'Журнал реєстрації інструктажів (онлайн-підтвердження)']
];

// ───────── екран ─────────
ROUTES.gen = (type, objectId) => {
  if (isVisitor()) return denied();
  const m = ym(today());
  if (!UI.gen) UI.gen = { type: 'tabel', from: m + '-01', to: monthEnd(m), brigade: '1', objectId: '' };
  if (type) { UI.gen.type = type; UI.gen.objectId = objectId || ''; location.replace('#/gen'); }
  const g = UI.gen;
  const body = fSel('Документ', 'type', GEN_TYPES, g.type, { re: true }) + (g.type === 'vac'
    ? fSel('Рік', 'year', vacYears(), g.year || today().slice(0, 4)) : g.type === 'ppecard'
    ? fSel('Працівник', 'personId', staffOpts(), g.personId, { none: 'Усі працівники (окремий аркуш на кожного)' }) : g.type === 'ppeneed'
    ? fInp('Потреба до дати', 'to', g.to && g.to > today() ? g.to : addDays(today(), 90), { type: 'date' }) :
    `<div class="seg wrap">${[['-1', 'Попередній місяць'], ['0', 'Поточний місяць'], ['1', 'Наступний місяць']].map(([k, t]) => { const mm = addMonths(m, +k); return `<button type="button" class="${g.from === mm + '-01' && g.to === monthEnd(mm) ? 'on' : ''}" data-act="genper" data-k="${k}">${t}</button>`; }).join('')}</div>
     <div class="grid2">${fInp('З', 'from', g.from, { type: 'date', req: true })}${fInp('По', 'to', g.to, { type: 'date', req: true })}</div>` +
    (g.type === 'brief' ? '' : g.type === 'sz' ? fSel('Бригада', 'brigade', BRIGADES.map(n => [n, brName(n)]), g.brigade, { re: true }) : fSel('Бригада', 'brigade', BRIGADES.map(n => [n, brName(n)]), g.brigade === 'all' ? '' : g.brigade, { none: 'Усі бригади', re: true })) +
    (['tabel', 'tech', 'fuel', 'move', 'mat'].includes(g.type) ? fSel('Обʼєкт', 'objectId', objOpts(), g.objectId, { none: 'Усі обʼєкти', re: true }) : ''));
  const hint = {
    sz: 'Склад бригади, авто та обʼєкти беруться із завдань бригади на обраний період.',
    move: 'Дні з пересувним характером — за щоденними звітами (виконання робіт і переїзди).',
    tabel: 'Години — за графіком зі звітів (8 або 11). Особливий характер — за нормою на знімки RT, водію не нараховується.',
    tech: 'Години роботи авто — за графіком змін, пробіг — зі звітів; мотогодини генераторів — зі звітів.',
    fuel: 'Витрата авто = км × норма/100; електростанцій = мотогодини × норма, окремо ДП і А-95.',
    ppecard: 'Картка: розміри, позиції за нормою, строк носіння, дати видачі та графа для підпису.',
    ppeneed: 'Позиції, що ще не видавались або чий строк носіння спливає до вказаної дати, згруповані за розміром.',
    mat: 'Витрата за нормами на стик для кожного діаметра (або фактична, якщо її вписали у звіті), з розбивкою по діаметрах і протоколом по днях.',
    brief: 'Інструктажі з датою в межах періоду: кожен учасник окремим рядком, дата і час онлайн-підтвердження, результат контрольних питань.',
    vac: 'Частини відпусток (план і факт), облік днів, розбивка по місяцях і графа для підпису про ознайомлення.'
  }[g.type];
  const periods = ['vac', 'ppecard', 'ppeneed', 'brief'].includes(g.type) ? '' : genTaskPeriods(ym(g.from || today()), g.brigade, g.objectId);
  return page('Формування документів', `<form class="form" data-form="gen" data-id="gen">${body}<p class="small mute">${hint}</p>
    <div class="form-actions"><button class="btn primary" type="submit">Сформувати .xlsx</button></div></form><div id="genres"></div>` + periods, '#/menu');
};
/** Звіти бригад за періодами виконання завдань у місяці — щоб обрати період документа одним натиском. */
function genTaskPeriods(m, brig, oid) {
  const a = m + '-01', b = monthEnd(m);
  const tasks = all('Завдання').filter(t => taskStatus(t) !== 'перенесено' && (t.dateFrom || a) <= b && (t.dateTo || b) >= a && (!oid || t.objectId === oid));
  let h = '';
  for (const n of BRIGADES) {
    if (brig && brig !== 'all' && String(brig) !== String(n)) continue;
    const ts = tasks.filter(t => String(t.brigade) === String(n)).sort((x, y) => String(x.dateFrom).localeCompare(String(y.dateFrom)));
    if (!ts.length) continue;
    h += `<p class="small"><b>${brName(n)}</b></p>` + ts.map(t => {
      const f = (t.dateFrom || a) < a ? a : (t.dateFrom || a), to = (t.dateTo || b) > b ? b : (t.dateTo || b);
      const reps = reportsIn(f, to, r => String(r.brigade) === String(n) && (r.taskId === t.id || r.objectId === t.objectId));
      const days = new Set(reps.map(r => r.date)).size;
      return `<div class="item"><div class="row between"><b>${esc(objShort(t.objectId))}</b>${badge(esc(taskStatus(t)))}</div>
        <span class="small mute">${uaDate(f)} – ${uaDate(to)} · звітів: <b>${reps.length}</b>${days ? ' за ' + days + ' дн.' : ''}</span>
        <div class="row gap"><button type="button" class="btn small ghost" data-act="genpick" data-b="${n}" data-o="${esc(t.objectId)}" data-f="${f}" data-t="${to}">Обрати цей період</button>
        ${reps.length ? `<a class="small" href="#/reports" data-act="genreps" data-f="${f}" data-b="${n}">звіти ›</a>` : ''}</div></div>`;
    }).join('');
  }
  return card('Звіти ' + (brig && brig !== 'all' ? brName(brig).toLowerCase().replace('бригада', 'бригади') : 'бригад') + ' за періодами завдань · ' + monthName(m), h || empty('Завдань у цьому місяці немає'));
}
ACTS.genpick = d => {
  const f = $('form[data-form=gen]'); if (f) Object.assign(UI.gen, formData(f));
  Object.assign(UI.gen, { from: d.f, to: d.t, brigade: d.b, objectId: d.o }); render(); window.scrollTo(0, 0);
};
ACTS.genreps = d => { UI.rdate = ''; UI.rbrig = d.b; go('#/reports'); };
ONCHANGE.gen = d => { Object.assign(UI.gen, d); };
ACTS.genper = d => {
  const f = $('form[data-form=gen]'); const cur = formData(f); Object.assign(UI.gen, cur);
  const m = addMonths(ym(today()), Number(d.k) || 0);
  UI.gen.from = m + '-01'; UI.gen.to = monthEnd(m);
  render();
};
FORMS.gen = async d => {
  Object.assign(UI.gen, d);
  if (!['vac', 'ppecard', 'ppeneed'].includes(d.type) && (!d.from || !d.to || d.to < d.from)) return toast('Перевірте період');
  const out = $('#genres');
  out.innerHTML = `<div class="card"><p>Формування…</p></div>`;
  try {
    await loadExcel();
    const { wb, name } = DOCS[d.type](d);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], name, { type: blob.type });
    const share = navigator.canShare && navigator.canShare({ files: [file] });
    out.innerHTML = card('Готово', `<p><b>${esc(name)}</b></p><div class="row gap"><button class="btn primary" id="saveDoc">Завантажити</button>${share ? '<button class="btn ghost" id="shareDoc">Надіслати (пошта, месенджер)</button>' : ''}</div>`);
    $('#saveDoc').onclick = () => saveFile(name, blob).then(r => toast(r === 'declined' ? 'Збереження скасовано' : 'Файл збережено: ' + name)).catch(e => toast(e.message));
    if (share) $('#shareDoc').onclick = () => navigator.share({ files: [file], title: name }).catch(() => { });
  } catch (e) {
    console.error(e);
    out.innerHTML = card('Помилка', `<p class="bad">${esc(e.message)}</p>`);
  }
};

// ───────── допоміжні функції Excel ─────────
const BORDER = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
const FONT = 'Times New Roman';
function wbNew() { const wb = new ExcelJS.Workbook(); wb.creator = 'Портал ВЛНК'; wb.created = new Date(); return wb; }
function sheet(wb, name, landscape) {
  return wb.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } } });
}
function line(ws, r, text, cols, o = {}) {
  ws.mergeCells(r, 1, r, cols);
  const c = ws.getCell(r, 1);
  c.value = text;
  c.font = { name: FONT, size: o.size || 12, bold: !!o.bold, italic: !!o.italic };
  c.alignment = { horizontal: o.align || 'center', vertical: 'middle', wrapText: true };
  if (o.h) ws.getRow(r).height = o.h;
  return r + 1;
}
function grid(ws, r, head, rows, o = {}) {
  const hr = ws.getRow(r);
  head.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { name: FONT, size: o.hsize || 10, bold: true }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = BORDER; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } }; });
  hr.height = o.hh || 32;
  r++;
  rows.forEach(row => {
    const xr = ws.getRow(r);
    row.forEach((v, i) => {
      const c = xr.getCell(i + 1);
      c.value = v === '' || v === undefined ? null : v;
      c.font = { name: FONT, size: o.size || 10, bold: !!(o.boldLast && row === rows[rows.length - 1]) };
      c.alignment = { horizontal: typeof v === 'number' ? 'center' : (o.left && o.left.includes(i) ? 'left' : 'center'), vertical: 'middle', wrapText: true };
      c.border = BORDER;
      if (o.shade && o.shade(i)) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    });
    r++;
  });
  return r;
}
function signs(ws, r, cols, list) {
  r++;
  list.forEach(([pos, name]) => {
    const half = Math.max(2, Math.floor(cols / 2));
    ws.mergeCells(r, 1, r, half); ws.getCell(r, 1).value = pos; ws.getCell(r, 1).font = { name: FONT, size: 11 };
    ws.mergeCells(r, half + 1, r, cols); ws.getCell(r, half + 1).value = '________________  ' + (name || '________________'); ws.getCell(r, half + 1).font = { name: FONT, size: 11 };
    ws.getCell(r, half + 1).alignment = { horizontal: 'right' };
    r += 2;
  });
  return r;
}
function widths(ws, w) { w.forEach((x, i) => (ws.getColumn(i + 1).width = x)); }
const lab = () => setting('labName', 'ВЛНК');
const org = () => setting('orgName', '');
const head = () => [[setting('headPosition', 'Начальник ВЛНК'), setting('headName', '')]];
const r2 = n => Math.round(n * 100) / 100;
const periodText = (a, b) => `з ${uaDate(a)} по ${uaDate(b)}`;
const isWeekend = d => [0, 6].includes(new Date(d + 'T12:00:00').getDay());
/** Бригада в назві/заголовку документа, якщо обрано конкретну бригаду. */
const hasBr = p => p.brigade && p.brigade !== 'all';
const brSfx = p => hasBr(p) ? ' · ' + brName(p.brigade) : '';
const brTag = p => hasBr(p) ? '_Б' + p.brigade : '';
function fname(base, a, b) { return `${base}_${a.slice(8)}.${a.slice(5, 7)}-${b.slice(8)}.${b.slice(5, 7)}.${b.slice(0, 4)}.xlsx`.replace(/[\\/:*?"<>|]/g, '_'); }

function filteredReports(p, withSummary) {
  // підсумкові записи за період (з шаблону «ВиконаноЗПочаткуРоку») — лише в акті матеріалів, не в табелях, паливі й пересувному характері
  return reportsIn(p.from, p.to, r => (withSummary || !isSummary(r)) && (!p.objectId || r.objectId === p.objectId) && (!p.brigade || p.brigade === 'all' || String(r.brigade) === String(p.brigade)));
}
/** Години та особливий характер на людину: якщо в один день кілька звітів — зміна ділиться порівну. */
function personDayShares(reps) {
  const byPD = {};
  for (const r of reps) for (const w of arr(r.workers)) (byPD[w + '|' + r.date] = byPD[w + '|' + r.date] || []).push(r);
  const out = [];
  for (const [k, rs] of Object.entries(byPD)) {
    const [pid, date] = k.split('|');
    for (const r of rs) {
      const c = calc(r);
      out.push({ pid, date, r, objectId: r.objectId, hours: c.h / rs.length, special: r.driverId === pid ? 0 : c.specialPer, travel: truthy(r.travel) });
    }
  }
  return out;
}

const DOCS = {};

// ───────── 1. СЗ на відрядження + відомість на проживання ─────────
DOCS.sz = p => {
  const b = brigadeOf(ym(p.from), p.brigade) || {};
  const mem = brigadeMembers(b);
  const tasks = all('Завдання').filter(t => String(t.brigade) === String(p.brigade) && (t.dateFrom || '') <= p.to && (t.dateTo || t.dateFrom || '') >= p.from)
    .sort((x, y) => String(x.dateFrom).localeCompare(String(y.dateFrom)));
  const methods = [...new Set(tasks.flatMap(t => methodsOf(t.methods)))];
  const days = daysBetween(p.from, p.to) + 1;
  const wb = wbNew();
  const ws = sheet(wb, 'СЗ відрядження');
  widths(ws, [5, 30, 26, 22, 14, 14]);
  const C = 6;
  let r = 1;
  ws.mergeCells(r, 4, r, C); ws.getCell(r, 4).value = 'Керівнику ____________________'; ws.getCell(r, 4).font = { name: FONT, size: 12 }; r += 2;
  r = line(ws, r, 'СЛУЖБОВА ЗАПИСКА', C, { bold: true, size: 14 });
  r = line(ws, r, `від ${uaDate(today())}  № _______`, C, { size: 11 });
  r++;
  const orders = [...new Set(tasks.map(t => t.orderNo).filter(Boolean))];
  r = line(ws, r, `Прошу направити у відрядження працівників ${lab()} (${brName(p.brigade)}) на період ${periodText(p.from, p.to)} (${days} календ. дн.) для виконання робіт з неруйнівного контролю зварних зʼєднань${methods.length ? ' (' + methods.join(', ') + ')' : ''} на обʼєктах:`, C, { align: 'left', h: 62 });
  r = grid(ws, r, ['№', 'Обʼєкт', 'ЛВУМГ / населений пункт', '№ заявки НК', 'Період', 'Вид робіт'],
    tasks.length ? tasks.map((t, i) => { const o = get('Обʼєкти', t.objectId) || {}; return [i + 1, o.short || '', [o.lvumg, o.settlement].filter(Boolean).join(', '), t.requestNo || '', uaDate(t.dateFrom) + '–' + uaDate(t.dateTo), t.workType || '']; }) : [['', 'завдань на період не знайдено', '', '', '', '']], { left: [1, 2] });
  r++;
  r = line(ws, r, 'Склад бригади:', C, { align: 'left', bold: true });
  r = grid(ws, r, ['№', 'ПІБ', 'Посада', 'Примітка', '', ''], mem.map((id, i) => { const pp = get('Персонал', id) || {}; return [i + 1, pp.pib || '', pp.posada || '', [id === b.leaderId ? 'старший бригади' : '', truthy(pp.isDriver) ? 'водій' : ''].filter(Boolean).join(', '), '', '']; }), { left: [1, 2] });
  r++;
  if (b && b.carId) { const c = get('Авто', b.carId) || {}; r = line(ws, r, `Транспорт: ${c.name || ''} ${c.plate || ''}, водій: ${personName(pickDriver(mem, b.carId)) || '—'}.`, C, { align: 'left' }); }
  if (orders.length) r = line(ws, r, `Підстава: наказ № ${orders.join(', ')}.`, C, { align: 'left' });
  signs(ws, r, C, head());

  const ws2 = sheet(wb, 'Відомість проживання', true);
  widths(ws2, [5, 30, 24, 26, 13, 13, 10, 14]);
  const C2 = 8; let q = 1;
  if (org()) q = line(ws2, q, org(), C2, { size: 11 });
  q = line(ws2, q, 'ВІДОМІСТЬ', C2, { bold: true, size: 14 });
  q = line(ws2, q, `на проживання працівників ${lab()} (${brName(p.brigade)}) ${periodText(p.from, p.to)}`, C2, { h: 34 });
  q++;
  const place = [...new Set(tasks.map(t => (get('Обʼєкти', t.objectId) || {}).settlement).filter(Boolean))].join(', ');
  const nights = Math.max(0, days - 1);
  q = grid(ws2, q, ['№', 'ПІБ', 'Посада', 'Населений пункт', 'Дата заїзду', 'Дата виїзду', 'К-сть діб', 'Підпис'],
    mem.map((id, i) => { const pp = get('Персонал', id) || {}; return [i + 1, pp.pib || '', pp.posada || '', place, uaDate(p.from), uaDate(p.to), nights, '']; }).concat([['', 'Разом', '', '', '', '', nights * mem.length, '']]), { left: [1, 2, 3], boldLast: true });
  signs(ws2, q, C2, head());
  return { wb, name: fname('СЗ_відрядження_Б' + p.brigade, p.from, p.to) };
};

// ───────── 2. Звіт про пересувний характер робіт ─────────
DOCS.move = p => {
  const reps = filteredReports(p);
  const sh = personDayShares(reps);
  const wb = wbNew();
  const ws = sheet(wb, 'Пересувний характер', true);
  widths(ws, [5, 28, 12, 8, 30, 26, 18, 9]);
  const C = 8; let r = 1;
  if (org()) r = line(ws, r, org(), C, { size: 11 });
  r = line(ws, r, 'ЗВІТ', C, { bold: true, size: 14 });
  r = line(ws, r, `про виконання робіт з пересувним (роз'їзним) характером працівниками ${lab()} ${periodText(p.from, p.to) + brSfx(p)}`, C, { h: 34 });
  r++;
  const rows = sh.sort((a, b) => personName(a.pid).localeCompare(personName(b.pid), 'uk') || a.date.localeCompare(b.date)).map(x => {
    const o = get('Обʼєкти', x.objectId) || {};
    return [personName(x.pid), uaDate(x.date), x.r.brigade, o.short || '', [o.lvumg ? o.lvumg + ' ЛВУМГ' : '', o.settlement].filter(Boolean).join(', '), x.travel ? 'переїзд між обʼєктами' : 'виконання робіт', r2(x.hours)];
  });
  r = grid(ws, r, ['№', 'ПІБ', 'Дата', 'Бригада', 'Обʼєкт', 'Місце виконання робіт', 'Характер', 'Годин'], rows.map((x, i) => [i + 1, ...x]), { left: [1, 4, 5] });
  r++;
  r = line(ws, r, 'Зведення по працівниках', C, { bold: true });
  const pids = [...new Set(sh.map(x => x.pid))].sort((a, b) => personName(a).localeCompare(personName(b), 'uk'));
  r = grid(ws, r, ['№', 'ПІБ', 'Посада', 'Днів', 'Обʼєкти', '', '', 'Годин'], pids.map((pid, i) => {
    const mine = sh.filter(x => x.pid === pid);
    return [i + 1, personName(pid), (get('Персонал', pid) || {}).posada || '', new Set(mine.map(x => x.date)).size, [...new Set(mine.map(x => objShort(x.objectId)))].join(', '), '', '', r2(mine.reduce((s, x) => s + x.hours, 0))];
  }), { left: [1, 2, 4] });
  signs(ws, r, C, head());
  return { wb, name: fname('Звіт_пересувний' + brTag(p), p.from, p.to) };
};

// ───────── 3. Табель робочого часу персоналу по обʼєктах ─────────
function tabelSheet(wb, title, sub, p, sh, valueKey) {
  const days = dateRange(p.from, p.to);
  const ws = sheet(wb, title, true);
  const C = 4 + days.length + 2;
  widths(ws, [4, 26, 20, 22, ...days.map(() => 4.2), 7, 8]);
  let r = 1;
  if (org()) r = line(ws, r, org(), C, { size: 11 });
  r = line(ws, r, lab(), C, { size: 11 });
  r = line(ws, r, sub, C, { bold: true, size: 13 });
  r = line(ws, r, periodText(p.from, p.to) + brSfx(p), C);
  r++;
  const keys = {};
  sh.forEach(x => { const k = x.pid + '|' + x.objectId; (keys[k] = keys[k] || []).push(x); });
  const order = Object.keys(keys).sort((a, b) => personName(a.split('|')[0]).localeCompare(personName(b.split('|')[0]), 'uk') || objShort(a.split('|')[1]).localeCompare(objShort(b.split('|')[1]), 'uk'));
  let totH = 0;
  const rows = order.map((k, i) => {
    const [pid, oid] = k.split('|'); const xs = keys[k];
    const cells = days.map(d => { const v = xs.filter(x => x.date === d).reduce((s, x) => s + x[valueKey], 0); return v ? r2(v) : ''; });
    const sum = r2(xs.reduce((s, x) => s + x[valueKey], 0)); totH += sum;
    return [i + 1, personName(pid), (get('Персонал', pid) || {}).posada || '', objShort(oid), ...cells, cells.filter(Boolean).length, sum];
  }).filter(row => row[row.length - 1] > 0);
  rows.forEach((row, i) => (row[0] = i + 1));
  if (valueKey === 'hours' && !p.objectId) {
    // дні відпустки позначаються «В»
    staff().forEach(pp => {
      const vd = vacDaysIn(pp.id, p.from, p.to);
      if (vd.size) rows.push([rows.length + 1, pp.pib, pp.posada || '', 'Відпустка', ...days.map(d => vd.has(d) ? 'В' : ''), vd.size, '']);
    });
  }
  rows.push(['', 'Разом', '', '', ...days.map(() => ''), '', r2(totH)]);
  const shade = i => i >= 4 && i < 4 + days.length && isWeekend(days[i - 4]);
  r = grid(ws, r, ['№', 'ПІБ', 'Посада', 'Обʼєкт', ...days.map(d => +d.slice(8)), 'Днів', 'Годин'], rows, { left: [1, 2, 3], size: 9, shade, boldLast: true });
  ws.views = [{ state: 'frozen', xSplit: 4, ySplit: r - rows.length - 1 }];
  signs(ws, r, C, [...head(), ['Табель склав', '']]);
  return ws;
}
DOCS.tabel = p => {
  const sh = personDayShares(filteredReports(p));
  const wb = wbNew();
  const o = p.objectId ? ' (обʼєкт: ' + objShort(p.objectId) + ')' : '';
  tabelSheet(wb, 'Робочий час', 'ТАБЕЛЬ обліку робочого часу по обʼєктах' + o, p, sh, 'hours');
  tabelSheet(wb, 'Особливий характер', 'ТАБЕЛЬ обліку часу робіт з особливим характером (шкідливі умови)' + o, p, sh, 'special');
  const ws = sheet(wb, 'Зведення');
  widths(ws, [5, 30, 26, 10, 12, 14, 30]);
  let r = line(ws, 1, 'Зведення по працівниках ' + periodText(p.from, p.to), 7, { bold: true });
  r++;
  const pids = [...new Set(sh.map(x => x.pid))].sort((a, b) => personName(a).localeCompare(personName(b), 'uk'));
  grid(ws, r, ['№', 'ПІБ', 'Посада', 'Днів', 'Годин', 'Особливий хар-р, год', 'Обʼєкти'], pids.map((pid, i) => {
    const m = sh.filter(x => x.pid === pid);
    return [i + 1, personName(pid), (get('Персонал', pid) || {}).posada || '', new Set(m.map(x => x.date)).size, r2(m.reduce((s, x) => s + x.hours, 0)), r2(m.reduce((s, x) => s + x.special, 0)), [...new Set(m.map(x => objShort(x.objectId)))].join(', ')];
  }), { left: [1, 2, 6] });
  return { wb, name: fname('Табель_персонал' + brTag(p) + (p.objectId ? '_' + objShort(p.objectId).slice(0, 25) : ''), p.from, p.to) };
};

// ───────── 4. Табель техніки ─────────
DOCS.tech = p => {
  const reps = filteredReports(p);
  const days = dateRange(p.from, p.to);
  const wb = wbNew();
  const ws = sheet(wb, 'Техніка', true);
  const C = 3 + days.length + 4;
  widths(ws, [4, 26, 24, ...days.map(() => 4.2), 7, 8, 9, 9]);
  let r = 1;
  if (org()) r = line(ws, r, org(), C, { size: 11 });
  r = line(ws, r, 'ТАБЕЛЬ роботи машин і механізмів по обʼєктах', C, { bold: true, size: 13 });
  r = line(ws, r, lab() + ', ' + periodText(p.from, p.to) + brSfx(p), C);
  r++;
  const shade = i => i >= 3 && i < 3 + days.length && isWeekend(days[i - 3]);
  const carRows = [];
  const carDay = {};
  reps.filter(x => x.carId).forEach(x => (carDay[x.carId + '|' + x.date] = (carDay[x.carId + '|' + x.date] || 0) + 1));
  const byCar = {};
  reps.filter(x => x.carId).forEach(x => (byCar[x.carId + '|' + x.objectId] = byCar[x.carId + '|' + x.objectId] || []).push(x));
  Object.entries(byCar).sort().forEach(([k, rs]) => {
    const [cid, oid] = k.split('|'); const car = get('Авто', cid) || {};
    const hrs = days.map(d => { const v = rs.filter(x => x.date === d).reduce((s, x) => s + shiftHours(x.schedule) / carDay[cid + '|' + d], 0); return v ? r2(v) : ''; });
    const km = rs.reduce((s, x) => s + num(x.km), 0);
    carRows.push([carRows.length + 1, (car.name || '') + ' ' + (car.plate || ''), objShort(oid), ...hrs, hrs.filter(Boolean).length, r2(hrs.reduce((s, v) => s + num(v), 0)), r2(km), r2(rs.reduce((s, x) => s + calc(x).carL, 0))]);
  });
  r = line(ws, r, 'Автомобілі', C, { bold: true, align: 'left' });
  r = grid(ws, r, ['№', 'Автомобіль', 'Обʼєкт', ...days.map(d => +d.slice(8)), 'Днів', 'Годин', 'Пробіг, км', 'Пальне, л'], carRows.length ? carRows : [['', 'немає даних', '', ...days.map(() => ''), '', '', '', '']], { left: [1, 2], size: 9, shade });
  r++;
  const genRows = [];
  const byGen = {};
  reps.filter(x => x.genId && num(x.genHours)).forEach(x => (byGen[x.genId + '|' + x.objectId] = byGen[x.genId + '|' + x.objectId] || []).push(x));
  Object.entries(byGen).sort().forEach(([k, rs]) => {
    const [gid, oid] = k.split('|'); const g = get('Генератори', gid) || {};
    const hrs = days.map(d => { const v = rs.filter(x => x.date === d).reduce((s, x) => s + num(x.genHours), 0); return v ? r2(v) : ''; });
    const tot = hrs.reduce((s, v) => s + num(v), 0);
    genRows.push([genRows.length + 1, (g.name || '') + (g.invNo ? ' інв.' + g.invNo : ''), objShort(oid), ...hrs, hrs.filter(Boolean).length, r2(tot), '', r2(rs.reduce((s, x) => s + num(x.genHours) * genNorm(g, x.date), 0))]);
  });
  r = line(ws, r, 'Електростанції (мотогодини)', C, { bold: true, align: 'left' });
  r = grid(ws, r, ['№', 'Електростанція', 'Обʼєкт', ...days.map(d => +d.slice(8)), 'Днів', 'Мотогод', '', 'Пальне, л'], genRows.length ? genRows : [['', 'немає даних', '', ...days.map(() => ''), '', '', '', '']], { left: [1, 2], size: 9, shade });
  signs(ws, r, C, [...head(), ['Табель склав', '']]);
  return { wb, name: fname('Табель_техніка' + brTag(p), p.from, p.to) };
};

// ───────── 5. Акт і протокол витрат палива ─────────
DOCS.fuel = p => {
  const reps = filteredReports(p).sort((a, b) => a.date.localeCompare(b.date));
  const wb = wbNew();
  const lines = [];
  for (const x of reps) {
    const c = calc(x);
    const car = x.carId && get('Авто', x.carId);
    if (car) { const cf = carFuelParts(x, car); cf.parts.forEach(pt => lines.push({ date: x.date, oid: x.objectId, tech: (car.name || '') + ' ' + (car.plate || '') + (pt.kind !== 'пробіг' ? ' — ' + pt.kind : ''), fuel: c.carFuel, unit: pt.unit, qty: pt.qty, norm: pt.norm, normU: pt.normU + ' (' + cf.season + ')', l: pt.l })); }
    if (x.genId && num(x.genHours)) { const g = get('Генератори', x.genId) || {}; lines.push({ date: x.date, oid: x.objectId, tech: g.name || '', fuel: c.genFuel, unit: 'мотогод', qty: num(x.genHours), norm: genNorm(g, x.date), normU: 'л/год (' + seasonName(x.date) + ')', l: c.genL }); }
  }
  // Акт
  const wa = sheet(wb, 'Акт');
  widths(wa, [5, 34, 18, 12, 12, 12]);
  const C = 6; let r = 1;
  if (org()) r = line(wa, r, org(), C, { size: 11 });
  r = line(wa, r, 'АКТ', C, { bold: true, size: 14 });
  r = line(wa, r, `списання паливно-мастильних матеріалів, використаних ${lab()} при виконанні робіт на обʼєктах ${periodText(p.from, p.to) + brSfx(p)}`, C, { h: 48 });
  r++;
  const byO = {};
  lines.forEach(l => { const o = byO[l.oid] = byO[l.oid] || { ДП: 0, 'А-95': 0 }; o[l.fuel] = (o[l.fuel] || 0) + l.l; });
  const tot = { ДП: 0, 'А-95': 0 };
  const rows = Object.entries(byO).sort((a, b) => objShort(a[0]).localeCompare(objShort(b[0]), 'uk')).map(([oid, f], i) => {
    tot['ДП'] += f['ДП'] || 0; tot['А-95'] += f['А-95'] || 0;
    return [i + 1, objShort(oid), (get('Обʼєкти', oid) || {}).lvumg || '', r2(f['ДП'] || 0), r2(f['А-95'] || 0), r2((f['ДП'] || 0) + (f['А-95'] || 0))];
  });
  rows.push(['', 'Разом', '', r2(tot['ДП']), r2(tot['А-95']), r2(tot['ДП'] + tot['А-95'])]);
  r = grid(wa, r, ['№', 'Обʼєкт', 'ЛВУМГ', 'ДП, л', 'А-95, л', 'Разом, л'], rows, { left: [1], boldLast: true });
  r++;
  r = line(wa, r, 'Витрата розрахована за нормами: автомобілі — за пробігом (л/100 км), електростанції — за мотогодинами (л/год). Детально — у протоколі.', C, { align: 'left', size: 10, italic: true, h: 30 });
  signs(wa, r, C, [['Голова комісії', ''], ['Члени комісії', ''], ['', ''], ...head()]);
  // Протокол
  const wp = sheet(wb, 'Протокол', true);
  widths(wp, [5, 11, 28, 26, 9, 10, 10, 10, 11, 11]);
  const C2 = 10; let q = 1;
  q = line(wp, q, 'ПРОТОКОЛ', C2, { bold: true, size: 14 });
  q = line(wp, q, `розрахунку витрат палива по обʼєктах ${periodText(p.from, p.to) + brSfx(p)}`, C2);
  q++;
  const prow = lines.map((l, i) => [i + 1, uaDate(l.date), objShort(l.oid), l.tech, l.fuel, l.unit, r2(l.qty), r2(l.norm), l.normU, r2(l.l)]);
  prow.push(['', '', 'Разом', '', '', '', '', '', '', r2(lines.reduce((s, l) => s + l.l, 0))]);
  q = grid(wp, q, ['№', 'Дата', 'Обʼєкт', 'Техніка', 'Пальне', 'Од.', 'Кількість', 'Норма', 'Од. норми', 'Витрата, л'], prow, { left: [2, 3], boldLast: true });
  signs(wp, q, C2, [...head(), ['Розрахунок склав', '']]);
  return { wb, name: fname('Акт_протокол_палива' + brTag(p) + (p.objectId ? '_' + objShort(p.objectId).slice(0, 25) : ''), p.from, p.to) };
};

// ───────── 6. Графік відпусток ─────────
DOCS.brief = p => {
  const list = all('Інструктажі').filter(b => b.date >= p.from && b.date <= p.to).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const wb = wbNew();
  const ws = sheet(wb, 'Журнал', true);
  widths(ws, [4, 11, 13, 30, 26, 18, 20, 20, 10, 20, 12, 12]);
  const C = 12; let r = 1;
  if (org()) r = line(ws, r, org(), C, { size: 11 });
  r = line(ws, r, 'ЖУРНАЛ РЕЄСТРАЦІЇ ІНСТРУКТАЖІВ З ПИТАНЬ ОХОРОНИ ПРАЦІ', C, { bold: true, size: 13 });
  r = line(ws, r, lab() + ', ' + periodText(p.from, p.to), C);
  r++;
  const rows = []; let n = 0;
  list.forEach(b => briefPeople(b).forEach(pid => {
    const pp = get('Персонал', pid) || {}; const ps = briefPass(b.id, pid);
    rows.push([++n, uaDate(b.date), b.type || '', b.title || '', pp.pib || '—', pp.posada || '', b.conductorId ? personName(b.conductorId) : '',
      ps ? uaDate(ps.date) + (ps.time ? ' ' + ps.time : '') + (ps.device ? '\n' + ps.device : '') : 'не пройдено', ps ? (ps.score || 'без питань') : '',
      ps && ps.condDate ? uaDate(ps.condDate) + (ps.condTime ? ' ' + ps.condTime : '') + '\n' + shortName(personName(ps.condBy)) : (ps ? 'не підтверджено' : ''), '', '']);
  }));
  r = grid(ws, r, ['№', 'Дата', 'Вид інструктажу', 'Тема / назва', 'ПІБ працівника', 'Посада', 'Хто проводив', 'Проходження підтвердив працівник (дата, час, пристрій)', 'Перевірка знань', 'Проведення підтвердив керівник (дата, час)', 'Підпис працівника', 'Підпис того, хто проводив'],
    rows.length ? rows : [['', '', '', 'інструктажів за період немає', '', '', '', '', '', '', '', '']], { left: [3, 4, 5, 6, 7], size: 9, hh: 44 });
  signs(ws, r, C, head());
  return { wb, name: fname('Журнал_інструктажів', p.from, p.to) };
};

DOCS.vac = p => {
  const Y = String(p.year || today().slice(0, 4));
  const ppl = staff().filter(x => x.role !== 'відвідувач');
  const wb = wbNew();
  const ws = sheet(wb, 'Графік ' + Y, true);
  widths(ws, [4, 28, 24, 11, 7, 6, 11, 11, 6, 11, 11, 6, 10, 12, 12]);
  const C = 15; let r = 1;
  if (org()) r = line(ws, r, org(), C, { size: 11 });
  r = line(ws, r, 'ГРАФІК ВІДПУСТОК', C, { bold: true, size: 14 });
  r = line(ws, r, lab() + ' на ' + Y + ' рік', C);
  r++;
  const rows = [];
  let n = 0;
  ppl.forEach(pp => {
    const s = vacSummary(pp.id, Y); const ack = vacAck(pp.id, Y);
    const parts = s.parts.length ? s.parts : [{}];
    parts.forEach((v, k) => rows.push([k ? '' : ++n, k ? '' : pp.pib, k ? '' : pp.posada || '', k ? '' : uaDate(pp.hireDate), k ? '' : s.norm, v.part || '',
      uaDate(v.planFrom), uaDate(v.planTo), v.planFrom ? vacLen(v.planFrom, v.planTo || v.planFrom) : '',
      uaDate(v.factFrom), uaDate(v.factTo), v.factFrom ? vacLen(v.factFrom, v.factTo || v.factFrom) : '', v.orderNo || '',
      k ? '' : (ack ? uaDate(ack.date) : ''), '']));
  });
  r = grid(ws, r, ['№', 'ПІБ', 'Посада', 'Дата прийняття', 'Норма, дн.', 'Част.', 'План з', 'План по', 'Днів', 'Факт з', 'Факт по', 'Днів', '№ наказу', 'Ознайомлений', 'Підпис'], rows, { left: [1, 2], size: 9, hh: 34 });
  signs(ws, r, C, head());

  const wm = sheet(wb, 'По місяцях', true);
  widths(wm, [4, 28, ...MONTHS.map(() => 7), 8, 8, 8, 8]);
  let q = line(wm, 1, 'Дні відпустки по місяцях, ' + Y + ' рік', 18, { bold: true });
  q++;
  const mrows = ppl.map((pp, i) => {
    const s = vacSummary(pp.id, Y);
    const ms = MONTHS.map((_, k) => { const m = Y + '-' + z2(k + 1); const c = vacDaysIn(pp.id, m + '-01', monthEnd(m)).size; return c || ''; });
    return [i + 1, pp.pib, ...ms, s.norm, s.plan, s.used, s.left];
  });
  grid(wm, q, ['№', 'ПІБ', ...MONTHS, 'Норма', 'Заплан.', 'Викор.', 'Залишок'], mrows, { left: [1], size: 9 });
  return { wb, name: 'Графік_відпусток_' + Y + '.xlsx' };
};

// ───────── 7. Особова картка обліку ЗІЗ ─────────
DOCS.ppecard = p => {
  const wb = wbNew();
  const ppl = p.personId ? [get('Персонал', p.personId)].filter(Boolean) : staff().filter(x => x.role !== 'відвідувач' && ppeOf(x.id).length);
  const used = new Set();
  ppl.forEach(pp => {
    let nm = shortName(pp.pib).replace(/[\\/?*[\]:]/g, '').slice(0, 28); while (used.has(nm)) nm += '_'; used.add(nm);
    const ws = sheet(wb, nm);
    widths(ws, [4, 34, 9, 12, 9, 9, 12, 14]);
    const C = 8; let r = 1;
    if (org()) r = line(ws, r, org(), C, { size: 11 });
    r = line(ws, r, 'ОСОБОВА КАРТКА', C, { bold: true, size: 14 });
    r = line(ws, r, 'обліку спецодягу, спецвзуття та інших засобів індивідуального захисту', C);
    r++;
    const info = [['Прізвище, імʼя, по батькові', pp.pib], ['Посада', pp.posada || ''], ['Структурний підрозділ', lab()], ['Дата прийняття на роботу', uaDate(pp.hireDate)],
      ['Зріст', pp.height || ''], ['Розмір одягу', pp.clothSize || ''], ['Розмір взуття', pp.shoeSize || ''], ['Розмір рукавиць', pp.gloveSize || '']];
    info.forEach(([k, v]) => { ws.mergeCells(r, 1, r, 3); ws.getCell(r, 1).value = k; ws.getCell(r, 1).font = { name: FONT, size: 11 }; ws.mergeCells(r, 4, r, C); ws.getCell(r, 4).value = v; ws.getCell(r, 4).font = { name: FONT, size: 11, bold: true }; r++; });
    r++;
    const rows = [];
    ppeOf(pp.id).forEach((x, i) => {
      const iss = ppeIssues(pp.id, x.item.id).slice().reverse();
      if (!iss.length) rows.push([i + 1, x.item.name + (x.item.code ? ' ' + x.item.code : ''), x.st.months, '', '', '', '', '']);
      iss.forEach((it, k) => { const a = ppeAck(it.id); rows.push([k ? '' : i + 1, k ? '' : x.item.name + (x.item.code ? ' ' + x.item.code : ''), k ? '' : x.st.months, uaDate(it.date), num(it.qty) || 1, it.size || '', uaDate(it.dueDate || addMonthsDate(it.date, x.st.months)), a ? 'підтв. ' + uaDate(a.date) : '']); });
    });
    r = grid(ws, r, ['№', 'Найменування ЗІЗ', 'Строк носіння, міс.', 'Дата видачі', 'К-сть', 'Розмір', 'Наступна заміна', 'Підпис працівника'], rows.length ? rows : [['', 'норми не задані', '', '', '', '', '', '']], { left: [1], size: 10, hh: 40 });
    signs(ws, r, C, [['Видав', ''], ...head()]);
  });
  if (!ppl.length) sheet(wb, 'Порожньо');
  return { wb, name: 'Картка_ЗІЗ_' + (p.personId ? shortName(personName(p.personId)).replace(/\s+/g, '_') : 'усі') + '.xlsx' };
};

// ───────── 8. Заявка (потреба) на ЗІЗ ─────────
DOCS.ppeneed = p => {
  const lim = p.to || addDays(today(), 90);
  const ppl = staff().filter(x => x.role !== 'відвідувач');
  const agg = {}; const det = [];
  ppl.forEach(pp => ppeOf(pp.id).forEach(x => {
    if (x.st.due && x.st.due > lim) return;
    const size = ppeSize(pp.id, x.item) || '';
    const k = x.item.id + '|' + size;
    (agg[k] = agg[k] || { item: x.item, size, n: 0 }).n++;
    det.push([pp.pib, x.item.name, size, x.st.due ? uaDate(x.st.due) : 'не видавалось']);
  }));
  const wb = wbNew();
  const ws = sheet(wb, 'Заявка');
  widths(ws, [5, 44, 16, 10, 22]);
  const C = 5; let r = 1;
  if (org()) r = line(ws, r, org(), C, { size: 11 });
  r = line(ws, r, 'ЗАЯВКА', C, { bold: true, size: 14 });
  r = line(ws, r, `на засоби індивідуального захисту для працівників ${lab()} (потреба до ${uaDate(lim)})`, C, { h: 34 });
  r++;
  const rows = Object.values(agg).sort((a, b) => String(a.item.name).localeCompare(String(b.item.name), 'uk') || String(a.size).localeCompare(String(b.size)))
    .map((x, i) => [i + 1, x.item.name + (x.item.code ? ' ' + x.item.code : ''), x.size || '—', x.n, x.item.category || '']);
  rows.push(['', 'Разом', '', rows.reduce((s, x) => s + x[3], 0), '']);
  r = grid(ws, r, ['№', 'Найменування', 'Розмір', 'К-сть', 'Група'], rows, { left: [1, 4], boldLast: true });
  signs(ws, r, C, head());
  const wd = sheet(wb, 'По працівниках');
  widths(wd, [5, 32, 44, 16, 16]);
  grid(wd, 1, ['№', 'ПІБ', 'Найменування', 'Розмір', 'Строк сплив / спливає'], det.map((x, i) => [i + 1, ...x]), { left: [1, 2] });
  return { wb, name: 'Заявка_ЗІЗ_до_' + uaDate(lim) + '.xlsx' };
};

// ───────── 9. Акт витрат матеріалів НК ─────────
DOCS.mat = p => {
  const reps = filteredReports(p, true).filter(r => !truthy(r.travel)).sort((a, b) => a.date.localeCompare(b.date));
  const wb = wbNew();
  const wa = sheet(wb, 'Акт', true);
  widths(wa, [4, 30, 8, 8, 11, 10, 10, 8, 11, 11, 11]);
  const C = 11; let r = 1;
  if (org()) r = line(wa, r, org(), C, { size: 11 });
  r = line(wa, r, 'АКТ', C, { bold: true, size: 14 });
  r = line(wa, r, `списання матеріалів для неруйнівного контролю, використаних ${lab()} ${periodText(p.from, p.to) + brSfx(p)}`, C, { h: 34 });
  r++;
  const byObj = {};
  reps.forEach(x => (byObj[x.objectId] = byObj[x.objectId] || []).push(x));
  const rows = []; const tot = { rt: 0, film: 0, dev: 0, fix: 0, pt: 0, pts: 0, ptp: 0, ptd: 0 };
  let n = 0;
  Object.keys(byObj).sort((a, b) => objShort(a).localeCompare(objShort(b), 'uk')).forEach(oid => {
    diamBreakdown(byObj[oid]).filter(x => x.rt || x.pt || x.film || x.pts || x.ptp || x.ptd).forEach((x, k) => {
      rows.push([k ? '' : ++n, k ? '' : objShort(oid), x.d || '—', x.rt, r3(x.film), r3(x.dev), r3(x.fix), x.pt, r3(x.pts), r3(x.ptp), r3(x.ptd)]);
      Object.keys(tot).forEach(t => (tot[t] += num(x[t])));
    });
  });
  rows.push(['', 'Разом', '', tot.rt, r3(tot.film), r3(tot.dev), r3(tot.fix), tot.pt, r3(tot.pts), r3(tot.ptp), r3(tot.ptd)]);
  r = grid(wa, r, ['№', 'Обʼєкт', 'Ø, мм', 'RT, стиків', 'Плівка, дм²', 'Проявник, л', 'Фіксаж, л', 'PT, стиків', 'Розчинник PT, л', 'Пенетрант PT, л', 'Проявник PT, л'], rows, { left: [1], boldLast: true, hh: 40 });
  r++;
  r = line(wa, r, 'Витрата розрахована за нормами на 1 стик для відповідного діаметра труби; де у щоденному звіті вказано фактичну витрату — враховано фактичну.', C, { align: 'left', size: 10, italic: true, h: 30 });
  signs(wa, r, C, [['Голова комісії', ''], ['Члени комісії', ''], ['', ''], ...head()]);

  const wp = sheet(wb, 'Протокол', true);
  widths(wp, [4, 11, 28, 6, 8, 8, 11, 10, 10, 8, 11, 11, 11, 8]);
  let q = line(wp, 1, 'ПРОТОКОЛ витрат матеріалів по щоденних звітах ' + periodText(p.from, p.to) + brSfx(p), 14, { bold: true });
  q++;
  const prow = [];
  reps.forEach(x => {
    const norm = matByNorm(volRows(x)); const man = arr(x.matManual);
    volRows(x).forEach((v, k) => {
      const nv = matByNorm([v]);
      const part = key => norm[key] ? repMat(x, key) * nv[key] / norm[key] : (k === 0 ? repMat(x, key) : 0);
      prow.push([prow.length + 1, uaDate(x.date), objShort(x.objectId), 'Б' + x.brigade, v.d || '—', num(v.rt), r3(part('film')), r3(part('dev')), r3(part('fix')), num(v.pt), r3(part('pts')), r3(part('ptp')), r3(part('ptd')), man.length ? 'факт' : 'норма']);
    });
  });
  grid(wp, q, ['№', 'Дата', 'Обʼєкт', 'Бр.', 'Ø', 'RT', 'Плівка, дм²', 'Прояв., л', 'Фікс., л', 'PT', 'PT розч., л', 'PT пенетр., л', 'PT прояв., л', 'Основа'], prow.length ? prow : [['', '', 'немає даних', '', '', '', '', '', '', '', '', '', '', '']], { left: [2], size: 9 });
  return { wb, name: fname('Акт_матеріалів_НК' + brTag(p) + (p.objectId ? '_' + objShort(p.objectId).slice(0, 25) : ''), p.from, p.to) };
};
const r3 = n => Math.round(num(n) * 1000) / 1000;
