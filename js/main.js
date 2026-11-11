// PaprKoin — interactions and scroll choreography.
import { locateByIP, locateExactly, exactAlreadyAllowed, exactSupported, exactErrorMessage, fallbackLocation } from './geo.js';
import { guardComposer } from './composer-guard.js';
import { DESTS, EARTH, byId, KIND_LABEL, kmBetween, buildRows, loadPhotos, cardSrc } from './destinations.js';
import * as auth from './auth.js';
import { createMiniGlobe } from './mini-globe.js';
import { initCheckout } from './checkout.js';
import { newOrderId, saveOrder } from './orders.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileMQ = matchMedia('(max-width: 899px)');
const { gsap, ScrollTrigger } = window;
const hasGsap = !!(gsap && ScrollTrigger);
if (reduced) document.documentElement.classList.add('reduced');
if (hasGsap) gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ toasts */
// One message at a time: a new one waits until the current one has gone, the
// same message is never shown twice in a row, and at most two wait in line.
const toastQueue = [];
let toastNow = null;
function toast(msg, { error = false, ms = 3400 } = {}) {
  if (toastNow?.msg === msg || toastQueue.some((t) => t.msg === msg)) return;
  toastQueue.push({ msg, error, ms });
  if (toastQueue.length > 2) toastQueue.shift();
  if (!toastNow) nextToast();
}
function nextToast() {
  toastNow = toastQueue.shift() || null;
  if (!toastNow) return;
  const el = document.createElement('div');
  el.className = 'toast' + (toastNow.error ? ' is-error' : '');
  el.textContent = toastNow.msg;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    let gone = false;
    const done = () => { if (gone) return; gone = true; el.remove(); nextToast(); };
    el.classList.add('is-out');
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 450); // in case the exit animation doesn't run
  }, toastNow.ms);
}

/* -------------------------------------------------------------------- theme */
function initTheme() {
  const root = document.documentElement;
  const btns = $$('[data-theme-toggle]');
  const meta = $('meta[name="theme-color"]');
  const sync = () => {
    const dark = root.dataset.theme === 'dark';
    btns.forEach((b) => b.setAttribute('aria-pressed', String(dark)));
    meta?.setAttribute('content', dark ? '#0D1526' : '#DCE6EC');
  };
  sync();
  btns.forEach((b) => b.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = next; sync(); };
    try { localStorage.setItem('pk.theme', next); } catch { /* storage blocked */ }
    if (reduced || !document.startViewTransition) { apply(); return; }
    // the new theme spreads out from the toggle
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  }));
}

/* ------------------------------------------------------------ smooth scroll */
let lenis = null;
let closeMenu = () => {};
let go = (target) => {
  if (lenis) lenis.scrollTo(target, { duration: 1.4 });
  else if (typeof target === 'number') window.scrollTo({ top: target });
  else target.scrollIntoView();
};
function initScroll() {
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4) });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    go(id === '#home' ? 0 : target);
    history.replaceState(null, '', id);
  });
  $('#toTop').addEventListener('click', () => go(0));
}

/* --------------------------------------------------------------------- nav */
function initNav() {
  const nav = $('#nav');
  const links = $$('.nav-links a');
  const setActive = (id) => links.forEach((a) => {
    const on = a.dataset.nav === id;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
  setActive('home');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id === 'intro' ? 'home' : en.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('[data-section]').forEach((s) => io.observe(s));

  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 16);
    const pastHero = y > $('#home').offsetHeight - innerHeight;
    nav.classList.toggle('is-hidden', pastHero && y > lastY + 2 && $('#mobileMenu').hidden);
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('.nav-burger');
  const menu = $('#mobileMenu');
  burger.addEventListener('click', () => {
    if (menu.hidden) {
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
      lenis?.stop();
      document.body.style.overflow = 'hidden';
    } else closeMenu();
  });
  closeMenu = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    lenis?.start();
    document.body.style.overflow = '';
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}

/* -------------------------------------------------------------------- hero */
let globe = null;
let visitor = fallbackLocation();
let ipLoc = null;
const fmtCoord = (v, pos, neg) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;

function placeVisitor(loc, announce = true) {
  visitor = loc;
  const place = [loc.city, loc.country].filter(Boolean).join(', ');
  $('#pmCity').textContent = place;
  $('#pmCoords').textContent = `${fmtCoord(loc.lat, 'N', 'S')}, ${fmtCoord(loc.lon, 'E', 'W')}`;
  if (announce) {
    $('#locateText').textContent = loc.source === 'exact' ? `You're in ${loc.city}` : loc.source === 'ip' ? `You're near ${loc.city}` : `Showing ${loc.city}`;
    $('.locate').classList.add('is-found');
    // the exact-location button always stays; once exact, it offers a refresh
    $$('[data-exact]').forEach((b) => {
      b.hidden = !exactSupported();
      const label = $('span', b);
      if (label) label.textContent = loc.source === 'exact' ? 'Refresh my exact location' : 'Not right? Use my exact location';
    });
  }
  globe?.setTarget(loc);
  $$('[data-visitor-city]').forEach((el) => { el.textContent = loc.city || 'your town'; });
  const pmText = `SENT FROM ${(loc.city || 'your town').toUpperCase()} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} ·`;
  $$('#aaPostmark, [data-postmark-text]').forEach((el) => { el.textContent = pmText; });
  refreshDestinations();
}

/* ---------------------------------------------------------- journey */
// Message → Koin → destinations → send. Each Koin carries a set number of places.
const KOINS = {
  copper: { name: 'Copper Koin', max: 1 },
  silver: { name: 'Silver Koin', max: 4 },
  gold: { name: 'Gold Koin', max: 15 },
  legend: { name: 'Legend Koin', max: Infinity },
};
const journey = {
  sealed: false,     // Go pressed with a message in the box
  koin: null,        // 'copper' | 'silver' | 'gold' | 'legend'
  picks: [],         // destination ids, in the order chosen
  preselect: null,   // a place chosen from the billboard before a Koin
};
const goTo = (sel, pad = 80) => { const el = $(sel); if (el) go(Math.max(0, el.getBoundingClientRect().top + scrollY - pad)); };
const journeyMax = () => (journey.koin ? KOINS[journey.koin].max : 0);
const pickedPlaces = () => journey.picks.map(byId).filter(Boolean);
let refreshDestinations = () => {};
let syncPicks = () => {};       // set by the destinations section
let updateTray = () => {};      // set by the journey bar
let sendJourney = () => {};     // set by the composer
let resetComposer = () => {};
let openCheckout = async () => null;  // set at boot

async function useExactLocation() {
  const btns = $$('[data-exact]');
  const labels = btns.map((b) => $('span', b)?.textContent);
  btns.forEach((b) => { b.disabled = true; b.classList.add('is-busy'); const s = $('span', b); if (s) s.textContent = 'Finding you…'; });
  try {
    const loc = await locateExactly({ fresh: true });
    placeVisitor(loc);
    const within = loc.accuracy ? (loc.accuracy < 1000 ? ` (accurate to about ${Math.max(10, Math.round(loc.accuracy / 10) * 10)} m)` : ` (accurate to about ${Math.round(loc.accuracy / 1000)} km)`) : '';
    toast(`Location updated to ${loc.city}${within}.`);
  } catch (e) {
    btns.forEach((b, i) => { const s = $('span', b); if (s && labels[i]) s.textContent = labels[i]; });
    toast(exactErrorMessage(e), { error: true, ms: 7000 });
  } finally {
    btns.forEach((b) => { b.disabled = false; b.classList.remove('is-busy'); });
  }
}

// letters settle one by one, like a message being decrypted
function decodeIn(els) {
  const glyphs = 'ABCDEF0123456789#%&*+=/';
  els.forEach((el) => {
    const final = el.dataset.final || el.textContent;
    el.dataset.final = final;
    if (reduced) { el.textContent = final; return; }
    const t0 = performance.now();
    const D = 700;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / D);
      const n = Math.floor(final.length * p);
      let s = final.slice(0, n);
      for (let i = n; i < final.length; i++) s += final[i] === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0];
      el.textContent = s;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function initHero() {
  const hero = $('#home');
  try {
    const mod = await import('./globe.js');
    globe = mod.createGlobe({ canvas: $('#globe'), pinEl: $('#postmark'), reduced });
  } catch (e) {
    console.warn('[hero] globe unavailable', e);
  }
  if (!globe) document.documentElement.classList.add('no-webgl');
  placeVisitor(visitor, false);

  (async () => {
    ipLoc = await locateByIP();
    placeVisitor(ipLoc);
    if (await exactAlreadyAllowed()) {
      try { placeVisitor(await locateExactly()); } catch { /* keep the IP result */ }
    }
  })();
  $$('[data-exact]').forEach((b) => b.addEventListener('click', useExactLocation));

  const ht1 = $('.ht-1'), ht2 = $('.ht-2');
  const status = $('.hero-status');
  const fades = [status];
  const lock = $('#postmark');
  const composer = $('#composer');
  let decoded = false;

  const frame = (p) => {
    globe?.setProgress(p);
    const e = smooth(0, 0.2, p);
    ht1.style.transform = `translate3d(${(-e * 30).toFixed(2)}vw, ${(-e * 4).toFixed(2)}vh, 0)`;
    ht2.style.transform = `translate3d(${(e * 30).toFixed(2)}vw, ${(-e * 4).toFixed(2)}vh, 0)`;
    const w0 = mobileMQ.matches ? 84 : 130;
    const wd = (w0 - e * (w0 - 50)).toFixed(1);
    ht1.style.setProperty('--wd', wd);
    ht2.style.setProperty('--wd', wd);
    ht1.style.opacity = ht2.style.opacity = String(1 - e);
    const f = 1 - smooth(0, 0.1, p);
    fades.forEach((el) => { el.style.opacity = String(f); });
    status.style.pointerEvents = f < 0.3 ? 'none' : '';
    lock.classList.toggle('is-stamped', p > 0.68);
    const c = smooth(0.72, 0.95, p);
    composer.style.setProperty('--pc-y', `${((1 - c) * 125).toFixed(2)}%`);
    composer.inert = c < 0.96;
    if (c > 0.6 && !decoded) { decoded = true; decodeIn($$('[data-decode]', composer)); }
  };

  if (reduced || !hasGsap) {
    frame(1);
    composer.style.setProperty('--pc-y', '0%');
  } else {
    frame(0);
    ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: (s) => frame(s.progress) });
  }
  setupComposer();
}

/* -------------------------------------------------------- encryption */
const enc = { key: null, iv: null };
const b64 = (u8) => { let s = ''; u8.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };

async function initCrypto() {
  if (!window.crypto?.subtle) return false;
  enc.key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  enc.iv = crypto.getRandomValues(new Uint8Array(12)); // preview only; every send uses a fresh IV
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', enc.key));
  const fp = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  const hex = [...fp.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  $('#keyFp').textContent = hex.match(/.{4}/g).join(' ');
  return true;
}
const encrypt = async (text, iv) => b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, enc.key, new TextEncoder().encode(text))));

// ghost prompts that type themselves while the box is empty
function rotatePrompts(form) {
  const el = $('#promptText');
  const prompts = [
    'A wish for someone you love',
    'A memory you never want to lose',
    'A prayer for the road ahead',
    'A tribute to someone who shaped you',
    'A message straight from the heart',
  ];
  if (reduced) { el.textContent = prompts[0]; return; }
  let p = 0, i = 0, dir = 1;
  const tick = () => {
    let delay = dir > 0 ? 55 : 25;
    if (form.classList.contains('is-idle')) {
      i += dir;
      el.textContent = prompts[p].slice(0, i);
      if (dir > 0 && i >= prompts[p].length) { dir = -1; delay = 1800; }
      else if (dir < 0 && i <= 0) { dir = 1; p = (p + 1) % prompts.length; delay = 350; }
    } else delay = 400;
    setTimeout(tick, delay);
  };
  tick();
}

function setupComposer() {
  const form = $('#composer');
  const note = $('#note');
  const field = $('#noteField');
  const count = $('#noteCount');
  const num = $('b', count);
  const sr = $('#noteCountSr');
  const goBtn = $('#goBtn');
  const card = $('#pcCard');
  const front = $('.cx-front');
  const back = $('.cx-back');
  const out = $('#cipherOut');
  const idle = '';
  const ring = $('#ringFg');
  const MAX = 200;
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $('#kbdMod').textContent = '⌘';
  let warnTimer;
  let announced = '';
  let cryptoOk = false;
  const cryptoReady = initCrypto().then((ok) => { cryptoOk = ok; if (!ok) out.textContent = 'Encryption needs a secure (https) connection.'; }).catch(() => {});

  // ciphertext preview: unchanged bytes stay put, the changed tail scrambles in
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let shown = '';
  let raf = 0;
  let seq = 0;
  const paint = (next) => {
    cancelAnimationFrame(raf);
    if (!next) { out.innerHTML = idle; shown = ''; return; }
    let k = 0;
    while (k < next.length && k < shown.length && next[k] === shown[k]) k++;
    const stable = document.createTextNode(next.slice(0, k));
    const hot = Object.assign(document.createElement('span'), { className: 'hot' });
    const tail = next.slice(k);
    out.replaceChildren(stable, hot);
    shown = next;
    const t0 = performance.now();
    const D = reduced ? 0 : 280;
    const step = (now) => {
      const p = D ? Math.min(1, (now - t0) / D) : 1;
      const n = Math.floor(tail.length * p);
      let s = tail.slice(0, n);
      for (let i = n; i < tail.length; i++) s += glyphs[(Math.random() * glyphs.length) | 0];
      hot.textContent = s;
      if (p < 1) raf = requestAnimationFrame(step);
      else out.replaceChildren(document.createTextNode(next));
    };
    raf = requestAnimationFrame(step);
  };
  const preview = async (value) => {
    const my = ++seq;
    await cryptoReady;
    if (!cryptoOk) return;
    const ct = value ? await encrypt(value, enc.iv) : '';
    if (my === seq) paint(ct);
  };

  // same sheet throughout; the first keystroke unfolds the seal line and the route
  const more = $('#cxMore');
  let writing = null;
  const setWriting = (on) => {
    if (on === writing) return;
    writing = on;
    form.classList.toggle('is-writing', on);
    form.classList.toggle('is-idle', !on);
    more.inert = !on;
  };

  const render = (value) => {
    setWriting(value.length > 0);
    const left = MAX - value.length;
    num.textContent = left;
    ring.style.strokeDashoffset = String(left);
    count.classList.toggle('is-low', left <= 20);
    goBtn.disabled = value.trim().length === 0;
    if (left === 20 || left === 0) {
      const msg = left === 0 ? 'Character limit reached.' : '20 characters left.';
      if (msg !== announced) { sr.textContent = msg; announced = msg; }
    }
    preview(value);
  };

  const guard = guardComposer(note, {
    onChange: render,
    onBlocked: (reason) => {
      const warn = $('#pasteWarn');
      warn.textContent = reason === 'copy' ? 'Copy blocked. Your words stay on this screen.'
        : reason === 'menu' ? 'Right-click is off here. Type it, every letter.'
        : 'Paste blocked. Type it, every letter.';
      sr.textContent = warn.textContent;
      field.classList.add('is-blocked');
      clearTimeout(warnTimer);
      warnTimer = setTimeout(() => field.classList.remove('is-blocked'), 2600);
    },
  });
  render('');
  rotatePrompts(form);

  note.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); return; }
    if (note.value.length >= MAX && e.key.length === 1 && !e.metaKey && !e.ctrlKey && note.selectionStart === note.selectionEnd) {
      count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
    }
  });

  const checkNote = () => {
    const text = note.value.trim();
    if (!text) return null;
    if (!guard.isIntact()) { toast('This note wasn’t typed in the box, so it can’t be sent. Type it again.', { error: true }); guard.reset(); return null; }
    return text;
  };
  const press = async () => {
    goBtn.disabled = true;
    goBtn.classList.add('is-pressing');
    await wait(reduced ? 0 : 300);
    goBtn.classList.remove('is-pressing');
    goBtn.disabled = !note.value.trim();
  };

  // Go: with a Koin and places already chosen it sends; otherwise it seals the
  // message and moves on to the next step of the journey
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkNote()) return;
    if (journey.koin && journey.picks.length) { sendJourney(); return; }
    await press();
    journey.sealed = true;
    updateTray();
    if (journey.koin) {
      toast(`Sealed. Now choose ${journeyMax() === 1 ? 'the destination' : 'the destinations'} for your ${KOINS[journey.koin].name}.`);
      goTo('#destRows', 96);
    } else {
      toast('Sealed. Now choose the Koin that carries it.');
      goTo('.plan-group', 84);
    }
  });

  const describe = (list) => (journey.koin === 'legend' ? `all ${list.length} destinations`
    : list.length === 1 ? `${list[0].name}, ${list[0].where}`
    : `${list[0].name} and ${list.length - 1} more`);

  sendJourney = async () => {
    const text = checkNote();
    const list = pickedPlaces().filter((d) => d.lat !== null);
    if (!text) {
      toast('Write your message, then press Go to send it.');
      const hero = $('#home');
      go(hero.offsetTop + hero.offsetHeight - innerHeight);
      setTimeout(() => note.focus({ preventScroll: true }), reduced ? 50 : 1400);
      return;
    }
    if (!list.length) { toast('Choose at least one destination first.'); return; }

    // seal first, then pay; the journey only sets off once payment succeeds
    await cryptoReady;
    let sealed = '';
    if (cryptoOk) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      sealed = await encrypt(text, iv);
      // TODO: POST { iv: b64(iv), ciphertext: sealed, typedChars: guard.typedChars(), from: visitor.city, koin: journey.koin, to: journey.picks } to your API.
    }
    const order = {
      id: newOrderId(), koin: journey.koin, picks: list.map((d) => d.id), message: text, sealed,
      from: { city: visitor.city, country: visitor.country, lat: visitor.lat, lon: visitor.lon },
      createdAt: new Date().toISOString(),
    };
    const user = auth.currentUser();
    const result = await openCheckout(order, { name: user?.name, email: user?.email });
    if (!result || !result.paid) return; // closed, or on its way to Stripe

    const hero = $('#home');
    go(hero.offsetTop + hero.offsetHeight - innerHeight);
    await press();
    const where = describe(list);
    $('#sentQuote').textContent = sealed;
    $('#sentFrom').textContent = visitor.city;
    $('#sentTo').textContent = where;
    $('#sentStatus').textContent = list.length === 1 ? `Sealed and on its way to ${list[0].name}` : `Sealed and on its way to ${list.length} destinations`;
    back.hidden = false;
    front.inert = true;
    journey.sent = true;
    updateTray(`On its way to ${list.length === 1 ? list[0].name : `${list.length} destinations`}`);
    requestAnimationFrame(() => { card.classList.add('is-flipped'); form.classList.add('is-sent'); });
    await wait(reduced ? 0 : 700);
    // the globe only animates on screen, so never wait on it for longer than the flight takes
    const flight = globe ? globe.sendKoin(visitor, list.map((d) => [d.name, d.lat, d.lon, d.where])) : wait(2500);
    await Promise.race([flight, wait(8000 + list.length * 60)]);
    const done = list.length === 1 ? `Delivered to ${list[0].name}` : `Delivered to ${list.length} destinations`;
    $('#sentStatus').textContent = `${done}. Opening your journey…`;
    updateTray(done);
    saveOrder(Object.assign(order, { deliveredAt: new Date().toISOString() }));
    await wait(reduced ? 300 : 1800);
    location.href = `journey.html?order=${encodeURIComponent(order.id)}`;
  };

  resetComposer = () => {
    card.classList.remove('is-flipped');
    form.classList.remove('is-sent');
    globe?.resetSend();
    guard.reset();
    front.inert = false;
    setTimeout(() => { back.hidden = true; }, reduced ? 0 : 800);
  };

  $('#writeAnother').addEventListener('click', () => {
    resetComposer();
    endJourney();
    setTimeout(() => note.focus({ preventScroll: true }), reduced ? 0 : 800);
  });
}

/* ------------------------------------------- journey: Koin, places, bar */
function chooseKoin(id) {
  const k = KOINS[id];
  if (!k) return;
  if (journey.koin === 'legend' && id !== 'legend') journey.picks = []; // leaving "everything" starts a fresh choice
  journey.koin = id;
  if (id === 'legend') {
    journey.picks = EARTH.map((d) => d.id);
  } else {
    const keep = journey.picks.slice(0, k.max);
    if (journey.preselect && !keep.includes(journey.preselect) && keep.length < k.max) keep.unshift(journey.preselect);
    journey.picks = keep.slice(0, k.max);
  }
  $$('.coins .cp').forEach((c) => c.classList.toggle('is-chosen', c.dataset.coin === id));
  $$('[data-koin]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.koin === id)));
  $('#planCue').hidden = true;
  syncPicks();
  updateTray();
  toast(id === 'legend' ? 'Legend Koin chosen. Every destination is included.'
    : `${k.name} chosen. Pick ${k.max === 1 ? '1 destination' : `up to ${k.max} destinations`}.`);
  goTo('#destRows', 96);
}

function togglePick(id) {
  const d = byId(id);
  if (!journey.koin || !d) return;
  if (d.lat === null) { toast(`${d.name} is coming soon.`); return; }
  if (journey.koin === 'legend') { toast('Your Legend Koin already includes every destination.'); return; }
  const max = journeyMax();
  const i = journey.picks.indexOf(id);
  if (i >= 0) { journey.picks.splice(i, 1); toast(`${d.name} removed from your journey.`); }
  else if (max === 1) journey.picks = [id];           // Copper: tapping another place swaps it
  else if (journey.picks.length >= max) {
    toast(`Your ${KOINS[journey.koin].name} holds ${max} destinations. Remove one to add another.`, { error: true });
    return;
  } else journey.picks.push(id);
  syncPicks();
  updateTray();
}

function endJourney() {
  Object.assign(journey, { sealed: false, koin: null, picks: [], preselect: null, sent: false });
  $$('.coins .cp').forEach((c) => c.classList.remove('is-chosen'));
  $$('[data-koin]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  syncPicks();
  updateTray();
}

function initJourney() {
  const tray = $('#jtray');
  const msg = $('#jtMsg');
  const send = $('#jtSend');
  const steps = { message: $('[data-step="message"]', tray), koin: $('[data-step="koin"]', tray), dest: $('[data-step="dest"]', tray) };
  let hideTimer = 0;

  $$('[data-koin]').forEach((b) => b.addEventListener('click', () => chooseKoin(b.dataset.koin)));

  const setStep = (el, state) => { el.dataset.state = state; };
  updateTray = (status) => {
    clearTimeout(hideTimer);
    const active = journey.sealed || journey.koin || journey.sent;
    document.documentElement.classList.toggle('has-tray', !!active);
    tray.hidden = !active;
    $('#planCue').hidden = !(journey.sealed && !journey.koin);
    if (!active) return;
    const hasNote = !!$('#note').value.trim();
    const n = journey.picks.length;
    const max = journeyMax();
    const koin = journey.koin && KOINS[journey.koin];
    setStep(steps.message, journey.sealed || hasNote ? 'done' : 'todo');
    setStep(steps.koin, koin ? 'done' : 'now');
    setStep(steps.dest, !koin ? 'todo' : n ? 'done' : 'now');
    $('#jtKoin').textContent = koin ? koin.name : 'Koin';
    $('#jtDest').textContent = !koin ? 'Destinations' : journey.koin === 'legend' ? `All ${n}` : `${n} of ${max}`;
    if (status) {
      msg.textContent = status;
    } else if (!koin) {
      msg.textContent = 'Choose the Koin that carries your message.';
    } else if (journey.koin === 'legend') {
      msg.textContent = `Every destination is included, all ${n} of them.`;
    } else if (!n) {
      msg.textContent = max === 1 ? 'Choose 1 destination below.' : `Choose up to ${max} destinations below.`;
    } else {
      const names = pickedPlaces().map((d) => d.name);
      const left = max - n;
      msg.textContent = `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` and ${names.length - 2} more` : ''}${left > 0 ? `. ${left} more ${left === 1 ? 'place' : 'places'} available.` : '.'}`;
    }
    send.disabled = !!journey.sent || !koin || !n;
    $('span', send).textContent = hasNote ? 'Send my message' : 'Write my message';
    $('#jtChange').hidden = !koin || !!journey.sent;
    // once sent, the message box carries the status, so the bar steps out of the way
    if (journey.sent) hideTimer = setTimeout(() => { tray.classList.add('is-leaving'); setTimeout(() => { tray.classList.remove('is-leaving'); endJourney(); }, 400); }, 1800);
  };

  send.addEventListener('click', () => sendJourney());
  $('#jtChange').addEventListener('click', () => goTo('.plan-group', 84));
  $('#jtCancel').addEventListener('click', () => { endJourney(); toast('Journey cleared. Your message is still in the box.'); });
  $('#note').addEventListener('input', () => { if (!tray.hidden) updateTray(); });
  updateTray();
}

/* ------------------------------------------------------ airmail route */
function initRoute() {
  const route = $('#route');
  const svg = $('#routeSvg');
  const ghost = $('#routeGhost');
  const ink = $('#routeInk');
  const reveal = $('#routeReveal');
  const mask = $('#routeMask');
  const env = $('#routeEnv');
  const steps = $$('.rstep');
  let len = 0;
  let stepY = [];

  const build = () => {
    const rr = route.getBoundingClientRect();
    const w = rr.width, h = rr.height;
    const pts = steps.map((s) => {
      const n = $('.rstep-n', s).getBoundingClientRect();
      return { x: n.left - rr.left + n.width / 2, y: n.top - rr.top + n.height / 2 };
    });
    stepY = pts.map((p) => p.y);
    let d = `M ${pts[0].x} 0 L ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dy = b.y - a.y;
      d += ` C ${a.x} ${a.y + dy * 0.6}, ${b.x} ${b.y - dy * 0.6}, ${b.x} ${b.y}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x} ${h}`;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    [ghost, ink, reveal].forEach((p) => p.setAttribute('d', d));
    Object.entries({ maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h }).forEach(([k, v]) => mask.setAttribute(k, v));
    len = reveal.getTotalLength();
    reveal.style.strokeDasharray = `${len}`;
  };

  const draw = (p) => {
    if (!len) return;
    reveal.style.strokeDashoffset = String(len * (1 - p));
    const at = reveal.getPointAtLength(len * p);
    const ahead = reveal.getPointAtLength(Math.min(len, len * p + 2));
    const ang = Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180 / Math.PI;
    env.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) rotate(${(ang - 90) * 0.25}deg)`;
    steps.forEach((s, i) => s.classList.toggle('is-reached', at.y >= stepY[i] - 4));
  };

  build();
  window.addEventListener('resize', () => { build(); ScrollTrigger?.refresh(); });
  document.fonts?.ready.then(build);
  if (reduced || !hasGsap) { draw(1); return; }
  draw(0);
  ScrollTrigger.create({ trigger: route, start: 'top 65%', end: 'bottom 65%', onUpdate: (s) => draw(s.progress), onRefresh: (s) => { build(); draw(s.progress); } });
}

/* ------------------------------------------------------ destinations */
const fmtKm = (k) => (k < 10 ? 'Right on your doorstep' : `${Math.round(k).toLocaleString('en-GB')} km from ${visitor.city || 'you'}`);
const svgIcon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

function initDestinations() {
  const rowsEl = $('#destRows');
  const bill = $('#bill');
  const img = $('#billImg');
  let photoMap = new Map();
  let rows = [];
  let featured = null;
  let topIds = [];
  let lastKey = '';

  const setImg = (el, src, fallback) => {
    if (!src) return;
    el.classList.remove('is-in');
    el.onload = () => el.classList.add('is-in');
    el.onerror = () => { if (fallback && el.src !== fallback) el.src = fallback; };
    el.src = src;
    if (el.complete && el.naturalWidth) el.classList.add('is-in');
  };

  const feature = (d, tag, animate = true) => {
    featured = d;
    if (animate && !reduced) { bill.classList.remove('is-swapping'); void bill.offsetWidth; bill.classList.add('is-swapping'); }
    $('#billTag').textContent = tag || KIND_LABEL[d.kind];
    $('#billName').textContent = d.name;
    $('#billBlurb').textContent = d.blurb;
    const meta = [KIND_LABEL[d.kind], d.where];
    if (d.lat !== null) meta.push(fmtKm(kmBetween(visitor, d)));
    $('#billMeta').replaceChildren(...meta.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    paintBill();
    img.alt = '';
    setImg(img, photoMap.get(d.id), cardSrc(photoMap.get(d.id)));
    if (!photoMap.get(d.id)) img.classList.remove('is-in');
    $$('.dcard', $('#destinations')).forEach((c) => c.setAttribute('aria-current', String(c.dataset.id === d.id)));
  };

  const card = (d, i, row) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dcard' + (row.top ? ' is-top' : '');
    b.dataset.id = d.id;
    b.setAttribute('aria-current', 'false');
    const where = d.lat === null ? d.where : fmtKm(kmBetween(visitor, d));
    b.setAttribute('aria-label', `${d.name}, ${d.where}. ${row.top ? `Number ${i + 1}. ` : ''}${row.soon ? 'Coming soon.' : where}`);
    b.innerHTML = `
      ${row.top ? `<span class="dcard-rank" aria-hidden="true">${i + 1}</span>` : ''}
      <span class="dcard-img" data-kind="${d.kind}" aria-hidden="true">
        <span class="dcard-ini">${d.name.replace(/^The /, '')[0]}</span>
        <img alt="" loading="lazy" decoding="async">
        ${row.soon ? '<span class="dcard-soon">Coming soon</span>' : '<span class="dcard-pick"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>'}
        <span class="dcard-copy"><b></b><span></span><span class="dcard-km"></span></span>
      </span>`;
    $('.dcard-copy b', b).textContent = d.name;
    $('.dcard-copy span', b).textContent = d.where;
    $('.dcard-km', b).textContent = d.lat === null ? KIND_LABEL[d.kind] : where;
    const src = photoMap.get(d.id);
    if (src) setImg($('img', b), cardSrc(src), src);
    li.append(b);
    return li;
  };

  const arrows = (track, prev, next) => {
    const upd = () => {
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
    };
    const by = (dir) => track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: reduced ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => by(-1));
    next.addEventListener('click', () => by(1));
    track.addEventListener('scroll', upd, { passive: true });
    new ResizeObserver(upd).observe(track);
    upd();
  };

  const render = () => {
    rows = buildRows(visitor);
    topIds = rows[0].items.map((d) => d.id);
    rowsEl.replaceChildren(...rows.map((row) => {
      const sec = document.createElement('section');
      sec.className = 'drow';
      sec.setAttribute('aria-labelledby', `drow-${row.id}`);
      sec.innerHTML = `
        <h3 class="drow-title" id="drow-${row.id}"></h3>
        <div class="drow-view">
          <button class="drow-arrow is-prev" type="button" aria-label="Scroll back">${svgIcon('M15 5l-7 7 7 7')}</button>
          <ul class="drow-track"></ul>
          <button class="drow-arrow is-next" type="button" aria-label="Scroll forward">${svgIcon('M9 5l7 7-7 7')}</button>
        </div>`;
      $('.drow-title', sec).textContent = row.title;
      const track = $('.drow-track', sec);
      track.append(...row.items.map((d, i) => card(d, i, row)));
      arrows(track, $('.is-prev', sec), $('.is-next', sec));
      return sec;
    }));
    feature(rows[0].items[0], `Top pick near ${visitor.city || 'you'}`, false);
    index();
    buildChips();
    applyFilter();
  };

  // the billboard button follows the journey: write here, add, remove, or included
  const paintBill = () => {
    if (!featured) return;
    const write = $('#billWrite');
    const label = $('span', write);
    const soon = featured.lat === null;
    const picked = journey.picks.includes(featured.id);
    write.disabled = soon || journey.koin === 'legend';
    write.classList.toggle('is-picked', picked);
    label.textContent = soon ? 'Coming soon'
      : journey.koin === 'legend' ? 'Included with Legend'
      : journey.koin ? (picked ? 'Remove from my journey' : 'Add to my journey')
      : 'Write a message here';
  };

  const sec = $('#destinations');
  const lede = $('#destsLede');
  const ledeHome = lede.innerHTML;
  syncPicks = () => {
    const picking = !!journey.koin;
    const max = journeyMax();
    sec.classList.toggle('is-picking', picking);
    sec.classList.toggle('is-full', picking && journey.koin !== 'legend' && max > 1 && journey.picks.length >= max);
    sec.classList.toggle('is-legend', journey.koin === 'legend');
    $$('.dcard', sec).forEach((c) => {
      const on = journey.picks.includes(c.dataset.id);
      c.classList.toggle('is-picked', picking && on);
      if (picking && byId(c.dataset.id)?.lat !== null) c.setAttribute('aria-pressed', String(on)); else c.removeAttribute('aria-pressed');
    });
    if (!picking) lede.innerHTML = ledeHome;
    else {
      const k = KOINS[journey.koin];
      lede.textContent = journey.koin === 'legend' ? `Your Legend Koin includes every destination, all ${journey.picks.length} of them.`
        : max === 1 ? 'Choose 1 destination for your Copper Koin, from any category. Tap another to swap.'
        : `Choose up to ${max} destinations for your ${k.name}, from any category. ${journey.picks.length} chosen so far.`;
    }
    // your picks, gathered from every category, each with a way to take it back
    const strip = $('#destPicked');
    strip.hidden = !picking || journey.koin === 'legend' || !journey.picks.length;
    strip.replaceChildren(...(strip.hidden ? [] : pickedPlaces().map((d) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dpick-chip';
      b.dataset.remove = d.id;
      b.setAttribute('aria-label', `Remove ${d.name}`);
      b.innerHTML = '<span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
      $('span', b).textContent = d.name;
      li.append(b);
      return li;
    })));
    paintBill();
  };
  $('#destPicked').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (b) togglePick(b.dataset.remove);
  });

  /* ---- search and categories: matches names, countries, kinds and category names */
  const rowsWrap = rowsEl;
  const grid = $('#destGrid');
  const results = $('#destResults');
  const resultsTitle = $('#destResultsTitle');
  const search = $('#destSearch');
  const clearBtn = $('#destSearchClear');
  const filtersEl = $('#destFilters');
  const filter = { q: '', cat: 'all' };
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let haystack = new Map();
  function index() {
    haystack = new Map(DESTS.map((d) => [d.id, fold([d.name, d.where, KIND_LABEL[d.kind], d.blurb].join(' '))]));
    rows.forEach((r) => r.items.forEach((d) => haystack.set(d.id, `${haystack.get(d.id)} ${fold(r.title)} ${fold(r.chip)}`)));
  }
  function buildChips() {
    const list = [{ id: 'all', chip: 'All', items: null }, ...rows.filter((r) => r.chip)];
    filtersEl.replaceChildren(...list.map((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dchip';
      b.dataset.cat = r.id;
      b.append(document.createTextNode(r.chip));
      if (r.items) b.append(Object.assign(document.createElement('span'), { textContent: r.items.length }));
      return b;
    }));
  }
  function applyFilter() {
    const raw = filter.q.trim();
    const q = fold(raw);
    clearBtn.hidden = !filter.q;
    search.closest('.dsearch').classList.toggle('has-text', !!filter.q);
    sec.classList.toggle('is-searching', !!q); // results take the billboard's place while searching
    $$('.dchip', filtersEl).forEach((b) => b.setAttribute('aria-pressed', String(!q && b.dataset.cat === filter.cat)));
    if (q) {
      const words = q.split(/\s+/);
      const hits = DESTS.filter((d) => words.every((w) => (haystack.get(d.id) || '').includes(w)))
        .sort((a, b) => (fold(b.name).startsWith(q) - fold(a.name).startsWith(q)) || (b.lat !== null) - (a.lat !== null) || b.pop - a.pop);
      resultsTitle.textContent = hits.length
        ? `${hits.length} ${hits.length === 1 ? 'place matches' : 'places match'} “${raw}”`
        : `No places match “${raw}”. Try a country, a landmark, or a category such as sacred.`;
      grid.replaceChildren(...hits.map((d, i) => card(d, i, { soon: d.lat === null })));
      results.hidden = false;
      rowsWrap.hidden = true;
    } else {
      results.hidden = true;
      grid.replaceChildren();
      rowsWrap.hidden = false;
      rowsWrap.classList.toggle('is-filtered', filter.cat !== 'all');
      $$('.drow', rowsWrap).forEach((s, i) => { s.hidden = filter.cat !== 'all' && rows[i]?.id !== filter.cat; });
    }
    syncPicks();
  }
  filtersEl.addEventListener('click', (e) => {
    const b = e.target.closest('.dchip');
    if (!b) return;
    filter.cat = b.dataset.cat;
    if (filter.q) { filter.q = ''; search.value = ''; }
    applyFilter();
  });
  search.addEventListener('input', () => { filter.q = search.value; applyFilter(); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.preventDefault(); search.value = ''; filter.q = ''; applyFilter(); } });
  clearBtn.addEventListener('click', () => { search.value = ''; filter.q = ''; applyFilter(); search.focus(); });
  // "/" jumps to search from anywhere on the page (not while typing)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    const r = search.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight) go(Math.max(0, r.top + scrollY - 120));
    search.focus({ preventScroll: true });
  });

  const onCard = (e) => {
    const c = e.target.closest('.dcard');
    if (!c) return;
    const d = byId(c.dataset.id);
    const rank = topIds.indexOf(d.id);
    if (journey.koin) { // picking: the tap chooses the place, and shows it without jumping away
      togglePick(d.id);
      // only refresh the billboard when it's on screen, so the rows don't shift under the finger
      if (bill.getBoundingClientRect().top >= 0) feature(d, rank >= 0 ? `Number ${rank + 1} near ${visitor.city || 'you'} today` : null);
      return;
    }
    if (filter.q) { search.value = ''; filter.q = ''; applyFilter(); } // bring the billboard back to show it
    feature(d, rank >= 0 ? `Number ${rank + 1} near ${visitor.city || 'you'} today` : null);
    const r = bill.getBoundingClientRect();
    if (r.top < 0 || r.top > innerHeight * 0.4) go(bill.getBoundingClientRect().top + scrollY - 80);
  };
  rowsEl.addEventListener('click', onCard);
  grid.addEventListener('click', onCard);

  $('#billNext').addEventListener('click', () => {
    const i = topIds.indexOf(featured?.id);
    const d = byId(topIds[(i + 1) % topIds.length]);
    feature(d, `Number ${topIds.indexOf(d.id) + 1} near ${visitor.city || 'you'} today`);
  });

  $('#billWrite').addEventListener('click', () => {
    if (!featured || featured.lat === null) return;
    if (journey.koin) { togglePick(featured.id); return; }
    journey.preselect = featured.id;
    const hero = $('#home');
    go(hero.offsetTop + hero.offsetHeight - innerHeight);
    const focus = () => $('#note').focus({ preventScroll: true });
    setTimeout(focus, reduced ? 50 : 1500);
    toast(`Writing to ${featured.name}. Press Go, then choose your Koin.`);
  });

  refreshDestinations = () => {
    const key = `${visitor.city}|${visitor.lat.toFixed(1)}|${visitor.lon.toFixed(1)}`;
    if (key === lastKey) return;
    lastKey = key;
    render();
  };
  refreshDestinations();

  // photos load once the section is near, for the whole list at once
  new IntersectionObserver((entries, io) => {
    if (!entries.some((en) => en.isIntersecting)) return;
    io.disconnect();
    loadPhotos().then((map) => {
      photoMap = map;
      $$('.dcard', $('#destinations')).forEach((c) => {
        const src = map.get(c.dataset.id);
        if (src) setImg($('img', c), cardSrc(src), src);
      });
      if (featured) setImg(img, map.get(featured.id), cardSrc(map.get(featured.id)));
    });
  }, { rootMargin: '600px 0px' }).observe($('#destinations'));
}

/* ------------------------------------------------------------- faq */
function initFaq() {
  $$('.qa button').forEach((btn) => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    btn.closest('.qa').classList.toggle('is-open', open);
    setTimeout(() => ScrollTrigger?.refresh(), 500);
  }));
}

/* ------------------------------------------------------------ forms */
function setErr(input, errEl, msg) {
  input.closest('.field').classList.toggle('has-error', !!msg);
  errEl.textContent = msg;
  input.setAttribute('aria-invalid', String(!!msg));
  if (msg) input.setAttribute('aria-describedby', errEl.id); else input.removeAttribute('aria-describedby');
  return !msg;
}

// "message" in the About letter gets rubber-stamped the first time it scrolls into view
function initStamp() {
  const stamp = $('#inkStamp');
  if (!stamp || reduced || !('IntersectionObserver' in window)) return;
  stamp.classList.add('is-ready');
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    stamp.classList.add('is-stamped');
    stamp.closest('.letter')?.classList.add('is-thud');
  }, { rootMargin: '0px 0px -25% 0px', threshold: 0.5 }).observe(stamp);
}

function initAuth() {
  const dlg = $('#authDialog');
  const form = $('#authForm');
  const pass = $('#aPass');
  const email = $('#aEmail');
  const name = $('#aName');
  const note = $('#authNote');
  const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const say = (msg) => { note.textContent = msg; note.hidden = !msg; };

  const art = $('.auth-art', dlg);
  const mini = createMiniGlobe($('#miniGlobe'), { home: () => visitor, places: EARTH, reduced });
  const strike = () => { art.classList.remove('is-stamping'); void art.offsetWidth; art.classList.add('is-stamping'); };

  const setMode = (mode, { keepNote = false } = {}) => {
    const changed = dlg.dataset.mode && dlg.dataset.mode !== mode;
    dlg.dataset.mode = mode;
    const up = mode === 'signup';
    mini?.setCount(up ? 5 : 4);
    if (changed && dlg.open) strike();
    $('#authTitle').textContent = up ? 'Create your account' : 'Welcome back!';
    $('#authSub').textContent = up ? 'One account for every journey you send.' : 'Pick up where your words left off.';
    $('#authHint').textContent = up
      ? 'Quicker: Google and Facebook set up your account in one step.'
      : 'New here? Google and Facebook create your account as you sign in.';
    $('#authSubmitLabel').textContent = up ? 'Create account' : 'Sign in';
    pass.autocomplete = up ? 'new-password' : 'current-password';
    if (!keepNote) say('');
    [name, email, pass].forEach((el) => { const f = el.closest('.field'); if (f.classList.contains('has-error')) setErr(el, $('.field-err', f), ''); });
  };

  // signed-in look across the page
  const acct = $('#acct');
  const menuBtn = $('#acctBtn');
  const menu = $('#acctMenu');
  const paint = () => {
    const u = auth.currentUser();
    document.documentElement.dataset.signedIn = u ? 'true' : 'false';
    if (!u) return;
    const shown = u.name || u.email.split('@')[0];
    $('#acctName').textContent = first(shown);
    $('#acctFull').textContent = shown;
    $('#acctEmail').textContent = u.email;
    $('#acctVia').textContent = `Signed in with ${u.provider === 'Email' ? 'email' : u.provider}`;
    $('#acctIni').textContent = shown[0].toUpperCase();
    const img = $('#acctImg');
    img.hidden = !u.picture;
    if (u.picture) { img.referrerPolicy = 'no-referrer'; img.src = u.picture; }
    $$('[data-acct-name]').forEach((el) => { el.textContent = shown; });
  };
  const closeAcct = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => { if (!acct.contains(e.target)) closeAcct(); });
  acct.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAcct(); menuBtn.focus(); } });
  $$('[data-signout]').forEach((b) => b.addEventListener('click', () => {
    auth.signOut();
    closeAcct();
    closeMenu();
    paint();
    toast('Signed out. Your words are safe.');
  }));

  const welcome = ({ user, isNew }) => {
    dlg.close();
    form.reset();
    paint();
    const n = first(user.name);
    toast(isNew ? `Welcome to PaprKoin${n ? `, ${n}` : ''}. Your account is ready.` : `Welcome back${n ? `, ${n}` : ''}.`);
  };

  $$('[data-provider]', dlg).forEach((b) => b.addEventListener('click', async () => {
    const p = b.dataset.provider;
    if (!auth.isOn(p)) {
      toast(`${p} sign-in isn’t switched on yet. Use your email for now.`);
      console.info(`[PaprKoin] Add your ${p === 'Google' ? 'Google client ID' : 'Facebook app ID'} in js/auth-config.js to switch on ${p} sign-in.`);
      return;
    }
    b.setAttribute('aria-busy', 'true');
    try {
      welcome(await auth.signInWith(p));
    } catch (err) {
      if (!/closed|popup|access_denied/i.test(err.message)) toast(`${p} couldn’t sign you in. Try again, or use your email.`, { error: true });
    } finally {
      b.removeAttribute('aria-busy');
    }
  }));

  $('#forgotBtn').addEventListener('click', () => {
    if (!/^\S+@\S+\.\S+$/.test(email.value)) { setErr(email, $('#aEmailErr'), 'Enter your email address first, then we can send a reset link.'); email.focus(); return; }
    setErr(email, $('#aEmailErr'), '');
    toast(`We’ll send a reset link to ${email.value} once email sign-in is connected to the server.`);
  });

  $$('[data-auth]').forEach((b) => b.addEventListener('click', () => {
    closeMenu();

    setMode('signin');
    dlg.showModal();
    strike();
    mini?.start();
    auth.warmUp();
    lenis?.stop();
  }));
  dlg.addEventListener('close', () => { lenis?.start(); mini?.stop(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
  $$('[data-mode]', dlg).forEach((b) => b.addEventListener('click', () => {
    setMode(b.dataset.mode);
    (b.dataset.mode === 'signup' ? name : email).focus();
  }));
  paint();
  const toggle = $('.pass-toggle', dlg);
  toggle.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const up = dlg.dataset.mode === 'signup';
    let ok = up ? setErr(name, $('#aNameErr'), name.value.trim() ? '' : 'Add your name so we know what to call you.') : true;
    ok = setErr(email, $('#aEmailErr'), /^\S+@\S+\.\S+$/.test(email.value) ? '' : 'Enter an email address like name@example.com.') && ok;
    ok = setErr(pass, $('#aPassErr'), pass.value.length >= 8 ? '' : 'Use at least 8 characters.') && ok;
    if (!ok) { $('.has-error input', form)?.focus(); return; }
    const addr = email.value.trim();
    if (!up && !auth.isKnown(addr)) {
      // new here: same door, the form turns into sign-up and keeps what they typed
      setMode('signup', { keepNote: true });
      say(`No account for ${addr} yet. Add your name and we’ll create one.`);
      name.focus();
      return;
    }
    if (up && auth.isKnown(addr)) {
      setMode('signin', { keepNote: true });
      say(`${addr} already has an account. Sign in instead.`);
      pass.focus();
      return;
    }
    welcome(up ? await auth.emailSignUp(name.value.trim(), addr) : await auth.emailSignIn(addr));
  });
  [name, email, pass].forEach((el) => el.addEventListener('input', () => {
    const f = el.closest('.field');
    if (f.classList.contains('has-error')) setErr(el, $('.field-err', f), '');
  }));
}

function initContact() {
  const tag = $('#copyEmail');
  tag.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(tag.dataset.email); } catch { /* clipboard blocked */ }
    $('#copyStatus').textContent = 'Copied';
    setTimeout(() => { $('#copyStatus').textContent = 'Copy'; }, 2000);
  });
  const form = $('#contactForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = $('#cName'), m = $('#cEmail'), msg = $('#cMsg');
    let ok = setErr(n, $('#cNameErr'), n.value.trim() ? '' : 'Add your name so we know who to reply to.');
    ok = setErr(m, $('#cEmailErr'), /^\S+@\S+\.\S+$/.test(m.value) ? '' : 'Enter an email address like name@example.com.') && ok;
    ok = setErr(msg, $('#cMsgErr'), msg.value.trim().length >= 5 ? '' : 'Write a few words first.') && ok;
    if (!ok) { $('.has-error input, .has-error textarea', form)?.focus(); return; }
    form.reset();
    toast('Message sent. We reply within a day.');
  });
  $$('#contactForm input, #contactForm textarea').forEach((el) => el.addEventListener('input', () => {
    const f = el.closest('.field');
    if (f.classList.contains('has-error')) setErr(el, $('.field-err', f), '');
  }));
}

/* ------------------------------------------------------------- footer */
function initFooter() {
  // "Write a message" from the footer takes you back up to the message box
  $$('[data-write]').forEach((b) => b.addEventListener('click', () => {
    const hero = $('#home');
    go(hero.offsetTop + hero.offsetHeight - innerHeight);
    setTimeout(() => $('#note')?.focus({ preventScroll: true }), reduced ? 50 : 1500);
  }));

  const form = $('#ftNews');
  const email = $('#ftEmail');
  const err = $('#ftEmailErr');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = /^\S+@\S+\.\S+$/.test(email.value.trim());
    form.classList.toggle('has-error', !ok);
    email.setAttribute('aria-invalid', String(!ok));
    err.textContent = ok ? '' : 'Enter an email address like name@example.com.';
    if (!ok) { email.focus(); return; }
    // TODO: POST { email } to your mailing list provider.
    form.reset();
    toast('Thanks. We’ll write when new destinations arrive.');
  });
  email.addEventListener('input', () => { if (form.classList.contains('has-error')) { form.classList.remove('has-error'); err.textContent = ''; email.removeAttribute('aria-invalid'); } });

  // the sign-off postmark strikes the wordmark when it scrolls into view
  const sign = $('.ft-sign');
  if (!sign || reduced || !('IntersectionObserver' in window)) return;
  sign.classList.add('is-ready');
  new IntersectionObserver(([en], io) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    sign.classList.add('is-stamped');
  }, { threshold: 0.6 }).observe(sign);
}

/* -------------------------------------------------------------------- boot */
initTheme();
initScroll();
initNav();
initHero();
initRoute();
initDestinations();
initJourney();
initFaq();
initStamp();
initAuth();
initContact();
initFooter();
openCheckout = initCheckout({ onOpen: () => lenis?.stop(), onClose: () => lenis?.start(), reduced });
window.addEventListener('load', () => ScrollTrigger?.refresh());
