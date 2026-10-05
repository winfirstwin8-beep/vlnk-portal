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
      <span class="small mute">${uaDate(p.date)}${p.brigade ? ' · ' + brName(p.brigade) : ''}${p.authorId ? ' · ' + esc(shortName(personName(p.authorId))) : ''}${p.note ? ' · ' + esc(p.note) : ''}</span>
      ${p.fileName ? `<span class="small ordername">📄 ${esc(p.fileName)}${String(p.file || '').startsWith('data:') || DB.cachedFiles.has(p.fileId) || DB.cachedFiles.has('local-' + p.id) ? ' <span class="ok">✓ офлайн</span>' : ''}</span>` : ''}
      <div class="row gap order">${has ? `<button type="button" class="btn small primary" data-act="protodl" data-id="${esc(p.id)}">⬇ Завантажити</button>${DB.mailQ.has(p.id) ? badge('✉ лист у черзі', 'warn') : `<button type="button" class="btn small ghost" data-act="protomail" data-id="${esc(p.id)}">✉ На пошту</button>`}${navigator.canShare ? `<button type="button" class="btn small ghost" data-act="protoshare" data-id="${esc(p.id)}">↗ Поділитися</button>` : ''}` : '<span class="small mute">файл не додано</span>'}
      ${pend ? badge('⏳ відправляється', 'warn') : ''}${canDel ? `<button type="button" class="btn small ghost" data-act="del" data-t="Протоколи" data-id="${esc(p.id)}" data-back="${esc(location.hash)}">Видалити</button>` : ''}</div></div>`;
}
function protoSection(oid, taskId) {
  const all_ = all('Протоколи').filter(p => p.objectId === oid)
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
        <label class="f"><span>Файл протоколу *</span><input type="file" name="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"><small>PDF, фото, Word або Excel до 15 МБ; фото стискається автоматично</small></label>
        ${fInp('Примітка', 'note', '', { ph: 'напр. стики № 12–24, Ø 530' })}
        <div class="form-actions"><button type="submit" class="btn primary">Зберегти протокол</button></div></form></details>`;
  }
  return card('Протоколи НК' + (all_.length ? ' · ' + all_.length : ''), h);
}
FORMS.proto = async (d, oid, f) => {
  if (d.objectId) { oid = d.objectId; delete d.objectId; }
  if (!oid) return toast('Оберіть обʼєкт');
  const file = f.querySelector('input[name=file]').files[0];
  if (!need(d, [['method', 'метод'], ['number', '№ протоколу'], ['date', 'дата']])) return;
  if (!file) return toast('Оберіть файл протоколу');
  const dup = all('Протоколи').find(p => p.objectId === oid && p.method === d.method && String(p.number).trim() === String(d.number).trim());
  if (dup && !await ask(`Протокол ${d.method} № ${d.number} на цьому обʼєкті вже є. Додати ще один?`)) return;
  delete d.file;
  const row = await save('Протоколи', { ...d, objectId: oid, taskId: f.dataset.task || '', authorId: ME.personId || '' });
  try {
    const r = await queueProto(row.id, file);
    toast(r === 'saved' ? 'Протокол збережено' : navigator.onLine ? 'Протокол відправляється…' : 'Протокол збережено на телефоні — відправиться, коли зʼявиться інтернет');
  } catch (e) { toast('Файл не додано: ' + e.message); }
  UI.dirty = false; UI.protoOpen = false; UI.regObj = oid; render();
};
/** Наступний № протоколу для обʼєкта й методу (підказка; можна змінити). */
function nextProtoNo(oid, method) {
  const ns = all('Протоколи').filter(p => p.objectId === oid && (!method || p.method === method)).map(p => parseInt((String(p.number).match(/\d+/) || ['0'])[0], 10)).filter(n => n > 0);
  return ns.length ? String(Math.max(...ns) + 1) : '1';
}
/** Реєстрація протоколів НК по обʼєктах: форма + реєстр. Файл зберігається на Диску в папці «Протоколи НК / <коротка назва обʼєкта>». */
ROUTES.protocols = () => {
  const vis = isVisitor();
  const m = UI.regMonth || '';
  const fo = UI.regObjF || '';
  let h = '';
  if (!vis) {
    // лише обʼєкти зі статусом «в роботі» (є завдання, що виконується зараз)
    const cur = new Set(all('Завдання').filter(isTaskInWork).map(t => t.objectId));
    const opts = objOpts().filter(o => cur.has(o[0]));
    const oid = UI.regObj && cur.has(UI.regObj) ? UI.regObj : '';
    const meth = UI.regMeth || 'RT';
    const mb = myBrigade(today()) || {};
    h += card('Зареєструвати протокол', `<form class="form" data-form="proto" data-id="" novalidate>
      ${fSel('Обʼєкт', 'objectId', opts, oid, { req: true, none: opts.length ? '— оберіть обʼєкт у роботі —' : '— немає обʼєктів у роботі —', re: true, hint: 'показано лише обʼєкти зі статусом «в роботі»; для інших — картка обʼєкта → «Протоколи НК»' })}
      <div class="grid2">${fSel('Метод контролю', 'method', PROTO_METHODS, meth, { req: true, re: true })}${fInp('№ протоколу', 'number', oid ? nextProtoNo(oid, meth) : '', { req: true })}</div>
      <div class="grid2">${fInp('Дата видачі', 'date', today(), { type: 'date', req: true })}${fSel('Бригада', 'brigade', BRIGADES.map(n => [n, brName(n)]), mb.num || '', { none: '—' })}</div>
      <label class="f"><span>Файл протоколу *</span><input type="file" name="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"><small>Зберігається на Google Диску в папці «Протоколи НК / ${oid ? esc(objShort(oid)) : 'коротка назва обʼєкта'}» — папка створюється автоматично</small></label>
      ${fInp('Примітка', 'note', '', { ph: 'напр. стики № 12–24, Ø 530' })}
      <div class="form-actions"><button type="submit" class="btn primary">Зареєструвати</button></div></form>`);
  }
  let list = all('Протоколи').slice();
  if (fo) list = list.filter(p => p.objectId === fo);
  if (m) list = list.filter(p => String(p.date).slice(0, 7) === m);
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number), 'uk', { numeric: true }));
  const months = [...new Set(all('Протоколи').map(p => String(p.date).slice(0, 7)).filter(Boolean))].sort().reverse();
  const objs = [...new Set(all('Протоколи').map(p => p.objectId))].map(id => [id, objShort(id)]).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'uk'));
  h += `<div class="filters">${fSel('Обʼєкт', 'rf', objs, fo, { none: 'Усі обʼєкти' }).replace('name="rf"', 'data-set="regObjF"')}${fSel('Місяць', 'rm', months.map(x => [x, monthName(x)]), m, { none: 'Усі місяці' }).replace('name="rm"', 'data-set="regMonth"')}</div>`;
  h += card('Реєстр протоколів · ' + list.length, list.length ? list.slice(0, UI.plimit || 30).map(p => protoItem(p, true)).join('') + (list.length > (UI.plimit || 30) ? `<button class="btn ghost wide" data-act="pmore">Показати ще</button>` : '') : empty('Протоколів не знайдено'));
  return page('Протоколи НК', h, '#/menu');
};
ONCHANGE.proto = (d, field) => { if (field === 'objectId') UI.regObj = d.objectId; if (field === 'method') UI.regMeth = d.method; d.number = d.objectId ? nextProtoNo(d.objectId, d.method) : ''; };
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
  if (UI.oact === '1') list = list.filter(o => act.has(o.id));
  list.sort((a, b) => (act.has(b.id) ? 1 : 0) - (act.has(a.id) ? 1 : 0));
  let h = `<input class="search" type="search" placeholder="Пошук: назва, ICP, замовлення…" value="${esc(UI.oq || '')}" data-set="oq">
    <div class="filters">${fSel('ЛВУМГ', 'x', lvs, lv, { none: 'Усі ЛВУМГ' }).replace('name="x"', 'data-set="olv"')}</div>
    ${seg('oact', [['', 'Усі ' + all('Обʼєкти').length], ['1', 'В роботі цього місяця']], UI.oact || '')}`;
  if (isLead()) h += fab('#/objform/new');
  h += list.slice(0, UI.limit).map(o => {
    const len = num(o.length); const f = facts[o.id];
    return `<a class="item" href="#/object/${esc(o.id)}">
      <div class="row between"><b>${esc(o.short || o.name)}</b>${act.has(o.id) ? badge('в роботі', 'pri') : (o.status ? badge(esc(o.status)) : '')}</div>
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
    ['Статус', esc(o.status)], ['ЛВУМГ', esc(o.lvumg)], ['Промисловий майданчик', esc(o.site)], ['Населений пункт', esc(o.settlement)],
    ['Відповідальний від замовника', respText(o)], ['Посада відповідального', esc(o.contactPos || (objResp(o) || {}).posada || '')], ['Автомобіль', objCarText(o)], ['Дорога', [o.distBase ? 'від бази ' + esc(o.distBase) + ' км' : '', o.distObj ? 'до обʼєкта ' + esc(o.distObj) + ' км' : '', o.travelTime ? 'у дорозі ' + esc(o.travelTime) : ''].filter(Boolean).join(' · ')], ['Координати', coords],
    ['СО/ТОРО замовлення', esc(o.soOrder)], ['СО/ТОРО підзамовлення', esc(o.soSubOrder)], ['Пропонований готель', esc(o.hotel)],
    ['Діаметр', o.diameter ? 'Ø ' + esc(o.diameter) + ' мм' : ''], ['Довжина ділянок ремонту', len ? fmtN(len) + ' м' : ''],
    ['Види робіт', esc(arr(o.workTypes).join(', '))], ['Методи НК', esc(methodsOf(o.methods).join(', '))], ['Примітка', esc(o.note)]
  ]));
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
    ['Статус', esc(o.status)], ['ЛВУМГ', esc(o.lvumg)], ['Промисловий майданчик', esc(o.site)], ['Населений пункт', esc(o.settlement)],
    ['Відповідальний від замовника', respText(o)], ['Посада відповідального', esc(o.contactPos || (objResp(o) || {}).posada || '')], ['Автомобіль', objCarText(o)], ['Дорога', [o.distBase ? 'від бази ' + esc(o.distBase) + ' км' : '', o.distObj ? 'до обʼєкта ' + esc(o.distObj) + ' км' : '', o.travelTime ? 'у дорозі ' + esc(o.travelTime) : ''].filter(Boolean).join(' · ')], ['Координати', coords],
    ['СО/ТОРО замовлення', esc(o.soOrder)], ['СО/ТОРО підзамовлення', esc(o.soSubOrder)], ['ICP', esc(o.icp)], ['Пропонований готель', esc(o.hotel)],
    ['Діаметр', o.diameter ? 'Ø ' + esc(o.diameter) + ' мм' : ''], ['Довжина ділянок ремонту', len ? fmtN(len) + ' м' : ''],
    ['Види робіт', esc(arr(o.workTypes).join(', '))], ['Методи НК', esc(methodsOf(o.methods).join(', '))], ['Примітка', esc(o.note)]
  ]) + (isLead() ? `<a class="btn ghost" href="#/objform/${esc(id)}">Редагувати</a>` : ''));

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
    `<div class="grid2">${fInp('Статус', 'status', d.status)}${fInp('ЛВУМГ', 'lvumg', d.lvumg)}</div>
     ${fInp('Промисловий майданчик', 'site', d.site)}
     ${fInp('Пропонований готель', 'hotel', d.hotel, { ph: 'назва, адреса, телефон' })}
     ${fInp('Населений пункт', 'settlement', d.settlement)}
     <fieldset class="f"><legend>Відповідальний від замовника</legend><div class="grid2">${fInp('ПІБ', 'contact', d.contact, { list: 'resplist', hint: visitors().length ? 'оберіть зі списку «Відповідальні від замовника» або впишіть' : '' })}${fInp('Посада', 'contactPos', d.contactPos)}</div>
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
  let h = `<div class="row gap"><a class="btn ghost" href="#/certs">Сертифікати</a><a class="btn ghost" href="#/ackmatrix">Ознайомлення</a>${isLead() ? `<a class="btn ghost" href="#/visitors">Відповідальні від замовника${nv ? ' · ' + nv : ''}</a>` : ''}${isLead() && hiddenPeople().length ? `<a class="btn ghost" href="#/hiddenstaff">Приховані · ${hiddenPeople().length}</a>` : ''}</div>`;
  if (isLead()) h += fab('#/personform/new');
  const st = staff(), stOf = {}; st.forEach(p => (stOf[p.id] = personState(p)));
  const cnt = k => st.filter(p => stOf[p.id] === k).length;
  const work = st.filter(p => !stOf[p.id]).length;
  const f = UI.sfilt || '';
  h += `<div class="kpis staffkpi">${[['', 'Усього', st.length], ['work', 'На роботі', work], ['відпустка', '🌴 У відпустці', cnt('відпустка')], ['лікарняний', '🤒 На лікарняному', cnt('лікарняний')], ['ЗСУ', '🎖 В ЗСУ', cnt('ЗСУ')], ['навчання', '🎓 На навчанні', cnt('навчання')]]
    .map(([k, l, n]) => `<button type="button" class="kpi${f === k ? ' on' : ''}" data-act="sfilt" data-k="${esc(k)}"><b>${n}</b><span>${l}</span></button>`).join('')}</div>`;
  if (isLead()) h += `<button class="btn ghost small" data-act="importold">⬇ Табельні номери, дати й пошта з попереднього порталу</button>`;
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
    ${os.length ? `<span class="small">${os.map(o => esc(o.short || o.name) + (o.settlement ? ' (📍 ' + esc(o.settlement) + ')' : '')).join(', ')}</span>` : ''}</a>`; }).join('')) : empty('Відповідальних від замовника немає');
  return page('Відповідальні від замовника', h, '#/staff');
};

ROUTES.person = id => {
  if (isVisitor()) return denied();
  const p = get('Персонал', id);
  if (!p) return notFound();
  const lead = isLead();
  const vis = p.role === 'відвідувач';
  let h = card(esc(p.pib), kv([
    ['Посада', esc(p.posada)], ...(vis ? [] : [['Табельний номер', esc(p.tabNo || '')]]),
    ...(vis ? [] : [['Стан', personState(p) ? `<b class="warn">${esc(STATE_LABEL[personState(p)] || personState(p))}</b>${p.absence === personState(p) && (p.absenceFrom || p.absenceTo) ? ` <span class="small mute">${p.absenceFrom ? 'з ' + uaDate(p.absenceFrom) : ''}${p.absenceTo ? ' до ' + uaDate(p.absenceTo) : ''}</span>` : ''}` : '<span class="ok">на роботі</span>']]),
    ['Роль у порталі', esc(roleName(p.role))], ['Email (вхід)', esc(p.email)], ['Корпоративна пошта', p.emailCorp ? `<a href="mailto:${esc(p.emailCorp)}">${esc(p.emailCorp)}</a>` : ''],
    ['Телефон', p.phone ? `<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ''],
    ...(vis ? [] : [['Графік', p.schedule === '11' ? '11 год (07:00–19:00)' : '8 год (08:00–17:00)'],
      ['Водій', truthy(p.isDriver) ? 'так' : ''], ['Посвідчення водія', esc(p.driverLicense) + (p.licenseTo ? ' · ' + validity(p.licenseTo).text : '')],
      ['Допуск до авто', arr(p.carAccess).map(c => esc(carName(c))).join(', ')],
      ['Працевлаштований', p.hireDate ? uaDate(p.hireDate) : ''], ['Стаж на підприємстві', esc(seniority(p.hireDate))],
      ['Працює за фахом з', p.profSince ? uaDate(p.profSince) : ''], ['Стаж за професією', esc(seniority(p.profSince))]]),
    ['Примітка', esc(p.note)]
  ]) + (lead ? `<a class="btn ghost" href="#/personform/${esc(id)}">Редагувати</a>` : '') + (p.role === 'відвідувач' ? '<p class="small mute">Відповідальний від замовника — не входить до персоналу лабораторії, має доступ лише на перегляд.</p>' : ''));
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
  const docs = all('Документи').filter(d => truthy(d.required));
  const ok = docs.filter(d => ackOf(d.id, id)).length;
  h += card('Ознайомлення з документами', `<p>${ok} з ${docs.length} обовʼязкових</p>${bar(docs.length ? ok / docs.length * 100 : 0)}`);
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
  const body = fInp('ПІБ', 'pib', d.pib, { req: true, ph: 'Прізвище Імʼя По батькові' }) + (vis0 ? fInp('Посада', 'posada', d.posada) : `<div class="grid2">${fInp('Посада', 'posada', d.posada)}${fInp('Табельний номер', 'tabNo', d.tabNo, { mode: 'numeric' })}</div>`) +
    `<div class="grid2">${fInp('Email (для входу)', 'email', d.email, { type: 'email', hint: 'без email увійти в портал не можна' })}${fInp('Телефон', 'phone', d.phone, { type: 'tel' })}</div>
     ${vis0 ? '' : fInp('Корпоративна пошта', 'emailCorp', d.emailCorp, { type: 'email', ph: 'name@tsoua.com' })}
     <div class="grid2">${fSel('Роль у порталі', 'role', ROLE_OPTS, d.role, { re: true })}${fInp('PIN для входу', 'pin', '', { mode: 'numeric', ph: src ? 'не змінювати' : '4–6 цифр' })}</div>` +
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
  if (!d.pin) delete d.pin;
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
function holderOpts() {
  return [['склад', 'Склад'], ...all('Авто').map(c => ['авто:' + c.id, 'Авто: ' + c.name]), ...staff().filter(p => p.role !== 'відвідувач').map(p => ['працівник:' + p.id, shortName(p.pib)])];
}
ROUTES.equip = () => {
  if (isVisitor()) return denied();
  const tab = UI.etab || 'list';
  let h = seg('etab', [['list', 'Обладнання'], ['moves', 'Переміщення']], tab) + `<a class="btn ghost wide" href="#/kit">Комплектація автомобілів за методами ›</a>`;
  if (tab === 'moves') {
    const mv = all('Переміщення').slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.updatedAt || 0) - (a.updatedAt || 0));
    h += mv.slice(0, UI.limit).map(m => { const e = get('Обладнання', m.equipId) || {}; return `<div class="item"><div class="row between"><b>${esc(e.name || '—')}</b><span class="small">${uaDate(m.date)}</span></div>
      <span class="small">${esc(holderName(m.fromType, m.fromId))} → <b>${esc(holderName(m.toType, m.toId))}</b></span>
      <span class="small mute">Стан: ${esc(m.condition || '—')}${m.note ? ' · ' + esc(m.note) : ''} · ${esc(personName(m.authorId))}</span></div>`; }).join('') + more(mv.length) || empty('Переміщень немає');
    return page('Обладнання', h, '#/menu');
  }
  const q = String(UI.eq || '').toLowerCase(); const hf = UI.eh || '';
  let list = all('Обладнання').filter(e => (!q || [e.name, e.invNo, e.serial, e.method].join(' ').toLowerCase().includes(q)));
  if (hf) list = list.filter(e => hf === 'склад' ? (!e.holderType || e.holderType === 'склад') : (e.holderType + ':' + e.holderId) === hf);
  list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'uk'));
  h += `<input class="search" type="search" placeholder="Пошук: назва, інв. №, метод" value="${esc(UI.eq || '')}" data-set="eq">
    <div class="filters">${fSel('Де знаходиться', 'x', holderOpts(), hf, { none: 'Усі місця' }).replace('name="x"', 'data-set="eh"')}</div>`;
  if (isLead()) h += fab('#/equipform/new');
  h += list.slice(0, UI.limit).map(e => {
    const cl = e.condition === 'несправне' ? 'bad' : e.condition === 'потребує обслуговування' ? 'warn' : 'ok';
    const cal = e.calibTo ? validity(e.calibTo) : null;
    return `<div class="item"><div class="row between"><b>${esc(e.name)}</b>${badge(esc(e.condition || 'справне'), cl)}</div>
      <span class="small mute">інв. ${esc(e.invNo || '—')}${e.serial ? ' · зав. ' + esc(e.serial) : ''}${e.method ? ' · ' + esc(normM(e.method)) : ''}</span>
      <span class="small">📍 ${esc(holderName(e.holderType, e.holderId))}${cal ? ' · повірка ' + `<span class="${cal.cls}">${cal.text}</span>` : ''}</span>
      <div class="row gap">${canReport() ? `<a class="btn small" href="#/moveform/${esc(e.id)}">Передати</a>` : ''}${isLead() ? `<a class="btn small ghost" href="#/equipform/${esc(e.id)}">Змінити</a>` : ''}</div></div>`;
  }).join('') + (list.length ? more(list.length) : empty('Обладнання не знайдено'));
  return page('Обладнання', h, '#/menu');
};
ROUTES.equipform = (id = 'new') => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Обладнання', id) : null;
  const d = src || { condition: 'справне', holderType: 'склад' };
  const body = fInp('Найменування', 'name', d.name, { req: true }) +
    `<div class="grid2">${fInp('Інвентарний №', 'invNo', d.invNo)}${fInp('Заводський №', 'serial', d.serial)}</div>
     <div class="grid2">${fSel('Метод НК', 'method', [...METHODS, 'Загальне'], normM(d.method), { none: '—' })}${fSel('Стан', 'condition', CONDITIONS, d.condition)}</div>
     ${fSel('Де знаходиться', 'holder', holderOpts(), d.holderType && d.holderType !== 'склад' ? d.holderType + ':' + d.holderId : 'склад')}
     ${fInp('Повірка / калібрування дійсні до', 'calibTo', d.calibTo, { type: 'date' })}${fArea('Примітка', 'note', d.note, { rows: 2 })}`;
  return page(src ? 'Обладнання' : 'Нове обладнання', form('equip', id, body, src ? { del: { t: 'Обладнання', id, back: '#/equip' } } : {}), '#/equip');
};
FORMS.equip = async (d, id) => {
  if (!need(d, [['name', 'найменування']])) return;
  const [ht, hid] = d.holder.split(':'); delete d.holder;
  const src = id !== 'new' ? get('Обладнання', id) : {};
  await save('Обладнання', { ...src, ...d, holderType: ht, holderId: hid || '', id: id !== 'new' ? id : undefined });
  UI.dirty = false; savedMsg('Збережено'); go('#/equip');
};
ROUTES.moveform = id => {
  if (!canReport()) return denied();
  const e = get('Обладнання', id);
  if (!e) return notFound();
  const body = `<div class="note">${esc(e.name)} · інв. ${esc(e.invNo || '—')}<br>Зараз: <b>${esc(holderName(e.holderType, e.holderId))}</b></div>` +
    fSel('Кому / куди передати', 'to', holderOpts().filter(o => o[0] !== (e.holderType && e.holderType !== 'склад' ? e.holderType + ':' + e.holderId : 'склад')), '', { req: true, none: '— оберіть —' }) +
    `<div class="grid2">${fInp('Дата', 'date', today(), { type: 'date', req: true })}${fSel('Стан при передачі', 'condition', CONDITIONS, e.condition || 'справне')}</div>` +
    fArea('Примітка (комплектність, пошкодження)', 'note', '', { rows: 2 });
  return page('Передача обладнання', form('move', id, body, { submit: 'Передати' }), '#/equip');
};
FORMS.move = async (d, id) => {
  if (!need(d, [['to', 'кому передати'], ['date', 'дата']])) return;
  const e = get('Обладнання', id);
  const [tt, tid] = d.to.split(':');
  await save('Переміщення', { equipId: id, date: d.date, fromType: e.holderType || 'склад', fromId: e.holderId || '', toType: tt, toId: tid || '', condition: d.condition, note: d.note, authorId: ME.personId });
  const upd = { ...e, holderType: tt, holderId: tid || '', condition: d.condition };
  if (isLead() || MODE === 'demo') await save('Обладнання', upd); else await applyLocal('Обладнання', upd);
  UI.dirty = false; savedMsg('Передачу зафіксовано'); go('#/equip');
};

// ═════════ КОМПЛЕКТАЦІЯ АВТО ═════════
ROUTES.kit = () => {
  if (isVisitor()) return denied();
  const req = all('Комплектація');
  const methods = METHODS.filter(m => req.some(r => normM(r.method) === m));
  let h = `<p class="small mute">Обладнання в автомобілі порівнюється з нормою комплектації за кожним методом (збіг за назвою).</p>`;
  for (const c of all('Авто')) {
    const inCar = all('Обладнання').filter(e => e.holderType === 'авто' && e.holderId === c.id);
    let rows = '', okM = 0;
    for (const m of methods) {
      const items = req.filter(r => normM(r.method) === m);
      const st = items.map(it => { const have = inCar.filter(e => String(e.name).toLowerCase().includes(String(it.item).toLowerCase())).length; return { it, have, ok: have >= (num(it.qty) || 1) }; });
      const full = st.every(x => x.ok); if (full) okM++;
      rows += `<details><summary>${full ? '✅' : '⚠️'} <b>${esc(m)}</b> <span class="small mute">${st.filter(x => x.ok).length}/${st.length}</span></summary>
        <ul class="plain small">${st.map(x => `<li class="${x.ok ? '' : 'bad'}">${x.ok ? '✓' : '✗'} ${esc(x.it.item)} — ${x.have}/${num(x.it.qty) || 1}${isLead() ? ` <a href="#" data-act="del" data-t="Комплектація" data-id="${esc(x.it.id)}" data-back="#/kit">×</a>` : ''}</li>`).join('')}</ul></details>`;
    }
    h += card('🚐 ' + esc(c.name) + (c.plate ? ' · ' + esc(c.plate) : ''), (methods.length ? `<p class="small">Укомплектовано за методами: <b>${okM} з ${methods.length}</b></p>${bar(okM / methods.length * 100)}` + rows : empty('Норми комплектації не задані')) +
      `<p class="small mute">Усього обладнання в авто: ${inCar.length}</p>`);
  }
  if (isLead()) h += card('Додати позицію до норми', form('kit', '', `<div class="grid2">${fSel('Метод', 'method', METHODS, 'RT')}${fNum('Кількість', 'qty', 1)}</div>${fInp('Найменування (частина назви)', 'item', '', { req: true, ph: 'напр. Негатоскоп' })}`, { submit: 'Додати' }));
  return page('Комплектація авто', h, '#/equip');
};
FORMS.kit = async d => {
  if (!need(d, [['item', 'найменування']])) return;
  await save('Комплектація', d); UI.dirty = false; savedMsg('Додано'); render();
};

// ═════════ ДОКУМЕНТИ: «Інструкції» (ОП, робочі, посадові, положення) і «НД» (загальна, по методах, ДДК) ═════════
const docReadable = d => !!(String(d.text || '').trim() || d.file || d.fileId);
function docItem(d) {
  const a = ME.personId ? ackOf(d.id, ME.personId) : null;
  const rd = docReadable(d);
  return `<div class="item"><div class="row between">${rd ? `<a href="#/doc/${esc(d.id)}"><b>${esc(d.title)}</b></a>` : `<b>${esc(d.title)}</b>`}${truthy(d.required) ? badge('обовʼязково') : ''}</div>
    <span class="small mute">${isND(d) ? esc(d.kind) + (d.version || d.date ? ' · ' : '') : ''}${d.version ? 'ред. ' + esc(d.version) : ''}${d.date ? ' від ' + uaDate(d.date) : ''}${String(d.text || '').trim() ? ' · текст у порталі' : ''}${d.fileName ? ' · файл' : ''}</span>
    <div class="row gap">${rd ? `<a class="btn small ${a || !ME.personId ? 'ghost' : 'primary'}" href="#/doc/${esc(d.id)}">📖 ${a || !ME.personId ? 'Читати' : 'Читати й ознайомитися'}</a>` : ''}${d.link ? `<a class="btn small ghost" href="${esc(d.link)}" target="_blank" rel="noopener">Відкрити ↗</a>` : ''}${docSendBtns(d)}
    ${ME.personId ? (a ? badge('✓ ознайомлений ' + uaDate(a.date), 'ok') : rd ? '' : `<button class="btn small primary" data-act="ack" data-id="${esc(d.id)}">Ознайомлений</button>`) : ''}
    ${isLead() ? `<a class="btn small ghost" href="#/docform/${esc(d.id)}">Змінити</a>` : ''}</div></div>`;
}
const byTitle = (a, b) => String(a.title).localeCompare(String(b.title), 'uk');
ROUTES.docs = () => {
  if (isVisitor()) return denied();
  const docs = all('Документи').filter(d => !isND(d));
  let h = isLead() ? `<div class="row gap"><a class="btn ghost" href="#/ackmatrix">Журнал ознайомлення</a></div>` + fab('#/docform/new') : '';
  for (const k of INSTR_KINDS) {
    const ds = docs.filter(d => d.kind === k).sort(byTitle);
    if (ds.length) h += card(k, ds.map(docItem).join(''));
  }
  if (!docs.length) h += empty('Інструкції ще не додані');
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
  h += `<div class="row gap docbar"><button class="btn small ghost" data-act="docfs" data-v="-1" aria-label="Менший шрифт">A−</button><button class="btn small ghost" data-act="docfs" data-v="1" aria-label="Більший шрифт">A+</button>
    ${hasFile ? `<button class="btn small ghost" data-act="docfile" data-id="${esc(d.id)}">📄 ${esc(d.fileName || 'Файл документа')}</button>` : ''}${d.link ? `<a class="btn small ghost" href="${esc(d.link)}" target="_blank" rel="noopener">Google Диск ↗</a>` : ''}${docSendBtns(d)}${isLead() ? `<a class="btn small ghost" href="#/docform/${esc(d.id)}">Змінити</a>` : ''}</div>`;
  h += hasText ? `<article class="doctext" style="font-size:${fs}px">${docTextHtml(d.text)}</article><div id="docend" class="small mute center">— кінець документа —</div>` : `<div class="card"><p class="mute">Текст документа не внесено — відкрийте файл${d.link ? ' або посилання' : ''}.</p></div>`;
  if (ME.personId) {
    h += a ? card('', `<p class="ok center"><b>✓ Ви ознайомились ${uaDate(a.date)}</b></p>`)
      : card('', `<button class="btn primary wide" id="docack" data-act="ack" data-id="${esc(d.id)}" ${hasText ? 'disabled' : hasFile ? 'disabled' : ''}>Ознайомлений(-а) з документом</button>
        <p class="small mute center" id="dochint">${hasText ? 'Кнопка стане активною, коли ви дочитаєте текст до кінця.' : hasFile ? 'Кнопка стане активною після відкриття файлу документа.' : ''}</p>`);
  }
  if (hasText && !a && ME.personId) setTimeout(docReaderWatch, 0);
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
  const d = src || { kind: nd ? ND_KINDS[0] : INSTR_KINDS[0], ndGroup: UI.ndg && UI.ndg !== 'all' ? UI.ndg : 'Загальна НД', required: true, date: today() };
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
    fChk('Обовʼязкове ознайомлення', 'required', d.required);
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
  const docs = all('Документи').filter(d => truthy(d.required) && isND(d) === nd)
    .sort((a, b) => nd ? ND_GROUPS.indexOf(ndGroupOf(a)) - ND_GROUPS.indexOf(ndGroupOf(b)) || byTitle(a, b) : String(a.kind).localeCompare(String(b.kind)) || byTitle(a, b));
  const ppl = staff().filter(p => p.role !== 'відвідувач');
  if (!docs.length) return page(ttl, empty('Обовʼязкових документів немає'), back);
  const rows = docs.map(d => [`<span class="small">${nd ? '<b>' + esc(ndGroupOf(d) === 'Загальна НД' ? 'Заг.' : ndGroupOf(d)) + '</b> · ' : ''}${esc(d.title)}</span>`, ...ppl.map(p => { const a = ackOf(d.id, p.id); return a ? `<span class="ok" title="${uaDate(a.date)}">✓</span>` : '<span class="bad">✗</span>'; })]);
  const tot = ppl.map(p => docs.filter(d => ackOf(d.id, p.id)).length);
  rows.push(['<b>Разом</b>', ...tot.map(t => `<b>${t}/${docs.length}</b>`)]);
  return page(ttl, table(['Документ', ...ppl.map(p => `<span class="vert">${esc(shortName(p.pib))}</span>`)], rows, 'center first'), back);
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
  h += card('Автомобілі', all('Авто').map(c => `<a class="item" href="#/carform/${esc(c.id)}"><div class="row between"><b>${esc(c.name)} ${esc(c.plate || '')}</b>${badge(esc(c.fuel || ''))}</div>
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
  return page('Автомобіль', form('car', id, fInp('Марка / назва', 'name', d.name, { req: true }) + `<div class="grid2">${fInp('Держ. номер', 'plate', d.plate)}${fSel('Пальне', 'fuel', FUELS, d.fuel)}</div><fieldset class="f"><legend>Норми витрат палива</legend>
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
  let h = `<p class="small mute">Норми на 1 стик для кожного діаметра. За ними портал рахує витрату плівки, реактивів і матеріалів PT у щоденних звітах, а також особливий характер робіт (люд-год RT). Для діаметра без точної норми береться найближчий.</p>`;
  h += list.length ? table(['Ø', 'Плівка, дм²', 'Прояв., л', 'Фікс., л', 'PT розч.', 'PT пенетр.', 'PT прояв.', 'VT, л-год', 'RT, л-год'],
    list.map(n => [isLead() ? `<a href="#/normform/${esc(n.id)}"><b>${esc(n.diameter)}</b></a>` : `<b>${esc(n.diameter)}</b>`, ...['film', 'dev', 'fix', 'ptSolvent', 'ptPenetrant', 'ptDeveloper', 'vtHours', 'rtHours'].map(k => fmtN3(num(n[k])))]), 'num first') :
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
     <fieldset class="f"><legend>PT, на 1 стик</legend><div class="grid3">${fNum('Розчинник, л', 'ptSolvent', d.ptSolvent)}${fNum('Пенетрант, л', 'ptPenetrant', d.ptPenetrant)}${fNum('Проявник, л', 'ptDeveloper', d.ptDeveloper)}</div></fieldset>
     <fieldset class="f"><legend>Людино-години на 1 стик</legend><div class="grid2">${fNum('VT', 'vtHours', d.vtHours)}${fNum('RT (особливий характер)', 'rtHours', d.rtHours)}</div></fieldset>`;
  return page('Норма для діаметра', form('norm', id, body, src ? { del: { t: 'НормиМатеріалів', id, back: '#/norms' } } : {}), '#/norms');
};
FORMS.norm = async (d, id) => {
  if (!need(d, [['diameter', 'діаметр']])) return;
  if (normsList().some(n => n.id !== id && num(n.diameter) === num(d.diameter))) return toast('Норма для цього діаметра вже є');
  await save('НормиМатеріалів', { ...(get('НормиМатеріалів', id) || {}), ...d, id: id !== 'new' ? id : undefined });
  UI.dirty = false; savedMsg('Норму збережено'); go('#/norms');
};
