// Boshqaruv: jamoa, usta sahifasi, xizmatlar, sozlamalar, botlar, "Boshqa" va platforma (bizneslar ro'yxati).
import { h, _, ctx, GET, POST, PATCH, PUT, DEL, api, icon, avatar, price, money, dur, fmtDate, todayStr, addDays, WD, WD_FULL, hhmmMin, minHHMM,
  errText, toast, sheet, confirmSheet, busy, field, input, toggle, nav, copyText, openLink, setLang, mapUrl, isDevSession, tg } from './lib.js';
import { A, loadBiz, isMgr, base, top } from './admin.js';
import { feedbackSheet, claimLink } from './platform.js';
import { resetAll, startTour } from './tour.js';
import { applyTheme, THEME_OPTIONS, GROUNDS } from './lib.js';

// ---------------------------------------------------------------- rasm yuklash (brauzerda kichraytirib)
async function pickImage() {
  return new Promise(res => {
    const f = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', style: { display: 'none' } });
    f.onchange = async () => {
      const file = f.files[0]; f.remove(); if (!file) return res(null);
      const bmp = await createImageBitmap(file).catch(() => null);
      if (!bmp) return res(null);
      const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      c.toBlob(b => res(b), 'image/jpeg', 0.86);
    };
    document.body.append(f); f.click();
  });
}
async function uploadTo(target) {
  const blob = await pickImage();
  if (!blob) return null;
  const r = await api('POST', `/api/a/${A.id}/upload?target=${target}`, undefined, blob);
  return r.url;
}

const row = (title, desc, right, onclick) => h(onclick ? 'button' : 'div', { class: 'item', onclick }, h('div', { class: 'grow' }, h('div', { class: 't' }, title), desc && h('div', { class: 'd' }, desc)), right);
const roleLabel = r => ({ owner: ctx.lang === 'ru' ? 'Владелец' : 'Egasi', manager: ctx.lang === 'ru' ? 'Менеджер' : 'Menejer', master: ctx.lang === 'ru' ? 'Мастер' : 'Usta' }[r] || r);

// ---------------------------------------------------------------- Jamoa
export async function team(params) {
  const d = await loadBiz(params.biz);
  const staff = d.staff;
  const el = h('div', { class: 'screen' },
    top(_('Jamoa'), null, isMgr() && h('button', { class: 'btn sm primary', onclick: () => addStaffSheet() }, icon('plus', 'sm'), _("Qo'shish"))),
    h('div', { class: 'card' }, h('div', { class: 'list' }, staff.map(s => h('button', { class: 'item', style: s.active ? {} : { opacity: .45 }, onclick: () => nav.go(`${base()}/team/${s.id}`) },
      avatar(s.name, s.id, s.photo), h('div', { class: 'grow' }, h('div', { class: 't' }, s.name), h('div', { class: 'd' }, [roleLabel(s.role), s.title].filter(Boolean).join(' · '))),
      h('div', { class: 'r' }, s.user_linked ? h('span', { class: 'pill pos' }, 'Telegram') : h('span', { class: 'pill' }, ctx.lang === 'ru' ? 'нет входа' : 'ulanmagan'), s.rating && h('div', { class: 'd stars' }, icon('star', 'sm'), ' ' + s.rating)),
      icon('right', 'sm'))))));
  return el;
}

function addStaffSheet() {
  const name = input({ placeholder: _('Ism'), maxlength: 60 });
  const title = input({ placeholder: _('Lavozim'), maxlength: 60 });
  const role = h('select', { class: 'input' }, h('option', { value: 'master' }, roleLabel('master')), A.data.role === 'owner' && h('option', { value: 'manager' }, roleLabel('manager')));
  const closeFn = sheet(() => [h('h2', {}, _("Qo'shish")), field(_('Ism'), name), field(_('Lavozim'), title), field('Rol', role), h('div', { style: { height: '16px' } }),
    h('button', { class: 'btn primary block', onclick: async e => {
      if (!name.value.trim()) return toast(errText({ code: 'invalid_name' }), true);
      const r = await busy(e.currentTarget, () => POST(`/api/a/${A.id}/staff`, { name: name.value, title: title.value, role: role.value }));
      closeFn(); await loadBiz(A.id, true); nav.go(`${base()}/team/${r.id}`);
    } }, _('Saqlash'))]);
}

// ---------------------------------------------------------------- Usta sahifasi
export async function staffDetail(params) {
  const d = await loadBiz(params.biz, true);
  const sid = Number(params.sid);
  const r = await GET(`/api/a/${A.id}/staff/${sid}`);
  const s = r.staff;
  const canEdit = d.role !== 'master' || d.my_staff_id === sid;
  const mgr = isMgr();
  const back = d.role === 'master' ? `${base()}/more` : `${base()}/team`;

  // profil
  const name = input({ value: s.name, maxlength: 60 }), title = input({ value: s.title || '', maxlength: 60 });
  const bio = h('textarea', { class: 'input', maxlength: 400 }, s.bio || '');
  const online = toggle(s.accepts_online);
  const av = h('div', {}, avatar(s.name, s.id, s.photo, 'lg'));
  const photoBtn = h('button', { class: 'btn sm', onclick: async () => { const u = await uploadTo(`staff:${sid}`).catch(e => (toast(errText(e), true), null)); if (u) av.replaceChildren(avatar(s.name, s.id, u, 'lg')); } }, icon('image', 'sm'), _('Rasm'));
  const profile = h('div', { class: 'card' },
    h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' } }, av, photoBtn),
    field(_('Ism'), name), field(_('Lavozim'), title), field(_('Haqida'), bio),
    h('div', { class: 'line', style: { marginTop: '8px' } }, h('div', { class: 'grow' }, h('div', { class: 't' }, ctx.lang === 'ru' ? 'Онлайн-запись' : 'Onlayn bron'), h('div', { class: 'd' }, ctx.lang === 'ru' ? 'Клиенты видят мастера в боте' : 'Mijozlar ustani botda ko\'radi')), online),
    h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: async e => { await busy(e.currentTarget, () => PATCH(`/api/a/${A.id}/staff/${sid}`, { name: name.value, title: title.value, bio: bio.value, accepts_online: online.value })); toast(_('Saqlandi')); await loadBiz(A.id, true); } }, _('Saqlash')));

  // Telegram ulash
  const inviteUrl = r.staff.invite_code && d.platform_bot_username ? `https://t.me/${d.platform_bot_username}?start=inv_${r.staff.invite_code}` : null;
  const link = mgr && !s.user_linked && s.role !== 'owner' ? h('div', { class: 'card' },
    h('div', { style: { fontWeight: 600 } }, _('Taklif havolasi')),
    h('p', { class: 'muted', style: { margin: '4px 0 12px' } }, ctx.lang === 'ru' ? 'Отправьте ссылку мастеру: он войдёт в Telegram и увидит свои записи.' : 'Havolani ustaga yuboring: u Telegram orqali kirib, o\'z bronlarini ko\'radi.'),
    inviteUrl ? h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => copyText(inviteUrl) }, icon('link', 'sm'), _('Nusxalash')),
      h('button', { class: 'btn', onclick: () => openLink(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(d.business.name)}`) }, icon('share', 'sm'), ctx.lang === 'ru' ? 'Отправить' : 'Yuborish'))
      : h('p', { class: 'hint' }, ctx.lang === 'ru' ? 'Платформенный бот не подключён.' : 'Platforma boti ulanmagan.'),
    h('button', { class: 'textbtn', onclick: async () => { await POST(`/api/a/${A.id}/staff/${sid}/invite`); nav.refresh(); } }, ctx.lang === 'ru' ? 'Создать новую ссылку' : 'Yangi havola yaratish')) : null;

  // shaxsiy bot
  const myBots = d.bots.filter(b => b.staff_id === sid);
  const botCard = d.role === 'owner' ? h('div', { class: 'card' },
    h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, ctx.lang === 'ru' ? 'Личный бот мастера' : 'Ustaning shaxsiy boti'),
    myBots.length ? myBots.map(b => h('div', { class: 'line' }, icon('bot'), h('div', { class: 'grow' }, '@' + b.username), h('button', { class: 'textbtn', onclick: () => openLink('https://t.me/' + b.username) }, 'Telegram')))
      : [h('p', { class: 'muted', style: { marginBottom: '10px' } }, ctx.lang === 'ru' ? 'Клиенты будут записываться сразу к этому мастеру.' : 'Mijozlar bevosita shu ustaga yoziladi.'),
        h('button', { class: 'btn', onclick: () => nav.go(`${base()}/bot?staff=${sid}`) }, icon('bot', 'sm'), _('Botni ulash'))]) : null;

  // haftalik jadval
  const hours = {}; for (let w = 0; w < 7; w++) hours[w] = r.hours.filter(x => x.weekday === w).map(x => ({ a: minHHMM(x.start_min), b: minHHMM(x.end_min) }));
  const breaks = r.breaks.map(x => ({ w: x.weekday, a: minHHMM(x.start_min), b: minHHMM(x.end_min) }));
  const schedBox = h('div', {});
  const drawSched = () => {
    schedBox.replaceChildren(...[0, 1, 2, 3, 4, 5, 6].map(w => {
      const on = hours[w].length > 0;
      const ivs = h('div', { class: 'ivs' });
      hours[w].forEach((iv, i) => {
        const a = input({ type: 'time', value: iv.a }), b = input({ type: 'time', value: iv.b });
        a.onchange = () => { iv.a = a.value; }; b.onchange = () => { iv.b = b.value; };
        ivs.append(h('div', { class: 'iv' }, a, h('span', { class: 'muted' }, '–'), b, hours[w].length > 1 && h('button', { class: 'iconbtn', style: { width: '36px', height: '36px' }, 'aria-label': 'x', onclick: () => { hours[w].splice(i, 1); drawSched(); } }, icon('x', 'sm'))));
      });
      return h('div', { class: 'dayrow' }, h('div', { class: 'head' }, h('span', { style: { fontWeight: 500 } }, _(WD_FULL[w])),
        h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, on && canEdit && h('button', { class: 'textbtn', onclick: () => { const last = hours[w].at(-1); hours[w].push({ a: last.b, b: '21:00' }); drawSched(); } }, '+'),
          toggle(on, v => { hours[w] = v ? [{ a: '09:00', b: '18:00' }] : []; drawSched(); }))), on ? ivs : null);
    }));
  };
  const brkBox = h('div', {});
  const drawBrk = () => {
    brkBox.replaceChildren(...breaks.map((br, i) => {
      const a = input({ type: 'time', value: br.a }), b = input({ type: 'time', value: br.b });
      a.onchange = () => { br.a = a.value; }; b.onchange = () => { br.b = b.value; };
      const sel = h('select', { class: 'input', style: { width: '110px', flex: 'none', height: '40px' } }, h('option', { value: '' }, ctx.lang === 'ru' ? 'Ежедневно' : 'Har kuni'), ...WD.map((n, w) => h('option', { value: w, selected: br.w === w }, _(n))));
      sel.onchange = () => { br.w = sel.value === '' ? null : Number(sel.value); };
      return h('div', { class: 'iv', style: { marginTop: '8px' } }, sel, a, h('span', { class: 'muted' }, '–'), b, h('button', { class: 'iconbtn', style: { width: '36px', height: '36px' }, 'aria-label': 'x', onclick: () => { breaks.splice(i, 1); drawBrk(); } }, icon('x', 'sm')));
    }));
  };
  drawSched(); drawBrk();
  const saveHours = async e => {
    const payload = { hours: [], breaks: breaks.map(x => ({ weekday: x.w, start: x.a, end: x.b })) };
    for (let w = 0; w < 7; w++) for (const iv of hours[w]) payload.hours.push({ weekday: w, start: iv.a, end: iv.b });
    await busy(e.currentTarget, () => PUT(`/api/a/${A.id}/staff/${sid}/hours`, payload)); toast(_('Saqlandi'));
  };
  const sched = h('div', { class: 'card' }, h('div', { style: { fontWeight: 600 } }, _('Ish vaqti')), schedBox,
    h('div', { class: 'section-h', style: { margin: '18px 0 0' } }, h('h2', { style: { fontSize: '14px' } }, _('Tanaffus')), canEdit && h('button', { class: 'link', onclick: () => { breaks.push({ w: null, a: '13:00', b: '14:00' }); drawBrk(); } }, '+ ' + _("Qo'shish"))),
    brkBox, canEdit && h('button', { class: 'btn primary block', style: { marginTop: '16px' }, onclick: saveHours }, _('Saqlash')));

  // xizmatlar
  const offered = new Map(r.offered.map(o => [o.service_id, { price: o.price, dur: o.duration_min }]));
  const svcBox = h('div', {});
  const drawSvc = () => svcBox.replaceChildren(...d.services.filter(x => x.active).map(x => {
    const on = offered.has(x.id), o = offered.get(x.id);
    const p = input({ type: 'number', inputmode: 'numeric', placeholder: String(x.price), value: o?.price ?? '', min: 0 }), du = input({ type: 'number', inputmode: 'numeric', placeholder: String(x.duration_min), value: o?.dur ?? '', min: 5 });
    p.oninput = () => { offered.get(x.id).price = p.value === '' ? null : Number(p.value); }; du.oninput = () => { offered.get(x.id).dur = du.value === '' ? null : Number(du.value); };
    return h('div', { class: 'dayrow' }, h('div', { class: 'head' }, h('div', {}, h('div', { class: 't', style: { fontWeight: 500 } }, x.name), h('div', { class: 'd muted', style: { fontSize: '13px' } }, `${dur(x.duration_min)} · ${price(x.price)}`)),
      toggle(on, v => { v ? offered.set(x.id, { price: null, dur: null }) : offered.delete(x.id); drawSvc(); })),
      on && h('div', { class: 'two', style: { marginTop: '8px' } }, field(_('Narx (so\'m)'), p), field(_('Davomiyligi') + ' (min)', du)));
  }));
  drawSvc();
  const svc = h('div', { class: 'card' }, h('div', { style: { fontWeight: 600 } }, _('Xizmatlar')), d.services.length ? svcBox : h('p', { class: 'muted' }, ctx.lang === 'ru' ? 'Сначала добавьте услуги.' : 'Avval xizmat qo\'shing.'),
    canEdit && d.services.length > 0 && h('button', { class: 'btn primary block', style: { marginTop: '16px' }, onclick: async e => {
      await busy(e.currentTarget, () => PUT(`/api/a/${A.id}/staff/${sid}/services`, { services: [...offered].map(([service_id, o]) => ({ service_id, price: o.price, duration_min: o.dur })) })); toast(_('Saqlandi')); await loadBiz(A.id, true);
    } }, _('Saqlash')));

  // ta'til va maxsus kunlar
  const off = h('div', { class: 'card' },
    h('div', { class: 'section-h', style: { margin: 0 } }, h('h2', {}, _('Yopiq kunlar')), canEdit && h('button', { class: 'link', onclick: () => timeOffSheet(sid) }, '+ ' + _("Qo'shish"))),
    (r.time_off.length + r.overrides.length) === 0 ? h('p', { class: 'muted', style: { marginTop: '8px' } }, '—') : h('div', { class: 'list', style: { marginTop: '4px' } },
      r.time_off.map(t => h('div', { class: 'item', style: { minHeight: '52px' } }, h('div', { class: 'grow' }, h('div', { class: 't' }, t.from_date === t.to_date ? fmtDate(t.from_date) : `${fmtDate(t.from_date)} – ${fmtDate(t.to_date)}`), h('div', { class: 'd' }, [t.staff_id ? _("Ta'til") : (ctx.lang === 'ru' ? 'Весь салон закрыт' : 'Butun do\'kon yopiq'), t.reason].filter(Boolean).join(' · '))),
        (canEdit && (t.staff_id || d.role === 'owner')) && h('button', { class: 'iconbtn', 'aria-label': 'delete', onclick: async () => { await DEL(`/api/a/${A.id}/time-off/${t.id}`); nav.refresh(); } }, icon('trash', 'sm')))),
      r.overrides.map(o => h('div', { class: 'item', style: { minHeight: '52px' } }, h('div', { class: 'grow' }, h('div', { class: 't' }, fmtDate(o.date, true)), h('div', { class: 'd' }, o.start_min === null ? _('Dam olish') : `${minHHMM(o.start_min)}–${minHHMM(o.end_min)}`)),
        canEdit && h('button', { class: 'iconbtn', 'aria-label': 'delete', onclick: async () => { await DEL(`/api/a/${A.id}/staff/${sid}/override/${o.date}`); nav.refresh(); } }, icon('trash', 'sm'))))));

  const danger = mgr && s.role !== 'owner' ? h('button', { class: 'btn block ' + (s.active ? 'danger' : ''), style: { marginTop: '14px' }, onclick: async e => {
    if (s.active && !(await confirmSheet(ctx.lang === 'ru' ? 'Деактивировать мастера?' : 'Ustani faolsizlantirish?', ctx.lang === 'ru' ? 'Он пропадёт из записи.' : 'U bron ro\'yxatidan chiqadi.', ctx.lang === 'ru' ? 'Деактивировать' : 'Faolsizlantirish'))) return;
    try { await PATCH(`/api/a/${A.id}/staff/${sid}`, { active: !s.active }); }
    catch (er) {
      if (er.code === 'has_future_bookings' && await confirmSheet(ctx.lang === 'ru' ? `Будущих записей: ${er.data.count}` : `Kelgusi bronlar: ${er.data.count}`, ctx.lang === 'ru' ? 'Отменить их и уведомить клиентов?' : 'Ularni bekor qilib, mijozlarga xabar yuboramizmi?', _('Bekor qilish'))) await PATCH(`/api/a/${A.id}/staff/${sid}`, { active: false, cancel_future: true });
      else return toast(errText(er), true);
    }
    await loadBiz(A.id, true); nav.go(`${base()}/team`);
  } }, s.active ? (ctx.lang === 'ru' ? 'Деактивировать' : 'Faolsizlantirish') : (ctx.lang === 'ru' ? 'Вернуть в команду' : 'Qayta faollashtirish')) : null;

  return h('div', { class: 'screen' }, top(s.name, back), h('div', { class: 'stack' }, profile, link, botCard, sched, svc, off, danger));
}

function timeOffSheet(sid) {
  let mode = 'range';
  const from = input({ type: 'date', value: todayStr(), min: todayStr() }), to = input({ type: 'date', value: todayStr(), min: todayStr() });
  const date = input({ type: 'date', value: todayStr(), min: todayStr() });
  const a = input({ type: 'time', value: '12:00' }), b = input({ type: 'time', value: '18:00' });
  const reason = input({ placeholder: ctx.lang === 'ru' ? 'Причина (необязательно)' : 'Sabab (ixtiyoriy)', maxlength: 100 });
  const body = h('div', {});
  const draw = () => body.replaceChildren(mode === 'range' ? h('div', { class: 'two' }, field(ctx.lang === 'ru' ? 'С' : 'Dan', from), field(ctx.lang === 'ru' ? 'По' : 'Gacha', to))
    : h('div', {}, field(_('Sana'), date), h('div', { class: 'two' }, field(ctx.lang === 'ru' ? 'С' : 'Dan', a), field(ctx.lang === 'ru' ? 'До' : 'Gacha', b))));
  const seg = h('div', { class: 'seg', style: { margin: '12px 0 14px' } },
    h('button', { 'aria-pressed': 'true', onclick: e => { mode = 'range'; sync(e.currentTarget); } }, _("Ta'til")),
    h('button', { 'aria-pressed': 'false', onclick: e => { mode = 'hours'; sync(e.currentTarget); } }, ctx.lang === 'ru' ? 'Особые часы' : 'Maxsus soat'));
  const sync = btn => { [...seg.children].forEach(c => c.setAttribute('aria-pressed', String(c === btn))); draw(); };
  draw();
  const closeFn = sheet(() => [h('h2', {}, _('Yopiq kunlar')), seg, body, field(ctx.lang === 'ru' ? 'Причина' : 'Sabab', reason), h('div', { style: { height: '14px' } }),
    h('button', { class: 'btn primary block', onclick: async e => {
      const res = await busy(e.currentTarget, () => mode === 'range'
        ? POST(`/api/a/${A.id}/time-off`, { staff_id: sid, from: from.value, to: to.value, reason: reason.value })
        : POST(`/api/a/${A.id}/staff/${sid}/override`, { date: date.value, hours: [{ start: a.value, end: b.value }], reason: reason.value }));
      closeFn(); toast(res.conflicts ? (ctx.lang === 'ru' ? `Внимание: записей в этот период — ${res.conflicts}` : `Diqqat: shu davrda ${res.conflicts} ta bron bor`) : _('Saqlandi'), !!res.conflicts); nav.refresh();
    } }, _('Saqlash'))]);
}

// ---------------------------------------------------------------- Xizmatlar
export async function services(params) {
  const d = await loadBiz(params.biz, true);
  const cats = [...new Set(d.services.map(s => s.category || ''))];
  const el = h('div', { class: 'screen' }, top(_('Xizmatlar'), null, h('button', { class: 'btn sm primary', onclick: () => serviceSheet() }, icon('plus', 'sm'), _("Qo'shish"))));
  if (!d.services.length) el.append(h('div', { class: 'card' }, h('div', { class: 'empty' }, h('b', {}, ctx.lang === 'ru' ? 'Услуг пока нет' : 'Hozircha xizmat yo\'q'), ctx.lang === 'ru' ? 'Добавьте первую: стрижка, борода...' : 'Birinchisini qo\'shing: soch olish, soqol...')));
  for (const c of cats) {
    if (c) el.append(h('div', { class: 'cat' }, c));
    el.append(h('div', { class: 'card', style: { marginTop: c ? 0 : '' } }, h('div', { class: 'list' }, d.services.filter(s => (s.category || '') === c).map(s =>
      h('button', { class: 'item', style: s.active ? {} : { opacity: .45 }, onclick: () => serviceSheet(s) },
        h('div', { class: 'grow' }, h('div', { class: 't' }, s.name), h('div', { class: 'd' }, dur(s.duration_min))), h('div', { class: 'r num', style: { fontWeight: 500 } }, money(s.price)), icon('right', 'sm'))))));
  }
  return el;
}

function serviceSheet(s) {
  const name = input({ value: s?.name || '', maxlength: 80 }), cat = input({ value: s?.category || '', maxlength: 40, placeholder: ctx.lang === 'ru' ? 'Например: Стрижка' : 'Masalan: Soch' });
  const pr = input({ type: 'number', inputmode: 'numeric', value: s?.price ?? '', min: 0 }), du = input({ type: 'number', inputmode: 'numeric', value: s?.duration_min ?? 30, min: 5, step: 5 });
  const desc = input({ value: s?.description || '', maxlength: 300 });
  const active = toggle(s ? !!s.active : true);
  const closeFn = sheet(() => [h('h2', {}, s ? _('Tahrirlash') : _("Qo'shish")), field(_('Nomi'), name), field(_('Toifa'), cat),
    h('div', { class: 'two' }, field(_('Narx (so\'m)'), pr), field(_('Davomiyligi') + ' (min)', du)), field(_('Tavsif'), desc),
    s && h('div', { class: 'line', style: { marginTop: '8px' } }, h('div', { class: 'grow' }, ctx.lang === 'ru' ? 'Активна' : 'Faol'), active),
    h('div', { style: { height: '14px' } }),
    h('div', { class: 'btn-row' },
      s && h('button', { class: 'btn danger', onclick: async () => { if (await confirmSheet(_("O'chirish"), s.name, _("O'chirish"))) { await DEL(`/api/a/${A.id}/services/${s.id}`); closeFn(); nav.refresh(); } } }, icon('trash', 'sm')),
      h('button', { class: 'btn primary', style: { flex: 3 }, onclick: async e => {
        const body = { name: name.value, category: cat.value, price: Number(pr.value || 0), duration_min: Number(du.value), description: desc.value };
        if (s) body.active = active.value;
        await busy(e.currentTarget, () => (s ? PATCH(`/api/a/${A.id}/services/${s.id}`, body) : POST(`/api/a/${A.id}/services`, body)));
        closeFn(); toast(_('Saqlandi')); nav.refresh();
      } }, _('Saqlash')))]);
}

// ---------------------------------------------------------------- Boshqa
export async function more(params) {
  const d = await loadBiz(params.biz);
  const items = [
    [_('Mijozlar'), 'users', `${base()}/clients`], [_('Statistika'), 'chart', `${base()}/stats`],
    d.role === 'master' && [ctx.lang === 'ru' ? 'Мой график и услуги' : 'Mening jadvalim', 'clock', `${base()}/team/${d.my_staff_id}`],
    [ctx.lang === 'ru' ? 'Фото работ' : 'Ish rasmlari', 'image', `${base()}/gallery`],
    isMgr() && [ctx.lang === 'ru' ? 'Подписка' : 'Obuna', 'award', `${base()}/subscription`],
    d.role === 'owner' && [ctx.lang === 'ru' ? 'Вид приложения' : "Ilova ko'rinishi", 'image', `${base()}/theme`],
    d.role === 'owner' && [_('Sozlamalar'), 'sliders', `${base()}/settings`], d.role === 'owner' && [_('Ulangan botlar'), 'bot', `${base()}/bot`],
  ].filter(Boolean);
  const langSeg = h('div', { class: 'seg' }, ['uz', 'ru'].map(l => h('button', { 'aria-pressed': String(ctx.lang === l), onclick: async () => { setLang(l); try { await POST('/api/c/profile', { lang: l }); } catch {} nav.refresh(true); } }, l === 'uz' ? "O'zbekcha" : 'Русский')));
  return h('div', { class: 'screen' }, top(_('Boshqa'), null, null, d.business.name),
    h('div', { class: 'card' }, h('div', { class: 'list' }, items.map(([t, ic, to]) => h('button', { class: 'item', onclick: () => nav.go(to) }, icon(ic), h('div', { class: 'grow t' }, t), icon('right', 'sm'))))),
    h('button', { class: 'btn block', style: { marginTop: '14px' }, onclick: () => { resetAll(); startTour('admin.more', { force: true }); } }, icon('play', 'sm'), ctx.lang === 'ru' ? 'Пройти инструкцию заново' : "Qo'llanmani qayta boshlash"),
    h('button', { class: 'btn block', style: { marginTop: '10px' }, onclick: () => feedbackSheet(d.business.id) }, ctx.lang === 'ru' ? 'Отзыв платформе' : 'Platformaga fikr bildirish'),
    h('div', { class: 'section-h' }, h('h2', {}, _('Til'))), langSeg,
    ctx.bot !== 'platform' && h('button', { class: 'btn block', style: { marginTop: '18px' }, onclick: () => nav.go('/') }, _("Mijoz ko'rinishi")),
    ctx.bot === 'platform' && h('button', { class: 'btn block', style: { marginTop: '18px' }, onclick: () => nav.go('/') }, ctx.lang === 'ru' ? 'Мои бизнесы' : 'Bizneslarim'));
}

// ---------------------------------------------------------------- Galereya
export async function gallery(params) {
  const d = await loadBiz(params.biz);
  const r = await GET(`/api/a/${A.id}/gallery`);
  const grid = h('div', { class: 'gallery' }, r.gallery.filter(g => d.role !== 'master' || g.staff_id === d.my_staff_id).map(g => h('div', { style: { backgroundImage: `url(${g.url})`, position: 'relative' } },
    h('button', { class: 'iconbtn', style: { position: 'absolute', top: '6px', right: '6px', width: '30px', height: '30px', background: '#000a' }, 'aria-label': 'delete', onclick: async () => { if (await confirmSheet(_("O'chirish"), '', _("O'chirish"))) { await DEL(`/api/a/${A.id}/gallery/${g.id}`); nav.refresh(); } } }, icon('x', 'sm')))));
  return h('div', { class: 'screen' }, top(ctx.lang === 'ru' ? 'Фото работ' : 'Ish rasmlari', `${base()}/more`, h('button', { class: 'btn sm primary', onclick: async () => { const u = await uploadTo('gallery').catch(e => (toast(errText(e), true), null)); if (u) nav.refresh(); } }, icon('plus', 'sm'), _("Qo'shish"))),
    r.gallery.length ? grid : h('div', { class: 'card' }, h('div', { class: 'empty' }, h('b', {}, ctx.lang === 'ru' ? 'Фото пока нет' : 'Rasmlar yo\'q'), ctx.lang === 'ru' ? 'Покажите клиентам свои лучшие работы' : 'Mijozlarga eng yaxshi ishlaringizni ko\'rsating')));
}

// ---------------------------------------------------------------- Sozlamalar
export async function settings(params) {
  const d = await loadBiz(params.biz, true);
  const b = d.business, st = d.settings;
  const { cities } = await GET('/api/cities');
  const name = input({ value: b.name, maxlength: 80 });
  const desc = h('textarea', { class: 'input', maxlength: 600 }, b.description || '');
  const city = h('select', { class: 'input' }, h('option', { value: '' }, '—'), ...cities.map(c => h('option', { value: c.id, selected: b.city?.id === c.id }, ctx.lang === 'ru' ? c.name_ru : c.name_uz)));
  const addr = input({ value: b.address || '', maxlength: 200 }), land = input({ value: b.landmark || '', maxlength: 200 });
  const phone = input({ value: b.phone || '', type: 'tel', maxlength: 30 }), insta = input({ value: b.instagram || '', maxlength: 60, placeholder: '@' });
  const profile = h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, ctx.lang === 'ru' ? 'Профиль' : 'Profil'),
    field(_('Biznes nomi'), name), field(_('Tavsif'), desc), field(_('Shahar'), city), field(_('Manzil'), addr), field(_("Mo'ljal"), land), field(_('Telefon'), phone), field('Instagram', insta),
    h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: async e => { await busy(e.currentTarget, () => PATCH(`/api/a/${A.id}`, { name: name.value, description: desc.value, city_id: city.value || null, address: addr.value, landmark: land.value, phone: phone.value, instagram: insta.value })); toast(_('Saqlandi')); await loadBiz(A.id, true); } }, _('Saqlash')));

  // rasmlar
  const mkImg = (target, label, cur, wide) => { const box = h('div', { style: { height: wide ? '110px' : '72px', width: wide ? '100%' : '72px', borderRadius: '14px', background: `var(--raised) ${cur ? `url(${cur}) center/cover` : ''}` } });
    return h('div', { style: { flex: wide ? 1 : 'none' } }, box, h('button', { class: 'btn sm block', style: { marginTop: '8px' }, onclick: async () => { const u = await uploadTo(target).catch(e => (toast(errText(e), true), null)); if (u) box.style.background = `url(${u}) center/cover`; } }, icon('image', 'sm'), label)); };
  const images = h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, marginBottom: '12px' } }, _('Rasm')), h('div', { style: { display: 'flex', gap: '14px' } }, mkImg('logo', 'Logo', b.logo, false), mkImg('cover', ctx.lang === 'ru' ? 'Обложка' : 'Muqova', b.cover, true)));

  // joylashuv
  const lat = input({ value: b.lat ?? '', inputmode: 'decimal', placeholder: '41.3111' }), lng = input({ value: b.lng ?? '', inputmode: 'decimal', placeholder: '69.2797' });
  const loc = h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, _('Joylashuv')),
    h('p', { class: 'muted', style: { marginBottom: '12px' } }, ctx.lang === 'ru' ? 'Клиенты откроют точку на карте одной кнопкой.' : 'Mijozlar xaritada bir tugma bilan ochadi.'),
    h('div', { class: 'two' }, field('Latitude', lat), field('Longitude', lng)),
    h('div', { class: 'btn-row', style: { marginTop: '12px' } },
      h('button', { class: 'btn', onclick: () => navigator.geolocation?.getCurrentPosition(p => { lat.value = p.coords.latitude.toFixed(6); lng.value = p.coords.longitude.toFixed(6); }, () => toast(ctx.lang === 'ru' ? 'Нет доступа к геолокации' : 'Joylashuvga ruxsat yo\'q', true)) }, icon('pin', 'sm'), ctx.lang === 'ru' ? 'Где я' : 'Men shu yerdaman'),
      h('button', { class: 'btn primary', onclick: async e => { await busy(e.currentTarget, () => PATCH(`/api/a/${A.id}`, { lat: lat.value === '' ? null : Number(lat.value), lng: lng.value === '' ? null : Number(lng.value) })); toast(_('Saqlandi')); } }, _('Saqlash'))),
    ctx.bot === 'platform' && h('button', { class: 'textbtn', style: { marginTop: '8px' }, onclick: async () => { await POST(`/api/a/${A.id}/request-location`); toast(ctx.lang === 'ru' ? 'Отправьте локацию в чат с ботом' : 'Botga joylashuv yuboring'); tg?.close(); } }, ctx.lang === 'ru' ? 'Отправить локацию через Telegram' : 'Telegram orqali joylashuv yuborish'));

  // qoidalar
  const num = (v, o = {}) => input({ type: 'number', inputmode: 'numeric', value: v, min: 0, ...o });
  const f = { step: num(st.slot_step_min), buf: num(st.buffer_min), notice: num(Math.round(st.min_notice_min / 60 * 10) / 10, { step: 0.5 }), adv: num(st.max_advance_days), cancel: num(Math.round(st.cancel_before_min / 60 * 10) / 10, { step: 0.5 }), act: num(st.max_active_per_client), ns: num(st.noshow_limit) };
  const auto = toggle(st.auto_confirm), paused = toggle(b.status === 'paused');
  const rules = h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, _('Qoidalar')),
    h('div', { class: 'two' }, field(ctx.lang === 'ru' ? 'Шаг слотов (мин)' : 'Slot qadami (daq)', f.step), field(ctx.lang === 'ru' ? 'Перерыв между записями (мин)' : 'Bronlar orasidagi tanaffus (daq)', f.buf)),
    h('div', { class: 'two' }, field(ctx.lang === 'ru' ? 'Мин. заранее (ч)' : 'Kamida oldin (soat)', f.notice), field(ctx.lang === 'ru' ? 'Макс. вперёд (дн.)' : 'Ko\'pi bilan oldin (kun)', f.adv)),
    h('div', { class: 'two' }, field(ctx.lang === 'ru' ? 'Отмена не позднее (ч)' : 'Bekor qilish muddati (soat)', f.cancel), field(ctx.lang === 'ru' ? 'Макс. активных записей' : 'Faol bronlar chegarasi', f.act)),
    field(ctx.lang === 'ru' ? 'Блокировать после неявок' : 'Kelmaganlardan keyin bloklash', f.ns, ctx.lang === 'ru' ? '0 — отключено' : '0 — o\'chirilgan'),
    h('div', { class: 'line' }, h('div', { class: 'grow' }, h('div', { class: 't' }, ctx.lang === 'ru' ? 'Автоподтверждение' : 'Avtomatik tasdiqlash'), h('div', { class: 'd' }, ctx.lang === 'ru' ? 'Выключите, чтобы подтверждать вручную' : 'O\'chirsangiz, har bir bronni o\'zingiz tasdiqlaysiz')), auto),
    h('div', { class: 'line' }, h('div', { class: 'grow' }, h('div', { class: 't' }, ctx.lang === 'ru' ? 'Приостановить запись' : 'Bronni vaqtincha to\'xtatish')), paused),
    h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: async e => {
      await busy(e.currentTarget, () => PATCH(`/api/a/${A.id}`, { slot_step_min: Number(f.step.value), buffer_min: Number(f.buf.value), min_notice_min: Math.round(Number(f.notice.value) * 60), max_advance_days: Number(f.adv.value), cancel_before_min: Math.round(Number(f.cancel.value) * 60), max_active_per_client: Number(f.act.value), noshow_limit: Number(f.ns.value), auto_confirm: auto.value, status: paused.value ? 'paused' : 'active' }));
      toast(_('Saqlandi')); await loadBiz(A.id, true);
    } }, _('Saqlash')));
  return h('div', { class: 'screen' }, top(_('Sozlamalar'), `${base()}/more`), h('div', { class: 'stack' }, profile, images, loc, rules));
}

// ---------------------------------------------------------------- Botlar
export async function botScreen(params, q) {
  const d = await loadBiz(params.biz, true);
  const presetStaff = Number(q.get('staff')) || '';
  const token = input({ placeholder: '123456789:AAF...', autocomplete: 'off', spellcheck: 'false' });
  const kind = h('select', { class: 'input' }, h('option', { value: 'shop' }, ctx.lang === 'ru' ? 'Общий бот заведения' : "Umumiy do'kon boti"), h('option', { value: 'staff', selected: !!presetStaff }, ctx.lang === 'ru' ? 'Личный бот мастера' : 'Ustaning shaxsiy boti'));
  const staffSel = h('select', { class: 'input' }, d.staff.filter(s => s.active).map(s => h('option', { value: s.id, selected: s.id === presetStaff }, s.name)));
  const staffField = field(_('Usta'), staffSel); staffField.classList.toggle('hidden', !presetStaff);
  kind.onchange = () => staffField.classList.toggle('hidden', kind.value !== 'staff');
  const steps = ctx.lang === 'ru'
    ? ['Откройте @BotFather в Telegram и отправьте /newbot', 'Придумайте название и username бота (оканчивается на bot)', 'Скопируйте полученный токен и вставьте ниже']
    : ["Telegram'da @BotFather ni oching va /newbot yuboring", "Bot nomi va username kiriting (oxiri bot bilan tugaydi)", "Olgan tokeningizni nusxalab, quyiga joylang"];
  const connect = h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, _('Botni ulash')),
    h('ol', { class: 'muted', style: { margin: '0 0 14px', paddingLeft: '20px' } }, steps.map(s => h('li', { style: { marginBottom: '4px' } }, s))),
    field(ctx.lang === 'ru' ? 'Тип' : 'Turi', kind), staffField, field(_('Bot tokeni'), token),
    h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: async e => {
      await busy(e.currentTarget, () => POST(`/api/a/${A.id}/bots`, { token: token.value, kind: kind.value, staff_id: kind.value === 'staff' ? Number(staffSel.value) : undefined }));
      toast(_('Saqlandi')); nav.refresh();
    } }, _('Ulash')),
    h('p', { class: 'hint' }, ctx.lang === 'ru' ? 'Токен хранится в зашифрованном виде.' : 'Token shifrlangan holda saqlanadi.'));
  const list = h('div', { class: 'card' }, d.bots.length ? h('div', { class: 'list' }, d.bots.map(b => h('div', { class: 'item' }, icon('bot'),
    h('div', { class: 'grow' }, h('div', { class: 't' }, '@' + b.username), h('div', { class: 'd' }, b.kind === 'staff' ? `${ctx.lang === 'ru' ? 'Личный' : 'Shaxsiy'}: ${d.staff.find(s => s.id === b.staff_id)?.name || ''}` : (ctx.lang === 'ru' ? 'Общий' : 'Umumiy'))),
    h('button', { class: 'btn sm', onclick: () => openLink('https://t.me/' + b.username) }, 'Telegram'),
    h('button', { class: 'iconbtn', 'aria-label': 'delete', onclick: async () => { if (await confirmSheet(ctx.lang === 'ru' ? 'Отключить бота?' : 'Botni uzamizmi?', '@' + b.username, ctx.lang === 'ru' ? 'Отключить' : 'Uzish')) { await DEL(`/api/a/${A.id}/bots/${b.id}`); nav.refresh(); } } }, icon('trash', 'sm'))))) : h('div', { class: 'empty' }, h('b', {}, ctx.lang === 'ru' ? 'Ботов пока нет' : 'Hozircha bot yo\'q')));
  return h('div', { class: 'screen' }, top(_('Ulangan botlar'), `${base()}/more`), h('div', { class: 'stack' }, list, connect));
}

// ---------------------------------------------------------------- Platforma: bizneslar ro'yxati va yangi biznes
export async function bizList(_params, q) {
  const me = await GET('/api/a/me');
  if (me.is_admin && !q?.get('mine')) { nav.go('/admin'); return null; } // platforma egasi avval umumiy panelni ko'radi
  const el = h('div', { class: 'screen' }, top(ctx.lang === 'ru' ? 'Мои бизнесы' : 'Bizneslarim', null, h('button', { class: 'btn sm', onclick: () => nav.go('/about') }, ctx.lang === 'ru' ? 'О сервисе' : 'Xizmat haqida')));
  if (!me.businesses.length && !me.is_admin) { nav.go('/about'); return null; } // biznesi yo'q odam sotuv sahifasini ko'radi
  el.append(h('div', { class: 'stack' }, me.businesses.map(b => {
    const until = Math.max(b.trial_ends || 0, b.paid_until || 0);
    const left = until ? Math.ceil((until - Date.now() / 1000) / 86400) : null;
    return h('button', { class: 'card', style: { display: 'block', width: '100%', textAlign: 'left' }, onclick: () => { A.id = null; nav.go(`/a/${b.id}`); } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } }, h('div', { style: { fontWeight: 600, fontSize: '16px' } }, b.name), h('span', { class: 'pill' }, roleLabel(b.role))),
      h('div', { class: 'muted', style: { marginTop: '4px' } }, b.bots.length ? b.bots.map(x => '@' + x.username).join(', ') : (ctx.lang === 'ru' ? 'Бот не подключён' : 'Bot ulanmagan')),
      left !== null && b.role === 'owner' && !b.paid_until && h('div', { class: 'd faint', style: { marginTop: '4px', fontSize: '12px' } }, left > 0 ? (ctx.lang === 'ru' ? `Пробный период: ${left} дн.` : `Sinov muddati: ${left} kun`) : (ctx.lang === 'ru' ? 'Пробный период закончился' : 'Sinov muddati tugagan')));
  })));
  if (me.is_admin) el.prepend(h('button', { class: 'card', style: { display: 'block', width: '100%', textAlign: 'left', marginBottom: '14px' }, onclick: () => nav.go('/admin') }, h('div', { style: { fontWeight: 600, fontSize: '16px' } }, ctx.lang === 'ru' ? 'Панель владельца платформы' : 'Platforma egasi paneli'), h('div', { class: 'muted', style: { marginTop: '2px' } }, ctx.lang === 'ru' ? 'Все бизнесы, доходы, подписки' : 'Barcha bizneslar, daromad, obunalar')));
  el.append(h('button', { class: 'btn block', style: { marginTop: '16px' }, onclick: () => feedbackSheet() }, ctx.lang === 'ru' ? 'Отзыв о сервисе' : 'Xizmat haqida fikr bildirish'));
  el.append(h('div', { class: 'seg', style: { marginTop: '24px' } }, ['uz', 'ru'].map(l => h('button', { 'aria-pressed': String(ctx.lang === l), onclick: () => { setLang(l); nav.refresh(true); } }, l === 'uz' ? "O'zbekcha" : 'Русский'))));
  return el;
}

export async function newBiz() {
  const { cities } = await GET('/api/cities');
  const name = input({ placeholder: ctx.lang === 'ru' ? 'Например: Barber House' : 'Masalan: Barber House', maxlength: 80 });
  const kind = h('select', { class: 'input' }, [['barber', ctx.lang === 'ru' ? 'Барбершоп / парикмахерская' : 'Sartaroshxona'], ['beauty', ctx.lang === 'ru' ? 'Салон красоты' : 'Go\'zallik saloni'], ['nails', ctx.lang === 'ru' ? 'Маникюр' : 'Manikyur'], ['clinic', ctx.lang === 'ru' ? 'Клиника' : 'Klinika'], ['other', ctx.lang === 'ru' ? 'Другое' : 'Boshqa']].map(([v, l]) => h('option', { value: v }, l)));
  const city = h('select', { class: 'input' }, cities.map(c => h('option', { value: c.id }, ctx.lang === 'ru' ? c.name_ru : c.name_uz)));
  const works = toggle(true);
  return h('div', { class: 'screen' }, top(_('Yangi biznes'), '/'),
    h('div', { class: 'card' }, field(_('Biznes nomi'), name), field(ctx.lang === 'ru' ? 'Тип' : 'Turi', kind), field(_('Shahar'), city),
      h('div', { class: 'line', style: { marginTop: '10px' } }, h('div', { class: 'grow' }, h('div', { class: 't' }, ctx.lang === 'ru' ? 'Я сам принимаю клиентов' : 'Men o\'zim ham mijoz qabul qilaman'), h('div', { class: 'd' }, ctx.lang === 'ru' ? 'Вы появитесь в списке мастеров' : 'Siz ustalar ro\'yxatida bo\'lasiz')), works),
      h('button', { class: 'btn primary block', style: { marginTop: '16px' }, onclick: async e => {
        if (name.value.trim().length < 2) return toast(errText({ code: 'invalid_name' }), true);
        const r = await busy(e.currentTarget, () => POST('/api/a/business', { name: name.value, kind: kind.value, city_id: Number(city.value), owner_works: works.value }));
        nav.go(`/a/${r.id}`);
      } }, _('Yaratish'))),
    h('p', { class: 'hint', style: { marginTop: '12px' } }, ctx.lang === 'ru' ? 'Бесплатный пробный период включён.' : 'Bepul sinov muddati yoqilgan.'));
}

export async function platformAdmin() {
  const [r, planData] = await Promise.all([GET('/api/admin/overview'), GET('/api/admin/plans')]);
  const plans = planData.plans.filter(p => p.active);
  const T = r.totals, ru = ctx.lang === 'ru';
  let metric = 'bookings';
  const stateLabel = b => b.state === 'paid' ? (ru ? 'Оплачен' : "To'langan") : b.state === 'trial' ? (ru ? 'Пробный' : 'Sinov') : (ru ? 'Истёк' : 'Tugagan');
  const daysLeft = b => Math.ceil((b.until - r.now) / 86400);
  const pillCls = b => b.status !== 'active' ? 'neg' : b.state === 'paid' ? 'pos' : b.state === 'trial' ? (daysLeft(b) <= 3 ? 'warn' : 'blue') : 'neg';
  const dstr = ts => new Date(ts * 1000).toISOString().slice(0, 10);

  const chart = h('div', {});
  const drawChart = () => {
    const vals = r.series.map(x => x[metric]); const mx = Math.max(1, ...vals);
    chart.replaceChildren(
      h('div', { class: 'bars blue', role: 'img', 'aria-label': metric }, vals.map((v, i) => h('div', { class: v ? '' : 'z', style: { height: v ? Math.max(4, (v / mx) * 100) + '%' : '2px' }, title: fmtDate(r.series[i].date) + ': ' + v }))),
      h('div', { class: 'axis', style: { display: 'flex', justifyContent: 'space-between' } }, h('span', {}, fmtDate(r.series[0].date)), h('span', {}, (ru ? 'макс. ' : 'maks. ') + mx), h('span', {}, fmtDate(r.series.at(-1).date))));
  };
  const seg = h('div', { class: 'seg', style: { marginBottom: '12px' } }, [['bookings', ru ? 'Записи' : 'Bronlar'], ['businesses', ru ? 'Новые бизнесы' : 'Yangi bizneslar']].map(([k, l]) =>
    h('button', { 'aria-pressed': String(k === metric), onclick: e => { metric = k; [...seg.children].forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); drawChart(); } }, l)));
  drawChart();

  // e'tibor talab qiladiganlar oldinda: muddati tugagan yoki 3 kundan kam qolgan
  const att = x => (x.state === 'expired' ? 0 : x.state === 'trial' && daysLeft(x) <= 3 ? 1 : 2);
  const sorted = [...r.businesses].sort((a, b) => att(a) - att(b) || b.bookings_30 - a.bookings_30);
  const attention = r.businesses.filter(b => att(b) < 2).length;

  function bizSheet(b) {
    const amount = input({ type: 'number', inputmode: 'numeric', placeholder: ru ? 'Сумма оплаты (сум)' : "To'lov summasi (so'm)", min: 0 });
    let days = 30, planId = b.plan_id || '';
    const planSel = h('select', { class: 'input', style: { marginBottom: '8px' } }, h('option', { value: '' }, ru ? 'Тариф не менять' : "Tarifni o'zgartirmaslik"), ...plans.map(p => h('option', { value: p.id, selected: p.id === b.plan_id }, p.name + (p.max_staff ? ` · ${p.max_staff} ${ru ? 'мастеров' : 'usta'}` : ''))));
    planSel.onchange = () => { planId = planSel.value; };
    const daySeg = h('div', { class: 'seg', style: { margin: '8px 0 12px' } }, [30, 90, 365].map(n => h('button', { 'aria-pressed': String(n === days), onclick: e => { days = n; [...daySeg.children].forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, '+' + n + ' ' + (ru ? 'дн.' : 'kun'))));
    const row = (k, v) => h('div', { class: 'summary-row' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v));
    const closeFn = sheet(() => [h('h2', {}, b.name),
      h('div', { class: 'card', style: { background: 'var(--raised)', marginTop: '10px', padding: '4px 16px' } },
        row(ru ? 'Владелец' : 'Egasi', b.owner_username ? h('a', { class: 'inline', href: '#', onclick: e => { e.preventDefault(); openLink('https://t.me/' + b.owner_username); } }, '@' + b.owner_username) : b.owner),
        row(ru ? 'Статус' : 'Holat', stateLabel(b) + (b.until ? ' · ' + fmtDate(dstr(b.until)) : '')),
        row(ru ? 'Тариф' : 'Tarif', b.plan_name || '—'),
        row(ru ? 'Записей' : 'Bronlar', b.bookings_30 + ' / 30 ' + (ru ? 'дн.' : 'kun') + ' · ' + b.bookings_total + ' ' + (ru ? 'всего' : 'jami')),
        row(ru ? 'Мастера · боты' : 'Ustalar · botlar', b.staff + ' · ' + b.bots),
        row(ru ? 'Последняя запись' : "So'nggi bron", b.last_booking ? fmtDate(dstr(b.last_booking)) : '—')),
      b.claim_code && r.platform_bot_username && h('div', { class: 'well', style: { marginTop: '12px' } }, h('div', { style: { fontWeight: 500 } }, ru ? 'Ждёт владельца' : 'Egasi kutilmoqda'),
        h('div', { class: 'btn-row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => copyText(claimLink(r.platform_bot_username, b.claim_code)) }, icon('link', 'sm'), _('Nusxalash')),
          h('button', { class: 'btn sm', onclick: () => openLink('https://t.me/share/url?url=' + encodeURIComponent(claimLink(r.platform_bot_username, b.claim_code)) + '&text=' + encodeURIComponent(b.name)) }, icon('share', 'sm')))),
      r.platform_bot_username && h('button', { class: 'textbtn', onclick: async () => { const c = await POST('/api/admin/businesses/' + b.id + '/claim'); copyText(claimLink(r.platform_bot_username, c.claim_code)); } }, ru ? 'Новая ссылка владельца (копировать)' : "Yangi egalik havolasi (nusxalash)"),
      h('div', { style: { fontWeight: 600, margin: '18px 0 0' } }, ru ? 'Продлить подписку' : 'Obunani uzaytirish'), planSel, daySeg, amount,
      h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: async e => {
        await busy(e.currentTarget, () => POST('/api/admin/businesses/' + b.id + '/extend', { days, amount: Number(amount.value || 0), plan_id: planId ? Number(planId) : undefined }));
        closeFn(); toast(_('Saqlandi')); nav.refresh();
      } }, ru ? 'Продлить и записать оплату' : "Uzaytirish va to'lovni yozish"),
      h('div', { class: 'btn-row', style: { marginTop: '10px' } },
        h('button', { class: 'btn', onclick: () => { closeFn(); A.id = null; nav.go('/a/' + b.id); } }, ru ? 'Открыть управление' : 'Boshqaruvni ochish'),
        h('button', { class: 'btn ' + (b.status === 'active' ? 'danger' : ''), onclick: async e => {
          const next = b.status === 'active' ? 'blocked' : 'active';
          if (next === 'blocked' && !(await confirmSheet(ru ? 'Заблокировать бизнес?' : 'Biznesni bloklaymizmi?', b.name, ru ? 'Заблокировать' : 'Bloklash'))) return;
          await busy(e.currentTarget, () => PATCH('/api/admin/businesses/' + b.id, { status: next })); closeFn(); toast(_('Saqlandi')); nav.refresh();
        } }, b.status === 'active' ? (ru ? 'Заблокировать' : 'Bloklash') : (ru ? 'Разблокировать' : 'Blokdan chiqarish')))]);
  }

  return h('div', { class: 'screen' }, top(ru ? 'Платформа' : 'Platforma', null, h('button', { class: 'btn sm', onclick: () => nav.go('/?mine=1') }, ru ? 'Мои бизнесы' : 'Bizneslarim'), ru ? 'Все бизнесы и доходы' : 'Barcha bizneslar va daromad'),
    h('div', { class: 'btn-row', style: { marginBottom: '14px' } }, h('button', { class: 'btn primary', onclick: () => nav.go('/admin/new') }, icon('plus', 'sm'), ru ? 'Создать бизнес' : 'Biznes yaratish')),
    h('div', { class: 'card', style: { marginBottom: '14px' } }, h('div', { class: 'list' },
      h('button', { class: 'item', onclick: () => nav.go('/admin/leads') }, h('div', { class: 'grow t' }, ru ? 'Заявки на подключение' : "Ulanish so'rovlari"), T.leads_new ? h('span', { class: 'pill warn' }, T.leads_new + (ru ? ' новых' : ' yangi')) : h('span', { class: 'muted' }, T.leads_total), icon('right', 'sm')),
      h('button', { class: 'item', onclick: () => nav.go('/admin/plans') }, h('div', { class: 'grow t' }, ru ? 'Тарифы и оплата' : "Tariflar va to'lov"), icon('right', 'sm')),
      h('button', { class: 'item', onclick: () => nav.go('/admin/feedback') }, h('div', { class: 'grow t' }, ru ? 'Отзывы' : 'Fikr-mulohazalar'), T.feedback_new ? h('span', { class: 'pill warn' }, T.feedback_new + (ru ? ' новых' : ' yangi')) : (T.feedback_avg ? h('span', { class: 'stars' }, icon('star', 'sm'), ' ' + T.feedback_avg.toFixed(1)) : null), icon('right', 'sm')))),
    h('div', { class: 'kpis two' },
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, ru ? 'Доход за 30 дней' : 'Daromad (30 kun)'), h('div', { class: 'v lead' }, money(T.revenue_30)), h('div', { class: 'c' }, _("so'm") + ' · ' + (ru ? 'всего ' : 'jami ') + money(T.revenue_total))),
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, ru ? 'Бизнесы' : 'Bizneslar'), h('div', { class: 'v' }, T.businesses), h('div', { class: 'c' }, T.paying + ' ' + (ru ? 'платят' : "to'lagan") + ' · ' + T.trial + ' ' + (ru ? 'пробный' : 'sinov'))),
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, ru ? 'Записей за 30 дней' : 'Bronlar (30 kun)'), h('div', { class: 'v blue' }, T.bookings_30), h('div', { class: 'c' }, (ru ? 'за 7 дней: ' : '7 kunda: ') + T.bookings_7))),
    h('div', { class: 'kpis', style: { marginTop: '14px' } },
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, ru ? 'Мастера' : 'Ustalar'), h('div', { class: 'v' }, T.staff)),
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, ru ? 'Клиенты' : 'Mijozlar'), h('div', { class: 'v' }, T.clients)),
      h('div', { class: 'kpi' }, h('div', { class: 'l' }, ru ? 'Боты' : 'Botlar'), h('div', { class: 'v' }, T.bots))),
    h('div', { class: 'section-h' }, h('h2', {}, ru ? 'Динамика, 30 дней' : 'Dinamika, 30 kun')),
    h('div', { class: 'card' }, seg, chart,
      h('p', { class: 'hint' }, ru ? 'Оборот клиентов через платформу за 30 дней: ' + money(T.gmv_30) + ' сум (выполненные записи).' : "Mijozlar platforma orqali 30 kunda aylantirgan summa: " + money(T.gmv_30) + " so'm (bajarilgan bronlar).")),
    h('div', { class: 'section-h' }, h('h2', {}, (ru ? 'Бизнесы' : 'Bizneslar') + ' · ' + r.businesses.length), attention > 0 && h('span', { class: 'pill warn' }, attention + ' ' + (ru ? 'требуют внимания' : "e'tibor talab"))),
    r.businesses.length ? h('div', { class: 'card' }, h('div', { class: 'list' }, sorted.map(b => h('button', { class: 'item', onclick: () => bizSheet(b) },
      h('div', { class: 'grow' }, h('div', { class: 't' }, b.name), h('div', { class: 'd' }, (b.claim_code ? (ru ? 'ждёт владельца' : 'egasi kutilmoqda') : b.owner) + ' · ' + b.bookings_30 + ' ' + (ru ? 'зап./30д' : 'bron/30k') + ' · ' + b.staff + ' ' + (ru ? 'мастеров' : 'usta'))),
      h('div', { class: 'r' }, h('span', { class: 'pill ' + pillCls(b) }, b.status !== 'active' ? b.status : (b.state === 'expired' ? stateLabel(b) : stateLabel(b) + ' · ' + daysLeft(b) + (ru ? 'д' : 'k'))))))))
      : h('div', { class: 'card' }, h('div', { class: 'empty' }, h('b', {}, ru ? 'Бизнесов пока нет' : "Hozircha biznes yo'q"), ru ? 'Они появятся, когда владельцы создадут их в боте.' : "Egalari botda yaratganda shu yerda ko'rinadi.")));
}

// ---------------------------------------------------------------- Ilova ko'rinishi (tema) — jonli ko'rinish
export async function themeScreen(params) {
  const d = await loadBiz(params.biz, true);
  const ru = ctx.lang === 'ru';
  const draft = { ...d.business.theme };
  const modeBox = h('div', { class: 'opt-row' });
  const sw = h('div', { class: 'swatches' }), gnd = h('div', { class: 'opt-row' }), rad = h('div', { class: 'opt-row' }), btn = h('div', { class: 'opt-row' });
  const preview = h('div', { class: 'preview' });
  const opt = (label, active, on, sample) => h('button', { class: 'opt', 'aria-pressed': String(active), onclick: on }, sample, label);
  const draw = () => {
    applyTheme(draft, { preview: true }); // butun ilova darrov o'zgaradi: shu jonli ko'rinish
    modeBox.replaceChildren(...[['dark', ru ? 'Тёмный' : "Qorong'u", 'moon'], ['light', ru ? 'Светлый' : 'Yorqin', 'sun']].map(([k, l, ic]) => opt(l, draft.mode === k, () => { draft.mode = k; draw(); }, h('i', { style: { background: k === 'dark' ? '#171615' : '#ffffff', display: 'grid', placeItems: 'center', color: k === 'dark' ? '#fff' : '#0f1b2d' } }, icon(ic, 'sm')))));
    gndCard.classList.toggle('hidden', draft.mode === 'light');
    sw.replaceChildren(...THEME_OPTIONS.accents.map(c => h('button', { class: 'swatch', style: { background: c }, 'aria-pressed': String(draft.accent === c), 'aria-label': c, onclick: () => { draft.accent = c; draw(); } }, icon('check'))));
    gnd.replaceChildren(...[['warm', ru ? 'Тёплый' : 'Iliq'], ['black', ru ? 'Чёрный' : 'Qora'], ['graphite', ru ? 'Графит' : 'Grafit']].map(([k, l]) => opt(l, draft.ground === k, () => { draft.ground = k; draw(); }, h('i', { style: { background: GROUNDS[k].raised, outline: '4px solid ' + GROUNDS[k].ground, outlineOffset: '-4px' } }))));
    rad.replaceChildren(...[['sharp', ru ? 'Острые' : "O'tkir"], ['soft', ru ? 'Мягкие' : 'Yumshoq'], ['round', ru ? 'Круглые' : 'Yumaloq']].map(([k, l]) => opt(l, draft.radius === k, () => { draft.radius = k; draw(); }, h('i', { style: { background: 'var(--control)', borderRadius: THEME_OPTIONS.radii[k] === '8px' ? '3px' : THEME_OPTIONS.radii[k] === '20px' ? '9px' : '14px' } }))));
    btn.replaceChildren(...[['white', ru ? 'Белая' : 'Oq'], ['accent', ru ? 'Цветная' : 'Rangli']].map(([k, l]) => opt(l, draft.button === k, () => { draft.button = k; draw(); }, h('i', { style: { background: k === 'white' ? '#fff' : draft.accent } }))));
    preview.replaceChildren(
      h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, fontSize: '16px' } }, d.business.name), h('div', { class: 'muted' }, ru ? 'Сегодня, 11:00 · Мастер' : 'Bugun, 11:00 · Usta'),
        h('div', { class: 'track', style: { marginTop: '12px' } }, h('i', { style: { left: '20%', width: '18%' } }), h('i', { class: 'd', style: { left: '45%', width: '12%' } }), h('i', { class: 'p', style: { left: '65%', width: '14%' } })),
        h('div', { class: 'slots', style: { marginTop: '12px', gridTemplateColumns: 'repeat(3,1fr)' } }, h('button', { class: 'slot', 'aria-pressed': 'false' }, '10:00'), h('button', { class: 'slot', 'aria-pressed': 'true' }, '10:30'), h('button', { class: 'slot', 'aria-pressed': 'false' }, '11:00')),
        h('button', { class: 'btn primary block', style: { marginTop: '12px' } }, ru ? 'Записаться' : 'Bron qilish')));
  };
  const section = (title, body) => h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, marginBottom: '12px' } }, title), body);
  const gndCard = section(ru ? 'Фон' : 'Fon', gnd);
  draw();
  return h('div', { class: 'screen' }, top(ru ? 'Вид приложения' : "Ilova ko'rinishi", base() + '/more', null, ru ? 'Так клиенты видят вашего бота' : "Mijozlar botingizni shunday ko'radi"),
    h('div', { class: 'stack' },
      preview,
      section(ru ? 'Стиль по умолчанию' : 'Asosiy uslub', modeBox), section(ru ? 'Акцентный цвет' : 'Asosiy rang', sw), gndCard, section(ru ? 'Углы' : 'Burchaklar', rad), section(ru ? 'Кнопка' : 'Tugma', btn),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => { Object.assign(draft, { accent: '#e6b05a', ground: 'warm', radius: 'soft', button: 'white' }); draw(); } }, ru ? 'Сбросить' : 'Standart'),
        h('button', { class: 'btn primary', onclick: async e => { await busy(e.currentTarget, () => PATCH('/api/a/' + A.id, { theme: draft })); await loadBiz(A.id, true); toast(_('Saqlandi')); } }, _('Saqlash')))));
}

// ---------------------------------------------------------------- Biznes egasi: obuna
export async function subscriptionScreen(params) {
  const d = await loadBiz(params.biz);
  const r = await GET('/api/a/' + A.id + '/subscription');
  const ru = ctx.lang === 'ru', sub = r.subscription;
  const stateTxt = { paid: ru ? 'Оплачена' : "To'langan", trial: ru ? 'Пробный период' : 'Sinov muddati', expired: ru ? 'Истекла' : 'Tugagan' }[sub.state];
  const cls = sub.state === 'paid' ? 'pos' : sub.state === 'trial' ? (sub.days_left <= 3 ? 'warn' : 'blue') : 'neg';
  const contact = r.support_contact;
  const contactBtn = contact ? h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => openLink(contact.startsWith('@') ? 'https://t.me/' + contact.slice(1) : contact.startsWith('http') ? contact : 'tel:' + contact) }, icon('message', 'sm'), (ru ? 'Связаться: ' : 'Bog\'lanish: ') + contact) : null;
  return h('div', { class: 'screen' }, top(ru ? 'Подписка' : 'Obuna', base() + '/more', null, d.business.name),
    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('div', { style: { fontWeight: 600, fontSize: '16px' } }, sub.plan ? sub.plan.name : (ru ? 'Тариф не выбран' : 'Tarif belgilanmagan')), h('span', { class: 'pill ' + cls }, stateTxt)),
      h('div', { class: 'summary-row', style: { marginTop: '8px' } }, h('span', { class: 'k' }, ru ? 'Действует до' : 'Amal qiladi'), h('span', { class: 'v' }, sub.until ? fmtDate(new Date(sub.until * 1000).toISOString().slice(0, 10)) + (sub.days_left > 0 ? ' · ' + sub.days_left + (ru ? ' дн.' : ' kun') : '') : '—')),
      h('div', { class: 'summary-row' }, h('span', { class: 'k' }, ru ? 'Мастера' : 'Ustalar'), h('span', { class: 'v' }, r.staff.used + (r.staff.max ? ' / ' + r.staff.max : ''))),
      sub.state === 'expired' && h('p', { class: 'hint' }, ru ? 'Новые записи не принимаются, данные сохранены.' : "Yangi bronlar qabul qilinmaydi, ma'lumotlar saqlanadi.")),
    h('div', { class: 'section-h' }, h('h2', {}, ru ? 'Тарифы' : 'Tariflar')),
    h('div', { class: 'card' }, h('div', { class: 'list' }, r.plans.map(p => h('div', { class: 'item', style: { minHeight: '56px' } },
      h('div', { class: 'grow' }, h('div', { class: 't' }, p.name), h('div', { class: 'd' }, p.max_staff ? (ru ? 'до ' : 'eng ko\'pi ') + p.max_staff + (ru ? ' мастеров' : ' usta') : (ru ? 'без ограничений' : 'cheklovsiz'))),
      h('div', { class: 'r num', style: { fontWeight: 500 } }, p.price ? money(p.price) + ' ' + _("so'm") + (ru ? '/мес' : '/oy') : (ru ? 'по договорённости' : 'kelishuv asosida')),
      sub.plan?.id === p.id && h('span', { class: 'pill pos' }, ru ? 'Ваш' : 'Sizniki'))))),
    h('div', { class: 'section-h' }, h('h2', {}, ru ? 'Как оплатить' : "Qanday to'lash")),
    h('div', { class: 'card' }, h('p', { style: { margin: 0 } }, r.payment_note || (ru ? 'Свяжитесь с нами, и мы выставим счёт.' : "Biz bilan bog'laning, hisob-kitobni kelishamiz.")), contactBtn));
}

// ---------------------------------------------------------------- Platforma egasi: tariflar va to'lov sozlamalari
export async function plansScreen() {
  const ru = ctx.lang === 'ru';
  const r = await GET('/api/admin/plans');
  const contact = input({ value: r.support_contact || '', placeholder: '@tashrif_support', maxlength: 100 });
  const note = h('textarea', { class: 'input', maxlength: 500, placeholder: ru ? 'Например: оплата переводом на карту, после оплаты пришлите чек' : "Masalan: kartaga o'tkazing, to'lovdan keyin chekni yuboring" }, r.payment_note || '');
  const planCard = p => {
    const name = input({ value: p.name, maxlength: 40 }), price = input({ type: 'number', inputmode: 'numeric', value: p.price, min: 0 }), max = input({ type: 'number', inputmode: 'numeric', value: p.max_staff, min: 0 });
    const active = toggle(!!p.active);
    return h('div', { class: 'card' }, field(ru ? 'Название' : 'Nomi', name),
      h('div', { class: 'two' }, field(ru ? 'Цена (сум/мес)' : "Narx (so'm/oy)", price), field(ru ? 'Макс. мастеров' : 'Ustalar (maks.)', max)),
      h('div', { class: 'line' }, h('div', { class: 'grow' }, ru ? 'Активен' : 'Faol'), active),
      h('p', { class: 'hint' }, ru ? 'Цена 0 = «по договорённости». Макс. 0 = без ограничений.' : "Narx 0 = «kelishuv asosida». Maks. 0 = cheklovsiz."),
      h('button', { class: 'btn primary block', style: { marginTop: '10px' }, onclick: async e => { await busy(e.currentTarget, () => PATCH('/api/admin/plans/' + p.id, { name: name.value, price: Number(price.value || 0), max_staff: Number(max.value || 0), active: active.value })); toast(_('Saqlandi')); } }, _('Saqlash')));
  };
  return h('div', { class: 'screen' }, top(ru ? 'Тарифы и оплата' : "Tariflar va to'lov", '/admin'),
    h('div', { class: 'stack' }, ...r.plans.map(planCard),
      h('button', { class: 'btn block', onclick: async e => { await busy(e.currentTarget, () => POST('/api/admin/plans', { name: ru ? 'Новый тариф' : 'Yangi tarif', price: 0, max_staff: 0 })); nav.refresh(); } }, icon('plus', 'sm'), ru ? 'Добавить тариф' : "Tarif qo'shish"),
      h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, marginBottom: '8px' } }, ru ? 'Как клиенту оплатить' : "Mijoz qanday to'laydi"),
        field(ru ? 'Контакт для оплаты' : "To'lov uchun aloqa", contact, ru ? '@username или ссылка. Показывается в напоминаниях и экране подписки.' : "@username yoki havola. Eslatmalarda va obuna ekranida ko'rsatiladi."),
        field(ru ? 'Инструкция по оплате' : "To'lov ko'rsatmasi", note),
        h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: async e => { await busy(e.currentTarget, () => api('PUT', '/api/admin/settings', { support_contact: contact.value, payment_note: note.value })); toast(_('Saqlandi')); } }, _('Saqlash')))));
}
