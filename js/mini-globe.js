// PaprKoin — the little earth in the sign-in panel.
// Real coastlines in an orthographic view centred on the visitor's town. The
// earth turns slowly around them like a dial, and every few seconds a handful
// of messages leave the centre for real destinations in evenly spread compass
// directions, each landing with a ripple and its place name.
import { geoOrthographic, geoPath, geoGraticule10, geoInterpolate, geoDistance, geoRotation } from 'd3-geo';
import { feature } from 'topojson-client';

const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json';
const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const C = 130;         // centre of the 260 × 260 viewBox
const R = 94;          // earth radius in viewBox units
const COLORS = ['#ff6b55', '#ffc770', '#f4f8fb', '#ff8a6e', '#9fd2ff'];
const STAGGER = 240;
const TRAIL = 0.34;

const el = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

let land = null;
const loadLand = () => (land ||= fetch(LAND_URL).then((r) => r.json()).then((t) => feature(t, t.objects.land)).catch(() => null));

function bearing([lo1, la1], [lo2, la2]) {
  const p1 = la1 * DEG, p2 = la2 * DEG, dl = (lo2 - lo1) * DEG;
  return Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
}
const angleGap = (a, b) => Math.abs(((((a - b) % TAU) + TAU + Math.PI) % TAU) - Math.PI);
const shortName = (n) => { const s = String(n).split(',')[0].replace(/^The /, ''); return s.length > 18 ? `${s.slice(0, 17)}…` : s; };

export function createMiniGlobe(svg, { home, places, reduced = false }) {
  if (!svg) return null;
  svg.replaceChildren();

  /* ----------------------------------------------------------------- defs */
  const defs = el('defs', {}, svg);
  const grad = (tag, id, attrs, stops) => {
    const g = el(tag, { id, ...attrs }, defs);
    stops.forEach(([o, c, a = 1]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g));
    return g;
  };
  grad('radialGradient', 'mgSea', { cx: '34%', cy: '28%', r: '78%' }, [[0, '#2f569b'], [0.42, '#16305f'], [1, '#081329']]);
  grad('radialGradient', 'mgHalo', { cx: '50%', cy: '50%', r: '50%' }, [[0.8, '#8ec9ff', 0], [0.855, '#8ec9ff', 0.55], [0.9, '#8ec9ff', 0.16], [1, '#8ec9ff', 0]]);
  grad('radialGradient', 'mgShade', { cx: '72%', cy: '76%', r: '72%' }, [[0, '#030714', 0.62], [0.55, '#030714', 0.25], [1, '#030714', 0]]);
  grad('linearGradient', 'mgRim', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#ffffff', 0.7], [0.35, '#bfe2ff', 0.15], [0.6, '#ffffff', 0]]);
  const blur = el('filter', { id: 'mgBlur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: 1.8 }, blur);
  const glow = el('filter', { id: 'mgGlow', x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
  el('feGaussianBlur', { stdDeviation: 2.6, result: 'b' }, glow);
  const merge = el('feMerge', {}, glow);
  el('feMergeNode', { in: 'b' }, merge);
  el('feMergeNode', { in: 'SourceGraphic' }, merge);
  const clip = el('clipPath', { id: 'mgClip' }, defs);
  el('circle', { cx: C, cy: C, r: R }, clip);

  /* --------------------------------------------------------------- layers */
  el('circle', { cx: C, cy: C, r: R + 18, fill: 'url(#mgHalo)' }, svg);
  el('circle', { cx: C, cy: C, r: R, fill: 'url(#mgSea)' }, svg);
  const earth = el('g', { 'clip-path': 'url(#mgClip)' }, svg);
  const gratEl = el('path', { class: 'mg-grat' }, earth);
  const landEl = el('path', { class: 'mg-land' }, earth);
  el('circle', { cx: C, cy: C, r: R, fill: 'url(#mgShade)' }, earth);
  el('circle', { cx: C, cy: C, r: R - 0.6, fill: 'none', stroke: 'url(#mgRim)', 'stroke-width': 1.4 }, svg);

  const routesG = el('g', {}, svg);
  const homeG = el('g', {}, svg);
  const pulses = [0, 1].map(() => el('circle', { cx: C, cy: C, r: 0, fill: 'none', stroke: '#ff6b55', 'stroke-width': 1.2, opacity: 0 }, homeG));
  el('circle', { cx: C, cy: C, r: 7, fill: '#ff6b55', opacity: 0.22, filter: 'url(#mgBlur)' }, homeG);
  el('circle', { cx: C, cy: C, r: 3.4, fill: '#ff6b55', stroke: '#fff3ef', 'stroke-width': 1.4 }, homeG);
  const labelsG = el('g', {}, svg);

  const projection = geoOrthographic().scale(R).translate([C, C]).clipAngle(90).precision(0.6);
  const path = geoPath(projection);
  const graticule = geoGraticule10();
  loadLand().then((f) => { if (f) { landShape = f; drawEarth(); } });
  let landShape = null;

  /* --------------------------------------------------------------- state */
  let gamma = 0;
  let rot = geoRotation([0, 0, 0]);
  let count = 4;
  let offset = Math.random() * TAU;
  let routes = [];
  let launches = [];
  let cycleEnd = 0;
  let raf = 0;
  let last = 0;
  let homeKey = '';

  const homeLL = () => { const h = home(); return [h.lon, h.lat]; };

  // a point at fraction t along the route, lifted off the surface, in screen units
  function screen(r, t) {
    const [lam, phi] = rot(r.interp(t));
    const k = 1 + Math.sin(Math.PI * t) * r.lift;
    const x = Math.cos(phi * DEG) * Math.sin(lam * DEG);
    const y = Math.sin(phi * DEG);
    return [C + R * k * x, C - R * k * y];
  }
  const line = (r, t0, t1, n) => {
    if (t1 - t0 <= 0.001) return '';
    let d = '';
    for (let i = 0; i <= n; i++) {
      const [x, y] = screen(r, t0 + ((t1 - t0) * i) / n);
      d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d;
  };

  function pick(n) {
    const h = homeLL();
    const used = new Set();
    const out = [];
    for (let k = 0; k < n; k++) {
      const want = offset + (k * TAU) / n;
      let best = null, score = Infinity;
      for (const p of places) {
        if (p.lat == null || used.has(p.id)) continue;
        const ll = [p.lon, p.lat];
        const d = geoDistance(h, ll);
        if (d < 0.3 || d > 1.12) continue;
        const s = angleGap(bearing(h, ll), want) + Math.abs(d - 0.75) * 0.25;
        if (s < score) { score = s; best = p; }
      }
      if (!best) continue;
      used.add(best.id);
      out.push(best);
    }
    return out;
  }

  function startCycle(now) {
    routesG.replaceChildren();
    labelsG.replaceChildren();
    const h = homeLL();
    homeKey = h.join(',');
    const dests = pick(count);
    launches = [];
    routes = dests.map((p, i) => {
      const b = [p.lon, p.lat];
      const dist = geoDistance(h, b);
      const color = COLORS[i % COLORS.length];
      const id = `mgT${i}`;
      const g = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse' }, routesG);
      el('stop', { offset: 0, 'stop-color': color, 'stop-opacity': 0 }, g);
      el('stop', { offset: 0.7, 'stop-color': color, 'stop-opacity': 0.85 }, g);
      el('stop', { offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 1 }, g);
      const r = {
        interp: geoInterpolate(h, b), lift: 0.05 + dist * 0.2, color, grad: g,
        t0: now + 350 + i * STAGGER, dur: 1500 + dist * 1100, landed: false, landT: 0,
        guide: el('path', { class: 'mg-guide' }, routesG),
        glow: el('path', { class: 'mg-trail-glow', stroke: color }, routesG),
        trail: el('path', { class: 'mg-trail', stroke: `url(#${id})` }, routesG),
        ring: el('circle', { r: 0, fill: 'none', stroke: color, 'stroke-width': 1.2, opacity: 0 }, routesG),
        end: el('circle', { r: 2.2, fill: color, opacity: 0 }, routesG),
        headGlow: el('circle', { r: 5.5, fill: color, opacity: 0, filter: 'url(#mgGlow)' }, routesG),
        head: el('circle', { r: 1.9, fill: '#fff', opacity: 0 }, routesG),
        label: el('text', { class: 'mg-label' }, labelsG),
      };
      r.label.textContent = shortName(p.name);
      launches.push(r.t0);
      return r;
    });
    const lastLand = routes.reduce((m, r) => Math.max(m, r.t0 + r.dur), now);
    cycleEnd = lastLand + 2600;
    offset += 0.9;
  }

  function drawEarth() {
    projection.rotate([-homeLL()[0], -homeLL()[1], gamma]);
    rot = geoRotation(projection.rotate());
    gratEl.setAttribute('d', path(graticule) || '');
    if (landShape) landEl.setAttribute('d', path(landShape) || '');
  }

  function draw(now) {
    drawEarth();
    const fadeOut = 1 - clamp01((now - (cycleEnd - 500)) / 500);
    for (const r of routes) {
      const v = (now - r.t0) / r.dur;
      const started = v >= 0;
      const head = easeInOut(clamp01(v));
      const tail = clamp01(easeInOut(clamp01(v)) - TRAIL + Math.max(0, v - 1) * 1.6);
      r.guide.setAttribute('d', started ? line(r, 0, 1, 40) : '');
      r.guide.setAttribute('opacity', (started ? clamp01(v * 4) : 0) * fadeOut);
      const td = started ? line(r, tail, head, 22) : '';
      r.trail.setAttribute('d', td);
      r.glow.setAttribute('d', td);
      r.glow.setAttribute('opacity', 0.28 * fadeOut);
      if (td) {
        const [x1, y1] = screen(r, tail), [x2, y2] = screen(r, head);
        r.grad.setAttribute('x1', x1); r.grad.setAttribute('y1', y1);
        r.grad.setAttribute('x2', x2); r.grad.setAttribute('y2', y2);
      }
      const flying = started && v < 1;
      const [hx, hy] = screen(r, head);
      [r.head, r.headGlow].forEach((c) => { c.setAttribute('cx', hx); c.setAttribute('cy', hy); });
      r.head.setAttribute('opacity', flying ? 1 : 0);
      r.headGlow.setAttribute('opacity', flying ? 0.95 : 0);

      if (v >= 1 && !r.landed) { r.landed = true; r.landT = now; r.label.classList.add('is-on'); }
      const [ex, ey] = screen(r, 1);
      r.end.setAttribute('cx', ex); r.end.setAttribute('cy', ey);
      r.end.setAttribute('opacity', r.landed ? 0.95 * fadeOut : 0);
      if (r.landed) {
        const age = clamp01((now - r.landT) / 1100);
        r.ring.setAttribute('cx', ex); r.ring.setAttribute('cy', ey);
        r.ring.setAttribute('r', 2 + easeOut(age) * 13);
        r.ring.setAttribute('opacity', (1 - age) * 0.9);
      }
      // name sits just outside the landing point, away from the centre
      const dx = ex - C, dy = ey - C, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // ...unless it would run off the panel, then it tucks in on the inside
      const w = r.label.textContent.length * 5.4;
      let anchor = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle';
      let lx = ex + ux * 8;
      if (anchor === 'end' && lx - w < 4) { anchor = 'start'; lx = ex + 7; }
      if (anchor === 'start' && lx + w > 256) { anchor = 'end'; lx = ex - 7; }
      if (anchor === 'middle') lx = Math.min(256 - w / 2, Math.max(4 + w / 2, lx));
      r.label.setAttribute('x', lx.toFixed(1));
      r.label.setAttribute('y', (ey + uy * 8 + (uy > 0.3 ? 7 : uy < -0.3 ? -1 : 3)).toFixed(1));
      r.label.setAttribute('text-anchor', anchor);
      if (fadeOut < 1) r.label.classList.remove('is-on');
    }
    // the town sends a pulse with every message that leaves
    pulses.forEach((c, i) => {
      const t = launches.filter((l) => l <= now).pop();
      const age = t === undefined ? 1 : clamp01((now - t - i * 180) / 900);
      c.setAttribute('r', 4 + easeOut(age) * 16);
      c.setAttribute('opacity', age >= 1 ? 0 : (1 - age) * 0.8);
    });
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    gamma = (gamma + dt * 5) % 360; // degrees a second, turning round the visitor
    const h = homeLL().join(',');
    if (now > cycleEnd || h !== homeKey) startCycle(now);
    draw(now);
  }

  function still() {
    const now = performance.now();
    startCycle(now - 100000);
    routes.forEach((r) => { r.t0 = now - r.dur - 2000; r.landed = true; r.landT = now - 5000; });
    cycleEnd = Infinity;
    draw(now);
    routes.forEach((r) => r.label.classList.add('is-on'));
  }

  drawEarth();

  return {
    start() {
      if (reduced) { still(); return; }
      if (raf) return;
      last = 0;
      startCycle(performance.now());
      raf = requestAnimationFrame(frame);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    setCount(n) {
      if (n === count) return;
      count = n;
      if (reduced) still(); else if (raf) startCycle(performance.now());
    },
  };
}
