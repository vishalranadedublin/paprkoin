// PaprKoin sign-in: Google, Facebook and email, behind one "Sign in" door.
// Google and Facebook do the real thing once their IDs are in auth-config.js.
// The browser remembers who is signed in. Accounts that must survive across
// devices, and password checks, need a server: see verifyWithServer below.
import { AUTH_CONFIG } from './auth-config.js';

const USER = 'pk.user';
const KNOWN = 'pk.known';
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

export const isOn = (provider) => !!(provider === 'Google' ? AUTH_CONFIG.googleClientId : AUTH_CONFIG.facebookAppId);
export const currentUser = () => store.get(USER, null);
export const isKnown = (email) => store.get(KNOWN, []).includes(String(email).toLowerCase());

// Hook for a real backend: send the provider token (or email + password) to your
// server, verify it there, and return the account. Until then it resolves locally.
async function verifyWithServer(user) { return user; }

function finish(user) {
  const email = String(user.email || '').toLowerCase();
  const known = store.get(KNOWN, []);
  const isNew = email ? !known.includes(email) : true;
  if (email && isNew) store.set(KNOWN, [...known, email]);
  const saved = { ...user, email, since: user.since || new Date().toISOString() };
  delete saved.token;
  store.set(USER, saved);
  return { user: saved, isNew };
}

const loaded = new Map();
function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = res;
      s.onerror = () => { loaded.delete(src); rej(new Error('script')); };
      document.head.append(s);
    }));
  }
  return loaded.get(src);
}

/* ------------------------------------------------------------------ google */
let googleClient = null;
let googleWait = null;
function prepareGoogle() {
  if (!AUTH_CONFIG.googleClientId) return Promise.reject(new Error('off'));
  return loadScript('https://accounts.google.com/gsi/client').then(() => {
    googleClient ||= window.google.accounts.oauth2.initTokenClient({
      client_id: AUTH_CONFIG.googleClientId,
      scope: 'openid email profile',
      callback: (r) => (r.error ? googleWait?.rej(new Error(r.error)) : googleWait?.res(r.access_token)),
      error_callback: (e) => googleWait?.rej(new Error(e?.type || 'closed')),
    });
  });
}

async function google() {
  await prepareGoogle();
  const token = await new Promise((res, rej) => { googleWait = { res, rej }; googleClient.requestAccessToken({ prompt: 'select_account' }); });
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('profile');
  const p = await r.json();
  const user = await verifyWithServer({ provider: 'Google', name: p.name || p.given_name || '', email: p.email, picture: p.picture || '', token });
  return finish(user);
}

/* ---------------------------------------------------------------- facebook */
let fbReady = null;
function prepareFacebook() {
  if (!AUTH_CONFIG.facebookAppId) return Promise.reject(new Error('off'));
  fbReady ||= new Promise((res, rej) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: AUTH_CONFIG.facebookAppId, cookie: true, xfbml: false, version: 'v19.0' });
      res();
    };
    loadScript('https://connect.facebook.net/en_US/sdk.js').catch((e) => { fbReady = null; rej(e); });
  });
  return fbReady;
}

async function facebook() {
  await prepareFacebook();
  const login = await new Promise((res) => window.FB.login(res, { scope: 'public_profile,email' }));
  if (!login?.authResponse) throw new Error('closed');
  const me = await new Promise((res) => window.FB.api('/me', { fields: 'name,email,picture.width(96).height(96)' }, res));
  if (!me || me.error) throw new Error('profile');
  const user = await verifyWithServer({
    provider: 'Facebook', name: me.name || '', email: me.email || '', picture: me.picture?.data?.url || '', token: login.authResponse.accessToken,
  });
  return finish(user);
}

/* ------------------------------------------------------------------- email */
export async function emailSignIn(email) {
  const user = await verifyWithServer({ provider: 'Email', name: store.get(`pk.name.${email.toLowerCase()}`, ''), email });
  return finish(user);
}
export async function emailSignUp(name, email) {
  store.set(`pk.name.${email.toLowerCase()}`, name);
  const user = await verifyWithServer({ provider: 'Email', name, email });
  return finish(user);
}

/* ------------------------------------------------------------------ public */
// Load provider scripts when the dialog opens so the popup opens straight from the click.
export function warmUp() {
  if (isOn('Google')) prepareGoogle().catch(() => {});
  if (isOn('Facebook')) prepareFacebook().catch(() => {});
}

export function signInWith(provider) {
  return provider === 'Google' ? google() : facebook();
}

export function signOut() {
  const u = currentUser();
  store.del(USER);
  if (u?.provider === 'Facebook' && window.FB) { try { window.FB.logout(() => {}); } catch { /* not logged in there */ } }
  if (u?.provider === 'Google' && window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
}
