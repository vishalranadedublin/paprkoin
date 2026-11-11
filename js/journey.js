// PaprKoin journey page: reads the paid order saved at checkout, then builds a
// film for every destination and the certificate.
import { byId, loadPhotos, cardSrc } from './destinations.js';
import { loadOrder, saveOrder, takePending, lastOrderId } from './orders.js';
import { createJourneyVideo, loadImage } from './journey-video.js';
import { drawCertificate, downloadPNG, downloadPDF, save } from './certificate.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KOIN_NAME = { copper: 'Copper Koin', silver: 'Silver Koin', gold: 'Gold Koin', legend: 'Legend Koin' };
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5-12-7.5Z"/></svg>';
const DOWNLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';

// one message at a time, as on the home page
const toastQueue = [];
let toastNow = null;
function toast(msg, { error = false, ms = 3600 } = {}) {
  if (toastNow?.msg === msg || toastQueue.some((t) => t.msg === msg)) return;
  toastQueue.push({ msg, error, ms });
  if (toastQueue.length > 2) toastQueue.shift();
  if (!toastNow) nextToast();
}
function nextToast() {
  toastNow = toastQueue.shift() || null;
  if (!toastNow) return;
  const t = Object.assign(document.createElement('div'), { className: `toast${toastNow.error ? ' is-error' : ''}`, textContent: toastNow.msg });
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('is-out'); setTimeout(() => { t.remove(); nextToast(); }, 320); }, toastNow.ms);
}

/* theme toggle, same as the home page */
function initTheme() {
  const root = document.documentElement;
  const sync = () => $$('[data-theme-toggle]').forEach((b) => {
    const dark = root.dataset.theme === 'dark';
    b.setAttribute('aria-pressed', String(dark));
    b.setAttribute('aria-label', dark ? 'Light mode' : 'Dark mode');
  });
  sync();
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('pk.theme', root.dataset.theme); } catch { /* blocked */ }
    sync();
  }));
}

/* which journey: ?order=ID, or the pending order after returning from Stripe */
function resolveOrder() {
  const params = new URLSearchParams(location.search);
  let id = params.get('order');
  if (params.get('paid') === 'stripe') {
    const pending = takePending();
    const o = pending && loadOrder(pending);
    if (o) {
      const now = new Date().toISOString();
      Object.assign(o, { paid: true, payment: 'stripe', paidAt: o.paidAt || now, deliveredAt: o.deliveredAt || now, stripeSession: params.get('session') || '' });
      saveOrder(o);
      id = o.id;
    }
    history.replaceState(null, '', id ? `journey.html?order=${encodeURIComponent(id)}` : 'journey.html');
  }
  if (!id) id = lastOrderId();
  return id ? loadOrder(id) : null;
}

function missing(title, text) {
  if (title) $('#jrMissingTitle').textContent = title;
  if (text) $('#jrMissingText').textContent = text;
  $('#jrMissing').hidden = false;
}

function renderHero(order, places) {
  const n = places.length;
  const city = order.from?.city || 'your town';
  const date = new Date(order.deliveredAt || order.paidAt || order.createdAt);
  const dateLong = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const lede = $('#jrLede');
  const strong = (t) => Object.assign(document.createElement('strong'), { textContent: t });
  lede.replaceChildren(
    'From ', strong(city), ' to ',
    strong(order.koin === 'legend' ? `every destination, all ${n}` : n === 1 ? places[0].name : `${n} places`),
    `, carried by your ${KOIN_NAME[order.koin]} on ${dateLong}.`,
  );
  $('#jrNote').textContent = order.message;
  $('#jrFrom').textContent = `From ${[order.from?.city, order.from?.country].filter(Boolean).join(', ') || 'your town'}`;
  $('#jrId').textContent = order.id;
  $('#jrStatus').textContent = n === 1 ? `Delivered to ${places[0].name}` : `Delivered to ${n} places`;
  document.title = `Your journey${n === 1 ? ` to ${places[0].name}` : ''} · PaprKoin`;
  $('#jrHero').hidden = false;
}

function renderFilms(order, places) {
  const grid = $('#jvGrid');
  const n = places.length;
  $('#jrVideosTitle').textContent = n === 1 ? 'Your film' : `Your ${n} films`;
  $('#jrVideosLede').textContent = n === 1
    ? `Your words arriving at ${places[0].name}. Play it here, or save it to keep and share.`
    : 'One for each place your words reached. Play them here, or save them to keep and share.';

  const cards = places.map((d, i) => {
    const li = document.createElement('li');
    li.className = 'jv';
    li.innerHTML = `
      <div class="jv-screen">
        <div class="jv-poster" data-kind="${d.kind}" aria-hidden="true">
          <img alt="" loading="lazy" decoding="async">
          <div class="jv-cap"><span></span><b></b></div>
        </div>
        <button class="jv-hit" type="button"></button>
        <span class="jv-play" aria-hidden="true">${PLAY}</span>
        <div class="jv-bar" aria-hidden="true"><i></i></div>
      </div>
      <div class="jv-meta">
        <p><b></b></p>
        <div class="jv-actions">
          <button class="jr-btn" type="button" data-act="play">Play</button>
          <button class="jr-btn is-icon" type="button" data-act="save">${DOWNLOAD}</button>
        </div>
      </div>`;
    $('.jv-cap span', li).textContent = `Journey ${i + 1} of ${n}`;
    $('.jv-cap b', li).textContent = d.name;
    const meta = $('.jv-meta p', li);
    $('b', meta).textContent = d.name;
    meta.append(`, ${d.where}`);
    $('.jv-hit', li).setAttribute('aria-label', `Play the film for ${d.name}`);
    $('[data-act="save"]', li).setAttribute('aria-label', `Download the film for ${d.name}`);
    $('[data-act="save"]', li).title = 'Download film';
    grid.append(li);
    return { li, d, i, player: null, canvas: null, photo: '', saving: false };
  });
  $('#jrVideos').hidden = false;

  // posters first, from the same photo set as the Destinations section
  loadPhotos().then((map) => cards.forEach((c) => {
    const src = map.get(c.d.id);
    if (!src) return;
    c.photo = src;
    const img = $('.jv-poster img', c.li);
    img.onload = () => img.classList.add('is-in');
    img.src = cardSrc(src);
  })).catch(() => {});

  // only one film holds a canvas at a time, so even Legend's long list stays light
  const release = (c) => {
    if (!c.player || c.saving) return;
    c.player.pause();
    c.canvas.remove();
    c.player = null; c.canvas = null;
    c.li.classList.remove('is-playing', 'is-paused', 'is-ended', 'has-film');
    $('[data-act="play"]', c.li).textContent = 'Play';
    $('.jv-bar i', c.li).style.transform = 'scaleX(0)';
  };
  const ensure = async (c) => {
    if (c.player) return c.player;
    cards.forEach((o) => { if (o !== c) release(o); });
    await document.fonts?.ready;
    const photo = await loadImage(c.photo);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    $('.jv-screen', c.li).insertBefore(canvas, $('.jv-hit', c.li));
    const p = createJourneyVideo({ canvas, dest: c.d, order, index: c.i + 1, total: n, photo });
    p.onTick = (k) => { $('.jv-bar i', c.li).style.transform = `scaleX(${k})`; };
    p.onEnd = () => {
      c.li.classList.remove('is-playing', 'is-paused');
      c.li.classList.add('is-ended');
      $('[data-act="play"]', c.li).textContent = 'Replay';
      $('.jv-hit', c.li).setAttribute('aria-label', `Replay the film for ${c.d.name}`);
    };
    p.seek(0);
    c.li.classList.add('has-film');
    c.player = p; c.canvas = canvas;
    return p;
  };
  const toggle = async (c) => {
    if (c.saving) return;
    const p = await ensure(c);
    const btn = $('[data-act="play"]', c.li);
    if (p.playing) {
      p.pause();
      c.li.classList.replace('is-playing', 'is-paused');
      btn.textContent = 'Play';
      $('.jv-hit', c.li).setAttribute('aria-label', `Play the film for ${c.d.name}`);
      return;
    }
    p.play();
    c.li.classList.remove('is-paused', 'is-ended');
    c.li.classList.add('is-playing');
    btn.textContent = 'Pause';
    $('.jv-hit', c.li).setAttribute('aria-label', `Pause the film for ${c.d.name}`);
  };
  const record = async (c) => {
    if (c.saving) return;
    if (cards.some((o) => o.saving)) { toast('One film is already being saved. Try again when it’s done.'); return; }
    const btn = $('[data-act="save"]', c.li);
    const p = await ensure(c);
    c.saving = true;
    btn.disabled = true;
    c.li.classList.remove('is-paused', 'is-ended');
    c.li.classList.add('is-playing', 'is-saving');
    $('[data-act="play"]', c.li).textContent = 'Saving…';
    toast(`Saving the ${c.d.name} film. It records in real time, about 11 seconds.`);
    try {
      const { blob, ext } = await p.record();
      save(blob, `paprkoin-${c.d.id}-${order.id.toLowerCase()}.${ext}`);
      toast(`Film saved: ${c.d.name}.`);
    } catch {
      toast('This browser can’t save films. Try Chrome, Edge or Firefox on a computer.', { error: true });
      p.pause();
    } finally {
      c.saving = false;
      btn.disabled = false;
      c.li.classList.remove('is-saving');
    }
  };

  grid.addEventListener('click', (e) => {
    const li = e.target.closest('.jv');
    if (!li) return;
    const c = cards.find((o) => o.li === li);
    if (e.target.closest('[data-act="save"]')) record(c);
    else if (e.target.closest('[data-act="play"], .jv-hit')) toggle(c);
  });
}

async function renderCertificate(order, places) {
  $('#jrCert').hidden = false;
  const img = $('#certImg');
  img.alt = `Certificate of Journey for ${order.name}, from ${order.from?.city || 'home'} to ${places.length} ${places.length === 1 ? 'destination' : 'destinations'}.`;
  let canvas = null;
  try {
    canvas = await drawCertificate(order, places);
    img.src = canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    toast('The certificate couldn’t be drawn in this browser.', { error: true });
    return;
  }
  const busy = (btn, on, label) => { btn.disabled = on; if (label) $('span', btn) ? ($('span', btn).textContent = label) : (btn.textContent = label); };
  $('#certPdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    busy(btn, true, 'Preparing your PDF…');
    try { await downloadPDF(canvas, order); toast('Certificate saved as a PDF.'); }
    catch { toast('The PDF couldn’t be made. Download the image instead.', { error: true }); }
    finally { busy(btn, false, 'Download certificate (PDF)'); }
  });
  $('#certPng').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    busy(btn, true);
    await downloadPNG(canvas, order);
    busy(btn, false);
    toast('Certificate saved as an image.');
  });
}

/* boot */
initTheme();
const order = resolveOrder();
if (!order) {
  missing();
} else if (!order.paid) {
  missing('This journey isn’t paid for yet.', 'Finish checkout to see your films and your certificate.');
} else {
  const places = (order.picks || []).map(byId).filter((d) => d && d.lat !== null);
  if (!places.length) missing('This journey has no destinations.', 'Start a new journey and choose where your words should go.');
  else {
    renderHero(order, places);
    renderFilms(order, places);
    renderCertificate(order, places);
  }
}
