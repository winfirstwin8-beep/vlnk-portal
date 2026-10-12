/* Портал ВЛНК — онлайн-інструктажі з підтвердженням проходження працівниками */
'use strict';

const BRIEF_TYPES = ['Вступний', 'Первинний', 'Повторний', 'Позаплановий', 'Цільовий'];
const BRIEF_CONFIRM = 'Інструктаж пройшов(-ла), зміст зрозумів(-ла), зобовʼязуюсь виконувати вимоги';

/** Контрольні питання: блоки через порожній рядок; рядок «+ …» — правильна відповідь, «- …» — неправильна. */
function parseQuestions(text) {
  return String(text || '').split(/\n\s*\n/).map(b => b.split('\n').map(s => s.trim()).filter(Boolean)).filter(b => b.length >= 3).map(b => {
    const opts = b.slice(1).filter(s => /^[+\-–]/.test(s)).map(s => ({ t: s.replace(/^[+\-–]\s*/, ''), ok: s[0] === '+' }));
    return { q: b[0], opts };
  }).filter(x => x.opts.length >= 2 && x.opts.some(o => o.ok));
}
function questionsText(qs) { return arr(qs).map(x => [x.q, ...x.opts.map(o => (o.ok ? '+ ' : '- ') + o.t)].join('\n')).join('\n\n'); }
const briefQs = b => { const v = b.questions; if (Array.isArray(v)) return v; try { return JSON.parse(v || '[]') || []; } catch (e) { return []; } };

/** Розсилки на ознайомлення з документами зберігаються в «Інструктажах» з видом «Ознайомлення». */
const ACQ_TYPE = 'Ознайомлення';
const isAcq = b => b && b.type === ACQ_TYPE;
const briefs = () => all('Інструктажі').filter(b => !isAcq(b)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
const briefPeople = b => arr(b.participants).length ? arr(b.participants) : staff().filter(p => p.role !== 'відвідувач').map(p => p.id);
const briefPass = (bid, pid) => all('ПроходженняІнструктажів').filter(x => x.briefingId === bid && x.personId === pid).sort((a, b) => num(b.ts) - num(a.ts))[0] || null;
/** done — пройшли (працівник підтвердив зі свого пристрою); conf — проведення підтвердив керівник; wait — пройшли, але керівник ще не підтвердив. */
const briefStat = b => {
  const ppl = briefPeople(b); const ps = ppl.map(p => briefPass(b.id, p));
  const done = ps.filter(Boolean).length, conf = ps.filter(p => p && p.condDate).length;
  return { ppl, done, conf, wait: done - conf, left: ppl.length - done, open: ppl.length - conf };
};
/** Короткий опис пристрою, з якого зроблено підтвердження (для журналу). */
function deviceTag() {
  const u = navigator.userAgent || '';
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'пристрій';
  const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /SamsungBrowser/.test(u) ? 'Samsung' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /FxiOS|Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : '';
  return os + (br ? ' · ' + br : '') + (window.matchMedia && matchMedia('(display-mode: standalone)').matches ? ' · застосунок' : '');
}
const nowHM = () => { const n = new Date(); return z2(n.getHours()) + ':' + z2(n.getMinutes()); };
/** Інструктажі, які працівнику ще треба пройти. */
const briefTodo = pid => briefs().filter(b => b.date <= today() && briefPeople(b).includes(pid) && !briefPass(b.id, pid));
const briefOverdue = b => b.dueDate && b.dueDate < today();

function briefItem(b) {
  const lead = isLead();
  const mine = ME.personId && briefPeople(b).includes(ME.personId) ? briefPass(b.id, ME.personId) : undefined;
  const s = briefStat(b);
  const st = lead
    ? badge(`${s.conf}/${s.ppl.length}`, s.open ? (briefOverdue(b) && s.left ? 'bad' : 'warn') : 'ok')
    : mine ? badge(mine.condDate ? '✓ пройдено' : '✓ пройдено · чекає підтвердження', mine.condDate ? 'ok' : 'warn') : mine === null ? badge(briefOverdue(b) ? 'прострочено' : 'потрібно пройти', briefOverdue(b) ? 'bad' : 'warn') : '';
  return `<a class="item" href="#/briefing/${esc(b.id)}"><div class="row between"><b>${esc(b.title)}</b>${st}</div>
    <span class="small mute">${esc(b.type || '')} · ${uaDate(b.date)}${b.dueDate ? ' · пройти до ' + uaDate(b.dueDate) : ''}${b.conductorId ? ' · проводить ' + esc(shortName(personName(b.conductorId))) : ''}${briefQs(b).length ? ' · питань: ' + briefQs(b).length : ''}</span>${lead ? `<span class="small">пройшли ${s.done} з ${s.ppl.length}${s.wait ? ` · <b class="warn">чекають вашого підтвердження: ${s.wait}</b>` : ''}</span>` : ''}</a>`;
}

ROUTES.brief = () => {
  if (isVisitor()) return denied();
  let h = '';
  if (isLead()) {
    h += `<div class="row gap"><a class="btn ghost" href="#/gen/brief">Журнал інструктажів (.xlsx)</a></div>` + fab('#/briefform/new');
    const list = briefs();
    const open = list.filter(b => briefStat(b).open), done = list.filter(b => !briefStat(b).open);
    h += card('Тривають', open.length ? open.map(briefItem).join('') : empty('Усі інструктажі пройдено і підтверджено'));
    if (done.length) h += card('Завершені (пройдено і підтверджено)', done.map(briefItem).join(''));
  } else {
    const todo = briefTodo(ME.personId);
    h += card('Потрібно пройти', todo.length ? todo.map(briefItem).join('') : empty('Нових інструктажів немає'));
    const past = briefs().filter(b => briefPeople(b).includes(ME.personId) && briefPass(b.id, ME.personId));
    if (past.length) h += card('Пройдені', past.map(briefItem).join(''));
  }
  return page('Інструктажі', h, '#/menu');
};

ROUTES.briefing = id => {
  const b = get('Інструктажі', id);
  if (!b || isVisitor()) return notFound();
  const qs = briefQs(b);
  const docs = arr(b.docIds).map(d => get('Документи', d)).filter(Boolean);
  let h = `<div class="objhead"><h2>${esc(b.title)}</h2><p>${esc(b.type || '')} інструктаж · ${uaDate(b.date)}${b.dueDate ? ' · пройти до ' + uaDate(b.dueDate) : ''}</p></div>`;
  h += card('Інструктаж', kv([['Вид', esc(b.type)], ['Дата', uaDate(b.date)], ['Проводить', b.conductorId ? esc(personName(b.conductorId)) : ''], ['Пройти до', uaDate(b.dueDate)]]) +
    (b.content ? `<div class="brieftext pre">${esc(b.content)}</div>` : '') +
    (b.link ? `<div class="row gap"><a class="btn ghost" href="${esc(b.link)}" target="_blank" rel="noopener">▶ Матеріали інструктажу ↗</a></div>` : '') +
    (docs.length ? '<h3>Документи до інструктажу</h3>' + docs.map(d => `<div class="item"><b>${esc(d.title)}</b><span class="small mute">${esc(d.kind)}</span>${d.link ? `<div class="row gap"><a class="btn small ghost" href="${esc(d.link)}" target="_blank" rel="noopener">Відкрити ↗</a></div>` : ''}</div>`).join('') : ''));

  if (ME.personId && briefPeople(b).includes(ME.personId)) {
    const p = briefPass(b.id, ME.personId);
    if (p) h += card('Проходження', `<p class="ok"><b>✓ Ви підтвердили проходження ${uaDate(p.date)}</b>${p.time ? ' о ' + esc(p.time) : ''}${p.device ? ' · ' + esc(p.device) : ''}</p>${qs.length ? `<p class="small mute">Контрольні питання: ${esc(p.score || '')}</p>` : ''}` +
      (p.condDate ? `<p class="ok">✓ Проведення підтвердив ${esc(shortName(personName(p.condBy)))} ${uaDate(p.condDate)}${p.condTime ? ' о ' + esc(p.condTime) : ''}</p>` : '<p class="warn">Очікує підтвердження проведення керівником</p>'));
    else if (b.date > today()) h += card('Проходження', `<p class="mute">Інструктаж стане доступним ${uaDate(b.date)}.</p>`);
    else {
      const qh = qs.map((x, i) => `<div class="bq" data-q="${i}"><p class="bqq">${i + 1}. ${esc(x.q)}</p>${x.opts.map((o, j) => `<label class="bqo"><input type="radio" name="q${i}" value="${j}"><span>${esc(o.t)}</span></label>`).join('')}</div>`).join('');
      h += card('Підтвердження проходження', `<form class="form" data-form="briefpass" data-id="${esc(b.id)}" novalidate>
        ${qs.length ? `<p class="small mute">Дайте відповіді на контрольні питання — усі мають бути правильними.</p>${qh}` : ''}
        ${fChk(BRIEF_CONFIRM, 'confirm', false)}
        <div class="form-actions"><button type="submit" class="btn primary">Підтвердити проходження</button></div></form>`);
    }
  }

  if (isLead()) {
    const s = briefStat(b);
    const rows = s.ppl.map(pid => {
      const p = briefPass(b.id, pid);
      const w = p ? `<span class="ok">✓ ${uaDate(p.date)}${p.time ? ' ' + esc(p.time) : ''}</span>${p.device ? ' · ' + esc(p.device) : ''}${qs.length ? ' · питання ' + esc(p.score || '') : ''}` : `<span class="${briefOverdue(b) ? 'bad' : 'warn'}">не пройдено</span>`;
      const c = !p ? '<span class="mute">—</span>' : p.condDate ? `<span class="ok">✓ ${uaDate(p.condDate)}${p.condTime ? ' ' + esc(p.condTime) : ''}</span> · ${esc(shortName(personName(p.condBy)))}` : `<button type="button" class="btn small primary" data-act="briefconf" data-id="${esc(p.id)}">✓ Підтвердити проведення</button>`;
      return `<div class="item"><b>${esc(shortName(personName(pid)))}</b><span class="small">Працівник: ${w}</span><span class="small">Керівник: ${c}</span></div>`;
    }).join('');
    h += card(`Учасники · пройшли ${s.done} з ${s.ppl.length} · проведення підтверджено ${s.conf}`, rows +
      (s.wait > 1 ? `<div class="row gap"><button type="button" class="btn primary" data-act="briefconfall" data-id="${esc(b.id)}">✓ Підтвердити проведення для всіх, хто пройшов (${s.wait})</button></div>` : '') +
      '<p class="small mute">Працівник підтверджує проходження зі свого пристрою, керівник — проведення інструктажу зі свого. Інструктаж вважається завершеним після обох підтверджень.</p>' +
      `<div class="row gap"><a class="btn ghost" href="#/briefform/${esc(b.id)}">Змінити</a><a class="btn ghost" href="#/briefform/new/${esc(b.id)}">Повторити для інших / новий на основі</a></div>`);
  }
  return page('Інструктаж', h, '#/brief');
};

FORMS.briefpass = async (d, id) => {
  const b = get('Інструктажі', id); if (!b) return;
  const qs = briefQs(b);
  if (qs.some((_, i) => d['q' + i] === undefined || d['q' + i] === '')) {
    const f = $('form[data-form=briefpass]');
    const miss = qs.filter((_, i) => !f.querySelector(`input[name=q${i}]:checked`)).length;
    if (miss) return toast('Дайте відповідь на всі питання (залишилось: ' + miss + ')');
  }
  const f = $('form[data-form=briefpass]');
  const ans = qs.map((_, i) => { const el = f.querySelector(`input[name=q${i}]:checked`); return el ? +el.value : -1; });
  const wrong = qs.map((x, i) => (x.opts[ans[i]] || {}).ok ? 0 : 1).reduce((a, c) => a + c, 0);
  [...f.querySelectorAll('.bq')].forEach((el, i) => el.classList.toggle('bad', !(qs[i].opts[ans[i]] || {}).ok));
  if (wrong) return toast(`Неправильних відповідей: ${wrong} з ${qs.length}. Ознайомтеся з матеріалами ще раз і повторіть.`);
  if (!d.confirm) return toast('Поставте позначку підтвердження');
  const now = new Date();
  await save('ПроходженняІнструктажів', { briefingId: id, personId: ME.personId, date: today(), time: z2(now.getHours()) + ':' + z2(now.getMinutes()), ts: now.getTime(), score: qs.length ? `${qs.length}/${qs.length}` : '', answers: JSON.stringify(ans), device: deviceTag() });
  UI.dirty = false; savedMsg('Проходження інструктажу підтверджено'); render();
};

/** Керівник підтверджує проведення інструктажу зі свого пристрою (для одного працівника або для всіх, хто вже пройшов). */
async function confirmConduct(passes, b) {
  if (!isLead()) return toast('Підтвердити проведення може лише керівник');
  const names = passes.map(p => shortName(personName(p.personId))).join(', ');
  const who = get('Персонал', ME.personId) || {};
  if (!await ask(`Підтверджую, що провів(-ла) інструктаж «${b.title}» з працівниками:\n${names}\n\nПідтвердження: ${who.pib || ME.name}, ${uaDate(today())} ${nowHM()}`, 'Підтвердити')) return;
  const dev = deviceTag(), t = nowHM();
  for (const p of passes) await save('ПроходженняІнструктажів', { ...p, condBy: ME.personId, condDate: today(), condTime: t, condDevice: dev });
  savedMsg(passes.length > 1 ? `Проведення підтверджено для ${passes.length} працівників` : 'Проведення інструктажу підтверджено'); render();
}
ACTS.briefconf = d => { const p = get('ПроходженняІнструктажів', d.id); if (p) confirmConduct([p], get('Інструктажі', p.briefingId) || {}); };
ACTS.briefconfall = d => {
  const b = get('Інструктажі', d.id); if (!b) return;
  const ps = briefPeople(b).map(pid => briefPass(b.id, pid)).filter(p => p && !p.condDate);
  if (ps.length) confirmConduct(ps, b);
};

ROUTES.briefform = (id = 'new', fromId) => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Інструктажі', id) : null;
  if (id !== 'new' && !src) return notFound();
  const base = src || (fromId ? { ...get('Інструктажі', fromId), id: undefined, date: today(), participants: [] } : null);
  const key = 'brief:' + id;
  const d = UI.draft[key] || base || { type: 'Повторний', date: today(), dueDate: addDays(today(), 7), conductorId: ME.personId, participants: [] };
  const workers = staff().filter(p => p.role !== 'відвідувач');
  const pre = arr(d.participants).length ? arr(d.participants) : (fromId ? workers.filter(p => !briefPass(fromId, p.id)).map(p => p.id) : workers.map(p => p.id));
  const body =
    `<div class="grid2">${fSel('Вид інструктажу', 'type', BRIEF_TYPES, d.type)}${fSel('Проводить', 'conductorId', staffOpts(), d.conductorId, { none: '—' })}</div>
     ${fInp('Тема / назва', 'title', d.title, { req: true, ph: 'напр. Повторний інструктаж з ОП, IV квартал' })}
     <div class="grid2">${fInp('Дата інструктажу', 'date', d.date, { type: 'date', req: true })}${fInp('Пройти до', 'dueDate', d.dueDate, { type: 'date' })}</div>
     ${fArea('Зміст інструктажу', 'content', d.content, { rows: 8, ph: 'Основні вимоги, порядок дій, небезпечні фактори…' })}
     ${fInp('Посилання на матеріали (відео, презентація, Google Диск)', 'link', d.link, { type: 'url', ph: 'https://…' })}
     ${fMulti('Документи до інструктажу (інструкції з охорони праці)', 'docIds', all('Документи').filter(isOHS).sort((a, b) => String(a.kind).localeCompare(String(b.kind), 'uk') || String(a.title).localeCompare(String(b.title), 'uk')).map(x => [x.id, x.title]), d.docIds)}
     ${fMulti('Учасники', 'participants', workers.map(p => [p.id, shortName(p.pib)]), pre)}
     ${fArea('Контрольні питання (необовʼязково)', 'questionsText', d.questionsText !== undefined ? d.questionsText : questionsText(briefQs(d)), { rows: 8, ph: 'Що робити при виявленні несправності електростанції?\n+ Зупинити роботу і повідомити керівника\n- Продовжити роботу\n- Відремонтувати самостійно\n\nНаступне питання?\n+ правильна відповідь\n- неправильна' })}
     <p class="small mute">Питання розділяйте порожнім рядком. Під питанням: «+ » — правильна відповідь, «- » — неправильна. Працівник підтверджує проходження лише після правильних відповідей на всі питання.</p>`;
  return page(src ? 'Інструктаж' : 'Новий інструктаж', form('brief', id, body, src ? { del: { t: 'Інструктажі', id, back: '#/brief' } } : {}), src ? '#/briefing/' + id : '#/brief');
};
FORMS.brief = async (d, id) => {
  if (!need(d, [['title', 'тема'], ['date', 'дата'], ['participants', 'учасники']])) return;
  const qs = parseQuestions(d.questionsText);
  const blocks = String(d.questionsText || '').split(/\n\s*\n/).filter(x => x.trim()).length;
  if (blocks && qs.length < blocks && !await ask(`Розпізнано питань: ${qs.length} з ${blocks}. Питання без правильної відповіді («+ ») або з менш ніж двома варіантами буде пропущено. Зберегти?`)) return;
  const src = id !== 'new' ? get('Інструктажі', id) : {};
  const row = { ...src, ...d, questions: JSON.stringify(qs), id: id !== 'new' ? id : undefined };
  delete row.questionsText;
  const saved = await save('Інструктажі', row);
  delete UI.draft['brief:' + id]; UI.dirty = false; savedMsg('Інструктаж збережено'); go('#/briefing/' + saved.id);
};

// ═════════ ОЗНАЙОМЛЕННЯ З ДОКУМЕНТАМИ ═════════
const ACQ_LBL = { 'Робоча інструкція': 'Робочі інструкції', 'Посадова інструкція': 'Посадові інструкції', 'Положення про лабораторію': 'Положення', 'Інструкція ДІВ': 'Робота з ДІВ' };
const ACQ_TTL = { 'Робоча інструкція': 'робочі інструкції', 'Посадова інструкція': 'посадові інструкції', 'Положення про лабораторію': 'положення про лабораторію', 'Інструкція ДІВ': 'інструкції з роботи з ДІВ' };
const acqs = () => all('Інструктажі').filter(isAcq).sort((a, b) => String(b.date).localeCompare(String(a.date)));
const acqDocs = b => arr(b.docIds).map(id => get('Документи', id)).filter(Boolean);
const acqDone = (b, pid) => { const ds = acqDocs(b); return ds.length > 0 && ds.every(d => ackOf(d.id, pid)); };
const acqStat = b => { const ppl = briefPeople(b); const done = ppl.filter(p => acqDone(b, p)).length; return { ppl, done, left: ppl.length - done }; };
/** Розсилки, за якими працівнику ще треба ознайомитися. */
const acqTodo = pid => acqs().filter(b => b.date <= today() && briefPeople(b).includes(pid) && !acqDone(b, pid));

function acqItem(b) {
  const lead = isLead(), s = acqStat(b), ds = acqDocs(b);
  const mine = ME.personId && briefPeople(b).includes(ME.personId) ? acqDone(b, ME.personId) : undefined;
  const st = lead ? badge(`${s.done}/${s.ppl.length}`, s.left ? (briefOverdue(b) ? 'bad' : 'warn') : 'ok')
    : mine ? badge('✓ ознайомлений', 'ok') : mine === false ? badge(briefOverdue(b) ? 'прострочено' : 'потрібно ознайомитися', briefOverdue(b) ? 'bad' : 'warn') : '';
  return `<a class="item" href="#/acqitem/${esc(b.id)}"><div class="row between"><b>${esc(b.title)}</b>${st}</div>
    <span class="small mute">${esc(ACQ_LBL[b.note] || b.note || '')} · ${uaDate(b.date)}${b.dueDate ? ' · ознайомитися до ' + uaDate(b.dueDate) : ''} · документів: ${ds.length}</span>${lead ? `<span class="small">ознайомились ${s.done} з ${s.ppl.length}</span>` : ''}</a>`;
}
ROUTES.acq = () => {
  if (isVisitor()) return denied();
  let h = '<p class="small mute">Ознайомлення з робочими, посадовими інструкціями, положеннями та інструкціями з роботи з ДІВ. Інструкції з охорони праці — через <a href="#/brief">інструктажі</a>.</p>';
  if (isLead()) {
    h += `<div class="row gap"><a class="btn ghost" href="#/ackmatrix">📋 Журнал ознайомлення</a><a class="btn ghost" href="#/gen/ack">⬇ Журнал (.xlsx)</a></div>` + fab('#/acqform/new');
    const list = acqs(), open = list.filter(b => acqStat(b).left), done = list.filter(b => !acqStat(b).left);
    h += card('Тривають', open.length ? open.map(acqItem).join('') : empty('Усі ознайомилися'));
    if (done.length) h += card('Завершені', done.map(acqItem).join(''));
  } else {
    const todo = acqTodo(ME.personId);
    h += card('Потрібно ознайомитися', todo.length ? todo.map(acqItem).join('') : empty('Нових документів для ознайомлення немає'));
    const past = acqs().filter(b => briefPeople(b).includes(ME.personId) && acqDone(b, ME.personId));
    if (past.length) h += card('Ознайомлений(-а)', past.map(acqItem).join(''));
  }
  return page('Ознайомлення з документами', h, '#/menu');
};
ROUTES.acqitem = id => {
  const b = get('Інструктажі', id);
  if (!isAcq(b) || isVisitor()) return notFound();
  const ds = acqDocs(b);
  let h = `<div class="objhead"><h2>${esc(b.title)}</h2><p>${esc(ACQ_LBL[b.note] || b.note || '')} · ${uaDate(b.date)}${b.dueDate ? ' · ознайомитися до ' + uaDate(b.dueDate) : ''}</p></div>`;
  if (b.content) h += card('', `<div class="brieftext pre">${esc(b.content)}</div>`);
  const me = ME.personId && briefPeople(b).includes(ME.personId);
  h += card('Документи · ' + ds.length, ds.map(d => { const a = ME.personId ? ackOf(d.id, ME.personId) : null;
    return `<div class="item"><div class="row between"><b>${esc(d.title)}</b>${a ? badge('✓ ' + uaDate(a.date), 'ok') : me ? badge('не ознайомлений', 'warn') : ''}</div>
      <span class="small mute">${esc(d.kind)}${d.version ? ' · ред. ' + esc(d.version) : ''}${d.date ? ' від ' + uaDate(d.date) : ''}</span>
      <div class="row gap"><a class="btn small ${a || !me ? 'ghost' : 'primary'}" href="#/doc/${esc(d.id)}">📖 ${a || !me ? 'Відкрити' : 'Читати й ознайомитися'}</a></div></div>`; }).join('') + (ds.length ? '' : empty('Документи не вибрано')) +
    (me && b.date > today() ? `<p class="mute">Ознайомлення стане доступним ${uaDate(b.date)}.</p>` : '') +
    (me ? '<p class="small mute">Відкрийте кожен документ, дочитайте до кінця й підтвердіть ознайомлення. Ознайомлення з документом зараховується і в інших розсилках.</p>' : ''));
  if (isLead()) {
    const s = acqStat(b);
    const rows = s.ppl.map(pid => { const n = ds.filter(d => ackOf(d.id, pid)).length; const full = n === ds.length && ds.length;
      const last = ds.map(d => ackOf(d.id, pid)).filter(Boolean).map(a => a.date).sort().pop();
      return `<div class="item"><div class="row between"><b>${esc(shortName(personName(pid)))}</b>${full ? badge('✓ ' + uaDate(last), 'ok') : badge(n + '/' + ds.length, briefOverdue(b) ? 'bad' : 'warn')}</div>${!full && n ? `<span class="small mute">не ознайомлений: ${ds.filter(d => !ackOf(d.id, pid)).map(d => esc(d.title)).join('; ')}</span>` : ''}</div>`; }).join('');
    h += card(`Учасники · ознайомились ${s.done} з ${s.ppl.length}`, rows +
      `<div class="row gap"><a class="btn ghost" href="#/acqform/${esc(b.id)}">Змінити</a><a class="btn ghost" href="#/acqform/new/${esc(b.id)}">Повторити для інших / нове на основі</a></div>`);
  }
  return page('Ознайомлення', h, '#/acq');
};
ROUTES.acqform = (id = 'new', fromId) => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Інструктажі', id) : null;
  if (id !== 'new' && !isAcq(src)) return notFound();
  const base = src || (fromId && isAcq(get('Інструктажі', fromId)) ? { ...get('Інструктажі', fromId), id: undefined, date: today(), participants: [] } : null);
  const key = 'acq:' + id;
  const d = UI.draft[key] || base || { note: ACK_KINDS[0], date: today(), dueDate: addDays(today(), 7), participants: [] };
  const kind = ACK_KINDS.includes(d.note) ? d.note : ACK_KINDS[0];
  const docs = all('Документи').filter(x => x.kind === kind).sort((a, b) => String(a.title).localeCompare(String(b.title), 'uk'));
  const sel = d.docIds !== undefined ? arr(d.docIds) : docs.map(x => x.id);
  const workers = staff().filter(p => p.role !== 'відвідувач');
  const pre = arr(d.participants).length ? arr(d.participants) : (fromId ? workers.filter(p => !acqDone(get('Інструктажі', fromId), p.id)).map(p => p.id) : workers.map(p => p.id));
  const body = fSel('Вид документа', 'note', ACK_KINDS.map(k => [k, ACQ_LBL[k]]), kind, { re: true, hint: 'у списку документів нижче — лише документи цього виду' }) +
    fInp('Назва', 'title', d.title !== undefined ? d.title : 'Ознайомлення: ' + ACQ_TTL[kind], { req: true }) +
    `<div class="grid2">${fInp('Дата', 'date', d.date, { type: 'date', req: true })}${fInp('Ознайомитися до', 'dueDate', d.dueDate, { type: 'date' })}</div>` +
    (docs.length ? fMulti('Документи для ознайомлення · ' + ACQ_LBL[kind], 'docIds', docs.map(x => [x.id, x.title + (x.version ? ' (ред. ' + x.version + ')' : '')]), sel) : `<p class="warn">Документів виду «${esc(kind)}» ще немає — додайте їх у розділі <a href="#/docs">Інструкції</a>.</p>`) +
    fMulti('Учасники', 'participants', workers.map(p => [p.id, shortName(p.pib)]), pre) +
    fArea('Коментар для працівників', 'content', d.content, { rows: 3, ph: 'напр. нова редакція посадових інструкцій з 01.11' });
  return page(src ? 'Ознайомлення' : 'Нове ознайомлення', form('acq', id, body, src ? { del: { t: 'Інструктажі', id, back: '#/acq' } } : {}), src ? '#/acqitem/' + id : '#/acq');
};
ONCHANGE.acq = (d, field) => { if (field === 'note') { const k = d.note; d.docIds = all('Документи').filter(x => x.kind === k).map(x => x.id); d.title = 'Ознайомлення: ' + (ACQ_TTL[k] || k); } };
FORMS.acq = async (d, id) => {
  if (!need(d, [['title', 'назва'], ['date', 'дата'], ['participants', 'учасники']])) return;
  const ok = arr(d.docIds).map(x => get('Документи', x)).filter(x => x && x.kind === d.note);
  if (!ok.length) return toast('Виберіть документи для ознайомлення');
  const src = id !== 'new' ? get('Інструктажі', id) : {};
  const saved = await save('Інструктажі', { ...src, ...d, docIds: ok.map(x => x.id), type: ACQ_TYPE, id: id !== 'new' ? id : undefined });
  delete UI.draft['acq:' + id]; UI.dirty = false; savedMsg('Ознайомлення збережено'); go('#/acqitem/' + saved.id);
};
