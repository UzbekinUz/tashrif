// Mijoz ko'rinishi: do'kon sahifasi, bron qilish oqimi, mening bronlarim.
import { legalLinks, applyTheme, h, _, ctx, GET, POST, icon, avatar, price, dur, money, fmtDate, fmtWhen, todayStr, addDays, wdOf, dayNum, WD, errText,
  toast, sheet, confirmSheet, busy, field, input, toggle, statusPill, mapUrl, openLink, nav, setTz, localTime, localDate, tg, skeleton } from './lib.js';

export const shop = { data: null };
let draft = { services: new Set(), staff: 'any', date: null, slot: null, resched: null };

export async function loadShop(force) {
  if (!shop.data || force) {
    shop.data = await GET('/api/c/shop');
    setTz(shop.data.business.timezone);
  }
  applyTheme(shop.data.business.theme);
  return shop.data;
}

const top = (title, backTo, right) => h('div', { class: 'top' },
  backTo && h('button', { class: 'back', 'aria-label': _('Orqaga'), onclick: () => (typeof backTo === 'function' ? backTo() : nav.go(backTo)) }, icon('left')),
  h('h1', {}, title), right);

const stepBar = n => h('div', { class: 'steps' }, [1, 2, 3, 4].map(i => h('i', { class: i <= n ? 'on' : '' })));

const ratingText = s => s.rating ? h('span', {}, h('span', { class: 'stars' }, icon('star', 'sm'), ' ' + s.rating), h('span', { class: 'muted' }, ` (${s.reviews})`)) : null;

// ------------------------------------------------------------------ Bosh sahifa
export async function home() {
  const d = await loadShop();
  const b = d.business;
  const open = b.open;
  const maps = mapUrl(b);
  const el = h('div', { class: 'screen' },
    h('div', { class: 'cover' + (b.cover ? '' : ' empty'), style: b.cover ? { backgroundImage: `url(${b.cover})` } : {} }, b.cover ? '' : b.name.slice(0, 2)),
    h('h1', { class: 'hero-name' }, b.name),
    b.description && h('p', { class: 'muted', style: { marginTop: '8px' } }, b.description),
    (b.address || b.city) && h('div', { class: 'meta-line' }, icon('pin'), h('div', {},
      [b.city && (ctx.lang === 'ru' ? b.city.name_ru : b.city.name_uz), b.address].filter(Boolean).join(', '),
      b.landmark && h('div', { class: 'faint' }, b.landmark))),
    h('div', { class: 'btn-row', style: { marginTop: '18px' } },
      b.phone && h('a', { class: 'btn', href: 'tel:' + b.phone }, icon('phone', 'sm'), _("Qo'ng'iroq")),
      maps && h('button', { class: 'btn', onclick: () => openLink(maps) }, icon('pin', 'sm'), _('Xaritada ochish'))),
    !open && h('div', { class: 'banner', style: { marginTop: '16px' } }, ctx.lang === 'ru' ? 'Запись временно не принимается' : 'Hozircha bron qabul qilinmaydi'),
    d.staff.length > 1 && [
      h('div', { class: 'section-h' }, h('h2', {}, _('Ustalarimiz'))),
      h('div', { class: 'masters' }, d.staff.map(s => h('button', { class: 'master', onclick: () => { draft = newDraft(); draft.staff = s.id; nav.go('/book/services'); } },
        avatar(s.name, s.id, s.photo), h('b', {}, s.name), h('div', { class: 'muted', style: { fontSize: '12px' } }, s.title || ' '),
        h('div', { style: { fontSize: '12px', marginTop: '4px' } }, ratingText(s) || ' ')))),
    ],
    d.gallery.length > 0 && [
      h('div', { class: 'section-h' }, h('h2', {}, _('Ishlarimiz'))),
      h('div', { class: 'gallery' }, d.gallery.slice(0, 9).map(g => h('div', { style: { backgroundImage: `url(${g.url})` }, role: 'img', 'aria-label': g.caption || b.name }))),
    ],
    h('div', { style: { height: '90px' } }),
    h('div', { class: 'dock' }, h('div', { class: 'dock-in' },
      h('button', { class: 'btn primary block', disabled: !open || d.me.blocked || !d.staff.length, onclick: () => { draft = newDraft(); if (d.locked_staff) draft.staff = d.locked_staff; nav.go('/book/services'); } }, _('Bron qilish')))),
  );
  return el;
}

function newDraft() { return { services: new Set(), staff: 'any', date: null, slot: null, resched: null }; }

// ------------------------------------------------------------------ 1-qadam: xizmatlar
export async function bookServices() {
  const d = await loadShop();
  const cats = [...new Set(d.services.map(s => s.category || ''))];
  const dock = h('div', { class: 'dock' });
  const list = h('div', {});
  const staffSel = draft.staff !== 'any' ? d.staff.find(s => s.id === draft.staff) : null;
  const sv = s => { // ustaga xos narx/davomiylik
    if (!staffSel) return s;
    const o = staffSel.services.find(x => x.service_id === s.id);
    return o ? { ...s, price: o.price, duration_min: o.duration_min } : null;
  };
  const refresh = () => {
    const chosen = d.services.filter(s => draft.services.has(s.id)).map(sv).filter(Boolean);
    dock.replaceChildren(h('div', { class: 'dock-in' },
      h('div', { class: 'sum' }, h('b', {}, chosen.length ? price(chosen.reduce((a, s) => a + s.price, 0)) : '—'), h('span', {}, chosen.length ? dur(chosen.reduce((a, s) => a + s.duration_min, 0)) : '')),
      h('button', { class: 'btn primary', disabled: !chosen.length, onclick: () => nav.go(d.locked_staff || staffSel ? '/book/time' : '/book/staff') }, _('Davom etish'))));
  };
  for (const c of cats) {
    const items = d.services.filter(s => (s.category || '') === c).map(sv).filter(Boolean);
    if (!items.length) continue;
    if (c) list.append(h('div', { class: 'cat' }, c));
    items.forEach(s => {
      const btn = h('button', { class: 'pick', 'aria-pressed': String(draft.services.has(s.id)) },
        h('div', { class: 'grow' }, h('div', { class: 't' }, s.name), h('div', { class: 'd' }, `${dur(s.duration_min)} · ${price(s.price)}`), s.description && h('div', { class: 'd', style: { marginTop: '2px' } }, s.description)),
        h('div', { class: 'check' }, icon('check', 'sm')));
      btn.onclick = () => { draft.services.has(s.id) ? draft.services.delete(s.id) : draft.services.add(s.id); btn.setAttribute('aria-pressed', String(draft.services.has(s.id))); draft.date = null; draft.slot = null; refresh(); };
      list.append(btn);
    });
  }
  refresh();
  document.getElementById('app').classList.add('no-tabs');
  return h('div', { class: 'screen' }, top(_('Xizmatni tanlang'), '/'), stepBar(1), staffSel && h('p', { class: 'muted' }, staffSel.name), list, h('div', { style: { height: '70px' } }), dock);
}

// ------------------------------------------------------------------ 2-qadam: usta
export async function bookStaff() {
  const d = await loadShop();
  if (!draft.services.size) return nav.go('/book/services');
  const ids = [...draft.services];
  const capable = d.staff.map(s => {
    const offers = ids.map(i => s.services.find(x => x.service_id === i));
    if (offers.some(o => !o)) return null;
    return { s, price: offers.reduce((a, o) => a + o.price, 0), dur: offers.reduce((a, o) => a + o.duration_min, 0) };
  }).filter(Boolean);
  const list = h('div', {});
  if (capable.length > 1) {
    const any = h('button', { class: 'pick', 'aria-pressed': String(draft.staff === 'any') },
      h('div', { class: 'avatar', style: { background: 'var(--raised)', color: '#fff' } }, icon('users')),
      h('div', { class: 'grow' }, h('div', { class: 't' }, _('Istalgan usta')), h('div', { class: 'd' }, _("Bo'sh usta avtomatik tanlanadi"))),
      h('div', { class: 'check' }, icon('check', 'sm')));
    any.onclick = () => { draft.staff = 'any'; draft.date = null; draft.slot = null; nav.go('/book/time'); };
    list.append(any);
  }
  capable.forEach(({ s, price: p, dur: du }) => {
    const b = h('button', { class: 'pick', 'aria-pressed': String(draft.staff === s.id) },
      avatar(s.name, s.id, s.photo),
      h('div', { class: 'grow' }, h('div', { class: 't' }, s.name), h('div', { class: 'd' }, [s.title, `${dur(du)} · ${price(p)}`].filter(Boolean).join(' · ')), s.rating && h('div', { class: 'd' }, ratingText(s))),
      h('div', { class: 'check' }, icon('check', 'sm')));
    b.onclick = () => { draft.staff = s.id; draft.date = null; draft.slot = null; nav.go('/book/time'); };
    list.append(b);
  });
  if (!capable.length) list.append(h('div', { class: 'empty' }, h('b', {}, _("Bu xizmatlar to'plamini bajaradigan usta yo'q")), _("Boshqa xizmatlarni tanlang")));
  return h('div', { class: 'screen' }, top(_('Ustani tanlang'), '/book/services'), stepBar(2), list);
}

// ------------------------------------------------------------------ 3-qadam: kun va vaqt
export async function bookTime() {
  const d = await loadShop();
  const R = draft.resched;
  if (!R && !draft.services.size) return nav.go('/book/services');
  const services = R ? R.serviceIds : [...draft.services];
  const staffQ = (R && !R.anyStaff) ? R.staffId : (draft.staff === 'any' ? 'any' : draft.staff);
  const q = `services=${services.join(',')}&staff=${staffQ}`;
  const today = todayStr();
  const { days: avail } = await GET(`/api/c/days?${q}&from=${today}&days=${Math.min(42, d.business.max_advance_days + 1)}`);
  const set = new Set(avail);
  const total = Math.min(42, d.business.max_advance_days + 1);
  const dates = Array.from({ length: total }, (_x, i) => addDays(today, i));
  if (!draft.date || !set.has(draft.date)) draft.date = avail[0] || null;

  const slotsBox = h('div', {});
  const dayStrip = h('div', { class: 'days', role: 'group' });
  const dock = h('div', { class: 'dock' });
  const drawDock = () => dock.replaceChildren(h('div', { class: 'dock-in' },
    h('div', { class: 'sum' }, draft.slot ? [h('b', {}, fmtWhen(draft.slot.ts)), h('span', {}, '')] : h('span', {}, '')),
    h('button', { class: 'btn primary', disabled: !draft.slot, onclick: R ? doResched : () => nav.go('/book/confirm') }, R ? _('Saqlash') : _('Davom etish'))));
  async function doResched(e) {
    await busy(e.currentTarget, async () => {
      await POST(`/api/c/my/${R.id}/reschedule`, { startTs: draft.slot.ts, staff: draft.slot.staffId });
      toast(_('Saqlandi')); draft = newDraft(); nav.go('/my');
    });
  }
  async function loadSlots() {
    slotsBox.replaceChildren(h('div', { class: 'skeleton', style: { height: '44px' } }));
    if (!draft.date) { slotsBox.replaceChildren(h('div', { class: 'empty' }, h('b', {}, _("Bu kunga bo'sh vaqt yo'q")), _("Boshqa kunni tanlang yoki boshqa ustani ko'ring"))); return; }
    const r = await GET(`/api/c/slots?${q}&date=${draft.date}${R ? '&exclude=' + R.id : ''}`);
    if (!r.slots.length) { slotsBox.replaceChildren(h('div', { class: 'empty' }, h('b', {}, _("Bu kunga bo'sh vaqt yo'q")), _("Boshqa kunni tanlang yoki boshqa ustani ko'ring"))); return; }
    const grid = h('div', { class: 'slots' });
    r.slots.forEach(s => {
      const b = h('button', { class: 'slot', 'aria-pressed': String(draft.slot?.ts === s.ts) }, s.time);
      b.onclick = () => {
        const cheapest = s.staff.reduce((a, x) => (x.price < a.price ? x : a), s.staff[0]);
        draft.slot = { ts: s.ts, staffIds: s.staff.map(x => x.id), price: cheapest.price, duration: cheapest.duration, staffId: staffQ === 'any' ? (R?.anyStaff ? null : null) : Number(staffQ) };
        [...grid.children].forEach(c => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); drawDock();
      };
      grid.append(b);
    });
    slotsBox.replaceChildren(grid);
  }
  dates.forEach(date => {
    const wd = wdOf(date);
    const b = h('button', { class: 'day' + (set.has(date) ? '' : ' off') + (date === today ? ' today' : ''), 'aria-pressed': String(date === draft.date), disabled: !set.has(date) },
      h('small', {}, _(WD[wd])), h('b', {}, dayNum(date)));
    b.onclick = () => { draft.date = date; draft.slot = null; [...dayStrip.children].forEach(c => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); drawDock(); loadSlots(); };
    dayStrip.append(b);
  });
  drawDock(); loadSlots();
  setTimeout(() => dayStrip.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 50);
  document.getElementById('app').classList.add('no-tabs');
  return h('div', { class: 'screen' }, top(R ? _("Ko'chirish") : _('Kun va vaqtni tanlang'), R ? '/my' : (d.locked_staff ? '/book/services' : '/book/staff')), !R && stepBar(3),
    draft.date && h('p', { class: 'muted', style: { marginBottom: '10px' } }, fmtDate(draft.date, true)), dayStrip, h('div', { style: { height: '16px' } }), slotsBox, h('div', { style: { height: '80px' } }), dock);
}

export async function startReschedule(b) {
  const d = await loadShop();
  const sv = b.items.map(i => i.service_id).filter(Boolean);
  draft = newDraft();
  draft.resched = { id: b.id, serviceIds: sv, staffId: b.staff_id, anyStaff: !!d.locked_staff ? false : false };
  nav.go('/book/time');
}

// ------------------------------------------------------------------ 4-qadam: tasdiqlash
export async function bookConfirm() {
  const d = await loadShop();
  if (!draft.slot) return nav.go('/book/time');
  const chosen = d.services.filter(s => draft.services.has(s.id));
  const staffObj = draft.staff === 'any' ? null : d.staff.find(s => s.id === draft.staff);
  const name = input({ value: d.me.name || '', placeholder: _('Ismingiz'), maxlength: 60, autocomplete: 'name' });
  const phone = input({ value: d.me.phone || '', placeholder: '+998 90 123 45 67', type: 'tel', inputmode: 'tel', autocomplete: 'tel' });
  const note = h('textarea', { class: 'input', placeholder: _('Izoh (ixtiyoriy)'), maxlength: 300 });
  const consent = toggle(false);
  const btn = h('button', { class: 'btn primary', onclick: async () => {
    if (name.value.trim().length < 1) { toast(errText({ code: 'invalid_name' }), true); return; }
    if (phone.value.replace(/\D/g, '').length < 9) { toast(errText({ code: 'invalid_phone' }), true); return; }
    if (!consent.value) { toast(errText({ code: 'consent_required' }), true); return; }
    await busy(btn, async () => {
      const r = await POST('/api/c/book', { services: [...draft.services], staff: draft.staff === 'any' ? null : draft.staff, startTs: draft.slot.ts, name: name.value, phone: phone.value, note: note.value, consent: true });
      lastBooking = r.booking; shop.data.me.phone = phone.value; shop.data.me.name = name.value; draft = newDraft(); nav.go('/book/done');
    }).catch(e => { if (e.code === 'slot_taken') { draft.slot = null; nav.go('/book/time'); } });
  } }, _('Bronni tasdiqlash'));
  const row = (k, v) => h('div', { class: 'summary-row' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v));
  const tot = draft.slot.price;
  document.getElementById('app').classList.add('no-tabs');
  return h('div', { class: 'screen' }, top(_('Tasdiqlash'), '/book/time'), stepBar(4),
    h('div', { class: 'card' },
      row(_('Xizmat'), chosen.map(s => s.name).join(', ')),
      row(_('Usta'), staffObj ? staffObj.name : _('Istalgan usta')),
      row(_('Vaqt'), fmtWhen(draft.slot.ts)),
      row(_('Davomiyligi'), dur(draft.slot.duration)),
      row(_('Jami'), (draft.staff === 'any' && draft.slot.staffIds.length > 1 ? (ctx.lang === 'ru' ? 'от ' : 'dan ') : '') + price(tot))),
    h('div', { class: 'card' }, field(_('Ismingiz'), name), field(_('Telefon raqam'), phone), field(_('Izoh (ixtiyoriy)'), note)),
    h('div', { class: 'card' }, h('div', { class: 'line', style: { alignItems: 'flex-start' } }, h('div', { class: 'grow' },
      h('div', { class: 't' }, ctx.lang === 'ru' ? 'Согласие на связь' : 'Aloqaga rozilik'),
      h('div', { class: 'd' }, ctx.lang === 'ru' ? `Я согласен(на), что «${d.business.name}» сохранит мой номер и свяжется со мной по звонку или в Telegram по поводу записи.` : `Men «${d.business.name}» telefon raqamimni saqlashiga va bron bo'yicha qo'ng'iroq yoki Telegram orqali bog'lanishiga roziman.`)), consent)),
    d.business.auto_confirm ? null : h('p', { class: 'hint', style: { marginTop: '12px' } }, ctx.lang === 'ru' ? 'Мастер должен подтвердить запись.' : 'Bronni usta tasdiqlaydi.'),
    h('p', { class: 'hint', style: { marginTop: '12px' } }, legalLinks()),
    h('p', { class: 'hint', style: { marginTop: '12px' } }, ctx.lang === 'ru' ? `Бесплатная отмена — не позднее чем за ${Math.round(d.business.cancel_before_min / 60 * 10) / 10} ч до начала.` : `Bepul bekor qilish — boshlanishiga ${Math.round(d.business.cancel_before_min / 60 * 10) / 10} soatdan kechiktirmay.`),
    h('div', { style: { height: '80px' } }),
    h('div', { class: 'dock' }, h('div', { class: 'dock-in' }, h('div', { class: 'sum' }, h('b', {}, price(tot)), h('span', {}, fmtWhen(draft.slot.ts))), btn)));
}

let lastBooking = null;
export async function bookDone() {
  const d = await loadShop();
  const b = lastBooking;
  if (!b) return nav.go('/');
  const maps = mapUrl(d.business);
  return h('div', { class: 'screen' },
    h('div', { class: 'success' }, h('div', { class: 'big' }, icon('check')),
      h('h1', {}, b.status === 'pending' ? _("So'rov yuborildi") : _('Bron qabul qilindi')),
      h('p', { class: 'muted' }, b.status === 'pending' ? _('Usta tasdiqlashi bilan xabar beramiz') : fmtWhen(b.start_ts))),
    h('div', { class: 'card' },
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Usta')), h('span', { class: 'v' }, b.staff_name)),
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Vaqt')), h('span', { class: 'v' }, fmtWhen(b.start_ts))),
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Xizmat')), h('span', { class: 'v' }, b.items.map(i => i.name).join(', '))),
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, _('Jami')), h('span', { class: 'v' }, price(b.total_price)))),
    maps && h('button', { class: 'btn block', style: { marginTop: '14px' }, onclick: () => openLink(maps) }, icon('pin', 'sm'), _('Xaritada ochish')),
    h('button', { class: 'btn primary block', style: { marginTop: '10px' }, onclick: () => nav.go('/my') }, _('Bronlarim')));
}

// ------------------------------------------------------------------ Bronlarim
export async function myBookings() {
  const d = await loadShop();
  const r = await GET('/api/c/my');
  const card = (b, past) => {
    const actions = [];
    if (!past) {
      actions.push(h('button', { class: 'btn sm', onclick: () => startReschedule(b) }, _("Ko'chirish")));
      actions.push(h('button', { class: 'btn sm danger', onclick: async () => {
        if (!(await confirmSheet(_('Bekor qilish'), fmtWhen(b.start_ts) + ' · ' + b.staff_name, _('Bekor qilish')))) return;
        try { await POST(`/api/c/my/${b.id}/cancel`); toast(_('Saqlandi')); nav.go('/my?' + Date.now()); } catch (e) { toast(e.code === 'too_late' ? (ctx.lang === 'ru' ? `Отмена возможна не позднее чем за ${Math.round(e.data.minutes / 60 * 10) / 10} ч` : `Bekor qilish boshlanishiga ${Math.round(e.data.minutes / 60 * 10) / 10} soat qolguncha mumkin`) : errText(e), true); }
      } }, _('Bekor qilish')));
    } else if (b.status === 'completed' && !b.reviewed) {
      actions.push(h('button', { class: 'btn sm', onclick: () => rate(b) }, _('Baholash')));
    }
    return h('div', { class: 'card' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' } },
        h('div', {}, h('div', { style: { fontWeight: 600, fontSize: '16px' } }, fmtWhen(b.start_ts)), h('div', { class: 'muted', style: { marginTop: '2px' } }, b.staff_name)), statusPill(b.status)),
      h('div', { class: 'muted', style: { marginTop: '10px' } }, b.items.map(i => i.name).join(', ')),
      h('div', { style: { marginTop: '2px', fontWeight: 500 } }, price(b.total_price)),
      actions.length && h('div', { class: 'btn-row', style: { marginTop: '14px' } }, actions));
  };
  const el = h('div', { class: 'screen' }, top(_('Bronlarim')));
  if (!r.upcoming.length && !r.past.length) el.append(h('div', { class: 'empty' }, h('b', {}, _("Bronlar yo'q")), h('button', { class: 'btn primary', style: { marginTop: '14px' }, onclick: () => nav.go('/book/services') }, _('Bron qilish'))));
  if (r.upcoming.length) el.append(h('div', { class: 'section-h', style: { marginTop: 0 } }, h('h2', {}, _('Yaqinlashayotgan'))), h('div', { class: 'stack' }, r.upcoming.map(b => card(b, false))));
  if (r.past.length) el.append(h('div', { class: 'section-h' }, h('h2', {}, _("O'tgan"))), h('div', { class: 'stack' }, r.past.map(b => card(b, true))));
  return el;
}

function rate(b) {
  let val = 5;
  const stars = h('div', { class: 'chips' });
  const text = h('textarea', { class: 'input', placeholder: _('Izoh (ixtiyoriy)'), maxlength: 500 });
  const draw = () => stars.replaceChildren(...[1, 2, 3, 4, 5].map(i => h('button', { class: 'chip' + (i <= val ? ' on' : ''), onclick: () => { val = i; draw(); } }, icon('star', 'sm'), ' ' + i)));
  draw();
  sheet(close => [h('h2', {}, _('Baholash')), h('p', { class: 'muted', style: { marginBottom: '12px' } }, b.staff_name), stars, h('div', { style: { height: '12px' } }), text, h('div', { style: { height: '14px' } }),
    h('button', { class: 'btn primary block', onclick: async e => { await busy(e.currentTarget, () => POST(`/api/c/my/${b.id}/review`, { rating: val, text: text.value })); close(); toast(_('Saqlandi')); nav.go('/my?' + Date.now()); } }, _('Saqlash'))]);
}

export const clientRoutes = {
  '/': home, '/book/services': bookServices, '/book/staff': bookStaff, '/book/time': bookTime, '/book/confirm': bookConfirm, '/book/done': bookDone, '/my': myBookings,
};
