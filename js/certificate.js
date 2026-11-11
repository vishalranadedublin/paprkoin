// The PaprKoin certificate of journey, drawn on a canvas at A4 landscape
// (2480 × 1754, about 210 dpi) and saved as a PNG or a PDF.
const CW = 2480;
const CH = 1754;
const NAVY = '#172340';
const INK2 = '#4b5a75';
const RED = '#c23a2b';
const PAPER = '#f3f6f8';
const KOIN = {
  copper: { name: 'Copper Koin', c: ['#f3b98d', '#b8643a', '#8a4524'] },
  silver: { name: 'Silver Koin', c: ['#ffffff', '#b9c3cd', '#8794a2'] },
  gold: { name: 'Gold Koin', c: ['#fff0b8', '#e0a93a', '#a8731c'] },
  legend: { name: 'Legend Koin', c: ['#3a4f80', '#172340', '#0b1323'] },
};
const LOGO_P = new Path2D('M19 32V16h6.2a4.6 4.6 0 0 1 0 9.2H19');
const WAVES = new Path2D('M2 30c4-2 6 2 10 0M36 30c4-2 6 2 10 0');

function font(ctx, weight, size, family, stretch, style = '') {
  ctx.font = `${style} ${weight} ${size}px ${family}`.trim();
  if ('fontStretch' in ctx) ctx.fontStretch = stretch || 'normal';
}
function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
function mark(ctx, x, y, size, color, waves = true) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 48, size / 48);
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(24, 24, 21, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(24, 24, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2.6; ctx.stroke(LOGO_P);
  if (waves) { ctx.lineWidth = 1.4; ctx.stroke(WAVES); }
  ctx.restore();
}
function ringText(ctx, text, cx, cy, r) {
  const chars = [...text]; const step = (Math.PI * 2) / chars.length;
  chars.forEach((ch, i) => {
    const a = -Math.PI / 2 + i * step;
    ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.rotate(a + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
  });
}

export async function drawCertificate(order, places) {
  await document.fonts?.ready;
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');
  const koin = KOIN[order.koin] || KOIN.silver;
  const date = new Date(order.deliveredAt || order.paidAt || order.createdAt);
  const dateLong = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateShort = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const from = [order.from?.city, order.from?.country].filter(Boolean).join(', ') || 'home';

  // paper and a faint grain
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, CW, CH);
  let s = 11; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  ctx.fillStyle = NAVY;
  for (let i = 0; i < 9000; i++) { ctx.globalAlpha = rnd() * 0.035; ctx.fillRect(rnd() * CW, rnd() * CH, 2, 2); }
  ctx.globalAlpha = 1;

  // airmail edges, top and bottom
  const stripe = (y) => {
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, CW, 30); ctx.clip();
    for (let x = -60, i = 0; x < CW + 60; x += 46, i++) {
      ctx.fillStyle = i % 2 ? NAVY : RED;
      ctx.beginPath(); ctx.moveTo(x, y + 30); ctx.lineTo(x + 30, y); ctx.lineTo(x + 52, y); ctx.lineTo(x + 22, y + 30); ctx.fill();
    }
    ctx.restore();
  };
  stripe(0); stripe(CH - 30);

  // engraved border: two rules with a band of fine waves between
  ctx.strokeStyle = NAVY; ctx.lineWidth = 4; ctx.strokeRect(90, 100, CW - 180, CH - 200);
  ctx.lineWidth = 1.5; ctx.strokeRect(126, 136, CW - 252, CH - 272);
  ctx.save(); ctx.globalAlpha = 0.22; ctx.lineWidth = 1.2;
  const band = (x0, y0, x1, y1, horizontal) => {
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      const len = horizontal ? x1 - x0 : y1 - y0;
      for (let i = 0; i <= len; i += 6) {
        const w = Math.sin(i / 18 + k * 1.3) * 7;
        if (horizontal) { const y = y0 + 6 + k * 6 + w; i ? ctx.lineTo(x0 + i, y) : ctx.moveTo(x0, y); }
        else { const x = x0 + 6 + k * 6 + w; i ? ctx.lineTo(x, y0 + i) : ctx.moveTo(x, y0); }
      }
      ctx.stroke();
    }
  };
  band(96, 104, CW - 96, 0, true); band(96, CH - 134, CW - 96, 0, true);
  band(94, 104, 0, CH - 104, false); band(CW - 130, 104, 0, CH - 104, false);
  ctx.restore();

  // header: the mark and the wordmark
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  mark(ctx, CW / 2 - 300, 214, 96, NAVY);
  font(ctx, 900, 88, 'Anybody, sans-serif', 'expanded');
  ctx.fillStyle = NAVY; ctx.textAlign = 'left';
  ctx.fillText('PaprKoin', CW / 2 - 186, 292);
  ctx.textAlign = 'center';

  // title
  font(ctx, 900, 150, 'Anybody, sans-serif', 'condensed');
  ctx.fillText('Certificate of Journey', CW / 2, 500);
  font(ctx, 400, 46, '"Courier Prime", monospace');
  ctx.fillStyle = INK2;
  ctx.fillText('This certifies that the words of', CW / 2, 600);

  // the sender
  font(ctx, 800, 130, 'Anybody, sans-serif', 'condensed');
  ctx.fillStyle = RED;
  const nm = order.name || 'A PaprKoin writer';
  ctx.fillText(nm, CW / 2, 750);
  const nw = Math.min(1500, ctx.measureText(nm).width + 160);
  ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(CW / 2 - nw / 2, 790); ctx.lineTo(CW / 2 + nw / 2, 790); ctx.stroke();

  // where they went
  font(ctx, 400, 46, '"Courier Prime", monospace');
  ctx.fillStyle = INK2;
  const n = places.length;
  const lead = order.koin === 'legend'
    ? `travelled from ${from} to every PaprKoin destination, all ${n} of them.`
    : `travelled from ${from} to ${n === 1 ? 'one destination' : `${n} destinations`}:`;
  const leadLines = wrap(ctx, lead, 1900);
  leadLines.forEach((ln, i) => ctx.fillText(ln, CW / 2, 880 + i * 58));
  let y = 880 + 58 * leadLines.length + 10;
  if (order.koin !== 'legend') {
    const size = n <= 4 ? 58 : 42;
    font(ctx, 800, size, 'Anybody, sans-serif', n <= 4 ? 'normal' : 'condensed');
    ctx.fillStyle = NAVY;
    const names = wrap(ctx, places.map((p) => p.name).join('   ·   '), 2000).slice(0, 4);
    names.forEach((ln, i) => ctx.fillText(ln, CW / 2, y + size * 0.9 + i * size * 1.25));
    y += size * 1.25 * names.length + 20;
  }

  // the message itself
  font(ctx, 400, 40, '"Courier Prime", monospace', 'normal', 'italic');
  ctx.fillStyle = NAVY;
  const q = wrap(ctx, `“${order.message}”`, 1700).slice(0, 4);
  const qy = Math.max(y + 40, 1180);
  q.forEach((ln, i) => ctx.fillText(ln, CW / 2, qy + i * 54));

  // footer row: the Koin, the postmark, the journey number
  const fy = CH - 300;
  // Koin
  const g = ctx.createRadialGradient(330, fy - 14, 6, 350, fy, 60);
  g.addColorStop(0, koin.c[0]); g.addColorStop(0.6, koin.c[1]); g.addColorStop(1, koin.c[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(350, fy, 58, 0, Math.PI * 2); ctx.fill();
  if (order.koin === 'legend') { ctx.strokeStyle = RED; ctx.lineWidth = 8; ctx.stroke(); }
  font(ctx, 900, 50, 'Anybody, sans-serif', 'condensed');
  ctx.fillStyle = order.koin === 'legend' ? '#e8eff4' : 'rgba(23,35,64,.75)';
  ctx.fillText(order.koin === 'legend' ? '♛' : 'K', 350, fy + 18);
  ctx.textAlign = 'left';
  ctx.fillStyle = NAVY; font(ctx, 800, 48, 'Anybody, sans-serif'); ctx.fillText(koin.name, 440, fy - 6);
  ctx.fillStyle = INK2; font(ctx, 400, 34, '"Courier Prime", monospace'); ctx.fillText(order.koin === 'legend' ? 'Every destination' : `${n} ${n === 1 ? 'destination' : 'destinations'}`, 440, fy + 44);

  // journey number and date
  ctx.textAlign = 'right';
  ctx.fillStyle = NAVY; font(ctx, 800, 48, 'Anybody, sans-serif'); ctx.fillText(`Journey ${order.id}`, CW - 260, fy - 6);
  ctx.fillStyle = INK2; font(ctx, 400, 34, '"Courier Prime", monospace'); ctx.fillText(`Delivered ${dateLong}`, CW - 260, fy + 44);

  // signature
  ctx.textAlign = 'center';
  ctx.strokeStyle = NAVY; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(CW / 2 - 300, CH - 190); ctx.lineTo(CW / 2 + 300, CH - 190); ctx.stroke();
  ctx.fillStyle = INK2; font(ctx, 400, 30, '"Courier Prime", monospace'); ctx.fillText('The PaprKoin post office', CW / 2, CH - 150);

  // the postmark, struck over the signature line
  ctx.save();
  ctx.translate(CW / 2 + 40, CH - 310); ctx.rotate(-0.22);
  ctx.globalAlpha = 0.9; ctx.strokeStyle = RED; ctx.fillStyle = RED;
  ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 82, 0, Math.PI * 2); ctx.stroke();
  font(ctx, 700, 27, '"Courier Prime", monospace'); ctx.textBaseline = 'middle';
  ringText(ctx, ` DELIVERED · ${(order.from?.city || 'PAPRKOIN').toUpperCase()} · ${dateShort} ·`, 0, 0, 116);
  mark(ctx, -62, -62, 124, RED, false);
  ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    // cancellation waves run left, into the open space between the Koin and the stamp
    for (let i = 0; i <= 240; i += 4) { const yy = -40 + k * 40 + Math.sin(i / 20) * 9; i ? ctx.lineTo(-160 - i, yy) : ctx.moveTo(-160, yy); }
    ctx.stroke();
  }
  ctx.restore();
  return c;
}

const fileBase = (order) => `paprkoin-certificate-${order.id.toLowerCase()}`;

export function downloadPNG(canvas, order) {
  return new Promise((resolve) => canvas.toBlob((blob) => { save(blob, `${fileBase(order)}.png`); resolve(); }, 'image/png'));
}

let jspdf = null;
const loadPdf = () => (jspdf ||= new Promise((res, rej) => {
  if (window.jspdf) { res(window.jspdf); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = () => res(window.jspdf);
  s.onerror = () => { jspdf = null; rej(new Error('pdf')); };
  document.head.append(s);
}));

export async function downloadPDF(canvas, order) {
  const { jsPDF } = await loadPdf();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: `PaprKoin certificate ${order.id}`, author: 'PaprKoin', subject: 'Certificate of Journey' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210);
  pdf.save(`${fileBase(order)}.pdf`);
}

export function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
