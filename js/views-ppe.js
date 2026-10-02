/* Портал ВЛНК — ЗІЗ: норми та строки носіння, розміри, видача, підтвердження отримання, потреба */
'use strict';

function sizesLine(p) {
  const s = [p.height && 'зріст ' + p.height, p.clothSize && 'одяг ' + p.clothSize, p.shoeSize && 'взуття ' + p.shoeSize, p.gloveSize && 'рукавиці ' + p.gloveSize].filter(Boolean);
  return s.length ? s.map(esc).join(' · ') : '<span class="mute">розміри не внесено</span>';
}
function ppeCounts(list) {
  const c = { bad: 0, warn: 0, ok: 0 }; list.forEach(x => c[x.st.cls]++);
  return `${c.bad ? badge('потрібно видати ' + c.bad, 'bad') : ''} ${c.warn ? badge('скоро заміна ' + c.warn, 'warn') : ''} ${badge('в нормі ' + c.ok, 'ok')}`;
}
function ppeRow(x, pid) {
  return `<div class="ppe-row"><span>${esc(x.item.name)}${truthy(x.item.seasonal) ? ' <span class="small mute">(на трасі)</span>' : ''}<br>
    <span class="small mute">строк ${x.st.months} міс.${x.st.last ? ' · видано ' + uaDate(x.st.last.date) + (x.st.last.size ? ', р. ' + esc(x.st.last.size) : '') : ''}${ppeSize(pid, x.item) ? ' · розмір ' + esc(ppeSize(pid, x.item)) : ''}</span></span>
    ${badge(x.st.text, x.st.cls)}</div>`;
}
function unconfirmed(pid) { return ppeIssues(pid).filter(i => !ppeAck(i.id)); }

ROUTES.ppe = () => {
  if (isVisitor()) return denied();
  const tab = UI.ptab || 'state';
  const lead = isLead();
  let h = '';
  // власні ЗІЗ працівника
  if (ME.personId && get('Персонал', ME.personId) && ppeOf(ME.personId).length) {
    const mine = ppeOf(ME.personId);
    const un = unconfirmed(ME.personId);
    h += card('Мої ЗІЗ', `<p class="small">${sizesLine(get('Персонал', ME.personId))}</p><p>${ppeCounts(mine)}</p>` +
      (un.length ? `<div class="note warn">Видано, але не підтверджено отримання: ${un.map(i => esc((get('ЗІЗ', i.itemId) || {}).name || '') + ' (' + uaDate(i.date) + ')').join(', ')}
        <button class="btn primary wide" data-act="ppeconfirm">Підтверджую отримання</button></div>` : '') +
      `<details ${mine.some(x => x.st.cls !== 'ok') ? 'open' : ''}><summary>Усі позиції (${mine.length})</summary>${mine.map(x => ppeRow(x, ME.personId)).join('')}</details>`);
  }
  if (!lead && tab === 'norms') UI.ptab = 'state';
  h += seg('ptab', [['state', 'Стан'], ['need', 'Потреба'], ['log', 'Видача'], ...(lead ? [['norms', 'Норми']] : [])], UI.ptab || 'state');
  const ppl = staff().filter(p => p.role !== 'відвідувач');

  if ((UI.ptab || 'state') === 'state') {
    if (!all('ЗІЗ').length) h += empty('Каталог ЗІЗ порожній. Імпортуйте норми з таблиці або додайте позиції у вкладці «Норми».');
    const rows = ppl.map(p => ({ p, list: ppeOf(p.id) })).filter(x => x.list.length)
      .sort((a, b) => b.list.filter(x => x.st.cls === 'bad').length - a.list.filter(x => x.st.cls === 'bad').length);
    h += rows.map(({ p, list }) => {
      const bad = list.filter(x => x.st.cls !== 'ok');
      return `<div class="item"><div class="row between"><b>${esc(p.pib)}</b>${lead ? `<a class="btn small primary" href="#/ppeissue/${esc(p.id)}">Видати</a>` : ''}</div>
        <span class="small mute">${esc(p.posada || '')}</span><span class="small">${sizesLine(p)}</span>
        <span>${ppeCounts(list)}${unconfirmed(p.id).length ? ' ' + badge('не підтв. ' + unconfirmed(p.id).length) : ''}</span>
        ${bad.length ? bad.map(x => ppeRow(x, p.id)).join('') : ''}
        <details><summary class="small">Усі позиції (${list.length})</summary>${list.map(x => ppeRow(x, p.id)).join('')}</details></div>`;
    }).join('') || (all('ЗІЗ').length ? empty('Норми видачі не задані') : '');
  }

  if (UI.ptab === 'need') {
    const hz = Number(UI.phz || 30);
    const lim = addDays(today(), hz);
    h += seg('phz', [['0', 'Зараз'], ['30', '30 дн.'], ['60', '60 дн.'], ['90', '90 дн.']], String(hz));
    const agg = {};
    ppl.forEach(p => ppeOf(p.id).forEach(x => {
      if (x.st.due && x.st.due > lim) return;
      const size = ppeSize(p.id, x.item) || '—';
      const k = x.item.id + '|' + size;
      (agg[k] = agg[k] || { item: x.item, size, who: [] }).who.push(shortName(p.pib));
    }));
    const rows = Object.values(agg).sort((a, b) => String(a.item.name).localeCompare(String(b.item.name), 'uk') || String(a.size).localeCompare(String(b.size)));
    h += rows.length ? card('Потрібно ' + (hz ? 'до ' + uaDate(lim) : 'видати зараз'), rows.map(r => `<div class="ppe-row"><span><b>${esc(r.item.name)}</b>${r.size !== '—' ? ' · р. ' + esc(r.size) : ''}<br><span class="small mute">${r.who.map(esc).join(', ')}</span></span><b class="qty">${r.who.length} шт.</b></div>`).join('') +
      `<p class="small mute">Разом одиниць: ${rows.reduce((s, r) => s + r.who.length, 0)}. Включає позиції, які ще не видавались, і ті, чий строк носіння спливає в цей період.</p>`) : empty('Потреби немає');
    h += `<a class="btn ghost wide" href="#/gen/ppeneed">Сформувати заявку на ЗІЗ (.xlsx)</a>`;
  }

  if (UI.ptab === 'log') {
    const list = all('ВидачаЗІЗ').slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    h += list.slice(0, UI.limit).map(i => { const it = get('ЗІЗ', i.itemId) || {}; const a = ppeAck(i.id);
      return `<${lead ? `a href="#/ppeedit/${esc(i.id)}"` : 'div'} class="item"><div class="row between"><b>${esc(it.name || '—')}</b><span class="small">${uaDate(i.date)}</span></div>
        <span class="small">${esc(personName(i.personId))} · ${esc(i.qty || 1)} шт.${i.size ? ' · р. ' + esc(i.size) : ''}</span>
        <span class="small">${a ? badge('✓ отримання підтверджено ' + uaDate(a.date), 'ok') : badge('не підтверджено', 'warn')}${i.note ? ' <span class="mute">' + esc(i.note) + '</span>' : ''}</span></${lead ? 'a' : 'div'}>`; }).join('') + more(list.length) || empty('Видач ще не було');
  }

  if (UI.ptab === 'norms' && lead) {
    h += card('Норми по працівниках', ppl.map(p => { const n = ppeOf(p.id).length; return `<a class="item" href="#/ppenorm/${esc(p.id)}"><div class="row between"><b>${esc(p.pib)}</b>${badge(n + ' поз.')}</div><span class="small mute">${esc(p.posada || '')}</span></a>`; }).join(''));
    const cats = [...new Set(ppeItems().map(i => i.category || 'Інше'))];
    h += card('Каталог ЗІЗ', cats.map(c => `<h3>${esc(c)}</h3>` + ppeItems().filter(i => (i.category || 'Інше') === c).map(i => `<a class="item" href="#/ppeitem/${esc(i.id)}"><b>${esc(i.name)}</b><span class="small mute">${esc(PPE_SIZE[i.sizeType || ''])}${i.code ? ' · ' + esc(i.code) : ''}${truthy(i.seasonal) ? ' · на трасі' : ''}</span></a>`).join('')).join('') || empty('Порожньо'),
      `<a class="small" href="#/ppeitem/new">+ позиція</a>`);
  }
  if (lead) h += `<a class="btn ghost wide" href="#/gen/ppecard">Особові картки обліку ЗІЗ (.xlsx)</a>`;
  return page('ЗІЗ', h, '#/menu');
};

ACTS.ppeconfirm = async () => {
  const un = unconfirmed(ME.personId);
  if (!await ask(`Підтверджую отримання ЗІЗ:\n${un.map(i => '• ' + ((get('ЗІЗ', i.itemId) || {}).name || '') + ' — ' + (i.qty || 1) + ' шт. (' + uaDate(i.date) + ')').join('\n')}`)) return;
  for (const i of un) await save('Ознайомлення', { docId: 'ppe-' + i.id, personId: ME.personId, date: today() });
  savedMsg('Отримання підтверджено'); render();
};

// ───────── видача ─────────
ROUTES.ppeissue = pid => {
  if (!isLead()) return denied();
  const key = 'ppeissue:' + (pid || 'new');
  const d = UI.draft[key] || { personId: pid || '', date: today() };
  const list = d.personId ? ppeOf(d.personId) : [];
  const rank = { bad: 0, warn: 1, ok: 2 };
  const rows = list.slice().sort((a, b) => rank[a.st.cls] - rank[b.st.cls]).map(x => {
    const on = d.items ? arr(d.items).includes(x.item.id) : x.st.cls !== 'ok';
    // розмір і кількість показуються лише для відмічених позицій
    const extra = on ? `<div class="grid2">${fInp('Розмір', 'size_' + x.item.id, d['size_' + x.item.id] ?? ppeSize(d.personId, x.item))}${fNum('К-сть', 'qty_' + x.item.id, d['qty_' + x.item.id] ?? 1)}</div>` : '';
    return `<div class="ppe-issue"><label class="chk"><input type="checkbox" name="items[]" value="${esc(x.item.id)}" ${on ? 'checked' : ''} data-re><span>${esc(x.item.name)}<br>${badge(x.st.text, x.st.cls)}</span></label>${extra}</div>`;
  }).join('');
  const body = fSel('Працівник', 'personId', staffOpts(), d.personId, { req: true, none: '— оберіть —', re: true }) +
    fInp('Дата видачі', 'date', d.date, { type: 'date', req: true }) +
    (d.personId ? (list.length ? `<fieldset class="f"><legend>Позиції за нормою (відмічено ті, що потрібно видати)</legend>${rows}</fieldset>` : empty('Для працівника не задано норм ЗІЗ. Задайте їх у вкладці «Норми».')) : '') +
    fInp('Примітка', 'note', d.note);
  return page('Видача ЗІЗ', form('ppeissue', pid || 'new', body, { submit: 'Видати' }), '#/ppe');
};
ONCHANGE.ppeissue = (d, f) => { if (f === 'personId') Object.keys(d).forEach(k => { if (/^(size_|qty_)/.test(k) || k === 'items') delete d[k]; }); };
FORMS.ppeissue = async (d, id) => {
  if (!need(d, [['personId', 'працівник'], ['date', 'дата'], ['items', 'позиції']])) return;
  for (const itemId of d.items) {
    const n = ppeNorm(d.personId, itemId);
    await save('ВидачаЗІЗ', { personId: d.personId, itemId, date: d.date, qty: d['qty_' + itemId] || 1, size: d['size_' + itemId] || '', dueDate: n && num(n.months) ? addMonthsDate(d.date, num(n.months)) : '', note: d.note, authorId: ME.personId });
  }
  delete UI.draft['ppeissue:' + id]; UI.dirty = false; UI.ptab = 'state';
  savedMsg(`Видано позицій: ${d.items.length}. Працівник підтвердить отримання у своєму розділі ЗІЗ`); go('#/ppe');
};
ROUTES.ppeedit = id => {
  if (!isLead()) return denied();
  const i = get('ВидачаЗІЗ', id); if (!i) return notFound();
  const body = `<div class="note">${esc(personName(i.personId))}<br><b>${esc((get('ЗІЗ', i.itemId) || {}).name || '')}</b></div>` +
    `<div class="grid3">${fInp('Дата', 'date', i.date, { type: 'date', req: true })}${fInp('Розмір', 'size', i.size)}${fNum('К-сть', 'qty', i.qty)}</div>` + fInp('Примітка', 'note', i.note);
  return page('Запис видачі', form('ppeedit', id, body, { del: { t: 'ВидачаЗІЗ', id, back: '#/ppe' } }), '#/ppe');
};
FORMS.ppeedit = async (d, id) => {
  const i = get('ВидачаЗІЗ', id); const n = ppeNorm(i.personId, i.itemId);
  await save('ВидачаЗІЗ', { ...i, ...d, dueDate: n && num(n.months) ? addMonthsDate(d.date, num(n.months)) : '' });
  UI.dirty = false; savedMsg('Збережено'); go('#/ppe');
};

// ───────── норми по працівнику ─────────
ROUTES.ppenorm = pid => {
  if (!isLead()) return denied();
  const p = get('Персонал', pid); if (!p) return notFound();
  const same = staff().filter(x => x.id !== pid && x.posada && x.posada === p.posada).length;
  const body = `<p class="small mute">Строк носіння в місяцях. 0 або порожньо — позиція не видається.</p>
    <fieldset class="f"><legend>Розміри</legend><div class="grid2">${fInp('Зріст', 'height', p.height, { ph: '176-182' })}${fInp('Одяг', 'clothSize', p.clothSize, { ph: '52-54' })}
    ${fInp('Взуття', 'shoeSize', p.shoeSize, { mode: 'decimal' })}${fInp('Рукавиці', 'gloveSize', p.gloveSize, { mode: 'decimal' })}</div></fieldset>
    <fieldset class="f"><legend>Строки носіння, міс.</legend>${ppeItems().map(i => `<label class="ppe-norm"><span>${esc(i.name)}</span><input name="m_${esc(i.id)}" type="number" min="0" step="1" inputmode="numeric" value="${esc((ppeNorm(pid, i.id) || {}).months || '')}"></label>`).join('') || empty('Каталог порожній')}</fieldset>
    ${same ? fChk(`Застосувати ці строки до всіх з посадою «${esc(p.posada)}» (${same})`, 'toSame', false) : ''}`;
  return page(shortName(p.pib) + ' · ЗІЗ', form('ppenorm', pid, body), '#/ppe');
};
FORMS.ppenorm = async (d, pid) => {
  const p = get('Персонал', pid);
  const sz = { height: d.height, clothSize: d.clothSize, shoeSize: d.shoeSize, gloveSize: d.gloveSize };
  if (Object.entries(sz).some(([k, v]) => String(p[k] || '') !== v)) await save('Персонал', { ...p, ...sz });
  const targets = [pid, ...(d.toSame ? staff().filter(x => x.id !== pid && x.posada === p.posada).map(x => x.id) : [])];
  let n = 0;
  for (const t of targets) for (const i of ppeItems()) {
    const v = d['m_' + i.id]; const cur = ppeNorm(t, i.id);
    if (cur ? String(cur.months) === String(v || 0) : !num(v)) continue;
    await save('НормиЗІЗ', { ...(cur || { id: 'ppn-' + t + '-' + i.id, personId: t, itemId: i.id }), months: num(v) }); n++;
  }
  UI.dirty = false; savedMsg('Норми збережено' + (n ? ' (' + n + ' змін)' : '')); UI.ptab = 'norms'; go('#/ppe');
};

// ───────── каталог ─────────
ROUTES.ppeitem = (id = 'new') => {
  if (!isLead()) return denied();
  const src = id !== 'new' ? get('ЗІЗ', id) : null;
  const d = src || { category: 'Спецодяг', sizeType: 'одяг' };
  const cats = [...new Set(['Спецодяг', 'Спецвзуття', 'Захист рук', 'Захист очей', 'Захист голови', 'Утеплені (на трасі)', ...all('ЗІЗ').map(i => i.category).filter(Boolean)])];
  const body = fInp('Найменування', 'name', d.name, { req: true }) + fInp('Маркування захисних властивостей', 'code', d.code, { ph: 'ЗМиВуНм' }) +
    `<div class="grid2">${fSel('Група', 'category', cats, d.category)}${fSel('Розмір за', 'sizeType', Object.entries(PPE_SIZE), d.sizeType || '')}</div>` +
    fChk('Видається під час роботи на трасі (утеплене)', 'seasonal', d.seasonal) + fArea('Примітка', 'note', d.note, { rows: 2 });
  return page('Позиція ЗІЗ', form('ppeitem', id, body, src ? { del: { t: 'ЗІЗ', id, back: '#/ppe' } } : {}), '#/ppe');
};
FORMS.ppeitem = async (d, id) => {
  if (!need(d, [['name', 'найменування']])) return;
  await save('ЗІЗ', { ...(get('ЗІЗ', id) || {}), ...d, id: id !== 'new' ? id : undefined });
  UI.dirty = false; UI.ptab = 'norms'; savedMsg('Збережено'); go('#/ppe');
};
