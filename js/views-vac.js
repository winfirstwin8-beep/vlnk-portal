/* Портал ВЛНК — графік відпусток 2026–2027: частини (план/факт), облік днів, ознайомлення, календар */
'use strict';

function vacYears() {
  const y = Number(today().slice(0, 4));
  const ys = new Set([String(y), String(y + 1), ...all('Відпустки').map(v => String(v.year))]);
  return [...ys].filter(Boolean).sort();
}
function vacLine(v) {
  const pl = v.planFrom ? `${uaDate(v.planFrom)}–${uaDate(v.planTo || v.planFrom)} (${vacLen(v.planFrom, v.planTo || v.planFrom)} дн.)` : '—';
  const fa = v.factFrom ? `${uaDate(v.factFrom)}–${uaDate(v.factTo || v.factFrom)} (${vacLen(v.factFrom, v.factTo || v.factFrom)} дн.)` : '';
  const moved = v.factFrom && v.planFrom && (v.factFrom !== v.planFrom || (v.factTo || '') !== (v.planTo || ''));
  const body = `<b>Частина ${esc(v.part || '')}</b>${v.kind && v.kind !== 'щорічна основна' ? ' · ' + esc(v.kind) : ''}<br>
    <span class="small">План: ${pl}</span>${fa ? `<br><span class="small">Факт: ${fa}${moved ? ' ' + badge('перенесено', 'warn') : ''}</span>` : ''}
    ${v.orderNo ? `<br><span class="small mute">Наказ № ${esc(v.orderNo)}</span>` : ''}${v.note ? `<br><span class="small mute">${esc(v.note)}</span>` : ''}`;
  return isLead() ? `<a class="vacpart" href="#/vacform/${esc(v.id)}">${body}</a>` : `<div class="vacpart">${body}</div>`;
}
function vacChips(s) {
  const left = s.left < 0 ? badge('перевикористано ' + (-s.left), 'bad') : badge('залишок ' + s.left, s.left ? 'pri' : 'ok');
  return `<span class="small">${badge('норма ' + s.norm)} ${badge('заплан. ' + s.plan, s.plan > s.norm ? 'warn' : '')} ${badge('викор. ' + s.used)} ${left}</span>`;
}

ROUTES.vac = () => {
  if (isVisitor()) return denied();
  const years = vacYears();
  const Y = UI.vyear && years.includes(UI.vyear) ? UI.vyear : (UI.vyear = today().slice(0, 4));
  const tab = UI.vtab || 'list';
  const people = staff().filter(p => p.role !== 'відвідувач');
  const t = today();
  let h = seg('vyear', years.map(y => [y, y + ' рік']), Y);

  // хто у відпустці зараз і найближчим часом
  const now = people.filter(p => onVacation(p.id, t));
  const soon = people.map(p => ({ p, v: all('Відпустки').filter(v => v.personId === p.id).map(v => vacRange(v)).filter(([a]) => a && a > t && a <= addDays(t, 30)).sort()[0] })).filter(x => x.v);
  if (now.length || soon.length) {
    h += card('Зараз і найближчі 30 днів',
      (now.length ? `<p><b>У відпустці:</b> ${now.map(p => { const [, b] = vacRange(onVacation(p.id, t)); return esc(shortName(p.pib)) + ' <span class="small mute">до ' + uaDate(b) + '</span>'; }).join(', ')}</p>` : '') +
      (soon.length ? `<p><b>Підуть:</b> ${soon.sort((a, b) => a.v[0].localeCompare(b.v[0])).map(x => esc(shortName(x.p.pib)) + ' <span class="small mute">' + uaDate(x.v[0]) + '–' + uaDate(x.v[1]) + '</span>').join(', ')}</p>` : ''));
  }

  // власний графік і підтвердження ознайомлення
  if (ME.personId && get('Персонал', ME.personId)) {
    const s = vacSummary(ME.personId, Y);
    const ack = vacAck(ME.personId, Y);
    h += card('Моя відпустка · ' + Y, vacChips(s) + (s.parts.length ? s.parts.map(vacLine).join('') : empty('Відпустку на цей рік не заплановано')) +
      (s.parts.length ? (ack ? `<p>${badge('✓ ознайомлений з графіком ' + uaDate(ack.date), 'ok')}</p>` : `<button class="btn primary wide" data-act="vacack" data-y="${Y}">Ознайомлений з графіком відпусток</button>`) : ''));
  }

  h += seg('vtab', [['list', 'Графік'], ['cal', 'Календар'], ['sum', 'Облік днів']], tab);

  if (tab === 'list') {
    if (isLead()) h += fab('#/vacform/new');
    h += people.map(p => {
      const s = vacSummary(p.id, Y);
      const ack = vacAck(p.id, Y);
      return `<div class="item"><div class="row between"><b>${esc(p.pib)}</b>${s.parts.length ? (ack ? badge('✓ ознайомл.', 'ok') : badge('не ознайомл.', 'warn')) : ''}</div>
        <span class="small mute">${esc(p.posada || '')}${p.hireDate ? ' · прийнятий ' + uaDate(p.hireDate) : ''}</span>
        ${vacChips(s)}${s.parts.map(vacLine).join('')}
        ${isLead() ? `<a class="small" href="#/vacform/new/${esc(p.id)}">+ частина відпустки</a>` : ''}</div>`;
    }).join('') || empty('Персонал не внесено');
  }

  if (tab === 'cal') {
    const months = MONTHS.map((_, i) => Y + '-' + z2(i + 1));
    const rows = people.map(p => [esc(shortName(p.pib)), ...months.map(m => { const n = vacDaysIn(p.id, m + '-01', monthEnd(m)).size; return n ? `<span class="vday">${n}</span>` : ''; })]);
    // найбільша кількість людей у відпустці одночасно в кожному місяці
    const peak = months.map(m => { let mx = 0; dateRange(m + '-01', monthEnd(m)).forEach(d => { const c = people.filter(p => onVacation(p.id, d)).length; if (c > mx) mx = c; }); return mx; });
    rows.push(['<b>Одночасно, макс.</b>', ...peak.map(n => n ? `<b class="${n >= 3 ? 'bad' : n === 2 ? 'warn' : ''}">${n}</b>` : '')]);
    h += card('Дні відпустки по місяцях · ' + Y, table(['ПІБ', ...MONTHS.map(m => m.slice(0, 3))], rows, 'center first cal') +
      `<p class="small mute">Число — календарні дні відпустки в місяці (за фактом, а якщо його немає — за планом). Нижній рядок показує, скільки людей максимально відсутні одночасно: зручно для планування складу бригад.</p>`);
  }

  if (tab === 'sum') {
    const rows = people.map(p => { const s = vacSummary(p.id, Y); const a = vacAck(p.id, Y); return [esc(shortName(p.pib)), s.norm, s.plan, s.used, `<b class="${s.left < 0 ? 'bad' : ''}">${s.left}</b>`, s.parts.length ? (a ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>') : '—']; });
    h += card('Облік днів · ' + Y, table(['ПІБ', 'Норма', 'Заплан.', 'Викор.', 'Залишок', 'Ознайомл.'], rows, 'num first') +
      `<p class="small mute">Норма — з картки працівника або загальна з налаштувань (${esc(setting('vacDaysDefault', '24'))} дн.). Використано — фактичні дні, що вже минули. Святкові дні автоматично не віднімаються.</p>`);
  }
  if (!isVisitor()) h += `<a class="btn ghost wide" href="#/gen/vac">Сформувати графік відпусток (.xlsx)</a>`;
  return page('Відпустки', h, '#/menu');
};

ACTS.vacack = async d => {
  if (!await ask(`Підтверджую, що ознайомився(-лась) з графіком відпусток на ${d.y} рік.`)) return;
  await save('Ознайомлення', { docId: 'vac-' + d.y, personId: ME.personId, date: today() });
  savedMsg('Ознайомлення зафіксовано'); render();
};

ROUTES.vacform = (id = 'new', pid) => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('Відпустки', id) : null;
  if (id !== 'new' && !src) return notFound();
  const Y = UI.vyear || today().slice(0, 4);
  const nextPart = p => String(Math.max(0, ...vacsOf(p, Y).map(v => num(v.part))) + 1);
  const d = src || { personId: pid || '', year: Y, part: pid ? nextPart(pid) : '1', kind: VAC_KINDS[0] };
  const body = fSel('Працівник', 'personId', staffOpts(), d.personId, { req: true, none: '— оберіть —' }) +
    `<div class="grid3">${fSel('Рік', 'year', vacYears(), d.year)}${fNum('Частина №', 'part', d.part, { min: 1, step: 1 })}${fSel('Вид', 'kind', VAC_KINDS, d.kind)}</div>
     <fieldset class="f"><legend>За графіком (план)</legend><div class="grid2">${fInp('Початок', 'planFrom', d.planFrom, { type: 'date', req: true })}${fInp('Закінчення', 'planTo', d.planTo, { type: 'date', req: true })}</div></fieldset>
     <fieldset class="f"><legend>Фактично</legend><div class="grid2">${fInp('Початок', 'factFrom', d.factFrom, { type: 'date' })}${fInp('Закінчення', 'factTo', d.factTo, { type: 'date' })}</div><small>Заповнюється, коли відпустку надано або перенесено</small></fieldset>
     ${fInp('№ наказу', 'orderNo', d.orderNo)}${fArea('Примітка', 'note', d.note, { rows: 2, ph: 'причина перенесення тощо' })}`;
  return page(src ? 'Частина відпустки' : 'Нова відпустка', form('vac', id, body, src ? { del: { t: 'Відпустки', id, back: '#/vac' } } : {}), '#/vac');
};
FORMS.vac = async (d, id) => {
  if (!need(d, [['personId', 'працівник'], ['planFrom', 'початок'], ['planTo', 'закінчення']])) return;
  if (d.planTo < d.planFrom || (d.factFrom && d.factTo && d.factTo < d.factFrom)) return toast('Дата закінчення раніша за початок');
  if (d.factFrom && !d.factTo) d.factTo = d.factFrom;
  const src = id !== 'new' ? get('Відпустки', id) : null;
  const [a, b] = d.factFrom ? [d.factFrom, d.factTo] : [d.planFrom, d.planTo];
  const clash = all('Відпустки').find(v => v.id !== id && v.personId === d.personId && (() => { const [x, y] = vacRange(v); return x && x <= b && a <= y; })());
  if (clash && !await ask('Період перетинається з іншою частиною відпустки цього працівника. Зберегти?')) return;
  const others = vacsOf(d.personId, d.year).filter(v => v.id !== id).reduce((s, v) => s + vacLen(v.planFrom, v.planTo || v.planFrom), 0);
  const total = others + vacLen(d.planFrom, d.planTo);
  if (d.kind.startsWith('щорічна') && total > vacNorm(d.personId) && !await ask(`Заплановано ${total} дн. при нормі ${vacNorm(d.personId)}. Зберегти?`)) return;
  const busy = all('Звіти').filter(r => r.date >= a && r.date <= b && arr(r.workers).includes(d.personId));
  if (busy.length && !await ask(`У цей період працівник є у ${busy.length} щоденних звітах. Зберегти відпустку?`)) return;
  const row = { ...(src || {}), ...d, id: src ? id : undefined };
  if (!src || src.planFrom !== d.planFrom || src.planTo !== d.planTo) row.planChangedAt = Date.now();
  await save('Відпустки', row);
  UI.vyear = d.year; UI.dirty = false; savedMsg('Відпустку збережено'); go('#/vac');
};
