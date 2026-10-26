// Boshqaruv (egasi / menejer / usta): bugun, jadval, bron kartasi, mijozlar, statistika.
import { applyTheme, h, _, ctx, GET, POST, PATCH, DEL, icon, avatar, price, money, dur, fmtDate, fmtWhen, todayStr, addDays, localDate, localTime, wdOf, WD, hhmmMin, minHHMM,
  errText, toast, sheet, confirmSheet, busy, field, input, toggle, statusPill, nav, setTz, copyText, openLink } from './lib.js';

export const A = { id: null, data: null, meta: null };

export async function loadBiz(id, force) {
  id = Number(id);
  if (A.id !== id || !A.data || force) {
    A.data = await GET(`/api/a/${id}`); A.id = id;
    setTz(A.data.business.timezone);
  }
  applyTheme(A.data.business.theme);
  return A.data;
}
export const isMgr = () => A.data.role === 'owner' || A.data.role === 'manager';
export const base = () => `/a/${A.id}`;

export const top = (title, back, right, sub) => h('div', { class: 'top' },
  back && h('button', { class: 'back', 'aria-label': _('Orqaga'), onclick: () => (typeof back === 'function' ? back() : nav.go(back)) }, icon('left')),
  h('div', { style: { flex: 1, minWidth: 0 } }, h('h1', { style: { flex: 'none' } }, title), sub && h('div', { class: 'sub' }, sub)), right);

// ---------------------------------------------------------------- bron qatori va kartasi
export function bkRow(b, onChange, { showDate = false } = {}) {
  const done = ['completed', 'no_show'].includes(b.status);
  const cancelled = b.status.startsWith('cancelled');
  const now = Date.now() / 1000;
  const acts = [];
  if (b.status === 'pending') {
    acts.push(h('button', { class: 'btn sm primary', onclick: e => { e.stopPropagation(); setStatus(b, 'confirmed', onChange, e.currentTarget); } }, _('Tasdiqlash')));
    acts.push(h('button', { class: 'btn sm', onclick: e => { e.stopPropagation(); setStatus(b, 'cancelled_staff', onChange, e.currentTarget); } }, _('Rad etish')));
  } else if (b.status === 'confirmed' && b.start_ts <= now) {
    acts.push(h('button', { class: 'btn sm primary', onclick: e => { e.stopPropagation(); setStatus(b, 'completed', onChange, e.currentTarget); } }, _('Keldi')));
    acts.push(h('button', { class: 'btn sm', onclick: e => { e.stopPropagation(); setStatus(b, 'no_show', onChange, e.currentTarget); } }, _('Kelmadi')));
  }
  return h('div', { class: 'bk' + (done ? ' done' : '') + (cancelled ? ' cancelled' : ''), role: 'button', tabindex: 0, style: { cursor: 'pointer' }, onclick: () => bookingSheet(b, onChange) },
    h('div', { class: 'time' }, localTime(b.start_ts), h('small', {}, showDate ? fmtDate(localDate(b.start_ts)) : localTime(b.end_ts))),
    h('div', { class: 'body' },
      h('div', { class: 't' }, b.client_name),
      h('div', { class: 'd' }, [b.items.map(i => i.name).join(', '), A.data.role !== 'master' && b.staff_name].filter(Boolean).join(' · ')),
      acts.length > 0 && h('div', { class: 'acts' }, acts)),
    h('div', { style: { textAlign: 'right', flex: 'none' } }, h('div', { class: 'num', style: { fontWeight: 500 } }, money(b.total_price)), (b.status !== 'confirmed' && b.status !== 'completed') && statusPill(b.status)));
}

async function setStatus(b, status, onChange, btn) {
  await busy(btn, () => POST(`/api/a/${A.id}/bookings/${b.id}/status`, { status }));
  toast(_('Saqlandi')); onChange?.();
}

export function bookingSheet(b, onChange) {
  const canAct = ['pending', 'confirmed'].includes(b.status);
  const now = Date.now() / 1000;
  sheet(close => [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } }, h('h2', {}, fmtWhen(b.start_ts)), statusPill(b.status)),
    h('div', { class: 'card', style: { background: 'var(--raised)', marginTop: '12px', padding: '6px 16px' } },
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Mijoz')), h('span', { class: 'v' }, b.client_name)),
      b.client_phone && h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Telefon')), h('a', { class: 'v', href: 'tel:' + b.client_phone }, b.client_phone)),
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Usta')), h('span', { class: 'v' }, b.staff_name)),
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Xizmat')), h('span', { class: 'v' }, b.items.map(i => i.name).join(', '))),
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Vaqt')), h('span', { class: 'v' }, `${localTime(b.start_ts)}–${localTime(b.end_ts)}`)),
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Jami')), h('span', { class: 'v' }, price(b.total_price))),
      b.note && h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Izoh')), h('span', { class: 'v' }, b.note))),
    h('div', { class: 'stack', style: { marginTop: '16px' } },
      b.status === 'pending' && h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: async e => { await setStatus(b, 'confirmed', onChange, e.currentTarget); close(); } }, _('Tasdiqlash')),
        h('button', { class: 'btn danger', onclick: async e => { await setStatus(b, 'cancelled_staff', onChange, e.currentTarget); close(); } }, _('Rad etish'))),
      b.status === 'confirmed' && b.start_ts <= now && h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: async e => { await setStatus(b, 'completed', onChange, e.currentTarget); close(); } }, _('Keldi')),
        h('button', { class: 'btn', onclick: async e => { await setStatus(b, 'no_show', onChange, e.currentTarget); close(); } }, _('Kelmadi'))),
      canAct && h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => { close(); moveSheet(b, onChange); } }, _("Ko'chirish")),
        b.status === 'confirmed' && h('button', { class: 'btn danger', onclick: async e => {
          if (await confirmSheet(_('Bekor qilish'), b.client_name + ' · ' + fmtWhen(b.start_ts), _('Bekor qilish'))) { await setStatus(b, 'cancelled_staff', onChange, e.currentTarget); close(); }
        } }, _('Bekor qilish'))),
      b.client_phone ? h('a', { class: 'btn block', href: 'tel:' + b.client_phone }, icon('phone', 'sm'), _("Qo'ng'iroq"))
        : h('p', { class: 'hint', style: { textAlign: 'center' } }, ctx.lang === 'ru' ? 'Клиент не давал согласия на звонки.' : "Mijoz qo'ng'iroqqa rozilik bermagan."))]);
}

// vaqt tanlash (sana + slotlar) — qo'lda bron va ko'chirish uchun umumiy
function slotPicker({ staffId, services, exclude, date, onPick }) {
  const wrap = h('div', {});
  const dateIn = input({ type: 'date', value: date || todayStr(), min: todayStr() });
  const box = h('div', { style: { marginTop: '12px' } });
  let cur = { staffId, services };
  const load = async () => {
    if (!cur.staffId || !cur.services.length) { box.replaceChildren(); return; }
    box.replaceChildren(h('div', { class: 'skeleton', style: { height: '44px' } }));
    try {
      const r = await GET(`/api/a/${A.id}/slots?staff=${cur.staffId}&services=${cur.services.join(',')}&date=${dateIn.value}${exclude ? '&exclude=' + exclude : ''}`);
      if (!r.slots.length) { box.replaceChildren(h('div', { class: 'empty', style: { padding: '16px' } }, _("Bu kunga bo'sh vaqt yo'q"))); onPick(null); return; }
      const grid = h('div', { class: 'slots' });
      r.slots.forEach(s => { const b = h('button', { class: 'slot', type: 'button', 'aria-pressed': 'false' }, s.time); b.onclick = () => { [...grid.children].forEach(c => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); onPick({ ts: s.ts, price: r.price, duration: r.duration }); }; grid.append(b); });
      box.replaceChildren(grid);
    } catch (e) { box.replaceChildren(h('div', { class: 'empty', style: { padding: '16px' } }, errText(e))); }
  };
  dateIn.onchange = () => { onPick(null); load(); };
  wrap.append(field(_('Sana'), dateIn), box);
  return { el: wrap, update: (s, sv) => { cur = { staffId: s, services: sv }; onPick(null); load(); }, load };
}

function moveSheet(b, onChange) {
  let pick = null;
  const sp = slotPicker({ staffId: b.staff_id, services: b.items.map(i => i.service_id).filter(Boolean), exclude: b.id, date: localDate(b.start_ts), onPick: p => { pick = p; save.disabled = !p; } });
  const save = h('button', { class: 'btn primary block', disabled: true, onclick: async e => {
    await busy(e.currentTarget, () => POST(`/api/a/${A.id}/bookings/${b.id}/move`, { startTs: pick.ts }));
    toast(_('Saqlandi')); onChange?.(); closeFn();
  } }, _('Saqlash'));
  const closeFn = sheet(() => [h('h2', {}, _("Ko'chirish")), h('p', { class: 'muted', style: { marginBottom: '12px' } }, `${b.client_name} · ${fmtWhen(b.start_ts)}`), sp.el, h('div', { style: { height: '16px' } }), save]);
  sp.load();
}

export async function newBookingSheet(onChange, date, presetStaff) {
  const d = A.data;
  const staffList = d.staff.filter(s => s.active && (d.role !== 'master' || s.id === d.my_staff_id));
  let staffId = presetStaff && staffList.find(s => s.id === presetStaff) ? presetStaff : staffList[0]?.id;
  const chosen = new Set();
  let pick = null, existing = null;
  const staffSel = h('select', { class: 'input' }, staffList.map(s => h('option', { value: s.id, selected: s.id === staffId }, s.name)));
  const svcBox = h('div', { class: 'chips', style: { flexWrap: 'wrap', overflow: 'visible' } });
  const name = input({ placeholder: _('Ism'), maxlength: 60 });
  const phone = input({ placeholder: '+998 90 123 45 67', type: 'tel' });
  const clientBox = h('div', {});
  const search = input({ placeholder: _('Qidirish'), type: 'search' });
  const save = h('button', { class: 'btn primary block', disabled: true, onclick: async e => {
    await busy(e.currentTarget, () => POST(`/api/a/${A.id}/bookings`, { staff_id: staffId, services: [...chosen], startTs: pick.ts, client_id: existing?.id, name: name.value, phone: phone.value }));
    toast(_('Saqlandi')); onChange?.(); closeFn();
  } }, _('Saqlash'));
  const validate = () => { save.disabled = !(pick && chosen.size && (existing || name.value.trim())); };
  const sp = slotPicker({ staffId, services: [], date: date || todayStr(), onPick: p => { pick = p; validate(); } });
  const drawSvc = () => {
    const s = staffList.find(x => x.id === staffId);
    const offered = new Set(s.services.map(x => x.service_id));
    for (const id of [...chosen]) if (!offered.has(id)) chosen.delete(id);
    svcBox.replaceChildren(...d.services.filter(x => x.active && offered.has(x.id)).map(x => {
      const b = h('button', { class: 'chip' + (chosen.has(x.id) ? ' on' : ''), type: 'button' }, x.name);
      b.onclick = () => { chosen.has(x.id) ? chosen.delete(x.id) : chosen.add(x.id); drawSvc(); sp.update(staffId, [...chosen]); validate(); };
      return b;
    }));
  };
  staffSel.onchange = () => { staffId = Number(staffSel.value); chosen.clear(); drawSvc(); sp.update(staffId, []); validate(); };
  name.oninput = validate;
  let t;
  search.oninput = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      if (search.value.trim().length < 2) { clientBox.replaceChildren(); return; }
      const r = await GET(`/api/a/${A.id}/clients?q=${encodeURIComponent(search.value.trim())}`);
      clientBox.replaceChildren(...r.clients.slice(0, 4).map(c => h('button', { class: 'pick', type: 'button', onclick: () => { existing = c; name.value = c.name; phone.value = c.phone; search.value = ''; clientBox.replaceChildren(h('div', { class: 'well' }, `${c.name} · ${c.phone || '—'}`)); validate(); } },
        h('div', { class: 'grow' }, h('div', { class: 't' }, c.name), h('div', { class: 'd' }, c.phone || '—')))));
    }, 250);
  };
  const closeFn = sheet(() => [h('h2', {}, _('Yangi bron')),
    d.role !== 'master' && field(_('Usta'), staffSel),
    h('div', { class: 'field' }, h('span', { class: 'muted', style: { display: 'block', fontSize: '13px', marginBottom: '6px' } }, _('Xizmat')), svcBox),
    sp.el,
    h('div', { class: 'field' }, field(_('Mijoz'), search), clientBox),
    h('div', { class: 'two' }, field(_('Ism'), name), field(_('Telefon raqam'), phone)),
    h('div', { style: { height: '16px' } }), save]);
  drawSvc();
}

// ---------------------------------------------------------------- yordamchi: ustalar bandligi chizig'i
export function lanes(staff, hoursByStaff, bookings, date) {
  const open = [], close = [];
  for (const s of staff) { for (const r of hoursByStaff[s.id] || []) { open.push(r.start_min); close.push(r.end_min); } }
  for (const b of bookings) { open.push(hhmmMin(localTime(b.start_ts))); close.push(hhmmMin(localTime(b.end_ts)) || 1440); }
  const from = Math.floor(Math.min(...open, 540) / 60) * 60, to = Math.ceil(Math.max(...close, 1080) / 60) * 60;
  const span = to - from;
  const pct = m => ((m - from) / span) * 100;
  const nowMin = date === todayStr() ? hhmmMin(localTime(Date.now() / 1000)) : null;
  const box = h('div', { class: 'lanes' });
  for (const s of staff) {
    const mine = bookings.filter(b => b.staff_id === s.id && !b.status.startsWith('cancelled'));
    const hrs = hoursByStaff[s.id] || [];
    const track = h('div', { class: 'track' });
    // ish vaqtidan tashqari qismlar
    let cur = from;
    for (const r of [...hrs].sort((a, b) => a.start_min - b.start_min)) { if (r.start_min > cur) track.append(h('div', { class: 'off', style: { left: pct(cur) + '%', width: pct(r.start_min) - pct(cur) + '%' } })); cur = Math.max(cur, r.end_min); }
    if (cur < to) track.append(h('div', { class: 'off', style: { left: pct(cur) + '%', width: 100 - pct(cur) + '%' } }));
    for (const b of mine) {
      const a = hhmmMin(localTime(b.start_ts)), e = hhmmMin(localTime(b.end_ts)) || 1440;
      track.append(h('i', { class: b.status === 'pending' ? 'p' : ['completed', 'no_show'].includes(b.status) ? 'd' : '', style: { left: pct(a) + '%', width: Math.max(0.8, pct(e) - pct(a)) + '%' }, title: `${localTime(b.start_ts)} ${b.client_name}` }));
    }
    if (nowMin !== null && nowMin >= from && nowMin <= to) track.append(h('div', { class: 'now', style: { left: pct(nowMin) + '%' } }));
    const busyMin = mine.reduce((a, b) => a + (b.end_ts - b.start_ts) / 60, 0);
    box.append(h('div', { class: 'lane' }, h('div', { class: 'who' }, h('span', {}, s.name), h('span', { class: 'num' }, hrs.length ? `${mine.length} · ${dur(Math.round(busyMin)) || ''}` : _('Dam olish'))), track));
  }
  const ticks = [];
  const stp = span > 600 ? 180 : 120;
  for (let m = from; m <= to; m += stp) ticks.push(h('span', { style: { left: pct(m) + '%', transform: m === from ? 'none' : (m + stp > to ? 'translateX(-100%)' : 'translateX(-50%)') } }, minHHMM(m)));
  box.append(h('div', { class: 'axis' }, ticks));
  return box;
}

async function hoursFor(staffList) {
  const out = {};
  await Promise.all(staffList.slice(0, 12).map(async s => { try { out[s.id] = (await GET(`/api/a/${A.id}/staff/${s.id}`)).hours; } catch { out[s.id] = []; } }));
  return out;
}

// ---------------------------------------------------------------- Bugun
export async function today(params) {
  const d = await loadBiz(params.biz);
  const date = todayStr();
  const [dayR, pendR] = await Promise.all([
    GET(`/api/a/${A.id}/bookings?from=${date}&to=${date}`),
    GET(`/api/a/${A.id}/bookings?from=${date}&to=${addDays(date, 30)}&status=pending`),
  ]);
  const staff = d.staff.filter(s => s.active);
  const hrs = await hoursFor(staff.filter(s => d.role !== 'master' || s.id === d.my_staff_id));
  const bks = dayR.bookings;
  const active = bks.filter(b => !b.status.startsWith('cancelled'));
  const wd = wdOf(date);
  const staffToday = staff.filter(s => (d.role !== 'master' || s.id === d.my_staff_id) && ((hrs[s.id] || []).some(r => r.weekday === wd) || active.some(b => b.staff_id === s.id)));
  const todayHours = Object.fromEntries(Object.entries(hrs).map(([k, v]) => [k, v.filter(r => r.weekday === wd)]));
  const reload = () => nav.refresh();
  const expected = active.filter(b => ['pending', 'confirmed'].includes(b.status)).reduce((a, b) => a + b.total_price, 0);
  const doneN = bks.filter(b => b.status === 'completed').length;
  const next = active.find(b => b.status === 'confirmed' && b.end_ts > Date.now() / 1000);

  const setup = [];
  if (d.role === 'owner') {
    setup.push([d.bots.length > 0, 'Botni ulang', `${base()}/bot`], [d.services.some(s => s.active), "Xizmatlarni qo'shing", `${base()}/services`],
      [!!d.business.address, 'Manzilni kiriting', `${base()}/settings`], [d.staff.filter(s => s.active).length > 1 || d.staff.some(s => s.user_linked && s.role !== 'owner'), "Ustalarni qo'shing", `${base()}/team`]);
  }
  const pendingSetup = setup.filter(s => !s[0]);
  const SETUP_RU = { 'Botni ulang': 'Подключите бота', "Xizmatlarni qo'shing": 'Добавьте услуги', 'Manzilni kiriting': 'Укажите адрес', "Ustalarni qo'shing": 'Добавьте мастеров' };

  const el = h('div', { class: 'screen' },
    top(d.business.name, null, h('button', { class: 'btn sm primary', onclick: () => newBookingSheet(reload, date) }, icon('plus', 'sm'), _('Yangi bron')), fmtDate(date, true)),
    d.business.status !== 'active' && h('div', { class: 'banner' }, ctx.lang === 'ru' ? 'Приём записей приостановлен' : 'Bron qabul qilish to\'xtatilgan'),
    !d.business.open && d.business.status === 'active' && h('button', { class: 'banner', style: { display: 'block', width: '100%', textAlign: 'left' }, onclick: () => isMgr() && nav.go(`${base()}/subscription`) }, ctx.lang === 'ru' ? 'Подписка закончилась: запись закрыта. Нажмите, чтобы продлить' : "Obuna muddati tugagan: bron yopiq. Uzaytirish uchun bosing"),
    (() => { const u = Math.max(d.business.trial_ends || 0, d.business.paid_until || 0), left = Math.ceil((u - Date.now() / 1000) / 86400); return isMgr() && d.business.open && u && left <= 3 ? h('button', { class: 'banner', style: { display: 'block', width: '100%', textAlign: 'left' }, onclick: () => nav.go(`${base()}/subscription`) }, ctx.lang === 'ru' ? `Подписка заканчивается через ${left} дн. Нажмите, чтобы продлить` : `Obuna ${left} kundan keyin tugaydi. Uzaytirish uchun bosing`) : null; })(),
    pendingSetup.length > 0 && h('div', { class: 'card', style: { marginBottom: '14px' } }, h('div', { style: { fontWeight: 600, marginBottom: '6px' } }, ctx.lang === 'ru' ? 'Осталось настроить' : 'Sozlashni yakunlang'),
      h('div', { class: 'check-list' }, setup.map(([ok, label, to]) => h('button', { class: 'line', style: { width: '100%', textAlign: 'left' }, onclick: () => nav.go(to) },
        h('span', { class: 'done-mark' + (ok ? ' on' : '') }, ok && icon('check', 'sm')), h('span', { class: 'grow', style: ok ? { color: 'var(--faint)' } : {} }, ctx.lang === 'ru' ? SETUP_RU[label] : label), !ok && icon('right', 'sm'))))),
    pendR.bookings.length > 0 && [
      h('div', { class: 'section-h', style: { marginTop: 0 } }, h('h2', {}, `${_('Tasdiqlashni kutayotgan')} · ${pendR.bookings.length}`)),
      h('div', { class: 'card' }, pendR.bookings.slice(0, 5).map(b => bkRow(b, reload, { showDate: true }))),
    ],
    h('div', { class: 'section-h', style: pendR.bookings.length ? {} : { marginTop: 0 } }, h('h2', {}, _('Bugun'))),
    h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, _('Bronlar')), h('div', { class: 'v' }, active.length), h('div', { class: 'c' }, `${doneN} ${ctx.lang === 'ru' ? 'выполнено' : 'bajarildi'}`)),
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, ctx.lang === 'ru' ? 'Ожидается' : 'Kutilmoqda'), h('div', { class: 'v' }, money(expected)), h('div', { class: 'c' }, _("so'm"))),
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, ctx.lang === 'ru' ? 'Следующий' : 'Keyingi'), h('div', { class: 'v' }, next ? localTime(next.start_ts) : '—'), h('div', { class: 'c' }, next ? next.client_name : ''))),
    staffToday.length > 0 && [h('div', { class: 'section-h' }, h('h2', {}, _('Ustalar bandligi'))), h('div', { class: 'card' }, lanes(staffToday, todayHours, bks, date))],
    h('div', { class: 'section-h' }, h('h2', {}, _('Bugungi bronlar')), h('button', { class: 'link', onclick: () => nav.go(`${base()}/day/${date}`) }, _('Jadval'))),
    active.length ? h('div', { class: 'card' }, active.map(b => bkRow(b, reload))) :
      h('div', { class: 'card' }, h('div', { class: 'empty' }, h('b', {}, _("Hozircha bron yo'q")), h('button', { class: 'btn primary', style: { marginTop: '12px' }, onclick: () => newBookingSheet(reload, date) }, _('Yangi bron')))));
  return el;
}

// ---------------------------------------------------------------- Jadval (kun)
export async function dayView(params) {
  const d = await loadBiz(params.biz);
  const date = params.date || todayStr();
  let staffFilter = null;
  const wrap = h('div', {});
  const staff = d.staff.filter(s => s.active && (d.role !== 'master' || s.id === d.my_staff_id));
  const dateIn = input({ type: 'date', value: date });
  dateIn.onchange = () => dateIn.value && nav.go(`${base()}/day/${dateIn.value}`);
  const draw = async () => {
    const r = await GET(`/api/a/${A.id}/bookings?from=${date}&to=${date}${staffFilter ? '&staff=' + staffFilter : ''}`);
    const shown = staff.filter(s => !staffFilter || s.id === staffFilter);
    const hrs = await hoursFor(shown);
    const wd = wdOf(date);
    const dh = Object.fromEntries(Object.entries(hrs).map(([k, v]) => [k, v.filter(x => x.weekday === wd)]));
    const bks = r.bookings;
    const reload = () => nav.refresh();
    wrap.replaceChildren(
      shown.length > 0 && h('div', { class: 'card', style: { marginBottom: '14px' } }, lanes(shown, dh, bks, date)),
      bks.length ? h('div', { class: 'card' }, bks.map(b => bkRow(b, reload))) : h('div', { class: 'card' }, h('div', { class: 'empty' }, h('b', {}, _("Hozircha bron yo'q")))));
  };
  await draw();
  const chips = d.role === 'master' ? null : h('div', { class: 'chips', style: { marginBottom: '12px' } },
    h('button', { class: 'chip', 'aria-pressed': 'true' }, _('Hammasi')),
    ...staff.map(s => h('button', { class: 'chip', 'aria-pressed': 'false', 'data-id': s.id }, s.name)));
  chips?.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    staffFilter = b.dataset.id ? Number(b.dataset.id) : null;
    [...chips.children].forEach(c => c.setAttribute('aria-pressed', String(c === b))); draw();
  });
  return h('div', { class: 'screen' },
    top(_('Jadval'), null, h('button', { class: 'btn sm primary', onclick: () => newBookingSheet(() => nav.refresh(), date, staffFilter) }, icon('plus', 'sm'), _('Yangi bron'))),
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' } },
      h('button', { class: 'iconbtn', 'aria-label': '−', onclick: () => nav.go(`${base()}/day/${addDays(date, -1)}`) }, icon('left')),
      h('div', { style: { flex: 1 } }, dateIn),
      h('button', { class: 'iconbtn', 'aria-label': '+', onclick: () => nav.go(`${base()}/day/${addDays(date, 1)}`) }, icon('right'))),
    h('p', { class: 'muted', style: { margin: '0 0 12px' } }, fmtDate(date, true)),
    chips, wrap);
}

// ---------------------------------------------------------------- Mijozlar
export async function clients(params) {
  await loadBiz(params.biz);
  const list = h('div', { class: 'card' });
  const search = input({ type: 'search', placeholder: _('Qidirish') });
  const draw = async () => {
    const r = await GET(`/api/a/${A.id}/clients?q=${encodeURIComponent(search.value.trim())}`);
    list.replaceChildren(...(r.clients.length ? r.clients.map(c => h('button', { class: 'item', onclick: () => clientSheet(c, draw) },
      avatar(c.name, c.id, null, 'sm'), h('div', { class: 'grow' }, h('div', { class: 't' }, c.name), h('div', { class: 'd' }, c.phone || '—')),
      h('div', { class: 'r' }, h('div', { class: 'num' }, `${c.visits}`), c.blocked ? h('span', { class: 'pill neg' }, ctx.lang === 'ru' ? 'блок' : 'blok') : c.no_shows ? h('div', { class: 'd' }, `${c.no_shows} ${ctx.lang === 'ru' ? 'неявк.' : 'kelmadi'}`) : null))) : [h('div', { class: 'empty' }, h('b', {}, _("Mijozlar yo'q")))]));
  };
  let t; search.oninput = () => { clearTimeout(t); t = setTimeout(draw, 250); };
  await draw();
  return h('div', { class: 'screen' }, top(_('Mijozlar'), `${base()}/more`), search, h('div', { style: { height: '14px' } }), list);
}

function clientSheet(c, onChange) {
  const note = h('textarea', { class: 'input', maxlength: 500 }, c.note || '');
  const closeFn = sheet(() => [h('h2', {}, c.name), h('p', { class: 'muted', style: { marginBottom: '12px' } }, `${c.phone || '—'} · ${_('Tashrif')}: ${c.visits}${c.no_shows ? ` · ${_('Kelmadi')}: ${c.no_shows}` : ''}`),
    field(_('Eslatma'), note), h('div', { style: { height: '14px' } }),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: async e => { await busy(e.currentTarget, () => PATCH(`/api/a/${A.id}/clients/${c.id}`, { note: note.value })); toast(_('Saqlandi')); closeFn(); onChange(); } }, _('Saqlash')),
      isMgr() && h('button', { class: 'btn ' + (c.blocked ? '' : 'danger'), onclick: async e => { await busy(e.currentTarget, () => PATCH(`/api/a/${A.id}/clients/${c.id}`, { blocked: !c.blocked })); toast(_('Saqlandi')); closeFn(); onChange(); } }, c.blocked ? _('Blokdan chiqarish') : _('Bloklash'))),
    c.phone ? h('a', { class: 'btn block', style: { marginTop: '10px' }, href: 'tel:' + c.phone }, icon('phone', 'sm'), _("Qo'ng'iroq"))
      : h('p', { class: 'hint', style: { marginTop: '10px', textAlign: 'center' } }, ctx.lang === 'ru' ? 'Номер скрыт: клиент не дал согласия на связь.' : "Raqam yashirin: mijoz aloqaga rozilik bermagan.")]);
}

// ---------------------------------------------------------------- Statistika
export async function stats(params) {
  const d = await loadBiz(params.biz);
  let days = 30;
  const box = h('div', {});
  const draw = async () => {
    const to = todayStr(), from = addDays(to, -(days - 1));
    const s = await GET(`/api/a/${A.id}/stats?from=${from}&to=${to}`);
    const total = Object.entries(s.by_status).filter(([k]) => !k.startsWith('cancelled')).reduce((a, [, v]) => a + v, 0);
    const series = Array.from({ length: days }, (_x, i) => s.per_day[addDays(from, i)] || 0);
    const mx = Math.max(1, ...series);
    const maxSvc = Math.max(1, ...s.top_services.map(x => x.c));
    box.replaceChildren(
      h('div', { class: 'kpis two' },
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, _('Daromad')), h('div', { class: 'v lead' }, money(s.revenue)), h('div', { class: 'c' }, `${_("so'm")} · ${ctx.lang === 'ru' ? 'выполненные' : 'bajarilgan bronlar'}`)),
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, _('Bronlar')), h('div', { class: 'v' }, total), h('div', { class: 'c' }, `${s.by_status.completed || 0} ${ctx.lang === 'ru' ? 'выполнено' : 'bajarildi'}`)),
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, _('Kelmaganlar')), h('div', { class: 'v' }, s.no_show_rate === null ? '—' : s.no_show_rate + '%'), h('div', { class: 'c' }, `${s.new_clients} ${_('Yangi mijozlar').toLowerCase()}`))),
      h('div', { class: 'section-h' }, h('h2', {}, _('Bronlar'))),
      h('div', { class: 'card' }, h('div', { class: 'bars blue', role: 'img', 'aria-label': 'bookings per day' }, series.map((v, i) => h('div', { class: v ? '' : 'z', style: { height: v ? Math.max(4, (v / mx) * 100) + '%' : '2px' }, title: `${fmtDate(addDays(from, i))}: ${v}` }))),
        h('div', { class: 'axis' }, h('span', {}, fmtDate(from)), h('span', {}, fmtDate(to)))),
      s.per_staff.length > 0 && d.role !== 'master' && [h('div', { class: 'section-h' }, h('h2', {}, _('Jamoa'))), h('div', { class: 'card' }, h('div', { class: 'list' }, s.per_staff.map(p =>
        h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 't' }, p.name), h('div', { class: 'd' }, `${p.bookings} ${ctx.lang === 'ru' ? 'записей' : 'bron'}${p.no_shows ? ` · ${p.no_shows} ${_('Kelmadi').toLowerCase()}` : ''}`)), h('div', { class: 'r num', style: { fontWeight: 500 } }, money(p.revenue))))))],
      s.top_services.length > 0 && [h('div', { class: 'section-h' }, h('h2', {}, _("Eng ko'p so'ralgan"))), h('div', { class: 'card barlist' }, s.top_services.map((x, i) => [
        h('div', { class: 'row' }, h('span', {}, x.name), h('span', { class: 'num muted' }, x.c)), h('div', { class: 'bar' }, h('i', { style: { width: (x.c / maxSvc) * 100 + '%', background: i === 0 ? '#fff' : '' } }))]))]);
  };
  const seg = h('div', { class: 'seg', style: { marginBottom: '16px' } }, [[7, '7'], [30, '30'], [90, '90']].map(([n, l]) => h('button', { 'aria-pressed': String(n === days), onclick: e => { days = n; [...seg.children].forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); draw(); } }, `${l} ${ctx.lang === 'ru' ? 'дн.' : 'kun'}`)));
  await draw();
  return h('div', { class: 'screen' }, top(_('Statistika'), `${base()}/more`), seg, box);
}
