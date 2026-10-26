// Harakat: animatsion fon (suzuvchi ikonlar), sahifa elementlarining ketma-ket paydo bo'lishi.
// Faqat transform va opacity; "kamroq harakat" sozlamasida hammasi statik.
import { h, icon, L, toggleMode, currentMode, toast } from './lib.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS = ['scissors', 'calendar', 'clock', 'star', 'bell', 'heart', 'zap', 'send', 'sparkle', 'coffee', 'award', 'bot', 'map', 'message'];
// [chap%, tepa%, o'lcham px, davomiylik s, kechikish s, rang sinfi]
const SPOTS = [
  [6, 8, 30, 9, 0, 1], [82, 6, 26, 11, 1.2, 2], [44, 3, 22, 10, 2.4, 3], [90, 30, 32, 12, 0.6, 4], [3, 38, 28, 10, 3.1, 2],
  [70, 52, 24, 9, 1.8, 1], [14, 62, 34, 13, 0.3, 3], [48, 70, 26, 11, 2.7, 4], [88, 78, 30, 10, 1.1, 1], [28, 88, 24, 12, 3.6, 2],
  [60, 90, 28, 9, 0.9, 3], [8, 82, 22, 11, 2.1, 4],
];

let bgEl;
/** Platforma sahifalari uchun doimiy fon: tekis dumaloq shakllar va 12 xil suzuvchi ikon */
export function ensureBg() {
  if (bgEl) return bgEl;
  bgEl = h('div', { class: 'bgfx', 'aria-hidden': 'true' },
    h('i', { class: 'blob b1' }), h('i', { class: 'blob b2' }), h('i', { class: 'blob b3' }),
    ...SPOTS.map(([x, y, s, d, dl, c], i) => h('span', { class: 'fi c' + c, style: { left: x + '%', top: y + '%', '--s': s + 'px', '--d': d + 's', '--dl': dl + 's', '--dx': (i % 2 ? -1 : 1) * (14 + (i % 4) * 6) + 'px', '--dy': (i % 3 ? -1 : 1) * (18 + (i % 5) * 5) + 'px' } }, icon(ICONS[i % ICONS.length]))));
  document.body.prepend(bgEl);
  return bgEl;
}
export const setBg = on => { ensureBg(); document.body.classList.toggle('bg-on', !!on); };

/** Ekrandagi kartalar va bo'limlar ketma-ket (60 ms oraliq) paydo bo'ladi */
let io;
export function decorate(root) {
  const els = [...root.querySelectorAll('.card, .kpis, .section-h, .master, .pick, .about-tile, .rm-node, [data-rv]')].filter(e => !e.closest('.sheet'));
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  io?.disconnect();
  io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.08 });
  els.forEach((e, i) => { e.setAttribute('data-rv', ''); e.style.transitionDelay = Math.min(i, 6) * 55 + 'ms'; io.observe(e); });
}
export const showAll = () => document.querySelectorAll('[data-rv]').forEach(e => e.classList.add('in'));

/** Doimiy uslub tugmasi: yorqin <-> qorong'u. Yordam tugmasi (?) bo'lsa, uning tepasida turadi. */
let styleBtn;
export function mountStyleFab({ dock = false, hasHelp = false } = {}) {
  if (!styleBtn) {
    styleBtn = h('button', { class: 'stylefab', onclick: () => {
      const next = toggleMode();
      setBg(next === 'light');
      draw();
      toast(next === 'light' ? L('Yorqin uslub yoqildi', 'Светлая тема включена') : L("Qorong'u uslub yoqildi", 'Тёмная тема включена'));
    } });
    document.body.append(styleBtn);
  }
  styleBtn.classList.toggle('up', dock);
  styleBtn.classList.toggle('alone', !hasHelp);
  draw();
}
function draw() {
  if (!styleBtn) return;
  const toLight = currentMode() !== 'light';
  styleBtn.setAttribute('aria-label', toLight ? L('Yorqin uslub', 'Светлая тема') : L("Qorong'u uslub", 'Тёмная тема'));
  styleBtn.replaceChildren(icon(toLight ? 'sun' : 'moon'));
}
window.addEventListener('themechange', draw);
