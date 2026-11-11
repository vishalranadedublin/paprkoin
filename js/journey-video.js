// A short film for each destination, drawn on a canvas in the browser:
// the route from the sender's town, the place itself with the message typed onto
// a paper slip, a "delivered" postmark, and an end card. It can be played in the
// page or recorded to a real video file with MediaRecorder.
export const W = 1280;
export const H = 720;
export const DURATION = 11;

const NAVY = '#0b1323';
const INK = '#172340';
const PAPER = '#eef3f6';
const RED = '#e2513d';
const KIND_TINT = {
  sacred: ['#3a2a55', '#121a33'], nature: ['#1d4a4a', '#0e1d2c'], wonder: ['#5a3a22', '#1a1626'],
  landmark: ['#2b3d66', '#10182d'], peace: ['#4a2430', '#141a30'], beyond: ['#1a1a3c', '#05070f'],
};
const LOGO_P = new Path2D('M19 32V16h6.2a4.6 4.6 0 0 1 0 9.2H19');

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const imgCache = new Map();
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';     // keeps the canvas recordable
      im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    }));
  }
  return imgCache.get(src);
}

function font(ctx, weight, size, family, stretch) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch || 'normal';
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function brandMark(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 48, size / 48);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(24, 24, 21, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(24, 24, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2.6; ctx.stroke(LOGO_P);
  ctx.restore();
}

function textOnCircle(ctx, text, cx, cy, r, start) {
  const chars = [...text];
  const step = (Math.PI * 2) / chars.length;
  chars.forEach((ch, i) => {
    const a = start + i * step;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

function postmark(ctx, cx, cy, r, label, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = r * 0.025; ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.stroke();
  font(ctx, 700, r * 0.17, '"Courier Prime", monospace');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textOnCircle(ctx, label, cx, cy, r * 0.77, -Math.PI / 2);
  brandMark(ctx, cx - r * 0.42, cy - r * 0.42, r * 0.84, color);
  ctx.restore();
}

function stars(ctx, seed) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.15 + rnd() * 0.5;
    ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 1.4 + 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function createJourneyVideo({ canvas, dest, order, index, total, photo }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const tint = KIND_TINT[dest.kind] || KIND_TINT.landmark;
  const fromCity = order.from?.city || 'home';
  const date = new Date(order.deliveredAt || order.paidAt || order.createdAt);
  const dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const stamp = ` DELIVERED · ${dest.name.toUpperCase().slice(0, 20)} · ${dateLabel} ·`;
  const seed = [...dest.id].reduce((a, c) => a + c.charCodeAt(0), 7);
  let raf = 0;
  let t0 = 0;
  let at = 0;
  let playing = false;
  let onTick = () => {};
  let onEnd = () => {};

  // the film, frame by frame
  function draw(t) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // 1 · the route from home (0 to 2.6s)
    const intro = 1 - seg(t, 2.2, 3.0);
    if (intro > 0) {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.4, 50, W * 0.5, H * 0.5, W * 0.8);
      g.addColorStop(0, '#1d2f5b'); g.addColorStop(1, NAVY);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      stars(ctx, seed);
      const ax = W * 0.2, ay = H * 0.62, bx = W * 0.8, by = H * 0.46;
      const cx = W * 0.5, cy = H * 0.08;
      const p = easeInOut(seg(t, 0.4, 2.0));
      // dotted guide
      ctx.setLineDash([2, 12]); ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(232,239,244,.35)';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by); ctx.stroke();
      ctx.setLineDash([]);
      // drawn route
      ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = (i / 60) * p;
        const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * bx;
        const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * by;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      const hx = (1 - p) * (1 - p) * ax + 2 * (1 - p) * p * cx + p * p * bx;
      const hy = (1 - p) * (1 - p) * ay + 2 * (1 - p) * p * cy + p * p * by;
      ctx.shadowColor = RED; ctx.shadowBlur = 24; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      [[ax, ay], [bx, by]].forEach(([x, y], i) => {
        ctx.fillStyle = NAVY; ctx.strokeStyle = i && p < 1 ? 'rgba(232,239,244,.5)' : '#e8eff4'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.fillStyle = '#e8eff4';
      font(ctx, 700, 22, '"Courier Prime", monospace');
      ctx.textAlign = 'left'; ctx.fillText(`FROM ${fromCity.toUpperCase()}`, ax - 30, ay + 52);
      ctx.textAlign = 'right'; ctx.globalAlpha = seg(t, 1.4, 2.0);
      ctx.fillText(`TO ${dest.name.toUpperCase()}`, bx + 30, by + 52); ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      font(ctx, 800, 26, 'Anybody, sans-serif');
      ctx.fillStyle = 'rgba(232,239,244,.85)';
      ctx.fillText(`Journey ${index} of ${total}`, 64, 84);
      brandMark(ctx, W - 64 - 44, 52, 44, 'rgba(232,239,244,.85)');
      ctx.globalAlpha = 1;
    }

    // 2 · the place, with the message (2.2s to 9.4s)
    const placeA = seg(t, 2.2, 3.0) * (1 - seg(t, 9.0, 9.6));
    if (placeA > 0) {
      ctx.globalAlpha = placeA;
      const k = seg(t, 2.2, 9.6);
      if (photo) {
        const s = Math.max(W / photo.width, H / photo.height) * (1.06 + 0.14 * k);
        const iw = photo.width * s, ih = photo.height * s;
        const dx = (W - iw) / 2 + (seed % 2 ? -1 : 1) * 40 * (k - 0.5);
        const dy = (H - ih) / 2 - 20 * (k - 0.5);
        ctx.drawImage(photo, dx, dy, iw, ih);
      } else {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, tint[0]); g.addColorStop(1, tint[1]);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        font(ctx, 900, 520, 'Anybody, sans-serif', 'condensed');
        ctx.fillStyle = 'rgba(232,239,244,.08)'; ctx.textAlign = 'right';
        ctx.fillText(dest.name.replace(/^The /, '')[0], W - 40, H - 40); ctx.textAlign = 'left';
      }
      const shade = ctx.createLinearGradient(0, H * 0.25, 0, H);
      shade.addColorStop(0, 'rgba(5,9,18,0)'); shade.addColorStop(1, 'rgba(5,9,18,.88)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);

      // name and place
      const nA = ease(seg(t, 2.8, 3.6));
      ctx.globalAlpha = placeA * nA;
      ctx.fillStyle = '#ffffff';
      font(ctx, 900, 84, 'Anybody, sans-serif', 'condensed');
      ctx.fillText(dest.name, 64, H - 150 + (1 - nA) * 20);
      font(ctx, 700, 24, '"Courier Prime", monospace');
      ctx.fillStyle = '#ffb3a6';
      ctx.fillText(`${dest.where.toUpperCase()}   ${Math.abs(dest.lat).toFixed(2)}°${dest.lat >= 0 ? 'N' : 'S'} ${Math.abs(dest.lon).toFixed(2)}°${dest.lon >= 0 ? 'E' : 'W'}`, 66, H - 104 + (1 - nA) * 20);

      // the message, typed onto a paper slip
      const slipA = ease(seg(t, 3.6, 4.2));
      if (slipA > 0) {
        const sw = 520, sx = W - sw - 64;
        font(ctx, 400, 25, '"Courier Prime", monospace');
        const lines = wrap(ctx, order.message, sw - 56);
        const sh = 70 + lines.length * 36;
        const sy = H - sh - 64;
        ctx.save();
        ctx.globalAlpha = placeA * slipA;
        ctx.translate(sx + sw / 2, sy + sh / 2 + (1 - slipA) * 30);
        ctx.rotate(-0.018);
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
        ctx.fillStyle = PAPER; ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = RED; ctx.fillRect(-sw / 2, -sh / 2, sw, 6);
        const chars = Math.floor(order.message.length * seg(t, 4.2, 7.6));
        let left = chars;
        let caret = [-sw / 2 + 28, 0];
        ctx.fillStyle = INK;
        lines.forEach((ln, i) => {
          if (left <= 0) return;
          const part = ln.slice(0, left);
          left -= ln.length + 1;
          ctx.fillText(part, -sw / 2 + 28, -sh / 2 + 52 + i * 36);
          caret = [-sw / 2 + 28 + ctx.measureText(part).width, i];
        });
        if (t < 7.8 && Math.floor(t * 2) % 2 === 0) ctx.fillRect(caret[0] + 3, -sh / 2 + 32 + caret[1] * 36, 3, 26);
        ctx.restore();
      }

      // delivered: the postmark hits
      const hit = seg(t, 7.9, 8.4);
      if (hit > 0) {
        const s = 1 + (1 - ease(hit)) * 1.2;
        ctx.save();
        ctx.translate(W - 190, 170);
        ctx.rotate(-0.2);
        ctx.scale(s, s);
        postmark(ctx, 0, 0, 105, stamp, RED, placeA * Math.min(1, hit * 1.6) * 0.95);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // 3 · end card (9.0s to 11s)
    const end = seg(t, 9.0, 9.6);
    if (end > 0) {
      ctx.globalAlpha = end;
      ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
      stars(ctx, seed + 3);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(232,239,244,.75)';
      font(ctx, 700, 24, '"Courier Prime", monospace');
      ctx.fillText(`JOURNEY ${index} OF ${total}`, W / 2, H / 2 - 120);
      ctx.fillStyle = '#ffffff';
      font(ctx, 900, 64, 'Anybody, sans-serif', 'condensed');
      ctx.fillText('Your words arrived at', W / 2, H / 2 - 40);
      ctx.fillStyle = '#ff6b55';
      font(ctx, 900, 92, 'Anybody, sans-serif', 'condensed');
      ctx.fillText(dest.name, W / 2, H / 2 + 60);
      ctx.fillStyle = 'rgba(232,239,244,.7)';
      font(ctx, 700, 22, '"Courier Prime", monospace');
      ctx.fillText(`${dest.where.toUpperCase()}  ·  ${dateLabel}  ·  ${order.id}`, W / 2, H / 2 + 130);
      brandMark(ctx, W / 2 - 24, H - 110, 48, 'rgba(232,239,244,.85)');
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function frame(now) {
    if (!playing) return;
    at = Math.min(DURATION, (now - t0) / 1000);
    draw(at);
    onTick(at / DURATION);
    if (at >= DURATION) { playing = false; onEnd(); return; }
    raf = requestAnimationFrame(frame);
  }

  return {
    poster() { draw(6.2); },
    play(from = at >= DURATION ? 0 : at) {
      cancelAnimationFrame(raf);
      playing = true;
      t0 = performance.now() - from * 1000;
      raf = requestAnimationFrame(frame);
    },
    pause() { playing = false; cancelAnimationFrame(raf); },
    get playing() { return playing; },
    set onTick(fn) { onTick = fn; },
    set onEnd(fn) { onEnd = fn; },
    seek(t) { at = t; draw(t); },
    // record the whole film in real time; resolves to { blob, ext }
    record(onProgress = () => {}) {
      const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      const mime = window.MediaRecorder && types.find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime || !canvas.captureStream) return Promise.reject(new Error('unsupported'));
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      return new Promise((resolve, reject) => {
        rec.onerror = (e) => reject(e.error || new Error('record'));
        rec.onstop = () => resolve({ blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.includes('mp4') ? 'mp4' : 'webm' });
        const prevTick = onTick, prevEnd = onEnd;
        onTick = (p) => { prevTick(p); onProgress(p); };
        onEnd = () => { onTick = prevTick; onEnd = prevEnd; setTimeout(() => rec.stop(), 150); prevEnd(); };
        rec.start(250);
        this.play(0);
      });
    },
  };
}
