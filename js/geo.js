// Visitor location.
// 1. IP lookup: providers are queried together and the most accurate one that
//    answers wins (ipapi.co and ipwho.is resolve Irish ISPs to the right town;
//    geojs.io is a last resort because it often snaps to a regional hub).
// 2. Exact location: the browser's Geolocation API, only when the visitor asks
//    (or has already granted permission), reverse-geocoded to a town name.
import { TZ_FALLBACK } from './data.js';

const IP_KEY = 'pk.loc.ip.v2';
const EXACT_KEY = 'pk.loc.exact.v1';

const read = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const valid = (l) => l && Number.isFinite(l.lat) && Number.isFinite(l.lon) && Math.abs(l.lat) <= 90 && Math.abs(l.lon) <= 180;

// in priority order
const PROVIDERS = [
  async (signal) => {
    const j = await (await fetch('https://ipapi.co/json/', { signal })).json();
    if (j.error) throw new Error(j.reason);
    return { lat: +j.latitude, lon: +j.longitude, city: j.city, country: j.country_name };
  },
  async (signal) => {
    const j = await (await fetch('https://ipwho.is/', { signal })).json();
    if (j.success === false) throw new Error(j.message);
    return { lat: +j.latitude, lon: +j.longitude, city: j.city, country: j.country };
  },
  async (signal) => {
    const j = await (await fetch('https://get.geojs.io/v1/ip/geo.json', { signal })).json();
    return { lat: +j.latitude, lon: +j.longitude, city: j.city, country: j.country };
  },
];

export function fallbackLocation() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
  const hit = TZ_FALLBACK[tz];
  if (hit) return { lat: hit[0], lon: hit[1], city: hit[2], country: hit[3], source: 'timezone' };
  return { lat: 20, lon: 0, city: 'Somewhere', country: 'on Earth', source: 'default' };
}

export async function locateByIP({ timeout = 4000 } = {}) {
  const cached = read(IP_KEY);
  if (valid(cached)) return cached;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  // start all at once; walk them in priority order so the best one wins
  // as soon as it answers, without waiting on slower fallbacks
  const runs = PROVIDERS.map((p) => p(ctrl.signal).catch(() => null));
  for (const run of runs) {
    const v = await run;
    if (valid(v) && v.city) {
      clearTimeout(timer);
      ctrl.abort();
      const loc = { ...v, country: v.country || '', source: 'ip' };
      write(IP_KEY, loc);
      return loc;
    }
  }
  clearTimeout(timer);
  return fallbackLocation();
}

export function exactSupported() {
  return 'geolocation' in navigator && window.isSecureContext;
}

export async function exactAlreadyAllowed() {
  if (!exactSupported() || !navigator.permissions) return false;
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; } catch { return false; }
}

async function placeName(lat, lon) {
  // BigDataCloud's client-side endpoint is free and keyless; it is meant to be
  // called from the visitor's browser with coordinates the visitor just shared.
  // `locality` is the most specific name (the village or district you are in);
  // `city` can be a larger town nearby.
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.search = new URLSearchParams({ latitude: lat.toFixed(4), longitude: lon.toFixed(4), localityLanguage: 'en' });
  const j = await (await fetch(url)).json();
  return { city: j.locality || j.city || j.principalSubdivision || '', country: j.countryName || '' };
}

// The browser's own position, named by where it actually is (never snapped to
// the IP town). `fresh` (the visitor pressed the button) always takes a new,
// high-accuracy reading; on page load a reading from the last few minutes is reused.
export async function locateExactly({ fresh = false } = {}) {
  const cached = read(EXACT_KEY);
  if (!fresh && valid(cached) && Date.now() - (cached.at || 0) < 5 * 60 * 1000) return cached;
  const pos = await position(fresh);
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  let place = { city: '', country: '' };
  try { place = await placeName(lat, lon); } catch { /* keep the coordinates even if naming fails */ }
  const loc = { lat, lon, city: place.city || 'Your location', country: place.country, accuracy: Math.round(pos.coords.accuracy || 0), source: 'exact', at: Date.now() };
  write(EXACT_KEY, loc);
  return loc;
}

function position(fresh) {
  return new Promise((resolve, reject) => {
    if (!exactSupported()) { reject(Object.assign(new Error('unsupported'), { code: 0 })); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,          // Wi-Fi or GPS where the device has it, not a network guess
      timeout: fresh ? 20000 : 12000,
      maximumAge: fresh ? 0 : 5 * 60 * 1000,
    });
  });
}

// Plain-language reasons, with the fix, for each way the browser can say no.
export function exactErrorMessage(err) {
  const code = err && err.code;
  const mac = /Mac/.test(navigator.platform || navigator.userAgent);
  const win = /Win/.test(navigator.platform || navigator.userAgent);
  if (code === 1) return 'Location is blocked for this site. Allow it from the icon at the left of the address bar, then press the button again.';
  if (code === 2) {
    return win ? 'Your computer couldn’t find its position. Turn on Location in Windows Settings, under Privacy & security, then try again.'
      : mac ? 'Your Mac couldn’t find its position. Turn on Location Services for your browser in System Settings, under Privacy & Security, then try again.'
      : 'Your device couldn’t find its position. Check that location is turned on, then try again.';
  }
  if (code === 3) return 'Finding your position took too long. Try again, ideally with Wi-Fi turned on.';
  if (code === 0) return 'This browser can’t share an exact location here. Open the site in Chrome, Edge, Safari or Firefox.';
  return 'Your exact location isn’t available right now, so the globe keeps your approximate town.';
}
