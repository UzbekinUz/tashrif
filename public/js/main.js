import { h, _, ctx, tg, nav, setBack, icon, skeleton, errText, toast, isDevSession, GET, setLang, applyTheme, PLATFORM_THEME } from './lib.js';
import { setBg, decorate, mountStyleFab } from './fx.js';
import { afterRender } from './tour.js';
import { clientRoutes, loadShop, shop } from './client.js';
import * as AD from './admin.js';
import * as AD2 from './admin2.js';
import * as PL from './platform.js';

const app = document.getElementById('app');
let seq = 0;

// yo'l -> ekran. Parametrli yo'llar regex orqali.
const routes = [];
const add = (pattern, fn) => routes.push([new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn]);
for (const [p, fn] of Object.entries(clientRoutes)) add(p, fn);
add('/a/:biz', AD.today);
add('/a/:biz/day/:date', AD.dayView);
add('/a/:biz/day', AD.dayView);
add('/a/:biz/team', AD2.team);
add('/a/:biz/team/:sid', AD2.staffDetail);
add('/a/:biz/services', AD2.services);
add('/a/:biz/more', AD2.more);
add('/a/:biz/clients', AD.clients);
add('/a/:biz/stats', AD.stats);
add('/a/:biz/settings', AD2.settings);
add('/a/:biz/bot', AD2.botScreen);
add('/a/:biz/gallery', AD2.gallery);
add('/a/:biz/theme', AD2.themeScreen);
add('/a/:biz/subscription', AD2.subscriptionScreen);
add('/admin/plans', AD2.plansScreen);
add('/about', PL.about);
add('/admin', AD2.platformAdmin);
add('/admin/leads', PL.leadsScreen);
add('/admin/feedback', PL.feedbackScreen);
add('/admin/new', PL.newBiz);

const platform = ctx.bot === 'platform';

// Har bir ekran uchun qo'llanma kaliti (tour.js dagi TOURS)
function tourKey(path) {
  if (platform) {
    if (path === '/about') return 'platform.about';
    if (path === '/') return 'platform.list';
    if (path === '/admin') return 'platform.admin';
  } else {
    const c = { '/': 'client.home', '/book/services': 'client.services', '/book/staff': 'client.staff', '/book/time': 'client.time', '/book/confirm': 'client.confirm', '/my': 'client.my' }[path];
    if (c) return c;
  }
  const a = /^\/a\/\d+(\/.*)?$/.exec(path);
  if (!a) return null;
  const rest = a[1] || '';
  if (rest === '') return 'admin.today';
  if (rest.startsWith('/day')) return 'admin.day';
  if (/^\/team\/\d+$/.test(rest)) return 'admin.staff';
  return { '/team': 'admin.team', '/services': 'admin.services', '/more': 'admin.more', '/theme': 'admin.theme' }[rest] || null;
}

function tabsFor(path) {
  const m = /^\/a\/(\d+)/.exec(path);
  if (m) {
    const b = `/a/${m[1]}`;
    const master = AD.A.data?.role === 'master';
    const pend = 0;
    return [
      ['Bugun', 'home', b, p => p === b],
      ['Jadval', 'calendar', `${b}/day`, p => p.startsWith(`${b}/day`)],
      master ? ['Mijozlar', 'users', `${b}/clients`, p => p.startsWith(`${b}/clients`)] : ['Jamoa', 'users', `${b}/team`, p => p.startsWith(`${b}/team`)],
      master ? ['Mening bronlarim', 'clock', `${b}/team/${AD.A.data.my_staff_id}`, p => p.startsWith(`${b}/team`)] : ['Xizmatlar', 'scissors', `${b}/services`, p => p.startsWith(`${b}/services`)],
      ['Boshqa', 'grid', `${b}/more`, p => /\/(more|clients|stats|settings|bot|gallery)/.test(p) && !master || (master && /\/(more|stats|gallery)/.test(p))],
    ].map(([l, i, to, on]) => ({ l, i, to, on: on(path) }));
  }
  if (platform) return null;
  const role = shop.data?.me.role;
  const tabs = [{ l: 'Bosh sahifa', i: 'home', to: '/', on: path === '/' || path.startsWith('/book') }, { l: 'Bronlarim', i: 'calendar', to: '/my', on: path === '/my' }];
  if (role) tabs.push({ l: 'Boshqaruv', i: 'sliders', to: `/a/${shop.data.business.id}`, on: false });
  return tabs;
}

function drawTabs(path) {
  document.querySelector('.tabbar')?.remove();
  const tabs = tabsFor(path);
  const hide = /^\/(book|new)/.test(path) || /\/team\/\d+$/.test(path) && false;
  app.classList.toggle('no-tabs', !tabs || hide);
  if (!tabs || hide) return;
  document.body.append(h('nav', { class: 'tabbar', 'aria-label': 'Main' }, h('div', { class: 'tabbar-in' }, tabs.map(t =>
    h('a', { class: 'tab', href: '#' + t.to, 'aria-current': t.on ? 'page' : null }, icon(t.i), _(t.l))))));
}

async function render() {
  const my = ++seq;
  document.querySelector('.dock')?.remove();
  let path = nav.path();
  const qIdx = path.indexOf('?');
  const q = new URLSearchParams(qIdx >= 0 ? path.slice(qIdx + 1) : '');
  if (qIdx >= 0) path = path.slice(0, qIdx);
  if (platform && !path.startsWith('/a/')) applyTheme(PLATFORM_THEME); // platforma ekranlari engil mavzuda

  // bot kontekstida egasi "?admin=1" bilan ochsa — to'g'ridan-to'g'ri boshqaruvga
  if (!platform && ctx.admin && path === '/' && !render.once) {
    render.once = true;
    const d = await loadShop().catch(() => null);
    if (d?.me.role) return nav.go(`/a/${d.business.id}`);
  }

  app.replaceChildren(skeleton());
  const slowTimer = setTimeout(() => {
    if (my === seq) app.append(h('div', { class: 'slow-note' }, ctx.lang === 'ru' ? 'Загрузка занимает дольше обычного…' : 'Yuklanish odatdagidan uzoq davom etmoqda…', h('div', {}, h('button', { class: 'btn sm', style: { marginTop: '10px' }, onclick: () => render() }, ctx.lang === 'ru' ? 'Повторить' : 'Qayta urinish'))));
  }, 7000);
  let screen = null, params = {};
  if (platform && path === '/') screen = AD2.bizList;
  else for (const [re, fn] of routes) { const m = re.exec(path); if (m) { screen = fn; params = m.groups || {}; break; } }
  try {
    if (!platform && !path.startsWith('/a/')) await loadShop();
    const el = await (screen ? screen(params, q) : clientRoutes['/']());
    clearTimeout(slowTimer);
    if (my !== seq || !el) return;
    app.replaceChildren(el);
    drawTabs(path);
    decorate(app);
    setBg(document.documentElement.dataset.mode === 'light'); // yorqin uslubda animatsion fon hamma joyda
    afterRender(tourKey(path));
    mountStyleFab({ dock: !!document.querySelector('.dock'), hasHelp: !!document.querySelector('.helpfab') });
    window.scrollTo(0, 0);
    const deep = /^\/(book|new|admin|about)|\/(clients|stats|settings|bot|gallery)$|\/team\/\d+$/.test(path);
    setBack(deep ? () => history.back() : null);
  } catch (e) {
    clearTimeout(slowTimer);
    if (my !== seq) return;
    app.replaceChildren(h('div', { class: 'screen' }, h('div', { class: 'top' }, h('h1', {}, '')),
      h('div', { class: 'card' }, h('div', { class: 'empty' }, h('b', {}, e.status === 401 ? (ctx.lang === 'ru' ? 'Откройте приложение через Telegram' : 'Ilovani Telegram orqali oching') : errText(e)),
        e.status === 401 && isDevSession() ? h('span', {}, 'dev: ?dev=<tg_id>') : h('button', { class: 'btn', style: { marginTop: '12px' }, onclick: () => render() }, 'Retry')))));
    document.querySelector('.tabbar')?.remove();
    console.error(e);
  }
}

if (ctx.go && !location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname + location.search + '#' + ctx.go);
if (platform) applyTheme(PLATFORM_THEME);
nav.refresh = (full) => { if (full) { shop.data = null; AD.A.data = null; } render(); };
window.addEventListener('hashchange', render);
if (isDevSession()) {
  const q = new URLSearchParams(location.search);
  if (q.get('dev')) { localStorage.setItem('dev', q.get('dev')); if (q.get('name')) localStorage.setItem('devname', q.get('name')); }
  document.body.append(h('div', { class: 'devbar' }, 'DEV · tg ' + (localStorage.getItem('dev') || '?')));
}
render();
