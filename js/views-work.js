/* Портал ВЛНК — завдання, склад бригад, щоденні звіти, моніторинг */
'use strict';

// ═════════ ЗАВДАННЯ НА МІСЯЦЬ ═════════
ROUTES.tasks = () => {
  const m = UI.tmonth || (UI.tmonth = ym(today()));
  const fb = UI.tbrig || 'all';
  const list = all('Завдання').filter(t => t.month === m || ym(t.dateFrom) === m || ym(t.dateTo) === m);
  const view = UI.tview || 'month';
  const inB = t => fb === 'all' || String(t.brigade) === String(fb);
  const nWork = all('Завдання').filter(t => isTaskInWork(t) && inB(t)).length, nPlan = all('Завдання').filter(t => isTaskPlanned(t) && inB(t)).length;
  let h = `<div class="row gap"><a class="btn ghost" href="#/brigades">Склад бригад</a>${isLead() ? `<a class="btn primary" href="#/taskform/new">+ Завдання</a>` : ''}</div>`;
  h += seg('tview', [['month', 'Завдання на місяць'], ['work', `В роботі · ${nWork}`], ['plan', `Плануються · ${nPlan}`]], view).replace('class="seg"', 'class="seg wrap"');
  h += seg('tbrig', [['all', 'Усі'], ...BRIGADES.map(n => [n, n === 5 ? '5 рез.' : 'Б' + n])], fb);
  if (view !== 'month') return page('Завдання', h + tasksByStatus(view, inB));
  h += monthNav('tmonth', m);
  // завдання, заплановані наперед (створені в попередньому місяці), — окремо, доки не настане їхній місяць
  const ahead = all('Завдання').filter(t => isPendingAhead(t) && (fb === 'all' || String(t.brigade) === String(fb)))
    .sort((a, c) => String(a.month).localeCompare(String(c.month)) || num(a.brigade) - num(c.brigade) || String(a.dateFrom).localeCompare(String(c.dateFrom)));
  if (ahead.length) {
    const byM = {}; ahead.forEach(t => (byM[t.month] = byM[t.month] || []).push(t));
    h += card('Заплановано наперед · ' + ahead.length, `<p class="small mute">Створені в попередньому місяці. З 1-го числа свого місяця автоматично переходять у статус «в роботі» і зʼявляються в картках бригад.</p>` +
      Object.entries(byM).map(([mm, ts]) => `<p class="small"><b>${esc(monthName(mm))}</b></p>` +
        ts.map(t => `<div class="small mute">${brName(t.brigade)}</div>` + taskItem(t)).join('')).join(''));
  }
  for (const n of BRIGADES) {
    if (fb !== 'all' && String(fb) !== String(n)) continue;
    const b = brigadeOf(m, n);
    const mem = brigadeMembers(b);
    const tasks = list.filter(t => String(t.brigade) === String(n) && !isPendingAhead(t)).sort((a, c) => String(a.dateFrom).localeCompare(String(c.dateFrom)));
    // склад бригади — в одному рядку з назвою «Бригада N»; під ним — авто
    const title = `${brName(n)} <span class="brmem">${mem.length ? '· ' + mem.map(id => esc(shortName(personName(id)))).join(', ') : '· склад не призначено'}</span>`;
    const info = b && b.carId ? `<p class="small mute">🚐 ${esc(carName(b.carId))}</p>` : '';
    // накази на відрядження — одразу під назвою бригади, перед складом
    // один наказ на всі виїзди бригади за місяць — одразу після напису «Бригада N»
    const ord = tasks.length ? hdrOrder(tasks) : '';
    h += card(title, info + (tasks.length ? tasks.map(taskItem).join('') : empty('Завдань немає')),
      ord + (isLead() ? `<a class="small addlink" href="#/taskform/new/${n}">+ додати</a>` : ''));
  }
  return page('Завдання', h);
};

/** Обʼєкти по бригадах за станом: «в роботі» — виконуються зараз, «плануються» — будуть виконуватись. */
function tasksByStatus(view, inB) {
  const d = today();
  const pick = view === 'work' ? isTaskInWork : isTaskPlanned;
  const tasks = all('Завдання').filter(t => pick(t) && inB(t)).sort((a, c) => String(a.dateFrom).localeCompare(String(c.dateFrom)));
  const hint = view === 'work'
    ? `<p class="small mute">Обʼєкти, на яких бригади працюють зараз (статус «в роботі» або період завдання включає ${uaDate(d)}).</p>`
    : `<p class="small mute">Обʼєкти, роботи на яких заплановані: статус «заплановано», початок пізніше ${uaDate(d)}.</p>`;
  let h = hint;
  let any = false;
  for (const n of BRIGADES) {
    const ts = tasks.filter(t => String(t.brigade) === String(n)); if (!ts.length) continue; any = true;
    h += card(brName(n) + ' · ' + ts.length, ts.map(taskItem).join(''));
  }
  return h + (any ? '' : empty(view === 'work' ? 'Зараз обʼєктів у роботі немає' : 'Запланованих обʼєктів немає'));
}

/** Наказ у заголовку картки бригади: № наказу + завантажити / на пошту (один на місяць). */
function hdrOrder(tasks) {
  const src = tasks.find(t => t.orderFile || DB.upTasks.has(t.id));
  const no = tripOrderNo(tasks[0]);
  let b = `<span class="small"><b>Наказ${no ? ' № ' + esc(no) : ''}</b></span>`;
  if (src && src.orderFile && !isVisitor()) {
    b += `<button type="button" class="btn small primary" data-act="orderdl" data-id="${esc(src.id)}">⬇ Завантажити</button>`;
    b += DB.mailQ.has(src.id) ? badge('✉ у черзі', 'warn') : `<button type="button" class="btn small ghost" data-act="ordermail" data-id="${esc(src.id)}">✉ На пошту</button>`;
  } else if (src && DB.upTasks.has(src.id)) b += badge('⏳ очікує відправки', 'warn');
  else if (isLead()) b += `<label class="btn small primary upl">⬆ Завантажити наказ<input type="file" accept="application/pdf,image/*,.doc,.docx" data-upload="${esc(tasks[0].id)}"></label>`;
  else b += '<span class="small mute">ще не завантажено</span>';
  return `<div class="hdrorder">${b}</div>`;
}

/** Виразні дати завдання: початок і кінець великим шрифтом, тривалість і стан (ще не почалось / триває / завершено). */
function taskDates(t) {
  const a = t.dateFrom || '', b = t.dateTo || t.dateFrom || '', d = today();
  if (!a) return '';
  const days = b ? daysBetween(a, b) + 1 : 1;
  const when = d < a ? `через ${daysBetween(d, a)} дн.` : d > b ? 'завершено' : `триває · ${daysBetween(d, b)} дн. до кінця`;
  const cls = d < a ? 'future' : d > b ? 'past' : 'now';
  return `<div class="tdates ${cls}"><span class="td-d"><small>початок</small><b>${uaDate(a)}</b></span><span class="td-arrow">→</span><span class="td-d"><small>кінець</small><b>${uaDate(b)}</b></span><span class="td-n">${days} дн. · ${when}</span></div>`;
}

function taskItem(t) {
  const o = get('Обʼєкти', t.objectId);
  const status = taskStatus(t);
  const st = { 'заплановано': '', 'в роботі': 'pri', 'виконано': 'ok', 'перенесено': 'warn' }[status] || '';
  const fact = agg(all('Звіти').filter(r => r.taskId === t.id));
  const href = isLead() ? '#/taskform/' + t.id : '#/tobj/' + t.id;
  const plan = planOf(t);
  return `<div class="item"><a class="item-link" href="${href}">
    <div class="row between"><b>${esc(o ? o.short : '—')}</b>${badge(esc(status), st)}</div>
    ${taskDates(t)}
    ${objMeta(o)}
    <span class="small mute">${esc(t.workType || '')}${t.requestNo ? (t.workType ? ' · ' : '') + 'заявка № ' + esc(t.requestNo) : ''}${t.orderNo ? ' · наказ № ' + esc(t.orderNo) : ''}</span>
    <span class="small">${methodsOf(t.methods).map(x => badge(esc(x))).join(' ')} ${t.diameters ? 'Ø ' + esc(arr(t.diameters).join(', ')) : ''}</span>
    ${fact.n || Object.keys(plan).length ? `<span class="small mute">Виконано/план: ${donePlanText(fact, plan, t.methods)}${fact.n ? ' · ' + fact.n + ' зв.' : ''}</span>` : ''}
  </a></div>`;
}

ROUTES.taskform = (id = 'new', brig) => {
  if (!isLead()) return denied();
  const key = 'task:' + id;
  const src = id !== 'new' ? get('Завдання', id) : null;
  if (id !== 'new' && !src) return notFound();
  const m = UI.tmonth || ym(today());
  const d = UI.draft[key] || src || { month: m, brigade: brig || '1', dateFrom: m + '-01', dateTo: monthEnd(m), status: 'заплановано', methods: ['RT', 'VT-W'] };
  const body =
    `<div class="grid2">${fInp('Місяць', 'month', d.month, { type: 'month', req: true })}
     ${fSel('Бригада', 'brigade', BRIGADES.map(n => [n, brName(n)]), d.brigade, { req: true })}</div>
     ${fSel('Обʼєкт', 'objectId', objOpts(), d.objectId, { req: true, none: '— оберіть обʼєкт —', re: true })}
     <div class="grid2">${fInp('Початок', 'dateFrom', d.dateFrom, { type: 'date', req: true })}${fInp('Закінчення', 'dateTo', d.dateTo, { type: 'date', req: true })}</div>
     ${fSel('Вид робіт', 'workType', WORK_TYPES, d.workType, { none: '—' })}
     ${fMulti('Методи контролю', 'methods', METHODS, methodsOf(d.methods))}
     ${fInp('Діаметри труб', 'diameters', arr(d.diameters).join(', '), { ph: '530, 720', hint: 'через кому' })}
     <fieldset class="f"><legend>Плановий обсяг за методами</legend><div class="grid4">${METHODS.map(m => { const k = MKEY[m]; const v = d['pl_' + k] !== undefined ? d['pl_' + k] : planOf(d)[k]; return fNum(`${m} <small>${MU(k)}</small>`, 'pl_' + k, v); }).join('')}</div>
     <small class="mute">Стики — RT, VT-W, UT-W, PT, UTT, HB; дм² — VT-S, UT-S. Працівник бачить «виконано/заплановано».</small></fieldset>
     <div class="grid2">${fInp('№ заявки НК', 'requestNo', d.requestNo)}${fInp('№ наказу на відрядження', 'orderNo', d.orderNo, { hint: 'один наказ на всі виїзди бригади за місяць' })}</div>
     ${fSel('Статус', 'status', TASK_STATUS, d.status)}
     ${fArea('Примітка', 'note', d.note)}`;
  return page(id === 'new' ? 'Нове завдання' : 'Завдання', (src ? card('Наказ на відрядження', orderBlock(src)) : '') + form('task', id, body, src ? { del: { t: 'Завдання', id, back: '#/tasks' } } : {}), '#/tasks');
};
ONCHANGE.task = d => { const o = get('Обʼєкти', d.objectId); if (o && !d.diameters) d.diameters = o.diameter; };
FORMS.task = async (d, id) => {
  if (!need(d, [['month', 'місяць'], ['brigade', 'бригада'], ['objectId', 'обʼєкт'], ['dateFrom', 'початок'], ['dateTo', 'закінчення']])) return;
  if (d.dateTo < d.dateFrom) return toast('Дата закінчення раніша за початок');
  d.diameters = arr(d.diameters);
  const pv = {}; MKEYS.forEach(k => { if (num(d['pl_' + k])) pv[k] = num(d['pl_' + k]); delete d['pl_' + k]; });
  d.planVol = JSON.stringify(pv);
  const src = id !== 'new' ? get('Завдання', id) : {};
  // місяць створення фіксується один раз — за ним визначається «заплановано наперед»
  const createdMonth = id !== 'new' ? taskCreatedYm(src) : ym(today());
  const row = await save('Завдання', { ...src, ...d, createdMonth, id: id !== 'new' ? id : undefined });
  // № наказу — один на всі завдання бригади за місяць
  const no = String(d.orderNo || '').trim();
  if (no) for (const x of tripTasks(row || { ...d })) if (x.id !== (row && row.id) && String(x.orderNo || '').trim() !== no) await save('Завдання', { ...x, orderNo: no });
  delete UI.draft['task:' + id]; UI.tmonth = d.month; UI.dirty = false;
  savedMsg('Завдання збережено'); go('#/tasks');
};

// ═════════ СКЛАД БРИГАД ═════════
ROUTES.brigades = () => {
  const m = UI.bmonth || (UI.bmonth = UI.tmonth || ym(today()));
  const lead = isLead();
  const used = {};
  BRIGADES.forEach(n => brigadeMembers(brigadeOf(m, n)).forEach(id => (used[id] = used[id] || []).push(n)));
  const dup = Object.entries(used).filter(([, v]) => v.length > 1);
  let h = monthNav('bmonth', m);
  if (dup.length) h += `<div class="note warn">Працівник у кількох бригадах: ${dup.map(([id, v]) => esc(shortName(personName(id))) + ' (' + v.join(', ') + ')').join('; ')}</div>`;
  const free = staff().filter(p => p.role !== 'відвідувач' && !used[p.id]);
  if (free.length) h += `<p class="small mute">Не розподілені: ${free.map(p => esc(shortName(p.pib))).join(', ')}</p>`;
  const vac = staff().filter(p => p.role !== 'відвідувач').map(p => ({ p, n: vacDaysIn(p.id, m + '-01', monthEnd(m)).size })).filter(x => x.n);
  if (vac.length) h += `<div class="note">🌴 Відпустки в ${monthName(m)}: ${vac.map(x => { const r = all('Відпустки').filter(v => v.personId === x.p.id).map(vacRange).filter(([a, b]) => a && a <= monthEnd(m) && b >= m + '-01').map(([a, b]) => uaDate(a).slice(0, 5) + '–' + uaDate(b).slice(0, 5)).join(', '); return esc(shortName(x.p.pib)) + ' ' + r; }).join('; ')}</div>`;
  if (lead && !all('Бригади').some(b => b.month === m)) h += `<button class="btn ghost wide" data-act="copybrig">Скопіювати склад з ${monthName(addMonths(m, -1))}</button>`;
  for (const n of BRIGADES) {
    const b = brigadeOf(m, n) || {};
    const mem = brigadeMembers(b);
    if (!lead) {
      h += card(brName(n), mem.length ? `<ul class="plain">${mem.map(id => `<li>${esc(personName(id))}${id === b.leaderId ? ' ' + badge('старший') : ''}${truthy((get('Персонал', id) || {}).isDriver) ? ' 🚐' : ''}</li>`).join('')}</ul>${b.carId ? `<p>Авто: <b>${esc(carName(b.carId))}</b></p>` : ''}` : empty('Не призначено'));
      continue;
    }
    const key = 'brig:' + m + ':' + n;
    const d = UI.draft[key] || { ...b, members: mem };
    const drivers = arr(d.members).filter(id => { const p = get('Персонал', id); return p && truthy(p.isDriver) && (!d.carId || !arr(p.carAccess).length || arr(p.carAccess).includes(d.carId)); });
    const warn = d.carId && !drivers.length ? `<p class="small warn">У складі немає водія з допуском до цього авто</p>` : '';
    h += card(brName(n), `<form class="form" data-form="brig" data-id="${m}:${n}">
      ${fMulti('Склад', 'members', staff().filter(p => p.role !== 'відвідувач').map(p => [p.id, shortName(p.pib) + (truthy(p.isDriver) ? ' 🚐' : '') + (used[p.id] && !used[p.id].includes(n) ? ' (Б' + used[p.id].join(',') + ')' : '') + (vacDaysIn(p.id, m + '-01', monthEnd(m)).size ? ' 🌴' + vacDaysIn(p.id, m + '-01', monthEnd(m)).size : '')]), d.members)}
      <div class="grid2">${fSel('Старший бригади', 'leaderId', arr(d.members).map(id => [id, shortName(personName(id))]), d.leaderId, { none: '—' })}
      ${fSel('Автомобіль', 'carId', carOpts(), d.carId, { none: 'без авто' })}</div>${warn}
      ${fInp('Примітка', 'note', d.note, { ph: n === 5 ? 'форс-мажор / резерв' : '' })}
      <div class="form-actions"><button class="btn primary" type="submit">Зберегти бригаду ${n}</button></div></form>`);
  }
  return page('Склад бригад', h, '#/tasks');
};
FORMS.brig = async (d, id) => {
  const [m, n] = id.split(':');
  const cur = brigadeOf(m, n) || {};
  if (d.leaderId && !d.members.includes(d.leaderId)) d.leaderId = '';
  await save('Бригади', { ...cur, month: m, num: n, members: d.members, leaderId: d.leaderId, carId: d.carId, note: d.note });
  delete UI.draft['brig:' + id]; UI.dirty = false; savedMsg('Бригаду ' + n + ' збережено'); render();
};
ACTS.copybrig = async () => {
  const m = UI.bmonth, p = addMonths(m, -1);
  const src = all('Бригади').filter(b => b.month === p);
  if (!src.length) return toast('У попередньому місяці склад не задано');
  for (const b of src) await save('Бригади', { month: m, num: b.num, members: arr(b.members), leaderId: b.leaderId, carId: b.carId, note: b.note });
  savedMsg('Склад скопійовано'); render();
};

// ═════════ ЩОДЕННІ ЗВІТИ ═════════
ROUTES.reports = () => {
  const fd = UI.rdate || '';
  const fb = UI.rbrig || 'all';
  let list = all('Звіти');
  if (fd) list = list.filter(r => r.date === fd);
  if (fb !== 'all') list = list.filter(r => String(r.brigade) === String(fb));
  if (UI.rmine === '1' && ME.personId) list = list.filter(r => arr(r.workers).includes(ME.personId));
  list = list.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.brigade).localeCompare(String(b.brigade)));
  let h = `<div class="filters">${fInp('Дата', 'rd', fd, { type: 'date' }).replace('name="rd"', 'data-set="rdate"')}
    ${fSel('Бригада', 'rb', [['all', 'Усі'], ...BRIGADES.map(n => [n, brName(n)])], fb).replace('name="rb"', 'data-set="rbrig"')}</div>`;
  if (ME.personId) h += seg('rmine', [['', 'Усі звіти'], ['1', 'Лише мої']], UI.rmine || '');
  if (canReport()) h += fab('#/reportform/new');
  h += list.length ? list.slice(0, UI.limit).map(reportItem).join('') + more(list.length) : empty('Звітів не знайдено');
  return page('Щоденні звіти', h);
};

/** Витрати матеріалів НК для Моніторингу: зведення за період + розбивка по бригадах / обʼєктах. */
function matCard(reps, per) {
  const t = agg(reps); const chem = q => q.dev + q.fix, pt = q => q.pts + q.ptp + q.ptd;
  const row = (name, v, unit, sub) => `<span>${name}${sub ? `<br><span class="small mute">${sub}</span>` : ''}</span><b>${v ? fmtN3(v) + ' ' + unit : '—'}</b>`;
  let body = `<div class="matgrid">
    ${row('Рентгенплівка', t.film, 'дм²')}
    ${row('Реактиви RT', chem(t), 'л', `проявник ${fmtN3(t.dev)} л · фіксаж ${fmtN3(t.fix)} л`)}
    ${row('Пенетранти (PT)', pt(t), 'л', `розчинник ${fmtN3(t.pts)} · пенетрант ${fmtN3(t.ptp)} · проявник ${fmtN3(t.ptd)} л`)}
    ${t.ptMat ? row('Матеріали PT', t.ptMat, 'компл.') : ''}</div>`;
  const line = q => [fmtN3(q.film), fmtN3(chem(q)), fmtN3(pt(q))];
  const has = q => q.film || chem(q) || pt(q);
  const byB = BRIGADES.map(n => [n, agg(reps.filter(r => +r.brigade === n))]).filter(([, q]) => has(q));
  if (per !== 'day' && byB.length) body += `<p class="small"><b>По бригадах</b></p>` + table(['Бр.', 'Плівка, дм²', 'Реактиви, л', 'Пенетранти, л'], byB.map(([n, q]) => [n === 5 ? '5 (рез.)' : n, ...line(q)]), 'num');
  const byO = [...new Set(reps.map(r => r.objectId))].map(id => [id, agg(reps.filter(r => r.objectId === id))]).filter(([, q]) => has(q)).sort((x, y) => y[1].film - x[1].film);
  if (byO.length) body += `<p class="small"><b>По обʼєктах</b></p>` + table(['Обʼєкт', 'Плівка, дм²', 'Реактиви, л', 'Пенетранти, л'], byO.map(([id, q]) => [`<a href="#/object/${esc(id)}">${esc(objShort(id))}</a>`, ...line(q)]), 'num first');
  return card('Витрати матеріалів', body + `<p class="small mute">За звітами: фактичні значення, а де їх не внесено — за нормами на діаметр.</p>`);
}

function reportItem(r) {
  const c = calc(r);
  const vol = volText(r);
  return `<a class="item" href="#/report/${esc(r.id)}">
    <div class="row between"><b>${isSummary(r) && r.periodFrom ? uaDate(r.periodFrom) + ' – ' : ''}${uaDate(r.date)} · ${esc(objShort(r.objectId))}</b>${r.brigade ? badge('Б' + esc(r.brigade)) : ''}</div>
    <span class="small mute">${isSummary(r) ? badge('підсумок за період', 'warn') + ' ' + c.workers.length + ' чол.' : `${c.workers.length} чол. × ${c.h} год${num(r.km) ? ' · ' + fmtN(num(r.km)) + ' км' : ''}`}</span>
    <span class="small">${truthy(r.travel) ? badge('переїзд', 'warn') : (vol || '<span class="mute">обсяг не вказано</span>')} ${r.problems ? badge('⚠ проблеми', 'bad') : ''}</span></a>`;
}

function canEditReport(r) { return isLead() || (canReport() && (r.authorId === ME.personId || arr(r.workers).includes(ME.personId))); }

ROUTES.report = id => {
  const r = get('Звіти', id);
  if (!r) return notFound();
  const c = calc(r);
  const t = get('Завдання', r.taskId);
  let h = (isSummary(r) ? `<div class="note warn">Підсумковий запис за період ${uaDate(r.periodFrom)} – ${uaDate(r.date)}, перенесений з шаблону «ВиконаноЗПочаткуРоку». Враховується в обсягах і матеріалах; у табелях, паливі та люд-годинах — ні.</div>` : '') + card(`${uaDate(r.date)} · ${brName(r.brigade)}`, kv([
    ['Обʼєкт', `<a href="#/object/${esc(r.objectId)}">${esc(objShort(r.objectId))}</a>`],
    ['Завдання', t ? esc(uaDate(t.dateFrom) + ' – ' + uaDate(t.dateTo)) + (t.requestNo ? ', заявка № ' + esc(t.requestNo) : '') : ''],
    ['Вид робіт', esc(r.workType)],
    ['Графік', c.h === 11 ? '11 год (07:00–19:00)' : '8 год (08:00–17:00)'],
    ['Працівники', c.workers.map(w => esc(shortName(personName(w))) + (w === r.driverId ? ' 🚐' : '')).join(', ')],
    ['Авто', r.carId ? esc(carName(r.carId)) + (num(r.km) ? `, ${fmtN(num(r.km))} км` : '') : ''],
    ['Характер', truthy(r.travel) ? 'переїзд між обʼєктами (без виконання)' : 'виконання робіт']
  ]));
  if (!truthy(r.travel)) {
    const vr = volRows(r);
    const cols = METHODS.filter(m => vr.some(v => num(v[MKEY[m]])));
    const man = arr(r.matManual);
    h += card('Виконано по діаметрах', (vr.length && cols.length ? table(['Ø, мм', ...cols.map(mHead)], [...vr.map(v => [esc(v.d || '—'), ...cols.map(m => fmtN(num(v[MKEY[m]])))]),
      ...(vr.length > 1 ? [['<b>Разом</b>', ...cols.map(m => '<b>' + fmtN(num(r[MKEY[m]])) + '</b>')]] : [])], 'num first') : empty('Обсяг не вказано')) +
      '');
    const mats = MAT.filter(([k]) => repMat(r, k));
    if (mats.length || num(r.ptMat)) h += card('Матеріали', `<div class="matgrid">${mats.map(([k, , name, unit]) => `<span>${name}</span><b>${fmtN3(repMat(r, k))} ${unit}${man.includes(k) ? ' <span class="small warn">факт</span>' : ' <span class="small mute">норма</span>'}</b>`).join('')}${num(r.ptMat) ? `<span>Матеріали PT</span><b>${fmtN(num(r.ptMat))} компл.</b>` : ''}</div>`);
  }
  h += card('Розрахунок', kv([
    ['Люд-год', fmtN(c.manH)],
    ['Особливий характер', c.special ? fmtN(c.special) + ' люд-год (' + fmtN(c.specialPer) + ' на особу, крім водія)' : '—'],
    ['Пальне авто', c.carL ? (() => { const cf = carFuelParts(r); return fmtN(c.carL) + ' л ' + esc(c.carFuel) + ` <span class="small mute">(${cf.season} норма)</span><br><span class="small">` + cf.parts.map(p => `${p.kind}: ${fmtN(p.qty)} ${p.unit} × ${fmtN3(p.norm)} ${p.normU} = ${fmtN(p.l)} л`).join('<br>') + '</span>'; })() : ''],
    ['Електростанція', r.genId ? (() => { const x = genDay(r.genId, r.genHours, r.genRefuel === '' || r.genRefuel == null ? num(r.genHours) * genNorm(get('Генератори', r.genId), r.date) : r.genRefuel, r.date, r.id, num(r.updatedAt)); return esc((get('Генератори', r.genId) || {}).name || '') + ' · ' + esc(r.genFuel || c.genFuel) + (x ? `<br>заправлено: <b>${fmtN3(x.refuel)} л</b><br>витрачено мотогодин: <b>${fmtN(num(r.genHours))}</b><br>витрачено палива: <b>${fmtN3(x.cons)} л</b>` : ''); })() : '']
  ]));
  if (r.problems) h += card('Проблемні питання та затримки', `<p class="pre">${esc(r.problems)}</p>`);
  if (r.note) h += card('Примітка', `<p class="pre">${esc(r.note)}</p>`);
  h += `<p class="small mute center">Подав: ${esc(personName(r.authorId))} · ${r.updatedBy ? esc(r.updatedBy) : ''}</p>`;
  if (canEditReport(r)) h += `<div class="row gap"><a class="btn primary" href="#/reportform/${esc(r.id)}">Редагувати</a></div>`;
  return page('Звіт', h, '#/reports');
};

function fillFromBrigade(d) {
  const b = brigadeOf(ym(d.date), d.brigade);
  d.workers = brigadeMembers(b).filter(w => !onVacation(w, d.date));
  d.carId = b ? b.carId || '' : '';
  d.driverId = pickDriver(d.workers, d.carId);
  const gs = gensForCar(d.carId); d.genId = gs.own ? gs.list[0].id : ''; d.genRefuel = ''; d.genFuel = '';
}
function pickDriver(ws, carId) {
  return arr(ws).find(w => { const p = get('Персонал', w); return p && truthy(p.isDriver) && (!carId || !arr(p.carAccess).length || arr(p.carAccess).includes(carId)); }) || '';
}
function fillFromTask(d, t) {
  d.taskId = t.id; d.objectId = t.objectId; d.workType = t.workType;
  const ds = arr(t.diameters).length ? arr(t.diameters) : arr((get('Обʼєкти', t.objectId) || {}).diameter);
  d.vol = volFromDiameters(ds, d.vol || []);
}
/** Рядки обсягу з полів форми v_<i>_<ключ>; ключі видаляються з d. */
function volFromForm(d) {
  const rows = [];
  Object.keys(d).forEach(k => { const m = k.match(/^v_(\d+)_(\w+)$/); if (m) { (rows[+m[1]] = rows[+m[1]] || {})[m[2]] = d[k]; delete d[k]; } });
  return rows.filter(Boolean);
}
function volFromDiameters(list, old) { const r = arr(list).map(x => (old || []).find(v => String(v.d) === String(x)) || { d: String(x) }); return r.length ? r : [{ d: '' }]; }
function cleanVol(rows) {
  return rows.map(v => { const o = { d: String(v.d || '').trim() }; MKEYS.forEach(k => { if (num(v[k])) o[k] = num(v[k]); }); return o; })
    .filter(v => v.d || MKEYS.some(k => v[k]));
}
/** Попередній розрахунок матеріалів за нормами (оновлюється під час введення). */
function matPreviewHtml(rows) {
  rows = cleanVol(rows);
  if (!normsList().length) return '<p class="small mute">Норми витрат не задано (Ще → Норми витрат матеріалів) — вкажіть фактичну витрату вручну.</p>';
  const m = matByNorm(rows);
  const warn = rows.filter(v => v.d && normFor(v.d) && num(normFor(v.d).diameter) !== num(v.d)).map(v => `Ø${esc(v.d)} → норма Ø${esc(normFor(v.d).diameter)}`);
  const used = MAT.filter(x => m[x[0]]);
  return (used.length ? `<div class="matgrid">${used.map(x => `<span>${x[2]}</span><b>${fmtN3(m[x[0]])} ${x[3]}</b>`).join('')}</div>` : '<p class="small mute">Внесіть стики RT або PT — витрата порахується автоматично.</p>') +
    (warn.length ? `<p class="small warn">Немає точної норми: ${warn.join(', ')}</p>` : '');
}
const fmtN3 = n => (Math.round(n * 1000) / 1000).toLocaleString('uk-UA');
function updateMatPreview(f) { const el = $('#matprev', f); if (el) el.innerHTML = matPreviewHtml(volFromForm(formData(f))); }
function volBlock(d) {
  const rows = d.vol && d.vol.length ? d.vol : [{ d: '' }];
  const diams = [...new Set([...normsList().map(n => String(n.diameter)), ...arr((get('Обʼєкти', d.objectId) || {}).diameter).map(String)])];
  return `<datalist id="diams">${diams.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <fieldset class="f"><legend>Виконаний обсяг по діаметрах</legend>
    ${rows.map((v, i) => `<div class="volrow">
      <div class="row between"><label class="f dia"><span>Діаметр, мм</span><input name="v_${i}_d" type="number" inputmode="numeric" list="diams" value="${esc(v.d ?? '')}" placeholder="530"></label>
      ${rows.length > 1 ? `<button type="button" class="btn small danger" data-act="voldel" data-i="${i}" aria-label="Прибрати діаметр">✕</button>` : ''}</div>
      <div class="grid4">${METHODS.map(m => { const k = MKEY[m]; return `<label class="f"><span>${m} <small>${MU(k)}</small></span><input name="v_${i}_${k}" type="number" min="0" step="any" inputmode="decimal" value="${esc(v[k] ?? '')}"></label>`; }).join('')}</div></div>`).join('')}
    <button type="button" class="btn ghost small" data-act="voladd">+ діаметр</button>
    <p class="small mute">Облік: RT, VT-W, UT-W, PT, UTT, HB — у стиках; VT-S, UT-S — у дм².</p></fieldset>`;
}
function matBlock(d) {
  const man = arr(d.matManual);
  return `<fieldset class="f"><legend>Матеріали за нормою</legend><div id="matprev">${matPreviewHtml(d.vol || [])}</div>
    <details ${man.length ? 'open' : ''}><summary class="small">Фактична витрата, якщо відрізняється від норми</summary>
    <div class="grid3">${MAT.map(([k, , name, unit]) => fNum(name + ', ' + unit, k, man.includes(k) ? d[k] : '', { ph: 'за нормою' })).join('')}</div></details></fieldset>`;
}
/** Блок електростанції: вид палива, заправлено, залишок у баку, час роботи на залишку, мотогодини, залишок після. */
const hhmm = h => { const t = Math.round(num(h) * 60); return Math.floor(t / 60) + ' год ' + String(t % 60).padStart(2, '0') + ' хв'; };
function genBlock(d, src) {
  const gs = gensForCar(d.carId);
  const opts = gs.list.map(g => [g.id, g.name + (g.carId && g.carId === d.carId ? ' · в авто' : '')]);
  const g = get('Генератори', d.genId);
  return `<fieldset class="f"><legend>Електростанція</legend>
    ${fSel('Станція', 'genId', opts, d.genId, { none: 'не використовувалась', re: true, hint: d.carId ? (gs.own ? 'закріплена за вибраним авто' : 'за цим авто електростанцію не закріплено') : '' })}
    ${g ? `<div class="grid2">${fSel('Вид палива', 'genFuel', FUELS, d.genFuel || g.fuel || FUELS[0])}${fNum('Заправлено, л', 'genRefuel', d.genRefuel, { ph: '0' })}</div>
    <div class="grid2"><label class="f"><span>Залишок в баку, л</span><input id="gAvail" readonly tabindex="-1" class="ro"></label>
      <label class="f"><span>Час роботи на залишку</span><div class="ro-row"><input id="gHours" readonly tabindex="-1" class="ro"><button type="button" class="btn small ghost" data-act="genfill" title="Підставити в мотогодини">↓</button></div><small id="gHoursHm"></small></label></div>
    <div class="grid2">${fNum('Мотогодини за день', 'genHours', d.genHours)}<label class="f"><span>Залишок після роботи, л</span><input id="gAfter" readonly tabindex="-1" class="ro"></label></div>
    <div id="genprev" class="small"></div>` : ''}</fieldset>`;
}
function updateGenPreview(f) {
  if (!f || !$('#gAvail', f)) return;
  const d = formData(f); const src = f.dataset.id && f.dataset.id !== 'new' ? get('Звіти', f.dataset.id) : null;
  const x = genDay(d.genId, d.genHours, d.genRefuel, d.date, src ? src.id : '', src ? num(src.updatedAt) : Infinity);
  if (!x) return;
  $('#gAvail', f).value = fmtN3(x.avail);
  $('#gHours', f).value = x.norm ? fmtN3(x.hoursAvail) + ' год' : 'норма не задана';
  $('#gHoursHm', f).textContent = x.norm ? '≈ ' + hhmm(x.hoursAvail) + ' при ' + fmtN3(x.norm) + ' л/год' : '';
  const a = $('#gAfter', f); a.value = fmtN3(x.after); a.classList.toggle('bad', x.after < 0); a.classList.toggle('ok', x.after === 0 && num(d.genHours) > 0);
  $('#genprev', f).innerHTML = (x.need ? `<p class="bad">Пального не вистачає: ${fmtN3(x.need)} л. Заправте щонайменше ${fmtN3(x.need)} л або зменшіть мотогодини.</p>` : '') +
    `<p class="mute">До заправки в баку: ${fmtN3(x.bal)} л · витрата за день: ${fmtN3(x.cons)} л · мотогодини станції всього: ${fmtN(x.motoAfter)}</p>`;
}
ACTS.genfill = () => {
  const f = $('form[data-form=report]'); const d = formData(f); const src = f.dataset.id && f.dataset.id !== 'new' ? get('Звіти', f.dataset.id) : null;
  const x = genDay(d.genId, 0, d.genRefuel, d.date, src ? src.id : '', src ? num(src.updatedAt) : Infinity);
  if (!x || !x.norm) return toast('Для станції не задано норму витрати');
  $('input[name=genHours]', f).value = x.hoursAvail; UI.dirty = true; updateGenPreview(f);
};
function volAct(fn) {
  const f = $('form[data-form=report]'); if (!f) return;
  const key = 'report:' + (f.dataset.id || 'new');
  const d = { ...(UI.draft[key] || {}), ...formData(f) };
  const v = volFromForm(d); d.vol = v.length ? v : (d.vol || []);
  fn(d); UI.draft[key] = d; UI.dirty = false; render(); UI.dirty = true;
}
ACTS.voladd = () => volAct(d => d.vol.push({ d: '' }));
ACTS.voldel = ds => volAct(d => d.vol.splice(Number(ds.i), 1));
function autoTask(d) {
  const tks = tasksOn(d.date).filter(t => String(t.brigade) === String(d.brigade));
  if (tks.length === 1) fillFromTask(d, tks[0]); else d.taskId = '';
}

ROUTES.reportform = (id = 'new') => {
  if (!canReport()) return denied();
  const key = 'report:' + id;
  const src = id !== 'new' ? get('Звіти', id) : null;
  if (id !== 'new' && !src) return notFound();
  if (src && !canEditReport(src)) return denied();
  let d = UI.draft[key];
  if (!d) {
    if (src) d = { ...src, workers: arr(src.workers), vol: volRows(src).map(v => ({ ...v })), matManual: arr(src.matManual), travel: truthy(src.travel) };
    else {
      const date = today(), mb = myBrigade(date);
      const me = get('Персонал', ME.personId) || {};
      d = { date, brigade: mb ? String(mb.num) : '1', schedule: me.schedule || '8', travel: false };
      fillFromBrigade(d); autoTask(d);
      if (!d.vol) d.vol = [{ d: '' }];
    }
    UI.draft[key] = d;
  }
  const tks = tasksOn(d.date).filter(t => String(t.brigade) === String(d.brigade));
  const travel = truthy(d.travel);
  let body =
    `<div class="grid2">${fInp('Дата', 'date', d.date, { type: 'date', req: true, re: true })}
     ${fSel('Бригада', 'brigade', BRIGADES.map(n => [n, brName(n)]), d.brigade, { req: true, re: true })}</div>
     ${fSel('Завдання', 'taskId', tks.map(t => [t.id, objShort(t.objectId) + ' (' + uaDate(t.dateFrom) + '–' + uaDate(t.dateTo) + ')']), d.taskId, { none: tks.length ? '— без привʼязки —' : 'на цю дату завдань немає', re: true })}
     ${fSel('Обʼєкт', 'objectId', objectsSorted().map(o => [o.id, o.name || o.short]), d.objectId, { req: true, none: '— оберіть обʼєкт —', re: true })}
     ${d.objectId && get('Обʼєкти', d.objectId) ? `<p class="small objfull">${esc((get('Обʼєкти', d.objectId) || {}).name || objShort(d.objectId))}</p>` : ''}
     ${fChk('Переїзд між обʼєктами (виконання робіт відсутнє)', 'travel', travel, { re: true })}
     <div class="grid2">${fSel('Графік роботи', 'schedule', [['8', '8 год (08–17)'], ['11', '11 год (07–19)']], d.schedule)}
     ${fSel('Вид робіт', 'workType', WORK_TYPES, d.workType, { none: '—' })}</div>
     ${(() => {
       const mem = brigadeMembers(brigadeOf(ym(d.date), d.brigade));
       const ids = [...new Set([...mem, ...arr(d.workers)])];
       const list = ids.length ? ids.map(id => get('Персонал', id)).filter(Boolean) : staff().filter(p => p.role !== 'відвідувач');
       return fMulti('Працівники на обʼєкті (склад бригади)', 'workers', list.map(p => [p.id, shortName(p.pib) + (!mem.includes(p.id) && mem.length ? ' (не з бригади)' : '')]), d.workers, { re: true }) +
         (mem.length ? '' : '<p class="small warn">Склад бригади на цей місяць не призначено — показано всіх працівників.</p>');
     })()}
     <div class="grid2">${fSel('Автомобіль', 'carId', carOpts(), d.carId, { none: 'без авто', re: true })}
     ${fSel('Водій', 'driverId', arr(d.workers).map(w => [w, shortName(personName(w))]), d.driverId, { none: '—', hint: 'водію не нараховується особливий характер' })}</div>
     <div class="grid3">${fNum('Пробіг за день, км', 'km', d.km)}${fNum('з них у важких дорожніх умовах, км', 'kmHeavy', d.kmHeavy)}${fNum('Автономний обігрівач, год', 'heaterH', d.heaterH)}</div>
     ${d.carId && get('Авто', d.carId) ? `<p class="small mute">Норми на ${uaDate(d.date)} (${seasonName(d.date)}): ${fmtN3(carNorm(get('Авто', d.carId), d.date))} л/100 км · важкі умови ${fmtN3(carNormHeavy(get('Авто', d.carId), d.date))} л/100 км · обігрівач ${fmtN3(num(get('Авто', d.carId).heaterLh))} л/год</p>` : ''}`;
  if (!travel) {
    body += volBlock(d) + genBlock(d, src);
  }
  const onVac = arr(d.workers).filter(w => onVacation(w, d.date));
  if (onVac.length) body = `<div class="note warn">У відпустці на ${uaDate(d.date)}: ${onVac.map(w => esc(shortName(personName(w)))).join(', ')}. Перевірте склад.</div>` + body;
  body += fArea('Проблемні питання та затримки в роботі', 'problems', d.problems, { ph: 'Простої, відсутність фронту робіт, несправності…' }) + fArea('Примітка', 'note', d.note, { rows: 2 });
  return page(id === 'new' ? 'Новий звіт' : 'Редагування звіту', form('report', id, body, src ? { del: { t: 'Звіти', id, back: '#/reports' } } : {}), src ? '#/report/' + id : '#/reports');
};
ONCHANGE.report = (d, f) => {
  const v = volFromForm(d); if (v.length) d.vol = v;
  if (f === 'date' || f === 'brigade') { fillFromBrigade(d); autoTask(d); }
  if (f === 'taskId') { const t = get('Завдання', d.taskId); if (t) fillFromTask(d, t); }
  if (f === 'carId') { const gs = gensForCar(d.carId); d.genId = gs.own ? gs.list[0].id : ''; d.genRefuel = ''; d.genFuel = ''; }
  if (f === 'genId') { d.genRefuel = ''; d.genFuel = ''; }
  if (f === 'carId' || f === 'workers') { if (!arr(d.workers).includes(d.driverId)) d.driverId = ''; d.driverId = d.driverId || pickDriver(d.workers, d.carId); }
};
FORMS.report = async (d, id) => {
  if (!need(d, [['date', 'дата'], ['brigade', 'бригада'], ['objectId', 'обʼєкт'], ['workers', 'працівники']])) return;
  if (d.date > today()) return toast('Звіт не можна подати на майбутню дату');
  if (num(d.kmHeavy) > num(d.km)) return toast('Пробіг у важких дорожніх умовах не може перевищувати загальний пробіг');
  const dup = all('Звіти').find(r => r.id !== id && r.date === d.date && String(r.brigade) === String(d.brigade) && r.objectId === d.objectId);
  if (dup && !await ask('Звіт цієї бригади по цьому обʼєкту за цю дату вже є. Зберегти ще один?')) return;
  const src = id !== 'new' ? get('Звіти', id) : null;
  const vol = cleanVol(volFromForm(d));
  const row = { ...(src || {}), ...d, travel: !!d.travel };
  // обсяги по діаметрах + загальні суми по методах (для моніторингу й табелів)
  row.vol = vol;
  row.diameters = vol.map(v => v.d).filter(Boolean);
  MKEYS.forEach(k => { row[k] = vol.reduce((s, v) => s + num(v[k]), 0) || ''; });
  // матеріали: фактичні, якщо вписані, інакше — за нормами
  const norm = matByNorm(vol);
  row.matManual = MAT.map(m => m[0]).filter(k => (d[k] !== '' && d[k] !== undefined) || (d[k] === undefined && src && arr(src.matManual).includes(k)));
  MAT.forEach(([k]) => { row[k] = row.matManual.includes(k) ? num(d[k] !== undefined ? d[k] : src[k]) : (norm[k] || ''); });
  // електростанція: заправка «під нуль», якщо не вписано інше
  if (row.genId && !row.travel) {
    const g = genDay(row.genId, row.genHours, d.genRefuel, row.date, src ? src.id : '', src ? num(src.updatedAt) : Infinity);
    if (g && g.need && !await ask(`Пального в баку не вистачає на ${fmtN(num(row.genHours))} мотогод: бракує ${fmtN3(g.need)} л. Зберегти так?`)) return;
    row.genRefuel = g ? g.refuel : 0; row.genFuel = d.genFuel || (get('Генератори', row.genId) || {}).fuel || '';
  } else { row.genRefuel = ''; row.genFuel = ''; if (!row.genId) row.genHours = ''; }
  if (row.travel) { [...MKEYS, 'meters', ...MAT.map(m => m[0]), 'ptMat', 'genId', 'genHours', 'genRefuel', 'genFuel'].forEach(k => (row[k] = '')); row.vol = []; row.diameters = []; row.matManual = []; }
  if (!src) { row.authorId = ME.personId; delete row.id; }
  await save('Звіти', row);
  delete UI.draft['report:' + id]; UI.dirty = false;
  savedMsg('Звіт збережено'); go('#/reports');
};

// ═════════ МОНІТОРИНГ ═════════
function period(per, d) {
  if (per === 'day') return [d, d, uaDate(d)];
  if (per === 'month') return [ym(d) + '-01', monthEnd(ym(d)), monthName(ym(d))];
  return [d.slice(0, 4) + '-01-01', d.slice(0, 4) + '-12-31', d.slice(0, 4) + ' рік'];
}
ACTS.mshift = d => {
  const per = UI.mper || 'day', cur = UI.mdate || today(), k = Number(d.k);
  UI.mdate = per === 'day' ? addDays(cur, k) : per === 'month' ? addMonths(ym(cur), k) + '-01' : (Number(cur.slice(0, 4)) + k) + '-01-01';
  render();
};

ROUTES.mon = () => {
  const per = UI.mper || 'day';
  const d = UI.mdate || today();
  const [a, b, label] = period(per, d);
  const reps = reportsIn(a, b);
  const s = agg(reps);
  let h = seg('mper', [['day', 'Доба'], ['month', 'Місяць'], ['year', 'Рік']], per) +
    `<div class="monthnav"><button class="btn icon" data-act="mshift" data-k="-1">‹</button><b>${label}</b><button class="btn icon" data-act="mshift" data-k="1">›</button></div>`;
  h += kpis([
    ['люд-год', fmtN(s.manH)], ['особл. хар-р', fmtN(s.special)], ...METHODS.map((m, i) => [mHead(m), mVals(s)[i]]),
    ['км', fmtN(s.km)], ['пальне, л', fmtN(s.fuelTotal)], ['плівка, дм²', fmtN(s.film)], ['реактиви, л', fmtN3(s.dev + s.fix)], ['пенетранти, л', fmtN3(s.pts + s.ptp + s.ptd)], ['звітів', s.n]
  ]);

  if (per === 'day') {
    const tk = tasksOn(d);
    h += card('Стан бригад', table(['Бригада', 'Завдання', 'Звіт', 'Обсяг'], BRIGADES.map(n => {
      const t = tk.filter(x => +x.brigade === n); const rp = reps.filter(x => +x.brigade === n); const q = agg(rp);
      return [n === 5 ? '5 (рез.)' : n, t.map(x => esc(objShort(x.objectId))).join('<br>') || '—',
        rp.length ? rp.map(r => `<a href="#/report/${r.id}">${truthy(r.travel) ? 'переїзд' : '✓'}</a>`).join(' ') : (t.length ? '<span class="bad">немає</span>' : '—'),
        rp.length ? volText(q) : ''];
    })));
  }

  const byB = BRIGADES.map(n => { const q = agg(reps.filter(r => +r.brigade === n)); return [n === 5 ? '5 (рез.)' : n, q.days.size, fmtN(q.manH), fmtN(q.special), ...mVals(q)]; });
  if (per === 'day') {
    const off = staff().filter(p => p.role !== 'відвідувач' && onVacation(p.id, d));
    if (off.length) h += card('У відпустці', `<p class="small">${off.map(p => esc(shortName(p.pib)) + ' <span class="mute">до ' + uaDate(vacRange(onVacation(p.id, d))[1]) + '</span>').join(', ')}</p>`);
  }
  if (per !== 'day') h += card('По бригадах', table(['Бр.', 'Днів', 'Люд-год', 'Особл.', ...METHODS.map(mHead)], byB, 'num'));

  const objIds = [...new Set(reps.map(r => r.objectId))];
  if (objIds.length) {
    const rows = objIds.map(id => {
      const q = agg(reps.filter(r => r.objectId === id)); const o = get('Обʼєкти', id) || {};
      let plan = 0;
      if (per === 'month') plan = num(obj(o.monthly)[ym(d)]);
      if (per === 'year') plan = num(o['plan' + d.slice(0, 4)]);
      return { id, q, plan, name: o.short || '—' };
    }).sort((x, y) => y.q.manH - x.q.manH);
    h += card('По обʼєктах', table(['Обʼєкт', ...METHODS.map(mHead)],
      rows.map(r => [`<a href="#/object/${r.id}">${esc(r.name)}</a>`, ...mVals(r.q)]), 'num first'));
  }

  if (per !== 'day') {
    const ppl = staff().filter(p => p.role !== 'відвідувач').map(p => {
      const mine = reps.filter(r => !isSummary(r) && arr(r.workers).includes(p.id));
      let hrs = 0, sp = 0; const days = new Set();
      mine.forEach(r => { const c = calc(r); hrs += c.h; days.add(r.date); if (r.driverId !== p.id) sp += c.specialPer; });
      return [esc(shortName(p.pib)), days.size, fmtN(hrs), fmtN(sp)];
    });
    h += card('По працівниках', table(['ПІБ', 'Днів', 'Годин', 'Особл. хар-р'], ppl, 'num first'));
  }

  if (per === 'month') {
    const days = dateRange(a, b); const vals = days.map(x => agg(reps.filter(r => r.date === x)).manH); const mx = Math.max(1, ...vals);
    h += card('Люд-години по днях', `<div class="chart">${days.map((x, i) => `<div title="${uaDate(x)}: ${vals[i]}"><i style="height:${vals[i] / mx * 100}%"></i><span>${+x.slice(8)}</span></div>`).join('')}</div>`);
  }
  if (per === 'year') {
    const rows = MONTHS.map((mn, i) => { const mm = d.slice(0, 4) + '-' + z2(i + 1); const q = agg(reps.filter(r => ym(r.date) === mm)); return [mn, fmtN(q.manH), fmtN(q.special), ...mVals(q)]; });
    h += card('По місяцях', table(['Місяць', 'Люд-год', 'Особл.', ...METHODS.map(mHead)], rows, 'num first'));
  }

  h += matCard(reps, per);

  const prob = reps.filter(r => r.problems).sort((x, y) => String(y.date).localeCompare(String(x.date)));
  if (prob.length) h += card('Проблемні питання', prob.slice(0, 30).map(r => `<a class="item" href="#/report/${r.id}"><b>${uaDate(r.date)} · Б${esc(r.brigade)} · ${esc(objShort(r.objectId))}</b><p class="pre small">${esc(r.problems)}</p></a>`).join(''));
  return page('Моніторинг', h);
};
