// Extend Stay — github.com/veraetogrex-portfolio · zero dependencies
// One month; the stay is a band of nights, each night a dark-blue day with its moon and its price.
// Drag the band's right edge (or use ← →) to add or remove nights; a night someone else holds stops it.
// Nights = check-out − check-in, and the booking bar under the month counts the same nights.

const YEAR = 2026, MONTH = 10;                 // November 2026
const RATE = 120;                              // dollars per night, taxes included
const TODAY = 16;
const TAKEN = [28, 29];                        // nights other guests hold
const BOOKED = { in: 23, out: 26 };            // the stay as booked: three nights

const CW = 176, CH = 168, TALL = 224, R = 34;   // day cell, a week row, the week of the stay (taller), band corner (px)
const FIRST = new Date(YEAR, MONTH, 1).getDay();          // 0 = Sunday
const DAYS = new Date(YEAR, MONTH + 1, 0).getDate();
const ROWS = Math.ceil((FIRST + DAYS) / 7);
// weeks wholly in the past are left out; the week of the stay is the tallest
const ROW_H = [...Array(ROWS).keys()].map(r => r * 7 + 7 - FIRST <= TODAY - 1 ? 0 : r === Math.floor((FIRST + BOOKED.in - 1) / 7) ? TALL : CH);
const ROW_Y = ROW_H.map((_, r) => ROW_H.slice(0, r).reduce((s, h) => s + h, 0));
const slot = d => FIRST + d - 1;               // a day's place in the month, left to right, row by row
const dayAt = s => s - FIRST + 1;
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"/></svg>';

const root   = document.querySelector('#stay');
const grid   = root.querySelector('.st-grid');
const inEl   = root.querySelector('.st-in');
const outEl  = root.querySelector('.st-out');
const countEl = root.querySelector('.st-count');
const wordEl = root.querySelector('.st-word');
const moonsEl = root.querySelector('.st-moons');
const totalEl = root.querySelector('.st-total-v');
const cta    = root.querySelector('.st-cta');

const money = v => '$' + Math.round(v).toLocaleString('en-US');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const label = d => new Date(YEAR, MONTH, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });                     // Nov 27
const longLabel = d => new Date(YEAR, MONTH, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const free = d => d >= TODAY && !TAKEN.includes(d);

// ── build the month: one band per week row, the two markers, the days, the handle ──
grid.innerHTML =
  [...Array(ROWS).keys()].map(r => `<span class="st-band" style="top:${ROW_Y[r] + 4}px;height:${ROW_H[r] - 8}px"></span><span class="st-band is-add" style="top:${ROW_Y[r] + 4}px;height:${ROW_H[r] - 8}px"></span>`).join('') +
  '<span class="st-mark is-in"><i></i></span><span class="st-mark is-out"><i></i><b>Checkout</b></span><span class="st-lift"></span>' +
  [...Array(DAYS).keys()].map(k => {
    const d = k + 1, s = slot(d), r = Math.floor(s / 7), past = d < TODAY, taken = TAKEN.includes(d);
    return `<button class="st-day${past ? ' is-past' : ''}${taken ? ' is-taken' : ''}${d === TODAY ? ' is-today' : ''}${ROW_H[r] ? '' : ' is-folded'}${ROW_H[r] === TALL ? ' is-tall' : ''}" data-d="${d}"
      style="height:${ROW_H[r]}px;transform:translate(${(s % 7) * CW}px,${ROW_Y[r]}px)"${past || taken ? ' aria-disabled="true"' : ''}>
      <span class="st-num">${d}</span>${taken ? '<span class="st-taken">Booked</span>' : `<span class="st-moon">${MOON}</span><span class="st-price"></span>`}</button>`;
  }).join('') +
  '<button class="st-handle" role="slider" aria-label="Checkout date"><i></i></button>' +
  '<span class="st-tag" aria-hidden="true"><b class="st-tag-n"></b><span class="st-tag-v"></span></span>';   // rides on the edge: nights and total
const bands = [...grid.querySelectorAll('.st-band:not(.is-add)')];
const adds = [...grid.querySelectorAll('.st-band.is-add')];       // the lighter part: nights added to the booking
const [markIn, markOut] = grid.querySelectorAll('.st-mark');
const days = [...grid.querySelectorAll('.st-day')];             // days[d - 1]
const handle = grid.querySelector('.st-handle');
const lift = grid.querySelector('.st-lift');                      // a night that has just joined the stay lifts off the band for a moment
const tag = grid.querySelector('.st-tag'), tagN = tag.querySelector('.st-tag-n'), tagV = tag.querySelector('.st-tag-v');

let a = slot(BOOKED.in), e = slot(BOOKED.out);   // the band in slots: from check-in to the check-out edge (e can be fractional while dragging)
let base = { ...BOOKED }, shown = null, anim = 0, goal = { a, e };   // goal: where the edges are heading
let shownN = null, tagLater = 0, popLater = 0;

// the new night lifts straight up with a shadow and settles back into the band
function pop(d) {
  const s = slot(d), r = Math.floor(s / 7), el = days[d - 1];
  lift.style.transform = `translate(${(s % 7) * CW + 3}px, ${ROW_Y[r] + 4}px)`; lift.style.height = `${ROW_H[r] - 8}px`;
  clearTimeout(popLater); days.forEach(x => x.classList.remove('is-pop'));
  lift.classList.add('is-up'); el.classList.add('is-pop');
  popLater = setTimeout(() => { lift.classList.remove('is-up'); el.classList.remove('is-pop'); }, 420);   // up 0.3 s, held, settles by ≈0.75 s
}

// the latest check-out from a given check-in: the first night someone else holds, or the last day of the month
function lastOut(inDay) { let d = inDay + 1; while (d < DAYS && free(d)) d++; return d; }

// ── draw one frame of the band; the nights, the markers and the booking bar follow its whole-day value ──
const cut = (r, from, to) => {         // the part of [from, to) that falls in week row r, as a clip-path
  const lo = Math.max(from, r * 7), hi = Math.min(to, r * 7 + 7);
  return hi - lo > .001 ? `inset(0 ${(r * 7 + 7 - hi) * CW + 3}px 0 ${(lo - r * 7) * CW + 3}px round ${R}px)` : 'inset(0 100% 0 0)';
};
function draw() {
  bands.forEach((b, r) => { b.style.clipPath = cut(r, a, e); });
  adds.forEach((b, r) => { b.style.clipPath = cut(r, Math.max(a, slot(base.out)), e); });
  const hr = Math.min(Math.floor((e - .001) / 7), ROWS - 1);     // the handle rides the band's right end
  const ex = (e - hr * 7) * CW;
  handle.style.transform = `translate(${ex - 22}px, ${ROW_Y[hr] + 4}px)`; handle.style.height = `${ROW_H[hr] - 8}px`;

  const inDay = dayAt(Math.round(a)), outDay = dayAt(Math.round(e));
  days.forEach((el, k) => {
    const d = k + 1, night = d >= inDay && d < outDay;
    el.classList.toggle('is-night', night);
    el.classList.toggle('is-added', night && (d < base.in || d >= base.out));   // a night the booking did not have yet
  });
  if (!shown || shown.in !== inDay || shown.out !== outDay) settle(inDay, outDay);
  const tw = tag.offsetWidth, at = tagSpot(hr, ex, tw);   // the tag rides the band's end where it covers no date: above it, below it, or it steps aside
  if (at) { tag.style.transform = `translate(${at.x + tw}px, ${at.y}px)`; tag.style.setProperty('--tip', `${at.x + tw - ex - 8}px`); }   // pinned by its right end: a new text never moves the tip
  tag.classList.toggle('is-below', !!at && at.below); tag.classList.toggle('is-off', !at);
}

// the whole-day state changed: move the markers and rewrite the booking bar
function settle(inDay, outDay) {
  const first = !shown, n = outDay - inDay;
  shown = { in: inDay, out: outDay };
  const at = d => `translate(${(slot(d) % 7) * CW}px, ${ROW_Y[Math.floor(slot(d) / 7)]}px)`;
  markIn.style.transform = at(inDay); markOut.style.transform = at(outDay);
  [[markIn, inDay], [markOut, outDay]].forEach(([m, d]) => { const h = ROW_H[Math.floor(slot(d) / 7)]; m.style.height = `${h}px`; m.classList.toggle('is-tall', h === TALL); });
  const grew = first ? 0 : n - (shownN ?? n); shownN = n;
  days.forEach((el, k) => { const p = el.querySelector('.st-price'); if (p) p.textContent = (k + 1 < base.in || k + 1 >= base.out) ? '+' + money(RATE) : money(RATE); el.classList.toggle('is-checkout', k + 1 === outDay); });
  flip(inEl, label(inDay), first); flip(outEl, label(outDay), first);
  flip(countEl, String(n), first); wordEl.textContent = n === 1 ? 'night' : 'nights';
  chips(inDay, n);
  roll(totalEl, n * RATE, first ? 0 : 520);
  clearTimeout(tagLater);
  const say = () => { flip(tagN, `${n} ${n === 1 ? 'night' : 'nights'}`, first); flip(tagV, money(n * RATE), first); };
  if (grew > 0 && outDay - 1 >= base.out) {             // a night came in at the end: it lifts, the tag says what it adds, then the new totals
    pop(outDay - 1);
    flip(tagN, `+${grew} ${grew === 1 ? 'night' : 'nights'}`); flip(tagV, '+' + money(grew * RATE));
    tagLater = setTimeout(say, 450);
  } else say();
  const diff = (n - (base.out - base.in)) * RATE;
  cta.disabled = n === base.out - base.in && inDay === base.in;
  cta.textContent = diff > 0 ? `Extend for ${money(diff)}` : diff < 0 ? 'Shorten stay' : cta.disabled ? 'No changes' : 'Move stay';
  const max = lastOut(inDay) - inDay;
  handle.setAttribute('aria-valuemin', 1); handle.setAttribute('aria-valuemax', max); handle.setAttribute('aria-valuenow', n);
  handle.setAttribute('aria-valuetext', `Checkout ${longLabel(outDay)}, ${n} ${n === 1 ? 'night' : 'nights'}`);
}

// the booking bar keeps one moon per night; added nights take the lighter blue of the band
function chips(inDay, n) {
  const want = Math.min(n, 5), have = [...moonsEl.querySelectorAll('.st-chip:not(.is-gone):not(.is-more)')];
  moonsEl.querySelectorAll('.is-more').forEach(c => c.remove());
  for (let i = have.length; i < want; i++) {
    const c = document.createElement('span'); c.className = 'st-chip is-gone'; c.innerHTML = MOON;
    moonsEl.append(c); c.offsetWidth; c.classList.remove('is-gone');           // grows in
  }
  have.slice(want).forEach(c => { c.classList.add('is-gone'); setTimeout(() => c.remove(), 300); });
  [...moonsEl.querySelectorAll('.st-chip:not(.is-gone)')].forEach((c, i) => { const d = inDay + i; c.classList.toggle('is-added', d < base.in || d >= base.out); });
  if (n > 5) { moonsEl.lastElementChild.remove(); const m = document.createElement('span'); m.className = 'st-chip is-more'; m.textContent = `+${n - 4}`; moonsEl.append(m); }
}

// ── move the band's edges to whole days ──
function glide(toA, toE, ms = 300) {
  const id = ++anim, a0 = a, e0 = e, t0 = performance.now(); goal = { a: toA, e: toE };
  const tick = now => {
    if (id !== anim) return;
    const p = Math.min(1, (now - t0) / ms), q = 1 - Math.pow(1 - p, 3);
    a = a0 + (toA - a0) * q; e = e0 + (toE - e0) * q; draw();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// a day you cannot reach: the edge leans toward it and comes back
function refuse(dir) {
  const id = ++anim, e0 = goal.e, t0 = performance.now();
  const tick = now => {
    if (id !== anim) return;
    const p = Math.min(1, (now - t0) / 360); e = e0 + dir * .18 * Math.sin(Math.PI * p); draw();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── drag the right edge: it follows the pointer day by day, booked nights hold it back ──
let drag = null;
function slotAt(x, y) {               // pointer → fractional slot in the month
  const r = grid.getBoundingClientRect(), k = r.width / (7 * CW);
  const ly = (y - r.top) / k, row = Math.max(0, ROW_Y.findLastIndex(top => top <= ly));
  return row * 7 + clamp((x - r.left) / k / CW, 0, 7);
}
handle.addEventListener('pointerdown', ev => {
  ev.preventDefault(); anim++;
  const lo = Math.round(a) + 1, hi = slot(lastOut(dayAt(Math.round(a))));
  drag = { off: e - slotAt(ev.clientX, ev.clientY), lo, hi };
  try { handle.setPointerCapture(ev.pointerId); } catch (_) {}
  root.classList.add('is-dragging'); handle.focus({ preventScroll: true, focusVisible: false });   // the checkout ring steps aside while the edge moves; arrows work after a drag
});
handle.addEventListener('pointermove', ev => {
  if (!drag) return;
  const want = slotAt(ev.clientX, ev.clientY) + drag.off;
  const over = want > drag.hi ? want - drag.hi : want < drag.lo ? want - drag.lo : 0;   // past the limit the edge only leans
  e = clamp(want, drag.lo, drag.hi) + .25 * Math.tanh(over * 2);
  draw();
});
const release = () => {
  if (!drag) return;
  drag = null; root.classList.remove('is-dragging');
  glide(a, clamp(Math.round(e), Math.round(a) + 1, slot(lastOut(dayAt(Math.round(a))))), 260);
};
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => handle.addEventListener(t, release));

// keyboard: ← → move check-out by a night
handle.addEventListener('keydown', ev => {
  const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[ev.key]; if (!dir || drag) return;
  ev.preventDefault();
  const inDay = dayAt(goal.a), out = dayAt(goal.e) + dir;          // from where the edge is heading, so fast presses add up
  if (out <= inDay || out > lastOut(inDay)) return refuse(dir);   // a booked night or the first night: the edge only leans
  glide(a, slot(out));
});

// click a day: after check-in it becomes check-out, before it the new check-in
days.forEach((el, k) => el.addEventListener('click', () => {
  const d = k + 1, { in: i, out: o } = shown;
  if (d < TODAY || d === i || (!free(d) && d !== lastOut(i))) return;   // a booked night can still be the checkout morning
  if (d > i) return d <= lastOut(i) ? glide(a, slot(d)) : refuse(1);
  for (let n = d; n < o; n++) if (!free(n)) return;
  glide(slot(d), e);
}));

// confirm the change locally: it becomes the booking
cta.addEventListener('click', () => {
  if (cta.disabled) return;
  base = { ...shown }; shown = null; draw();
  cta.textContent = 'Stay updated';
});

// a value flips to its new text
function flip(el, text, now) {
  el.classList.add('flip');
  const cur = el.querySelector('span:not(.is-out)');
  if (cur && cur.textContent === text) return;
  el.querySelectorAll('.is-out').forEach(s => s.remove());
  const s = document.createElement('span'); s.textContent = text;
  if (now || !cur) { el.replaceChildren(s); return; }
  s.className = 'is-in'; el.append(s); s.offsetWidth;
  s.classList.remove('is-in'); cur.classList.add('is-out');
  setTimeout(() => cur.remove(), 420);
}

// numbers count to their new value instead of jumping
let rolls = new Map();
function roll(el, to, ms = 520) {
  const id = {}; rolls.set(el, id);
  if (!ms) { el.textContent = money(to); return; }
  const from = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0, t0 = performance.now();
  const step = now => {
    if (rolls.get(el) !== id) return;
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = money(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function reset() {
  anim++; drag = null; root.classList.add('is-reset'); root.classList.remove('is-dragging');
  rolls = new Map(); base = { ...BOOKED }; a = slot(BOOKED.in); e = slot(BOOKED.out); goal = { a, e }; shown = null; shownN = null;
  clearTimeout(tagLater); clearTimeout(popLater); lift.classList.remove('is-up'); days.forEach(x => x.classList.remove('is-pop'));
  moonsEl.replaceChildren(); draw();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-reset')));
}

// where the tag can stand without covering a date: under the week above (clear of its nights and booked days),
// over the week below (clear of its dates), or nowhere — the booking bar says the same
function tagSpot(hr, ex, tw) {
  const inRow = r => days.filter((el, k) => Math.floor(slot(k + 1) / 7) === r && ROW_H[r]);
  const col = el => slot(+el.dataset.d) % 7;
  const tries = [];
  if (hr > 0 && ROW_H[hr - 1]) tries.push({ y: ROW_Y[hr] - 76, below: false, busy: inRow(hr - 1).filter(el => el.matches('.is-night, .is-taken')).map(col) });
  if (hr + 1 < ROWS) tries.push({ y: ROW_Y[hr] + ROW_H[hr] + 4, below: true, busy: inRow(hr + 1).map(col) });
  for (const t of tries) {
    const lo = Math.max(0, ex - tw + 24), hi = Math.min(7 * CW - tw, ex - 24);   // the tip stays under the edge
    const xs = [ex - tw + 24, ...t.busy.flatMap(c => [(c + 1) * CW, c * CW - tw])].map(x => clamp(x, lo, hi)).sort((p, q) => Math.abs(p - ex + tw - 24) - Math.abs(q - ex + tw - 24));
    const x = xs.find(x => t.busy.every(c => x + tw <= c * CW + 4 || x >= (c + 1) * CW - 4));
    if (x !== undefined) return { x, y: t.y, below: t.below };
  }
  return null;
}

// Esc puts the stay back the way it is booked
root.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !drag) { ev.preventDefault(); glide(slot(base.in), slot(base.out)); } });

reset();
root.stay = { reset, handle, day: d => days[d - 1], nights: () => shown.out - shown.in };   // for scripted demos
