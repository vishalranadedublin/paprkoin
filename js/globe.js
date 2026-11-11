// PaprKoin — a realistic earth.
// NASA Blue Marble day imagery, city lights on the night side, specular oceans,
// terrain relief, drifting clouds and an atmosphere rim. Notes travel as small
// points of light along great-circle routes. Scrolling zooms onto the visitor.
import * as THREE from 'three';
import { mesh } from 'topojson-client';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { CITIES } from './data.js';

const R = 1;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const IMG = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/';
const CLOUDS = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png';
const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';

const C = {
  red: new THREE.Color('#ff4a36'),
  white: new THREE.Color('#fff6e8'),
  gold: new THREE.Color('#ffc770'),
  atmo: new THREE.Color('#8ec9ff'),
};

export function llToVec(lat, lon, r = R, out = new THREE.Vector3()) {
  const phi = (lon + 180) * DEG;
  const th = lat * DEG;
  return out.set(-Math.cos(phi) * Math.cos(th), Math.sin(th), Math.sin(phi) * Math.cos(th)).multiplyScalar(r);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* --------------------------------- shaders --------------------------------- */
const earthVert = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPos = mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;

const earthFrag = /* glsl */`
  uniform sampler2D uDay, uNight, uWater, uBump, uLines;
  uniform float uReady, uBumpScale, uZoom;
  uniform vec3 uSun, uAtmo;
  varying vec2 vUv; varying vec3 vN; varying vec3 vPos;

  vec3 bumpNormal(vec3 n){
    vec2 dx = dFdx(vUv), dy = dFdy(vUv);
    if (abs(dx.x) > 0.5 || abs(dy.x) > 0.5) return n;     // texture seam
    float h = texture2D(uBump, vUv).r;
    vec2 dH = vec2(texture2D(uBump, vUv + dx).r - h, texture2D(uBump, vUv + dy).r - h) * uBumpScale;
    vec3 sx = dFdx(vPos), sy = dFdy(vPos);
    vec3 r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1);
    vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
    return normalize(abs(det) * n - grad);
  }

  void main(){
    vec3 n = normalize(vN);
    vec3 v = normalize(-vPos);
    vec3 l = normalize(uSun);
    vec3 nb = bumpNormal(n);

    vec3 day = texture2D(uDay, vUv).rgb;
    vec3 night = texture2D(uNight, vUv).rgb;
    float water = texture2D(uWater, vUv).r;

    float ndl = dot(nb, l);
    float sdl = dot(n, l);
    float lit = smoothstep(-0.16, 0.3, sdl);
    vec3 dayLit = day * (0.3 + 1.18 * max(ndl, 0.0));
    float lum = dot(dayLit, vec3(0.299, 0.587, 0.114));
    dayLit = mix(vec3(lum), dayLit, 1.22);                 // a touch richer than the raw photo
    vec3 nightLit = night * vec3(1.0, 0.8, 0.52) * 1.7 + day * 0.03;
    vec3 col = mix(nightLit, dayLit, lit);

    // oceans: deeper blue, with a soft sheen on the sunlit side
    col *= mix(1.0, 0.84, water * lit);
    col = mix(col, col * vec3(0.86, 0.97, 1.1), water * lit * 0.6);
    vec3 h = normalize(l + v);
    float nh = max(dot(n, h), 0.0);
    col += vec3(1.0, 0.94, 0.84) * (pow(nh, 18.0) * 0.022) * water * lit * (1.0 - uZoom * 0.7);

    // a thin warm tint where day turns into night (a tint, so the dark side stays dark)
    float dusk = smoothstep(-0.05, 0.05, sdl) * (1.0 - smoothstep(0.05, 0.25, sdl));
    col *= mix(vec3(1.0), vec3(1.35, 1.0, 0.75), dusk);

    // country borders fade in as we zoom towards the visitor
    vec4 lines = texture2D(uLines, vUv);
    col = mix(col, vec3(1.0), smoothstep(0.25, 0.8, lines.b) * uZoom * 0.4);

    // atmosphere scattering on the rim, strongest on the sunlit side
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.6);
    col = mix(col, uAtmo * 1.15, fres * (0.12 + 0.62 * smoothstep(-0.35, 0.6, sdl)));

    col = mix(vec3(0.07, 0.11, 0.2), col, uReady);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const cloudFrag = /* glsl */`
  uniform sampler2D uClouds; uniform vec3 uSun; uniform float uOpacity;
  varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
  void main(){
    vec4 t = texture2D(uClouds, vUv);
    float a = t.a * max(t.r, 0.6);
    float lit = smoothstep(-0.2, 0.35, dot(normalize(vN), normalize(uSun)));
    gl_FragColor = vec4(vec3(1.0) * (0.25 + 0.8 * lit), a * uOpacity * (0.25 + 0.75 * lit));
    #include <colorspace_fragment>
  }`;

const atmoVert = /* glsl */`
  varying vec3 vN; varying vec3 vPos;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vPos = mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;
// a thin halo hugging the limb, brighter towards the sun
const atmoFrag = /* glsl */`
  uniform vec3 uAtmo, uSun; uniform float uFade; varying vec3 vN; varying vec3 vPos;
  void main(){
    vec3 n = normalize(vN);
    float d = -dot(n, normalize(-vPos));
    float i = pow(clamp(d / 0.37, 0.0, 1.0), 3.4);
    float sun = 0.3 + 0.7 * smoothstep(-0.6, 0.8, dot(normalize(n.xy + 1e-4), normalize(uSun.xy)));
    vec3 col = mix(uAtmo, vec3(0.92, 0.97, 1.0), i * 0.55);
    gl_FragColor = vec4(col, i * 0.9 * sun * uFade);
    #include <colorspace_fragment>
  }`;

// a soft shadow on the page beneath the globe
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 32, 0, 128, 32, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.setTransform(1, 0, 0, 0.25, 0, 24);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const trailVert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// each note: a white-hot head, a tail in its colour, and a faint dotted route
// showing the whole way it travels
const trailFrag = /* glsl */`
  uniform float uProgress, uTrail, uOpacity, uDash; uniform vec3 uColor;
  varying vec2 vUv;
  void main(){
    float d = uProgress - vUv.x;
    float fade = 1.0 - smoothstep(1.0, 1.0 + uTrail, uProgress);
    float dots = step(fract(vUv.x * uDash), 0.4) * 0.2 * fade * smoothstep(0.0, 0.12, uProgress);
    vec3 col = uColor;
    float a = dots;
    if (d >= 0.0 && d <= uTrail) {
      float k = 1.0 - d / uTrail;
      a = max(a, pow(k, 2.0));
      col = mix(uColor, vec3(1.0, 0.97, 0.92), pow(k, 7.0) * 0.85);
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a * uOpacity);
    #include <colorspace_fragment>
  }`;

// a dashed postal orbit with one Koin riding it
const orbitFrag = /* glsl */`
  uniform float uT, uOpacity; uniform vec3 uColor;
  varying vec2 vUv;
  void main(){
    float dash = step(fract(vUv.x * 150.0), 0.5) * 0.62;
    float d = fract(uT - vUv.x);
    float comet = d < 0.16 ? pow(1.0 - d / 0.16, 2.2) : 0.0;
    float a = max(dash, comet);
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.96, 0.9), comet * comet * 0.6), a * uOpacity);
    #include <colorspace_fragment>
  }`;

/* --------------------------------- globe ----------------------------------- */
export function createGlobe({ canvas, pinEl, reduced = false }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A realistic spinning earth with points of light travelling between cities.');

  const small = matchMedia('(max-width: 899px)').matches;
  let pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const globe = new THREE.Group();
  scene.add(globe);
  globe.rotation.set(0.32, -1.4, 0);

  const sun = new THREE.Vector3(-0.75, 0.45, 0.65).normalize(); // view space, upper left
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;

  const earthMat = new THREE.ShaderMaterial({
    vertexShader: earthVert,
    fragmentShader: earthFrag,
    extensions: { derivatives: true },
    uniforms: {
      uDay: { value: blank }, uNight: { value: blank }, uWater: { value: blank }, uBump: { value: blank }, uLines: { value: blank },
      uReady: { value: 0 }, uBumpScale: { value: 2.2 }, uZoom: { value: 0 },
      uSun: { value: sun }, uAtmo: { value: C.atmo },
    },
  });
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 160, 80), earthMat));

  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: earthVert, fragmentShader: cloudFrag,
    uniforms: { uClouds: { value: blank }, uSun: { value: sun }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false,
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 120, 60), cloudMat);
  clouds.renderOrder = 1;
  globe.add(clouds);

  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: atmoVert, fragmentShader: atmoFrag,
    uniforms: { uAtmo: { value: C.atmo }, uSun: { value: sun }, uFade: { value: 1 } },
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.08, 96, 48), atmoMat);
  scene.add(atmo);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: new THREE.Color('#0b1430'), transparent: true, depthWrite: false, opacity: 0 }),
  );
  shadow.position.set(0, -R * 1.2, -0.2);
  shadow.scale.set(R * 2.1, R * 0.5, 1);
  shadow.renderOrder = -1;
  scene.add(shadow);

  // the orbit sits in the scene, not on the earth, so it keeps its tilt while the earth turns
  class Ring extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) { return out.set(Math.cos(t * TAU), 0, Math.sin(t * TAU)); }
  }
  const orbitMat = new THREE.ShaderMaterial({
    vertexShader: trailVert, fragmentShader: orbitFrag,
    uniforms: { uT: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: C.red } },
    transparent: true, depthWrite: false,
  });
  const orbit = new THREE.Group();
  orbit.rotation.set(0.32, 0, -0.34);
  const orbitR = R * 1.24;
  const orbitTube = new THREE.Mesh(new THREE.TubeGeometry(new Ring(), 480, 0.0034 / 1.24, 6, true), orbitMat);
  orbitTube.scale.setScalar(orbitR);
  orbitTube.renderOrder = 2;
  orbit.add(orbitTube);
  scene.add(orbit);
  const glow = glowTexture();
  const orbitKoin = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color('#ffd9a8'), transparent: true, depthWrite: false }));
  orbitKoin.renderOrder = 4;
  orbit.add(orbitKoin);
  const ringPt = new Ring();

  const load = (url, srgb) => new Promise((res) => loader.load(url, (t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    res(t);
  }, undefined, () => res(null)));

  Promise.all([
    load(IMG + 'earth-blue-marble.jpg', true),
    load(IMG + 'earth-night.jpg', true),
    load(IMG + 'earth-water.png', false),
    load(IMG + 'earth-topology.png', false),
  ]).then(([day, night, water, bump]) => {
    if (day) earthMat.uniforms.uDay.value = day;
    if (night) earthMat.uniforms.uNight.value = night;
    if (water) earthMat.uniforms.uWater.value = water;
    if (bump) earthMat.uniforms.uBump.value = bump;
    ready = !!day;
  });
  load(CLOUDS, false).then((t) => { if (t) { cloudMat.uniforms.uClouds.value = t; cloudsReady = true; } });
  let ready = false;
  let cloudsReady = false;

  // country borders, drawn crisp from vector data, revealed when zoomed in
  (async () => {
    try {
      const topo = await (await fetch(ATLAS_URL)).json();
      const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
      const W = small ? 2048 : 4096;
      const c = document.createElement('canvas');
      c.width = W; c.height = W / 2;
      const g = c.getContext('2d');
      const path = geoPath(geoEquirectangular().scale(W / TAU).translate([W / 2, W / 4]), g);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, W / 2);
      g.strokeStyle = 'rgb(0,0,255)'; g.lineWidth = 0.8 * (W / 2048); g.lineJoin = 'round';
      g.beginPath(); path(borders); g.stroke();
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      earthMat.uniforms.uLines.value = t;
    } catch { /* borders are a nice-to-have */ }
  })();

  /* travelling lights */
  const trailMat = new THREE.ShaderMaterial({
    vertexShader: trailVert, fragmentShader: trailFrag,
    uniforms: { uProgress: { value: 0 }, uTrail: { value: 0.3 }, uOpacity: { value: 1 }, uDash: { value: 40 }, uColor: { value: new THREE.Color() } },
    transparent: true, depthWrite: false,
  });
  const coreMat = new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, depthWrite: false });
  const ringGeo = new THREE.RingGeometry(0.82, 1, 64);
  const Z = new THREE.Vector3(0, 0, 1);
  const arcs = [];
  const ripples = [];

  function ripple(at, color, size, life) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const n = at.clone().normalize();
    m.position.copy(n).multiplyScalar(R * 1.003);
    m.quaternion.setFromUnitVectors(Z, n);
    m.scale.setScalar(0.001);
    m.renderOrder = 3;
    globe.add(m);
    ripples.push({ m, t: 0, life, size });
  }

  function spawnArc(from, to, { color = C.red, speed = 1, width = 1, special = false, trail = null, lift = 1, onLand = null } = {}) {
    const a = llToVec(from[0], from[1], R * 1.002);
    const b = llToVec(to[0], to[1], R * 1.002);
    const ang = a.angleTo(b);
    if (ang < 0.03 || ang > 2.8) return null;
    const h = R * (0.03 + ang * 0.18) * lift * (special ? 1 : 0.8 + Math.random() * 0.45);
    const c1 = a.clone().lerp(b, 0.25).setLength(R + h * 1.33);
    const c2 = a.clone().lerp(b, 0.75).setLength(R + h * 1.33);
    const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
    const geo = new THREE.TubeGeometry(curve, special ? 160 : 90, 0.0024 * width, 6, false);
    const mat = trailMat.clone();
    mat.uniforms.uColor.value = color.clone();
    mat.uniforms.uTrail.value = trail ?? (special ? 0.9 : 0.32 + Math.random() * 0.2);
    mat.uniforms.uDash.value = Math.max(6, Math.round(ang * 46));
    const meshA = new THREE.Mesh(geo, mat);
    meshA.renderOrder = 2;
    globe.add(meshA);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false }));
    head.renderOrder = 4;
    const core = new THREE.Sprite(coreMat);
    core.scale.setScalar(0.42);
    core.renderOrder = 5;
    head.add(core);
    globe.add(head);
    const dur = (1.3 + ang * 1.2) / speed;
    const arc = { mesh: meshA, mat, head, core, curve, dur, t: 0, trail: mat.uniforms.uTrail.value, b, color, landed: false, onLand, special, size: (special ? 0.028 : 0.016) * width };
    arc.done = new Promise((r) => { arc.resolve = r; });
    arcs.push(arc);
    return arc;
  }

  /* visitor marker */
  const userDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: C.red, transparent: true, depthWrite: false }));
  userDot.visible = false;
  userDot.renderOrder = 5;
  globe.add(userDot);

  /* state */
  const size = { w: 0, h: 0 };
  const stage = canvas.parentElement;
  let target = null;
  let targetY = 0;
  let lockY = null;
  let progress = 0;
  let pS = 0;
  let sent = false;
  let sentZ = 0;
  let sentSpread = 0.42; // how far the camera pulls back while a Koin is travelling
  let spinVel = reduced ? 0 : 1.4;
  let spin = globe.rotation.y;
  let spawnAcc = 0;
  let pulse = 0;

  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 2 || h < 2) return;
    size.w = w; size.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  let inView = true;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(stage);

  const tan = Math.tan((camera.fov * DEG) / 2);
  function frameCamera(z, lift) {
    const aspect = size.w / size.h;
    const wide = aspect > 1.1;
    // fraction of the short side the globe fills before the zoom
    const fill = wide ? 0.54 : aspect < 0.62 ? 0.86 : 0.68;
    const d0 = R / (fill * tan * Math.min(1, aspect)) + 0.05;
    const d1 = 1 + 1.15 / (2 * tan * Math.min(1.8, Math.max(0.5, aspect)));
    camera.position.set(0, 0, 1 + Math.exp(lerp(Math.log(d0 - 1), Math.log(d1 - 1), z)));
    // before the zoom the globe sits a little low, clear of the headline; once
    // zoomed it lifts above the message box
    const down = wide ? 0.075 : aspect < 0.62 ? -0.015 : 0.06;
    const up = wide ? 0.23 : 0.2;
    camera.setViewOffset(size.w, size.h, 0, (lift * up - (1 - lift) * down) * size.h, size.w, size.h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const _hp = new THREE.Vector3();
  function toScreen(world) {
    _v.copy(world).project(camera);
    return { x: (_v.x + 1) * 0.5 * size.w, y: (1 - _v.y) * 0.5 * size.h };
  }
  function facesCamera(world) {
    const toCam = camera.position;
    const lim = Math.acos(Math.min(1, R / toCam.length())) + Math.acos(Math.min(1, R / Math.max(R, world.length())));
    return toCam.angleTo(world) < lim;
  }

  // Notes leave in every compass direction. Each new one turns by the golden
  // angle from the last, so headings spread evenly round the dial, and they
  // start from whichever side of the earth is facing you.
  const CV = CITIES.map((c) => llToVec(c[1], c[2], 1));
  const _c = new THREE.Vector3();
  let heading = Math.random() * TAU;
  let outward = true;
  function bearing(la1, lo1, la2, lo2) {
    const p1 = la1 * DEG, p2 = la2 * DEG, dl = (lo2 - lo1) * DEG;
    return Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  }
  function towards(lat, lon, want, minA, maxA, from) {
    let best = null, score = Infinity;
    CITIES.forEach((c, i) => {
      const ang = CV[i].angleTo(from);
      if (ang < minA || ang > maxA) return;
      const s = Math.abs(wrap(bearing(lat, lon, c[1], c[2]) - want)) + Math.random() * 0.25;
      if (s < score) { score = s; best = c; }
    });
    return best;
  }
  function destPoint(lat, lon, brg, dist) {
    const p1 = lat * DEG, l1 = lon * DEG;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(dist) + Math.cos(p1) * Math.sin(dist) * Math.cos(brg));
    const l2 = l1 + Math.atan2(Math.sin(brg) * Math.sin(dist) * Math.cos(p1), Math.cos(dist) - Math.sin(p1) * Math.sin(p2));
    return [p2 / DEG, ((l2 / DEG + 540) % 360) - 180];
  }
  const tint = () => { const r = Math.random(); return r < 0.55 ? C.red : r < 0.85 ? C.white : C.gold; };

  function spawnAmbient(zoomed) {
    heading += 2.39996;
    const color = tint();
    if (target && zoomed) {
      // around the visitor: half arrive, half leave, from every side
      const home = llToVec(target.lat, target.lon, 1);
      const c = towards(target.lat, target.lon, heading, 0.12, 1.1, home);
      if (!c) return;
      outward = !outward;
      const me = [target.lat, target.lon], it = [c[1], c[2]];
      spawnArc(outward ? me : it, outward ? it : me, { color, speed: 0.8, width: 0.6, onLand: outward ? null : () => { pulse = 1; } });
      return;
    }
    globe.worldToLocal(_c.copy(camera.position)).normalize();
    const near = CITIES.filter((_, i) => CV[i].dot(_c) > 0.35);
    const a = pick(near.length ? near : CITIES);
    const b = towards(a[1], a[2], heading, 0.25, 1.5, llToVec(a[1], a[2], 1));
    if (b) spawnArc([a[1], a[2]], [b[1], b[2]], { color, speed: 1, width: zoomed ? 0.6 : 1 });
  }

  const clock = new THREE.Clock();

  function update(dt) {
    if (ready) earthMat.uniforms.uReady.value = Math.min(1, earthMat.uniforms.uReady.value + dt * 1.5);

    pS = damp(pS, progress, reduced ? 30 : 5, dt);
    sentZ = damp(sentZ, sent ? 1 : 0, 2.2, dt);
    const blend = target ? smooth(0.02, 0.55, pS) : 0;
    const lift = smooth(0.08, 0.78, pS); // keeps the globe above the message box
    const z = lerp(lift, Math.min(lift, sentSpread), sentZ);
    earthMat.uniforms.uZoom.value = z;
    earthMat.uniforms.uBumpScale.value = 2.2 * (1 - z * 0.85); // relief texels get blocky up close
    if (cloudsReady) cloudMat.uniforms.uOpacity.value = damp(cloudMat.uniforms.uOpacity.value, 0.9 * (1 - z * 0.92), 3, dt);
    clouds.rotation.y += dt * 0.006;

    const free = pS < 0.004 && !sent;
    spinVel = damp(spinVel, free && !reduced ? 0.18 : 0, free ? 0.8 : 4, dt);
    spin += spinVel * dt;
    if (free || lockY === null) lockY = spin + wrap(targetY - spin);
    globe.rotation.y = damp(globe.rotation.y, lerp(spin, lockY, blend), 9, dt);
    globe.rotation.x = damp(globe.rotation.x, lerp(0.32, target ? target.lat * DEG : 0.32, blend), 9, dt);

    frameCamera(z, lift);
    globe.updateMatrixWorld();

    // page shadow and postal orbit belong to the whole-earth view; they leave as we zoom
    const whole = 1 - smooth(0.0, 0.3, z);
    const dark = document.documentElement.dataset.theme === 'dark';
    shadow.material.opacity = (dark ? 0.55 : 0.3) * whole * earthMat.uniforms.uReady.value;
    shadow.visible = whole > 0.01;
    orbitMat.uniforms.uOpacity.value = whole * earthMat.uniforms.uReady.value;
    orbit.visible = whole > 0.01 && camera.aspect > 0.8; // on phones the earth fills the width, so the ring would be cut off
    if (orbit.visible) {
      const ot = (orbitMat.uniforms.uT.value + dt * (reduced ? 0 : 0.035)) % 1;
      orbitMat.uniforms.uT.value = ot;
      ringPt.getPoint(ot, orbitKoin.position).multiplyScalar(orbitR);
      orbitKoin.getWorldPosition(_hp);
      orbitKoin.scale.setScalar(0.022 * _hp.distanceTo(camera.position));
      orbitKoin.material.opacity = whole;
    }

    const zoomed = z > 0.35;
    spawnAcc += dt * (reduced ? 0.4 : zoomed ? 1.4 : 4.5);
    while (spawnAcc > 1) { spawnAcc -= 1; if (arcs.length < (small ? 18 : 30)) spawnAmbient(zoomed); }

    for (let i = arcs.length - 1; i >= 0; i--) {
      const A = arcs[i];
      A.t += dt;
      const p = A.t / A.dur;
      A.mat.uniforms.uProgress.value = p;
      if (p <= 1) A.curve.getPointAt(p, A.head.position);
      A.head.material.opacity = p <= 1 ? 1 : Math.max(0, 1 - (p - 1) / 0.08);
      A.core.visible = p <= 1;
      A.head.getWorldPosition(_hp);
      A.head.scale.setScalar(A.size * _hp.distanceTo(camera.position));
      if (!A.landed && p >= 1) {
        A.landed = true;
        ripple(A.b, A.color, A.special ? 0.06 : 0.025, A.special ? 2.4 : 1.3);
        A.onLand?.();
        A.resolve();
      }
      if (p > 1 + A.trail) {
        globe.remove(A.mesh, A.head);
        A.mesh.geometry.dispose(); A.mat.dispose(); A.head.material.dispose();
        arcs.splice(i, 1);
      }
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.t += dt;
      const k = r.t / r.life;
      r.m.scale.setScalar(0.001 + (1 - Math.pow(1 - k, 3)) * r.size);
      r.m.material.opacity = (1 - k) * 0.9;
      if (k >= 1) { globe.remove(r.m); r.m.material.dispose(); ripples.splice(i, 1); }
    }

    if (target) {
      llToVec(target.lat, target.lon, R * 1.004, userDot.position);
      userDot.visible = true;
      userDot.getWorldPosition(_w);
      pulse = Math.max(0, pulse - dt * 1.5);
      userDot.scale.setScalar((0.03 + pulse * 0.02) * _w.distanceTo(camera.position));
      if (pinEl) {
        const s = toScreen(_w);
        pinEl.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
        pinEl.dataset.visible = facesCamera(_w) ? 'true' : 'false';
      }
    }
  }

  // step down resolution on weak GPUs
  const perf = { n: 0, sum: 0, done: false };
  function frame() {
    requestAnimationFrame(frame);
    const raw = clock.getDelta();
    if (!inView || document.hidden || size.w < 2) return;
    if (!perf.done && ++perf.n <= 90) {
      perf.sum += raw;
      if (perf.n === 90) {
        perf.done = true;
        if (perf.sum / 90 > 1 / 35) { pr = Math.max(1, pr * 0.6); renderer.setPixelRatio(pr); resize(); }
      }
    }
    update(Math.min(raw, 1 / 8));
    renderer.render(scene, camera);
  }
  frame();

  return {
    setProgress(p) { progress = clamp01(p); },
    setTarget(loc) {
      target = loc;
      const v = llToVec(loc.lat, loc.lon, 1);
      targetY = -Math.atan2(v.x, v.z);
      lockY = spin + wrap(targetY - spin);
    },
    pickDestination(loc) {
      const u = llToVec(loc.lat, loc.lon, 1);
      const ok = CITIES.filter((c) => { const a = u.angleTo(llToVec(c[1], c[2], 1)); return a > 0.3 && a < 0.95; });
      return pick(ok.length ? ok : CITIES);
    },
    // one Koin, one or many destinations: lights leave in a short stagger
    sendKoin(loc, dests) {
      const list = Array.isArray(dests[0]) ? dests : [dests];
      sent = true;
      sentSpread = list.length > 4 ? 0.05 : list.length > 1 ? 0.25 : 0.42;
      pulse = 1;
      const gap = Math.min(220, 2400 / list.length);
      const many = list.length > 1;
      return Promise.all(list.map((d, i) => new Promise((res) => {
        setTimeout(() => {
          const arc = spawnArc([loc.lat, loc.lon], [d[1], d[2]], { color: i % 3 === 2 ? C.white : C.red, special: true, speed: many ? 0.55 : 0.42, width: many ? 1.2 : 2 });
          pulse = 1;
          // the moment it leaves, a ring of short sparks scatters to every side
          if (i === 0 && !reduced) {
            const start = Math.random() * TAU;
            for (let k = 0; k < 8; k++) {
              const to = destPoint(loc.lat, loc.lon, start + (k * TAU) / 8, 0.09 + Math.random() * 0.07);
              spawnArc([loc.lat, loc.lon], to, { color: k % 2 ? C.gold : C.white, speed: 1.5, width: 0.55, trail: 0.5, lift: 0.7 });
            }
          }
          (arc ? arc.done : Promise.resolve()).then(res);
        }, i * gap);
      })));
    },
    resetSend() { sent = false; },
  };
}
