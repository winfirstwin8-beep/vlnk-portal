/* Портал ВЛНК — ядро: утиліти, локальна база (IndexedDB), синхронізація, розрахунки */
'use strict';

const VER = '1.8.50';
/** Мінімальна версія серверного коду (Code.gs), з якою працює цей застосунок. */
const NEED_API = '1.8.18';
/** Що нового — показується один раз після оновлення (коротко, для працівників). */
const CHANGES = {
  '1.8.50': ['Завдання: у картці обʼєкта — кнопка «⬆ Завантажити протокол» (відкриває реєстрацію з обʼєктом і бригадою; метод — вручну) і «🧾 Списання матеріалів» (вимоги на рентгенплівку й реактиви; неактивна, якщо плівка не використовувалась)', 'Реєстрація протоколів: зазначається, хто вносить дані (за входом — автоматично); можна завантажити оновлену версію протоколу — обидві версії зберігаються в папці обʼєкта, нова підписана'],
  '1.8.49': ['Щоденний звіт: після відправки — «Ваш звіт успішно збережено» з часом; якщо звіт бригади за сьогодні вже є — замість нового бланка пропонується «Редагувати існуючий звіт»; фіксується, хто створив звіт і хто вносив зміни'],
  '1.8.48': ['Списання ПММ: дати прописом (13 жовтня 2026 р.) у шапці та після № акта і відомості; електростанція і рядок пального — в один рядок; у відомості ПІБ підзвітної особи — прізвище й ініціали, 10 шрифтом'],
  '1.8.47': ['Головна: новини — на початку сторінки; у «Бригади сьогодні» — склад бригад; після «Моє завдання на сьогодні» — проблемні питання зі звітів за 7 днів'],
  '1.8.46': ['План робіт по днях: для кожного завдання — план за методами на кожен день (можна розподілити план завдання рівномірно) і примітка; у розгорнутій картці обʼєкта — таблиця «план / факт» за щоденними звітами'],
  '1.8.45': ['Списання ПММ: залишок на початок (C41) — із залишку на кінець (K42) відомості цієї електростанції по попередньому обʼєкту'],
  '1.8.44': ['Списання ПММ: № і дата акта та відомості — наступний день після останнього дня робіт; залишок на початок місяця 0 л; відомість — А4 книжкова, двосторонній друк'],
  '1.8.43': ['Біля дат обʼєкта — кнопка «⛽ Списання ПММ»: акт на списання ПММ і відомість використання ПММ електростанції за щоденними звітами (мотогодини, норма, заправки)'],
  '1.8.42': ['Кнопка «📄 Звіти» біля дат обʼєкта перейменована на «📄 Табеля для замовника»'],
  '1.8.42': ['Кнопку «📄 Звіти» перейменовано на «📄 Табеля для замовника»'],
  '1.8.41': ['Завдання / Планування: у розгорнутій картці обʼєкта — ТОРО-замовлення, ТОРО-підзамовлення і № ICP', 'Звіти для замовника: номер і дата наказу на відрядження бригади на цей період (можна виправити перед формуванням)'],
  '1.8.40': ['Звіти для замовника: номер і дата наказу розділяються («№ … від …») — дата підставляється автоматично'],
  '1.8.39': ['Планування / Завдання: кнопка «📄 Звіти» праворуч від дат обʼєкта — звіт про відрядження, табель перебування і табель машин і механізмів за цей обʼєкт на ці дати (xlsx на пошту і на Диск)'],
  '1.8.38': ['Обʼєкти: фільтри «Активні» (є завдання або звіти за рік) і «RT» (де проводився рентгенконтроль), кількість у кожному фільтрі'],
  '1.8.37': ['Завдання: у розгорнутій картці обʼєкта — склад бригади з табельними номерами, табельний номер відповідального від замовника, автомобіль (марка, держ. номер, SAP-номер)', 'Авто: поле «SAP-номер»'],
  '1.8.36': ['Моніторинг: реактиви розділено на проявник і фіксаж; за місяць і рік «Витрати матеріалів» і «Проблемні питання» — одразу після «По обʼєктах»'],
  '1.8.35': ['Звіти: повторний звіт бригади по тому самому обʼєкту за ту саму дату не створюється — відкривається раніше поданий звіт для редагування'],
  '1.8.34': ['Персонал: лічильники «на роботі, у відпустці, на лікарняному, в ЗСУ, на навчанні» з фільтром', 'Картка працівника: працевлаштований, працює за фахом з, стаж на підприємстві й за професією, корпоративна пошта, відсутність; ЗІЗ згорнуто', 'Табельні номери й дати — з попереднього порталу (кнопка на сторінці «Персонал»)'],
  '1.8.33': ['Планування → «Вахти за місяць»: у кожної вахти — період, кількість обʼєктів, стан СЗ і відомості та кнопка «Сформувати СЗ і відомість» (2 документи за шаблонами, надсилаються на email)', 'Персонал: табельний номер; Обʼєкти: відстані й час у дорозі для СЗ', 'Виправлено вигляд кнопок вибору складу після 1.8.32'],
  '1.8.32': ['Ще → «Планування»: склад бригад на місяць із зауваженнями (сертифікати, РБ, водій, авто, відпустки), графік вахт і вахти з обсягами', 'Розділ «Склад бригад» прибрано з меню — змінити склад можна з «Планування»'],
  '1.8.31': ['Завдання: у картці завдання перед наказом — повна назва обʼєкта, відповідальний від замовника та його телефон', 'Обʼєкти: поле «Телефон» відповідального від замовника'],
  '1.8.30': ['Картка працівника: скан сертифіката НК (PDF або фото) — додати, завантажити, надіслати на пошту, поділитися', 'Картка працівника: «Обладнання на руках» — між «Відпусткою» та «ЗІЗ»'],
  '1.8.29': ['Паливо: в таблиці електростанцій — лише ті, що працювали в місяці; у звіті не показується станція без мотогодин'],
  '1.8.28': ['Завдання: прибрано кнопки «Склад бригад» і «+ Завдання» (склад — у меню «Ще», завдання — «+ додати» в картці бригади)'],
  '1.8.27': ['Звіти: видно, хто й коли подав звіт; попередження про повторний звіт по обʼєкту за той самий період', 'Список звітів: фільтр «Повторні»'],
  '1.8.26': ['Протоколи НК: у виборі обʼєкта — лише обʼєкти в роботі'],
  '1.8.25': ['НД: новий вид документа «Зразок протоколу» — за методами контролю'],
  '1.8.24': ['Формування документів: вибір бригади фільтрує картку «Звіти бригад за періодами», бригада — у заголовку й назві файлу'],
  '1.8.23': ['Реєстрація протоколів НК (Ще → Протоколи НК): реєстр по обʼєктах, файли — у папках з короткою назвою обʼєкта'],
  '1.8.22': ['Вид робіт «Перехід» у завданнях, звітах і обʼєктах'],
  '1.8.21': ['Завдання: дати початку й кінця — крупно, з тривалістю та станом'],
  '1.8.20': ['Картка відповідального від замовника — без графіка, відпустки, водійських даних і допуску до авто'],
  '1.8.19': ['Завдання: склад бригади — в одному рядку з назвою бригади', '«Відвідувачі» перейменовано на «Відповідальні від замовника»; у картках обʼєктів — відповідальний і населений пункт'],
  '1.8.18': ['Виконані роботи з початку року: підсумкові записи з шаблону «ВиконаноЗПочаткуРоку» враховуються в обсягах і матеріалах'],
  '1.8.17': ['Витрати плівки, реактивів і пенетрантів рахуються за всі звіти, зокрема перенесені зі старого порталу (за нормами на діаметр)'],
  '1.8.16': ['Картка обʼєкта: відповідальний від замовника (ПІБ і посада), населений пункт, автомобіль'],
  '1.8.15': ['Новий логотип порталу NDT ВЛНК'],
  '1.8.14': ['Завдання: перемикач «В роботі» і «Плануються» — обʼєкти по бригадах', 'Документи: попередній, поточний, наступний місяць і звіти бригад за періодами завдань'],
  '1.8.13': ['Завдання, заплановані наперед, показуються окремо; з 1-го числа свого місяця — автоматично «в роботі»'],
  '1.8.12': ['Моніторинг: витрати рентгенплівки, реактивів і пенетрантів за добу, місяць, рік — по бригадах і обʼєктах'],
  '1.8.11': ['Обнулення мотогодин і залишку палива електростанцій (Авто та генератори → станція → Обнулити)'],
  '1.8.10': ['Вакансії та службовий обліковий запис приховані зі списку персоналу (Персонал → Приховані)'],
  '1.8.9': ['Відвідувачі винесені з «Персоналу» в окремий розділ (Персонал → Відвідувачі)'],
  '1.8.8': ['Картку працівника можна зберегти без email (наприклад, при зміні ролі на «відвідувач»)'],
  '1.8.7': ['НД та інструкції: надсилання собі на пошту і «Поділитися»', 'НД можна відкрити й ознайомитися прямо в порталі'],
  '1.8.6': ['Повідомлення про нову версію порталу з кнопкою «Оновити»', 'Після оновлення — короткий перелік змін'],
  '1.8.5': ['Читання тексту інструкцій і НД у порталі; ознайомлення — після прочитання до кінця'],
  '1.8.4': ['Інструктаж: працівник підтверджує проходження, керівник — проведення'],
  '1.8.3': ['Протоколи НК можна надіслати собі на пошту'],
  '1.8.1': ['Протоколи НК на картці обʼєкта'],
  '1.8.0': ['Онлайн-інструктажі з контрольними питаннями']
};
const cmpVer = (a, b) => { const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
// Методи НК. Ключі полів звіту збережені зі старої версії (vt = VT-W, ut = UT-W, thick = UTT, hard = HB), щоб не втратити дані.
const METHODS = ['RT', 'VT-W', 'VT-S', 'UT-W', 'UT-S', 'PT', 'UTT', 'HB'];
const MKEY = { RT: 'rt', 'VT-W': 'vt', 'VT-S': 'vts', 'UT-W': 'ut', 'UT-S': 'uts', PT: 'pt', UTT: 'thick', HB: 'hard' };
const MKEYS = METHODS.map(m => MKEY[m]);
const MSHORT = Object.fromEntries(METHODS.map(m => [MKEY[m], m]));
const MUNIT = { rt: 'стиків', vt: 'стиків', vts: 'дм²', ut: 'стиків', uts: 'дм²', pt: 'стиків', thick: 'стиків', hard: 'стиків' };
const MU = k => MUNIT[k] === 'дм²' ? 'дм²' : 'ст.';          // коротка одиниця для таблиць
const mHead = m => m + ', ' + MU(MKEY[m]);                  // заголовок колонки: «RT, ст.», «VT-S, дм²»
/** Коротке зведення обсягу: «RT 12 ст. · VT-S 3 дм²». */
const planOf = t => { const p = obj(t && t.planVol); const o = {}; MKEYS.forEach(k => { if (num(p[k])) o[k] = num(p[k]); }); return o; };
// «виконано/заплановано» за методами: ключі — методи завдання, план або факт
const donePlanKeys = (fact, plan, methods) => MKEYS.filter(k => plan[k] || num(fact[k]) || methodsOf(methods || []).some(m => MKEY[m] === k));
const donePlanText = (fact, plan, methods) => donePlanKeys(fact, plan, methods).map(k => MSHORT[k] + ' ' + fmtN(num(fact[k])) + '/' + (plan[k] ? fmtN(plan[k]) : '—') + ' ' + MU(k)).join(' · ');
const volText = q => MKEYS.filter(k => num(q[k])).map(k => MSHORT[k] + ' ' + fmtN(num(q[k])) + ' ' + MU(k)).join(' · ');
const METHOD_ALIAS = { VT: 'VT-W', UT: 'UT-W', 'Товщинометрія': 'UTT', 'Твердометрія': 'HB' };
const normM = m => METHOD_ALIAS[m] || m;
const methodsOf = v => [...new Set(arr(v).map(normM))];
/** Значення по всіх методах для таблиць і плиток. */
const mVals = q => MKEYS.map(k => fmtN(num(q[k])));
const WORK_TYPES = ['Монтажна колона', 'Ізоляційна колона', 'Муфти', 'ДДК', 'Вогневі роботи', 'Перехід', 'Інше'];
const BRIGADES = [1, 2, 3, 4, 5];
const DOC_KINDS = ['Інструкція з охорони праці', 'Робоча інструкція', 'Посадова інструкція', 'Положення про лабораторію', 'Нормативний документ', 'Методика контролю', 'Зразок протоколу'];
const INSTR_KINDS = DOC_KINDS.slice(0, 4);             // розділ «Інструкції»
const ND_KINDS = ['Нормативний документ', 'Методика контролю', 'Зразок протоколу']; // розділ «НД» (зразки протоколів — за методом контролю)
const ND_GROUPS = ['Загальна НД', 'RT', 'VT-W', 'VT-S', 'UT-W', 'UT-S', 'PT', 'UTT', 'HB', 'ДДК'];
const isND = d => ND_KINDS.includes(d.kind);
const ndGroupOf = d => ND_GROUPS.includes(d.ndGroup) ? d.ndGroup : (normM(d.ndGroup) && ND_GROUPS.includes(normM(d.ndGroup)) ? normM(d.ndGroup) : 'Загальна НД');
const CONDITIONS = ['справне', 'потребує обслуговування', 'несправне'];
const TASK_STATUS = ['заплановано', 'в роботі', 'виконано', 'перенесено'];
/** Місяць створення завдання: поле createdMonth, а для старих записів — місяць останньої зміни. */
const taskCreatedYm = t => t.createdMonth || (num(t.updatedAt) ? fmtD(new Date(num(t.updatedAt))).slice(0, 7) : '');
/** Завдання, заплановане наперед: статус «заплановано» і створене в попередньому місяці (раніше, ніж місяць завдання). */
const isPlannedAhead = t => (t.status || 'заплановано') === 'заплановано' && !!t.month && !!taskCreatedYm(t) && taskCreatedYm(t) < t.month;
/** Ще чекає свого місяця — показується окремо на сторінці «Завдання». */
const isPendingAhead = t => isPlannedAhead(t) && t.month > ym(today());
/** Місяць настав — завдання переходить у «в роботі». */
const isDueStart = t => isPlannedAhead(t) && t.month <= ym(today());
/** Статус для показу: заплановане наперед у своєму місяці вже «в роботі», навіть поки керівник не синхронізувався. */
const taskStatus = t => isDueStart(t) ? 'в роботі' : (t.status || 'заплановано');
/** Обʼєкт у роботі: статус «в роботі» або «заплановано», але період завдання вже триває. */
const isTaskInWork = t => { const st = taskStatus(t); if (st === 'в роботі') return true; return st === 'заплановано' && taskCovers(t, today()); };
/** Обʼєкт плануються: статус «заплановано», початок у майбутньому. */
const isTaskPlanned = t => taskStatus(t) === 'заплановано' && !isTaskInWork(t) && String(t.dateFrom || (t.month ? t.month + '-01' : '')) > today();
/** Керівник: переводить заплановані наперед завдання, місяць яких настав, у статус «в роботі». */
async function autoStartTasks() {
  if (MODE !== 'live' && MODE !== 'demo' || !isLead()) return 0;
  const due = all('Завдання').filter(isDueStart);
  for (const t of due) await save('Завдання', { ...t, status: 'в роботі', createdMonth: taskCreatedYm(t) });
  return due.length;
}
const ROLES = ['керівник', 'працівник', 'відвідувач'];
/** Назва ролі для показу: роль «відвідувач» — це відповідальні від замовника (лише перегляд). */
const roleName = r => r === 'відвідувач' ? 'відповідальний від замовника' : (r || '');
const ROLE_OPTS = ROLES.map(r => [r, roleName(r)]);
/** Відповідальний від замовника (картка з «Персонал», роль відвідувач) для обʼєкта — за ПІБ у полі contact. */
const normName = s => String(s || '').toLowerCase().replace(/[^a-zа-яіїєґ]/gi, '');
function objResp(o) {
  const k = normName(o && o.contact); if (!k) return null;
  return all('Персонал').find(p => p.role === 'відвідувач' && normName(p.pib) && (normName(p.pib) === k || normName(shortName(p.pib)) === k)) || null;
}
/**
 * Вахти бригади в місяці: завдання групуються за половиною місяця (1–15 і 16–кінець) за датою початку
 * (завдання, що почалися в попередньому місяці, — у першу половину). Період вахти — від найранішого початку до найпізнішого кінця.
 */
function brigShifts(m, n) {
  const a = m + '-01', z = monthEnd(m);
  const ts = all('Завдання').filter(t => String(t.brigade) === String(n) && taskStatus(t) !== 'перенесено' && t.dateFrom && String(t.dateFrom) <= z && String(t.dateTo || t.dateFrom) >= a)
    .sort((x, y) => String(x.dateFrom).localeCompare(String(y.dateFrom)));
  const g = {};
  ts.forEach(t => { const h = t.dateFrom < a || +t.dateFrom.slice(8) <= 15 ? 1 : 2; (g[h] = g[h] || []).push(t); });
  return Object.keys(g).sort().map(h => {
    const list = g[h];
    const from = list.map(t => t.dateFrom).sort()[0], to = list.map(t => t.dateTo || t.dateFrom).sort().slice(-1)[0];
    const objs = [...new Set(list.map(t => t.objectId))];
    return { brigade: String(n), from, to, tasks: list, objects: objs };
  });
}
/** Сформовані СЗ і відомість для вахти: точний збіг періоду, інакше — документ на період, що перетинається (період змінився). */
function shiftDoc(s) {
  const ds = all('ДокументиВахт').filter(d => String(d.brigade) === String(s.brigade)).sort((x, y) => num(y.sentAt) - num(x.sentAt));
  const exact = ds.find(d => d.dateFrom === s.from && d.dateTo === s.to);
  if (exact) return { doc: exact, exact: true };
  const ov = ds.find(d => d.dateFrom <= s.to && d.dateTo >= s.from);
  return ov ? { doc: ov, exact: false } : null;
}
/** Телефон відповідального: з картки обʼєкта, інакше — з картки відповідального від замовника. */
const respPhone = o => String((o && o.contactPhone) || (objResp(o) || {}).phone || '').trim();
/** Обʼєкти, за які відповідає представник замовника. */
const respObjects = p => all('Обʼєкти').filter(o => { const r = objResp(o); return r && r.id === p.id; });
/** Рядок «📍 населений пункт · 👤 відповідальний» для карток обʼєктів. */
function objMeta(o) {
  if (!o) return '';
  const parts = [];
  if (o.settlement) parts.push('📍 ' + esc(o.settlement));
  if (o.contact) parts.push('👤 ' + esc(o.contact) + (o.contactPos ? ', ' + esc(o.contactPos) : ''));
  return parts.length ? `<span class="small">${parts.join(' · ')}</span>` : '';
}
const FUELS = ['ДП', 'А-95'];
const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

// ───────── утиліти ─────────
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const z2 = n => String(n).padStart(2, '0');
const fmtD = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const today = () => fmtD(new Date());
const ym = s => String(s || '').slice(0, 7);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : 0; };
const r1 = n => Math.round(n * 10) / 10;
const truthy = v => v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1';
const fmtN = n => { n = Math.abs(n) >= 100 ? Math.round(n) : r1(n); return n ? n.toLocaleString('uk-UA') : '0'; };
function uaDate(s) { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return d ? `${d}.${m}.${y}` : String(s); }
function monthName(m) { const [y, mm] = String(m).split('-'); return (MONTHS[+mm - 1] || '') + ' ' + y; }
function addMonths(m, k) { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + k, 1); return d.getFullYear() + '-' + z2(d.getMonth() + 1); }
function addDays(s, k) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + k); return fmtD(d); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
function dateRange(a, b) { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; }
function monthEnd(m) { const [y, mm] = m.split('-').map(Number); return fmtD(new Date(y, mm, 0)); }
function arr(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === '') return [];
  const t = String(v).trim();
  if (t.startsWith('[')) { try { return JSON.parse(t); } catch (e) { /* далі */ } }
  return t.split(/\s*[,;]\s*/).filter(Boolean);
}
function obj(v) { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}') || {}; } catch (e) { return {}; } }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

const LS = {
  get(k, d = null) { try { const v = localStorage.getItem('vlnk.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { v === null ? localStorage.removeItem('vlnk.' + k) : localStorage.setItem('vlnk.' + k, v); } catch (e) { /* немає сховища */ } },
  json(k) { try { return JSON.parse(LS.get(k) || 'null'); } catch (e) { return null; } }
};

// ───────── IndexedDB (з запасним варіантом у памʼяті) ─────────
const IDB = {
  db: null, mem: false,
  open(name) {
    return new Promise(res => {
      try {
        const r = indexedDB.open(name, 3);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('rows')) d.createObjectStore('rows');
          if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { autoIncrement: true });
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
          if (!d.objectStoreNames.contains('uploads')) d.createObjectStore('uploads', { autoIncrement: true }); // файли й листи, що чекають відправки
          if (!d.objectStoreNames.contains('files')) d.createObjectStore('files'); // накази, збережені на телефоні (ключ — id файлу)
        };
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = () => { this.mem = true; res(); };
      } catch (e) { this.mem = true; res(); }
    });
  },
  _t(store, mode, fn) {
    if (this.mem) return Promise.resolve(null);
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, mode);
      const out = fn(tx.objectStore(store));
      tx.oncomplete = () => res(out);
      tx.onerror = () => rej(tx.error);
    });
  },
  async getAll(store) {
    if (this.mem) return { keys: [], values: [] };
    const o = await this._t(store, 'readonly', s => ({ k: s.getAllKeys(), v: s.getAll() }));
    return { keys: o.k.result, values: o.v.result };
  },
  async get(store, key) { const o = await this._t(store, 'readonly', s => s.get(key)); return o ? o.result : undefined; },
  putMany(store, entries) { return this._t(store, 'readwrite', s => entries.forEach(([k, v]) => k === undefined ? s.put(v) : s.put(v, k))); },
  delMany(store, keys) { return this._t(store, 'readwrite', s => keys.forEach(k => s.delete(k))); },
  clear(store) { return this._t(store, 'readwrite', s => s.clear()); },
  count(store) { return this._t(store, 'readonly', s => s.count()).then(o => o ? o.result : 0); }
};

// ───────── дані в памʼяті ─────────
let MODE = null;      // 'live' | 'demo'
let ME = null;        // {email, name, personId, role}
let CFG = {};
const DB = { data: {}, cache: {}, pending: 0, lastSync: 0, syncing: false, error: '', upTasks: new Set(), mailQ: new Set(), cachedFiles: new Set() };

function tbl(t) { return DB.data[t] || (DB.data[t] = new Map()); }
function all(t) {
  if (!DB.cache[t]) DB.cache[t] = [...tbl(t).values()].filter(r => !truthy(r.deleted));
  return DB.cache[t];
}
function get(t, id) { if (!id) return null; const r = tbl(t).get(String(id)); return r && !truthy(r.deleted) ? r : null; }
function putMem(t, r) { tbl(t).set(String(r.id), r); DB.cache[t] = null; }

async function loadLocal() {
  const { values } = await IDB.getAll('rows');
  values.forEach(v => putMem(v.t, v.r));
  DB.pending = await IDB.count('outbox');
  await refreshQueue();
  DB.lastSync = Number(await IDB.get('meta', 'lastSync') || 0);
}

/** Зберегти рядок локально + у чергу на відправку. */
async function save(t, row) {
  row = { ...row };
  if (!row.id) row.id = uid();
  row.updatedAt = Date.now();
  row.updatedBy = ME.email;
  putMem(t, row);
  await IDB.putMany('rows', [[t + '|' + row.id, { t, r: row }]]);
  if (MODE === 'live') {
    await IDB.putMany('outbox', [[undefined, { t, r: row }]]);
    DB.pending++;
    syncSoon();
  }
  onData();
  return row;
}
async function remove(t, id) { const r = tbl(t).get(String(id)); if (r) await save(t, { ...r, deleted: true }); }
/** Лише локальна зміна без відправки (сервер зробить те саме сам). */
async function applyLocal(t, row) { putMem(t, row); await IDB.putMany('rows', [[t + '|' + row.id, { t, r: row }]]); }

// ───────── синхронізація ─────────
async function api(body, timeoutMs = 90000) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(CFG.api, {
      method: 'POST', redirect: 'follow', signal: ctl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: LS.get('token') })
    });
    return await r.json();
  } finally { clearTimeout(tm); }
}

const syncSoon = debounce(() => sync(), 2500);

async function sync(manual) {
  if (MODE !== 'live' || DB.syncing) return;
  if (!navigator.onLine) { if (manual) toast('Немає інтернету — дані збережено на телефоні'); updateChip(); return; }
  DB.syncing = true; DB.error = ''; updateChip();
  try {
    const ob = await IDB.getAll('outbox');
    const dedup = new Map();
    ob.values.forEach(c => dedup.set(c.t + '|' + c.r.id, c));
    const since = Number(await IDB.get('meta', 'since') || 0);
    const res = await api({ action: 'sync', since, changes: [...dedup.values()] });
    if (!res.ok) {
      if (res.error === 'AUTH') { DB.error = 'Потрібен повторний вхід'; toast('Сесія завершилась — увійдіть знову. Незбережені зміни залишаться в черзі.'); showLogin(true); return; }
      throw new Error(res.error || 'помилка сервера');
    }
    await IDB.delMany('outbox', ob.keys);
    // рядки, змінені під час запиту, не перезаписуємо — вони підуть наступним разом
    const rest = await IDB.getAll('outbox');
    const busy = new Set(rest.values.map(c => c.t + '|' + c.r.id));
    const entries = [];
    let n = 0;
    for (const [t, rows] of Object.entries(res.data || {})) {
      for (const r of rows) {
        const k = t + '|' + r.id;
        if (busy.has(k)) continue;
        putMem(t, r); entries.push([k, { t, r }]); n++;
      }
    }
    let since2 = res.serverTime;
    if (res.rejected && res.rejected.length) {
      const del = res.rejected.map(x => x.t + '|' + x.id);
      res.rejected.forEach(x => { tbl(x.t).delete(String(x.id)); DB.cache[x.t] = null; });
      await IDB.delMany('rows', del);
      since2 = 0; // наступного разу — повне оновлення
      toast('Частину змін відхилено: недостатньо прав (' + res.rejected.length + ')');
    }
    await IDB.putMany('rows', entries);
    DB.lastSync = Date.now();
    await IDB.putMany('meta', [['since', since2], ['lastSync', DB.lastSync]]);
    DB.pending = rest.values.length;
    if (res.user) { ME = { ...ME, ...res.user }; LS.set('user', JSON.stringify(ME)); }
    DB.apiVer = res.apiVer || '0';
    if (await autoStartTasks()) n++;
    if (n || manual) onData(true);
    if (manual) toast('Синхронізовано' + (n ? ': оновлено ' + n : ''));
    await sendUploads();
  } catch (e) {
    DB.error = e.name === 'AbortError' ? 'Час очікування вичерпано' : String(e.message || e);
    if (manual) toast('Помилка синхронізації: ' + DB.error);
  } finally {
    DB.syncing = false; updateChip();
  }
}

// ───────── файли (накази) ─────────
/** Стискає фото до 2000 px (JPEG), PDF та інші файли лишає як є. Повертає {name, mime, data(base64)}. */
async function readFileForUpload(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Файл більший за 15 МБ');
  if (/^image\//.test(file.type) && !/gif|svg/.test(file.type)) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const k = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    const url = c.toDataURL('image/jpeg', 0.82);
    return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', data: url.split(',')[1] };
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { name: file.name, mime: file.type || 'application/octet-stream', data: btoa(bin) };
}
/** Ставить наказ у чергу; у демо-режимі зберігає прямо в завданні. */
async function queueOrder(taskId, file) {
  const f = await readFileForUpload(file);
  if (MODE === 'demo') {
    const t = get('Завдання', taskId);
    await save('Завдання', { ...t, orderFile: 'data:' + f.mime + ';base64,' + f.data, orderFileName: f.name });
    return 'saved';
  }
  await IDB.putMany('uploads', [[undefined, { taskId, ...f, at: Date.now() }]]);
  DB.upTasks.add(taskId);
  syncSoon();
  return 'queued';
}
// ───────── протоколи НК: файли на картці обʼєкта ─────────
/** Файл до рядка (протокол НК, текст інструкції/НД): у демо — прямо в рядку, у робочому режимі — у чергу на відправку на Диск. */
const FILE_KIND = { 'Протоколи': 'proto', 'Документи': 'docfile', 'Сертифікати': 'certfile' };
const KIND_TBL = { proto: 'Протоколи', docfile: 'Документи', certfile: 'Сертифікати' };
const KIND_ACT = { proto: 'uploadproto', docfile: 'uploaddoc', certfile: 'uploadcert' };
async function queueRowFile(table, id, file, extra = {}) {
  const f = await readFileForUpload(file);
  if (MODE === 'demo') {
    const p = get(table, id);
    const upd = { file: 'data:' + f.mime + ';base64,' + f.data, fileName: f.name };
    // оновлена версія протоколу: попередня зберігається в versions, нова підписується
    if (table === 'Протоколи' && p.file) {
      const vs = arr(p.versions), v = vs.length + 2, by = extra.by || '';
      vs.push({ v: v - 1, fileName: p.fileName || '', file: p.file, at: p.verAt || '', by: p.verBy || p.enteredBy || '' });
      const ext = (String(f.name).match(/\.[A-Za-z0-9]{2,5}$/) || [''])[0];
      const o = get('Обʼєкти', p.objectId) || {};
      upd.fileName = `Протокол${p.number ? ' № ' + p.number : ''} — ${p.method || 'НК'} — ${o.short || ''} ${p.date || ''} — оновлена версія ${v} від ${uaDate(today())}${by ? ' (' + by + ')' : ''}${ext}`;
      Object.assign(upd, { versions: JSON.stringify(vs), verAt: Date.now(), verBy: by });
    }
    await save(table, { ...p, ...upd });
    return 'saved';
  }
  // одразу кладемо копію в кеш телефону — автор може відкрити файл ще до відправки
  const key = 'local-' + id;
  await IDB.putMany('files', [[key, f]]); DB.cachedFiles.add(key);
  await IDB.putMany('uploads', [[undefined, { kind: FILE_KIND[table], taskId: id, ...f, ...(extra.by ? { by: extra.by } : {}), at: Date.now() }]]);
  DB.upTasks.add(id);
  syncSoon();
  return 'queued';
}
async function getRowFile(table, p) {
  if (String(p.file || '').startsWith('data:')) {
    const [head, data] = p.file.split(',');
    return { name: p.fileName || 'Файл', mime: head.slice(5).replace(';base64', ''), data };
  }
  for (const k of [p.fileId, 'local-' + p.id]) { const hit = k ? await IDB.get('files', k) : null; if (hit) return hit; }
  if (!p.fileId) throw new Error('Файл ще не відправлено на сервер');
  if (!navigator.onLine) throw new Error('Файл ще не збережено на телефоні, а інтернету немає');
  const res = await api({ action: 'getfile', table, id: p.id }, 120000);
  if (!res.ok) throw new Error(res.error);
  const f = { name: res.name, mime: res.mime, data: res.data };
  await IDB.putMany('files', [[res.fileId, f]]);
  DB.cachedFiles.add(res.fileId);
  return f;
}
const queueProto = (id, file) => queueRowFile('Протоколи', id, file);
const getProtoFile = p => getRowFile('Протоколи', p);

/** Відправляє файли з черги (після синхронізації рядків, щоб завдання вже було на сервері). */
async function sendUploads() {
  const up = await IDB.getAll('uploads');
  for (let i = 0; i < up.values.length; i++) {
    const u = up.values[i];
    if (!navigator.onLine) break;
    if (u.kind === 'mail') {
      try {
        const res = await api({ action: 'mailorder', taskId: u.taskId }, 120000);
        await IDB.delMany('uploads', [up.keys[i]]);
        toast(res.ok ? 'Наказ надіслано на ' + res.to : 'Лист не надіслано: ' + res.error);
      } catch (e) { break; }
      continue;
    }
    if (u.kind === 'mailproto' || u.kind === 'maildoc' || u.kind === 'mailcert') {
      try {
        const res = await api({ action: u.kind, id: u.taskId }, 120000);
        if (res.error === 'NOROW' || res.error === 'NOFILE') break; // протокол ще не дійшов на сервер — спробуємо пізніше
        await IDB.delMany('uploads', [up.keys[i]]);
        toast(res.ok ? ({ maildoc: 'Документ', mailcert: 'Сертифікат' }[u.kind] || 'Протокол') + ' надіслано на ' + res.to : 'Лист не надіслано: ' + res.error);
      } catch (e) { break; }
      continue;
    }
    if (KIND_TBL[u.kind]) {
      const tbl = KIND_TBL[u.kind];
      try {
        const res = await api({ action: KIND_ACT[u.kind], id: u.taskId, name: u.name, mime: u.mime, data: u.data, ...(u.by ? { by: u.by } : {}) }, 180000);
        if (res.ok) {
          const p = get(tbl, u.taskId);
          if (p) await applyLocal(tbl, { ...p, ...res.file });
          await IDB.putMany('files', [[res.file.fileId, { name: res.file.fileName, mime: u.mime, data: u.data }]]);
          await IDB.delMany('uploads', [up.keys[i]]);
          toast('Файл завантажено: ' + res.file.fileName);
        } else if (res.error !== 'NOROW') {
          await IDB.delMany('uploads', [up.keys[i]]);
          toast('Файл не завантажено: ' + res.error);
        }
      } catch (e) { break; }
      continue;
    }
    try {
      const res = await api({ action: 'upload', taskId: u.taskId, name: u.name, mime: u.mime, data: u.data }, 180000);
      if (res.ok) {
        const t = get('Завдання', u.taskId);
        if (t) await applyLocal('Завдання', { ...t, ...res.file });
        await IDB.delMany('uploads', [up.keys[i]]);
        toast('Наказ завантажено: ' + res.file.orderFileName);
      } else if (res.error !== 'NOTASK') {
        await IDB.delMany('uploads', [up.keys[i]]);
        toast('Наказ не завантажено: ' + res.error);
      }
    } catch (e) { break; }
  }
  await refreshQueue();
  await prefetchOrders();
  onData(true);
}
async function refreshQueue() {
  const v = (await IDB.getAll('uploads')).values;
  const isMail = u => u.kind === 'mail' || u.kind === 'mailproto' || u.kind === 'maildoc' || u.kind === 'mailcert';
  DB.upTasks = new Set(v.filter(u => !isMail(u)).map(u => u.taskId));
  DB.mailQ = new Set(v.filter(isMail).map(u => u.taskId));
  DB.cachedFiles = new Set((await IDB.getAll('files')).keys);
}

/** Файл наказу: з телефона, а якщо його там ще немає — із сервера (і зберегти). */
async function getOrderFile(t) {
  if (String(t.orderFile || '').startsWith('data:')) {
    const [head, data] = t.orderFile.split(',');
    return { name: t.orderFileName || 'Наказ', mime: head.slice(5).replace(';base64', ''), data };
  }
  const hit = t.orderFileId ? await IDB.get('files', t.orderFileId) : null;
  if (hit) return hit;
  if (!navigator.onLine) throw new Error('Наказ ще не збережено на телефоні, а інтернету немає');
  const res = await api({ action: 'getorder', taskId: t.id }, 120000);
  if (!res.ok) throw new Error(res.error);
  const f = { name: res.name, mime: res.mime, data: res.data };
  await IDB.putMany('files', [[res.fileId, f]]);
  DB.cachedFiles.add(res.fileId);
  return f;
}
function fileToBlob(f) {
  const bin = atob(f.data); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: f.mime || 'application/octet-stream' });
}
/** Накази до завдань своєї бригади (цей і наступний місяць) зберігаються на телефоні заздалегідь — для роботи без звʼязку. */
async function prefetchOrders() {
  if (MODE !== 'live' || !ME || !ME.personId || !navigator.onLine) return;
  const m = ym(today()), m2 = addMonths(m, 1);
  const mine = new Set([m, m2].map(x => all('Бригади').find(b => b.month === x && brigadeMembers(b).includes(ME.personId))).filter(Boolean).map(b => b.month + '|' + b.num));
  const need = all('Завдання').filter(t => t.orderFileId && !DB.cachedFiles.has(t.orderFileId) && mine.has((t.month || ym(t.dateFrom)) + '|' + t.brigade) && (t.dateTo || '') >= today());
  for (const t of need.slice(0, 10)) { try { await getOrderFile(t); } catch (e) { break; } }
}
/** Надіслати протокол собі на пошту (email з картки «Персонал»); без інтернету або до відправки файлу — у чергу. */
async function mailProto(p) {
  if (MODE === 'demo') return { demo: true };
  if (!navigator.onLine || !p.fileId) {
    await IDB.putMany('uploads', [[undefined, { kind: 'mailproto', taskId: p.id, at: Date.now() }]]);
    await refreshQueue();
    if (navigator.onLine) syncSoon();
    return { queued: true };
  }
  const res = await api({ action: 'mailproto', id: p.id }, 120000);
  if (!res.ok) throw new Error(res.error);
  return res;
}
/** Надіслати документ (НД / інструкцію) собі на пошту: файл вкладенням, текст і посилання — у листі. */
async function mailDoc(d) {
  if (MODE === 'demo') return { demo: true };
  const fileNotSent = DB.upTasks.has(d.id);
  if (!navigator.onLine || fileNotSent) {
    await IDB.putMany('uploads', [[undefined, { kind: 'maildoc', taskId: d.id, at: Date.now() }]]);
    await refreshQueue();
    if (navigator.onLine) syncSoon();
    return { queued: true };
  }
  const res = await api({ action: 'maildoc', id: d.id }, 120000);
  if (!res.ok) throw new Error(res.error);
  return res;
}
/** Надіслати скан сертифіката собі на пошту; без інтернету або до відправки файлу — у чергу. */
async function mailCert(c) {
  if (MODE === 'demo') return { demo: true };
  if (!navigator.onLine || !c.fileId || DB.upTasks.has(c.id)) {
    await IDB.putMany('uploads', [[undefined, { kind: 'mailcert', taskId: c.id, at: Date.now() }]]);
    await refreshQueue();
    if (navigator.onLine) syncSoon();
    return { queued: true };
  }
  const res = await api({ action: 'mailcert', id: c.id }, 120000);
  if (!res.ok) throw new Error(res.error);
  return res;
}
/** Надіслати наказ собі на пошту; без інтернету — у чергу. */
async function mailOrder(t) {
  if (MODE === 'demo') return { demo: true };
  if (!navigator.onLine) {
    await IDB.putMany('uploads', [[undefined, { kind: 'mail', taskId: t.id, at: Date.now() }]]);
    await refreshQueue();
    return { queued: true };
  }
  const res = await api({ action: 'mailorder', taskId: t.id }, 120000);
  if (!res.ok) throw new Error(res.error);
  return res;
}

// ───────── довідники та розрахунки ─────────
function setting(k, d = '') { const r = all('Налаштування').find(x => x.key === k); return r && r.value !== '' ? r.value : d; }
const isLead = () => ME && ME.role === 'керівник';
const isVisitor = () => !ME || ME.role === 'відвідувач';
const canReport = () => ME && (ME.role === 'керівник' || ME.role === 'працівник');
const personName = id => { const p = get('Персонал', id); return p ? p.pib : '—'; };
const shortName = pib => { const p = String(pib || '').trim().split(/\s+/); return p.length >= 3 ? `${p[0]} ${p[1][0]}.${p[2][0]}.` : String(pib || ''); };
const objShort = id => { const o = get('Обʼєкти', id); return o ? (o.short || o.name) : '—'; };
/** Автомобіль повністю: марка, держ. номер, SAP-номер. */
function carFull(id) {
  const c = get('Авто', id); if (!c) return '';
  return [esc(c.name || ''), c.plate ? 'держ. № <b>' + esc(c.plate) + '</b>' : '', c.sapNo ? 'SAP № <b>' + esc(c.sapNo) + '</b>' : ''].filter(Boolean).join(' · ');
}
/** Табельний номер відповідального від замовника: з картки обʼєкта, інакше — з картки відповідального. */
const respTab = o => String((o && o.contactTabNo) || (objResp(o) || {}).tabNo || '').trim();
/** Склад бригади завдання з табельними номерами й авто (для розгорнутої картки обʼєкта на сторінці «Завдання»). */
function taskCrewHtml(t) {
  if (!t) return '';
  const b = brigadeOf(t.month || ym(t.dateFrom), t.brigade) || {};
  const mem = brigadeMembers(b);
  const rows = mem.map(id => { const p = get('Персонал', id) || {}; return `<div class="crewrow"><span>${esc(shortName(p.pib || '—'))}${id === b.leaderId ? ' ' + badge('старший') : ''}${truthy(p.isDriver) ? ' 🚐' : ''}</span><span class="small">таб. № <b>${esc(p.tabNo || '—')}</b></span></div>`; }).join('');
  return `<p class="small"><b>${brName(t.brigade)}</b></p>` + (rows || '<p class="small mute">склад бригади не призначено</p>') +
    `<p class="small" style="margin-top:6px">🚐 ${b.carId ? carFull(b.carId) : '<span class="mute">автомобіль не закріплено</span>'}</p>`;
}
const carName = id => { const c = get('Авто', id); return c ? c.name + (c.plate ? ' ' + c.plate : '') : '—'; };
const allPeople = () => all('Персонал').slice().sort((a, b) => String(a.pib).localeCompare(String(b.pib), 'uk'));
/** Персонал лабораторії — без відвідувачів (вони в окремому розділі «Відвідувачі»). */
/** Приховані записи: вакансії та службовий обліковий запис (ПІБ = email) — не показуються в персоналі, бригадах, табелях тощо. */
const isHiddenPerson = p => /^\s*ваканс/i.test(String(p.pib || '')) || String(p.pib || '').includes('@');
const staff = () => allPeople().filter(p => p.role !== 'відвідувач' && !isHiddenPerson(p));
const hiddenPeople = () => allPeople().filter(p => p.role !== 'відвідувач' && isHiddenPerson(p));
const visitors = () => allPeople().filter(p => p.role === 'відвідувач');
const objectsSorted = () => all('Обʼєкти').slice().sort((a, b) => String(a.short).localeCompare(String(b.short), 'uk'));
const brName = n => Number(n) === 5 ? 'Бригада 5 · резерв' : 'Бригада ' + n;

function brigadeOf(month, num) { return all('Бригади').find(b => b.month === month && String(b.num) === String(num)) || null; }
function brigadeMembers(b) { if (!b) return []; const m = arr(b.members); if (b.leaderId && !m.includes(b.leaderId)) m.unshift(b.leaderId); return m; }
function myBrigade(d) {
  if (!ME || !ME.personId) return null;
  return all('Бригади').find(b => b.month === ym(d) && brigadeMembers(b).includes(ME.personId)) || null;
}
function taskCovers(t, d) {
  const a = t.dateFrom || (t.month ? t.month + '-01' : ''); const b = t.dateTo || t.dateFrom || (t.month ? monthEnd(t.month) : '');
  return a && b && a <= d && d <= b;
}
const tasksOn = d => all('Завдання').filter(t => t.status !== 'перенесено' && taskCovers(t, d));
const shiftHours = s => String(s) === '11' ? 11 : 8;

// ───────── норми витрат палива: літня / зимова, важкі дорожні умови, автономний обігрівач ─────────
/** Зимовий період (ММ-ДД), за замовчуванням 01.11–31.03; задається в Налаштуваннях. */
function winterRange() { return { from: String(setting('winterFrom', '11-01')), to: String(setting('winterTo', '03-31')) }; }
function isWinter(date) {
  const md = String(date || today()).slice(5, 10); const w = winterRange();
  return w.from <= w.to ? md >= w.from && md <= w.to : md >= w.from || md <= w.to;
}
const seasonName = date => isWinter(date) ? 'зимова' : 'літня';
const mdText = md => String(md).split('-').reverse().join('.');
/** Норма авто на дату, л/100 км: зимова (якщо задана) або літня. */
const carNorm = (car, date) => !car ? 0 : isWinter(date) && num(car.norm100W) ? num(car.norm100W) : num(car.norm100);
/** Норма у важких дорожніх умовах, л/100 км (зимова, якщо задана; інакше — звичайна норма сезону). */
const carNormHeavy = (car, date) => !car ? 0 : (isWinter(date) && num(car.normHeavyW)) || num(car.normHeavy) || carNorm(car, date);
/** Норма електростанції на дату, л/год. */
const genNorm = (g, date) => !g ? 0 : isWinter(date) && num(g.normLhW) ? num(g.normLhW) : num(g.normLh);
/** Витрата авто за звітом: звичайний пробіг + пробіг у важких умовах + робота автономного обігрівача. */
function carFuelParts(r, car) {
  car = car || get('Авто', r.carId); if (!car) return null;
  const km = num(r.km), heavy = Math.min(num(r.kmHeavy), km), normal = km - heavy, hh = num(r.heaterH);
  const n = carNorm(car, r.date), nh = carNormHeavy(car, r.date), hn = num(car.heaterLh);
  const parts = [
    { kind: 'пробіг', unit: 'км', qty: normal, norm: n, normU: 'л/100 км', l: normal * n / 100 },
    { kind: 'пробіг у важких дорожніх умовах', unit: 'км', qty: heavy, norm: nh, normU: 'л/100 км', l: heavy * nh / 100 },
    { kind: 'автономний обігрівач', unit: 'год', qty: hh, norm: hn, normU: 'л/год', l: hh * hn }
  ].filter(p => p.qty);
  return { parts, l: parts.reduce((s, p) => s + p.l, 0), season: seasonName(r.date) };
}

/** Розрахунок по одному щоденному звіту. */
/** Підсумковий запис за період (перенесений з шаблону «ВиконаноЗПочаткуРоку»): лише обсяги й матеріали, без годин, пального й табелю. */
const isSummary = r => truthy(r.summary);
/** Відмінювання: plural(2, 'доба', 'доби', 'діб'). */
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

// ───────── хто подав звіт і повторні звіти ─────────
const personByEmail = e => { e = String(e || '').toLowerCase(); return e ? all('Персонал').find(p => String(p.email || '').toLowerCase() === e) : null; };
const fmtDT = ms => { const t = new Date(num(ms)); if (!num(ms) || isNaN(t)) return ''; const p = n => String(n).padStart(2, '0'); return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`; };
/** Час подання: createdAt (з 1.8.27), для старих звітів — час останнього збереження. */
const repWhen = r => num(r.createdAt) || num(r.updatedAt);
/** Хто подав: автор звіту, інакше — за email останнього збереження. */
function repAuthor(r) {
  if (r.authorId && get('Персонал', r.authorId)) return shortName(personName(r.authorId));
  const p = personByEmail(r.updatedBy); return p ? shortName(p.pib) : (r.updatedBy || '—');
}
function repEditor(r) { const p = personByEmail(r.updatedBy); return p ? shortName(p.pib) : (r.updatedBy || ''); }
/** Інші звіти по тому самому обʼєкту, період яких перетинається (той самий характер: робота / переїзд). */
const REPIDX = new WeakMap();
/** Індекс звітів по обʼєктах + множини повторних і «перших» (до яких є повтор) — перераховується лише після змін даних. */
function repIndex() {
  const list = all('Звіти');
  let ix = REPIDX.get(list);
  if (ix) return ix;
  const byObj = new Map();
  list.forEach(x => { if (!byObj.has(x.objectId)) byObj.set(x.objectId, []); byObj.get(x.objectId).push(x); });
  ix = { byObj, rep: new Set(), orig: new Set() };
  REPIDX.set(list, ix);
  list.forEach(r => {
    const w = repWhen(r);
    const firsts = repOverlaps(r, r.id).filter(x => String(x.brigade) === String(r.brigade) && (repWhen(x) < w || (repWhen(x) === w && String(x.id) < String(r.id))));
    if (firsts.length) { ix.rep.add(r.id); firsts.forEach(x => ix.orig.add(x.id)); }
  });
  return ix;
}
function repOverlaps(r, exceptId) {
  if (!r || !r.objectId || !r.date) return [];
  const from = isSummary(r) && r.periodFrom ? r.periodFrom : r.date, to = r.date, tr = truthy(r.travel);
  return (repIndex().byObj.get(r.objectId) || []).filter(x => x.id !== exceptId && truthy(x.travel) === tr &&
    (isSummary(x) && x.periodFrom ? x.periodFrom : x.date) <= to && from <= x.date)
    .sort((a, b) => repWhen(a) - repWhen(b));
}
/** Повторний звіт: раніше за нього той самий обʼєкт і період уже звітувала ця ж бригада. */
const isRepeatReport = r => repIndex().rep.has(r.id);
/** Звіт, до якого пізніше подано повтор. */
const hasRepeat = r => repIndex().orig.has(r.id);
const repLine = x => `${isSummary(x) && x.periodFrom ? uaDate(x.periodFrom) + ' – ' : ''}${uaDate(x.date)} · Б${x.brigade} — подав ${repAuthor(x)}${repWhen(x) ? ', ' + fmtDT(repWhen(x)) : ''}`;
function calc(r) {
  if (isSummary(r)) return { workers: arr(r.workers), h: 0, nonDriver: [], manH: 0, special: 0, specialPer: 0, carL: 0, carFuel: '', genL: 0, genFuel: '' };
  const workers = arr(r.workers);
  const h = shiftHours(r.schedule);
  const nonDriver = workers.filter(w => w !== r.driverId);
  // особливий характер: стики RT × люд-год на стик за нормою для діаметра (запасний варіант — загальна норма з налаштувань)
  const fallback = num(setting('rtNormHours', '0.5'));
  const rtH = volRows(r).reduce((s, v) => { const n = normFor(v.d); return s + num(v.rt) * (n && num(n.rtHours) ? num(n.rtHours) : fallback); }, 0);
  const special = truthy(r.travel) ? 0 : Math.min(rtH, nonDriver.length * h);
  const car = get('Авто', r.carId);
  const gen = get('Генератори', r.genId);
  return {
    workers, h, nonDriver,
    manH: workers.length * h,
    special: r1(special),
    specialPer: nonDriver.length ? special / nonDriver.length : 0,
    carL: car ? carFuelParts(r, car).l : 0, carFuel: car ? (car.fuel || 'ДП') : '',
    genL: gen ? num(r.genHours) * genNorm(gen, r.date) : 0, genFuel: gen ? (r.genFuel || gen.fuel || 'ДП') : ''
  };
}

/** Зведення по набору звітів. */
function agg(reports) {
  const s = { n: reports.length, manH: 0, special: 0, ...Object.fromEntries(MKEYS.map(k => [k, 0])), meters: 0, km: 0, genH: 0, fuel: {}, film: 0, dev: 0, fix: 0, pts: 0, ptp: 0, ptd: 0, ptMat: 0, days: new Set() };
  for (const r of reports) {
    const c = calc(r);
    s.manH += c.manH; s.special += c.special;
    for (const k of [...MKEYS, 'meters', 'km', 'ptMat']) s[k] += num(r[k]);
    for (const [k] of MAT) s[k] += repMat(r, k);
    s.genH += num(r.genHours);
    if (c.carL) s.fuel[c.carFuel] = (s.fuel[c.carFuel] || 0) + c.carL;
    if (c.genL) s.fuel[c.genFuel] = (s.fuel[c.genFuel] || 0) + c.genL;
    if (!isSummary(r)) s.days.add(r.date);
  }
  s.fuelTotal = Object.values(s.fuel).reduce((a, b) => a + b, 0);
  return s;
}

function reportsIn(a, b, f) { return all('Звіти').filter(r => r.date >= a && r.date <= b && (!f || f(r))); }

/** Статус сертифіката / терміну: 'bad' прострочено, 'warn' ≤ 60 днів, 'ok'. */
function validity(to) {
  if (!to) return { cls: 'mute', text: 'не вказано' };
  const d = daysBetween(today(), String(to).slice(0, 10));
  if (d < 0) return { cls: 'bad', text: 'прострочено ' + uaDate(to) };
  if (d <= 60) return { cls: 'warn', text: 'до ' + uaDate(to) + ' (' + d + ' дн.)' };
  return { cls: 'ok', text: 'до ' + uaDate(to) };
}

/** Чи ознайомлений працівник з актуальною версією документа. */
function ackOf(docId, personId) {
  const d = get('Документи', docId);
  const a = all('Ознайомлення').filter(x => x.docId === docId && x.personId === personId).sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
  if (!a) return null;
  if (d && d.date && String(a.date).slice(0, 10) < String(d.date).slice(0, 10)) return null; // нова редакція — потрібне повторне ознайомлення
  return a;
}

function holderName(type, id) {
  if (type === 'авто') return 'Авто: ' + carName(id);
  if (type === 'працівник') return shortName(personName(id));
  return 'Склад';
}

// ───────── відпустки ─────────
const VAC_KINDS = ['щорічна основна', 'щорічна додаткова', 'додаткова (особливий характер)', 'соціальна', 'без збереження зарплати', 'навчальна'];
// сертифікати видаються на метод (VT, UT), тож сектори W/S тут не розділяються
const CERT_TYPES = ['RT', 'VT', 'UT', 'PT', 'UTT', 'HB', 'AE', 'Спрямовані хвилі', 'Радіаційна безпека'];
const CERT_ALIAS = { 'Товщинометрія': 'UTT', 'Твердометрія': 'HB' };
/** Календарні дні між датами включно. */
const vacLen = (a, b) => (a && b && b >= a) ? daysBetween(a, b) + 1 : 0;
/** Діючий період частини: фактичний, якщо внесено, інакше плановий. */
function vacRange(v) { return v.factFrom ? [v.factFrom, v.factTo || v.factFrom] : [v.planFrom, v.planTo || v.planFrom]; }
function vacsOf(pid, year) {
  return all('Відпустки').filter(v => v.personId === pid && (!year || String(v.year) === String(year)))
    .sort((a, b) => String(a.year).localeCompare(String(b.year)) || num(a.part) - num(b.part) || String(vacRange(a)[0]).localeCompare(String(vacRange(b)[0])));
}
/** Стаж від дати до сьогодні: «5 р. 3 міс.». */
function seniority(from, to = today()) {
  if (!from || from > to) return '';
  const [y1, m1, d1] = from.split('-').map(Number), [y2, m2, d2] = to.split('-').map(Number);
  let mo = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0); if (mo < 0) return '';
  const y = Math.floor(mo / 12), m = mo % 12;
  return [y ? y + ' р.' : '', m || !y ? m + ' міс.' : ''].filter(Boolean).join(' ');
}
const ABSENCES = ['лікарняний', 'ЗСУ', 'навчання', 'відпустка'];
/** Стан працівника на дату: відпустка (за графіком або відміткою), лікарняний, ЗСУ, навчання; '' — на роботі. */
function personState(p, d = today()) {
  if (!p) return '';
  if (p.absence && (!p.absenceFrom || p.absenceFrom <= d) && (!p.absenceTo || p.absenceTo >= d)) return p.absence;
  return onVacation(p.id, d) ? 'відпустка' : '';
}
const STATE_LABEL = { 'відпустка': '🌴 у відпустці', 'лікарняний': '🤒 на лікарняному', 'ЗСУ': '🎖 в ЗСУ', 'навчання': '🎓 на навчанні' };
function onVacation(pid, d) { return all('Відпустки').find(v => v.personId === pid && (() => { const [a, b] = vacRange(v); return a && a <= d && d <= b; })()) || null; }
/** Дні відпустки людини, що припадають на період [a, b]. */
function vacDaysIn(pid, a, b) {
  const out = new Set();
  for (const v of all('Відпустки').filter(x => x.personId === pid)) {
    const [f, t] = vacRange(v); if (!f) continue;
    const s = f > a ? f : a, e = t < b ? t : b;
    if (s <= e) dateRange(s, e).forEach(d => out.add(d));
  }
  return out;
}
function vacNorm(pid) { const p = get('Персонал', pid) || {}; return num(p.vacDays) || num(setting('vacDaysDefault', '24')); }
/** Підсумки за рік: норма, заплановано, використано (фактичні дати, що вже минули), залишок. */
function vacSummary(pid, year) {
  const vs = vacsOf(pid, year); const t = today();
  let plan = 0, used = 0;
  vs.forEach(v => {
    plan += vacLen(v.planFrom, v.planTo || v.planFrom);
    if (v.factFrom) { const e = (v.factTo || v.factFrom) < t ? (v.factTo || v.factFrom) : t; used += v.factFrom <= t ? vacLen(v.factFrom, e) : 0; }
  });
  const norm = vacNorm(pid);
  return { norm, plan, used, left: norm - used, unplanned: norm - plan, parts: vs };
}
/** Ознайомлення з графіком відпусток за рік (скидається, якщо планові дати змінились після підпису). */
function vacAck(pid, year) {
  const a = all('Ознайомлення').filter(x => x.docId === 'vac-' + year && x.personId === pid).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0))[0];
  if (!a) return null;
  const changed = Math.max(0, ...vacsOf(pid, year).map(v => num(v.planChangedAt)));
  return num(a.updatedAt) >= changed ? a : null;
}

// ───────── ЗІЗ ─────────
const PPE_SIZE = { 'одяг': 'Одяг / зріст', 'взуття': 'Взуття', 'рукавиці': 'Рукавиці', 'голова': 'Головний убір', '': 'Без розміру' };
function addMonthsDate(s, k) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1 + k, 1);
  dt.setDate(Math.min(d, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()));
  return fmtD(dt);
}
const ppeItems = () => all('ЗІЗ').slice().sort((a, b) => String(a.category).localeCompare(String(b.category), 'uk') || String(a.name).localeCompare(String(b.name), 'uk'));
function ppeNorm(pid, itemId) { return all('НормиЗІЗ').find(n => n.personId === pid && n.itemId === itemId) || null; }
function ppeIssues(pid, itemId) { return all('ВидачаЗІЗ').filter(x => x.personId === pid && (!itemId || x.itemId === itemId)).sort((a, b) => String(b.date).localeCompare(String(a.date))); }
function ppeSize(pid, item) {
  const p = get('Персонал', pid) || {};
  return { 'одяг': [p.clothSize, p.height].filter(Boolean).join(' / '), 'взуття': p.shoeSize, 'рукавиці': p.gloveSize }[item.sizeType] || '';
}
/** Стан позиції для працівника: null — не видається; bad — не видано або строк сплив; warn — ≤ 30 днів. */
function ppeStatus(pid, item) {
  const n = ppeNorm(pid, item.id); const months = n ? num(n.months) : 0;
  if (months <= 0) return null;
  const last = ppeIssues(pid, item.id)[0];
  if (!last) return { cls: 'bad', text: 'не видано', months, due: '' };
  const due = addMonthsDate(last.date, months);
  const d = daysBetween(today(), due);
  const warnDays = Math.min(30, Math.round(months * 30 * 0.25)); // для коротких строків (1 міс.) — за тиждень
  return { cls: d < 0 ? 'bad' : d <= warnDays ? 'warn' : 'ok', text: d < 0 ? 'строк сплив ' + uaDate(due) : 'до ' + uaDate(due), months, due, last };
}
function ppeOf(pid) { return ppeItems().map(item => ({ item, st: ppeStatus(pid, item) })).filter(x => x.st); }
const ppeAck = issueId => all('Ознайомлення').find(a => a.docId === 'ppe-' + issueId) || null;

// ───────── норми витрат матеріалів по діаметрах ─────────
const MAT = [ // ключ у звіті, ключ у нормі, назва, одиниця, метод
  ['film', 'film', 'Плівка RT', 'дм²', 'rt'], ['dev', 'dev', 'Проявник RT', 'л', 'rt'], ['fix', 'fix', 'Фіксаж RT', 'л', 'rt'],
  ['pts', 'ptSolvent', 'Розчинник PT', 'л', 'pt'], ['ptp', 'ptPenetrant', 'Пенетрант PT', 'л', 'pt'], ['ptd', 'ptDeveloper', 'Проявник PT', 'л', 'pt']
];
const normsList = () => all('НормиМатеріалів').slice().sort((a, b) => num(a.diameter) - num(b.diameter));
/** Норма для діаметра: точний збіг або найближчий діаметр у таблиці (529 → 530). */
function normFor(d) {
  d = num(d); if (!d) return null;
  let best = null;
  for (const n of normsList()) if (!best || Math.abs(num(n.diameter) - d) < Math.abs(num(best.diameter) - d)) best = n;
  return best;
}
/** Обсяги звіту по діаметрах: [{d, rt, vt, ...}]. Для старих звітів — один рядок із загальних полів. */
function volRows(r) {
  const v = arr(r.vol);
  if (v.length && typeof v[0] === 'object') return v;
  const d = arr(r.diameters)[0] || '';
  const row = { d }; MKEYS.forEach(k => { if (num(r[k])) row[k] = num(r[k]); });
  return Object.keys(row).length > 1 ? [row] : [];
}
/** Витрата матеріалів за нормами для набору рядків по діаметрах. */
function matByNorm(rows) {
  const out = Object.fromEntries(MAT.map(m => [m[0], 0]));
  for (const v of rows) {
    const n = normFor(v.d); if (!n) continue;
    for (const [k, nk, , , meth] of MAT) out[k] += num(v[meth]) * num(n[nk]);
  }
  for (const k in out) out[k] = Math.round(out[k] * 1000) / 1000;
  return out;
}

/**
 * Витрата матеріалу у звіті: внесене у звіті значення (факт або норма, збережена формою),
 * а якщо поле порожнє (звіти, перенесені зі старого порталу) — розрахунок за нормами на діаметр.
 */
function repMat(r, k) {
  if (truthy(r.travel)) return 0;
  const v = r[k], man = arr(r.matManual).includes(k);
  if (man || (v !== '' && v != null && num(v))) return num(v);
  return matByNorm(volRows(r))[k] || 0;
}

// ───────── збереження файлу на пристрій ─────────
/** Зберігає файл: у вбудованому переглядачі — через дозвіл «downloads», у звичайному браузері — як завантаження. */
async function saveFile(name, blob) {
  let dl = null;
  try { if (window.claude && window.claude.use) dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return 'saved'; }
    catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (e && e.code === 'rejected_extension') throw new Error('Цей тип файлу не можна зберегти тут');
      if (e && !['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) throw new Error(e.message || 'не вдалося зберегти');
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'saved';
}

// ───────── електростанції: залишок пального і мотогодини ─────────
/** Округлення до 0,01 л без «-0» і хвостів на кшталт 0,0000001. */
const z2l = x => { const v = Math.round(num(x) * 100) / 100; return Math.abs(v) < 0.005 ? 0 : v; };
/** Генератори, закріплені за авто (або всі, якщо за авто нічого не закріплено). */
function gensForCar(carId) { const g = all('Генератори').filter(x => carId && x.carId === carId); return { list: g.length ? g : all('Генератори'), own: g.length > 0 }; }
/**
 * Стан станції перед звітом: залишок у баку і мотогодини з початку обліку.
 * Рахується за всіма попередніми звітами: залишок += заправка − мотогодини × норма.
 * Старі звіти без заправки вважаються заправленими «під нуль».
 */
function genState(genId, date, excludeId, atCreated) {
  const g = get('Генератори', genId); if (!g) return null;
  // Обнулення: станом на кінець дня resetDate лічильники стають resetMoto / resetFuel,
  // далі враховуються лише звіти після цієї дати. Для дат до обнулення — облік як раніше.
  const rd = String(g.resetDate || ''); const after = !!rd && date > rd;
  const reps = all('Звіти').filter(r => r.genId === genId && r.id !== excludeId && !truthy(r.travel) && (!after || r.date > rd) &&
    (r.date < date || (r.date === date && atCreated && num(r.updatedAt) < atCreated))).sort((a, b) => String(a.date).localeCompare(String(b.date)) || num(a.updatedAt) - num(b.updatedAt));
  let bal = after ? num(g.resetFuel) : num(g.fuelStart), moto = after ? num(g.resetMoto) : num(g.motoStart);
  for (const r of reps) {
    const nr = genNorm(g, r.date); const cons = num(r.genHours) * nr;
    const refuel = r.genRefuel === '' || r.genRefuel === undefined || r.genRefuel === null ? cons : num(r.genRefuel);
    bal = bal + refuel - cons; moto += num(r.genHours);
    if (num(r.genHours) && Math.abs(bal) <= nr * 0.011) bal = 0; // «чистий нуль», як у формі звіту
  }
  return { g, bal: z2l(bal), moto: Math.round(moto * 10) / 10, norm: genNorm(g, date), season: seasonName(date), fuel: g.fuel || '' };
}
/**
 * Розрахунок станції на день:
 *   залишок у баку = залишок після попередніх звітів + заправлено сьогодні;
 *   час роботи на залишку = залишок / норма (год);
 *   залишок після роботи = залишок − мотогодини × норма.
 * Якщо введено саме «час роботи на залишку» (з округленням до 0,01 год), результат — рівно 0 л.
 */
function genDay(genId, hours, refuel, date, excludeId, atCreated) {
  const st = genState(genId, date, excludeId, atCreated); if (!st) return null;
  const ref = z2l(refuel);
  const avail = z2l(st.bal + ref);
  const hoursAvail = st.norm ? Math.floor(Math.max(0, avail) / st.norm * 100) / 100 : 0;
  let cons = z2l(num(hours) * st.norm);
  let after = z2l(avail - cons);
  // «чистий нуль»: розбіжність у межах округлення часу (0,01 год) — це нуль, а не ±0,01 л
  if (num(hours) && Math.abs(after) <= st.norm * 0.011) { cons = avail; after = 0; }
  return { ...st, refuel: ref, avail, hoursAvail, cons, after, need: after < 0 ? -after : 0, underZero: z2l(Math.max(0, cons - st.bal)), motoAfter: Math.round((st.moto + num(hours)) * 10) / 10 };
}
