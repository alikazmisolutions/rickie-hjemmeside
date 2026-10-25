// Fifteen thousand gold particles that keep rebuilding themselves: the RW logo, then
// each trade in turn (frame house, roof trusses, terrace, windows and door, spiral
// stair), bursting into a swirl between shapes. The cursor parts the particles.
import * as THREE from './three.module.min.js';

const canvas = document.getElementById('house');
const label = document.getElementById('morph-label');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth < 820;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
}

if (renderer) start();

async function start() {
  const N = isSmall() ? 9000 : 15000;
  const GOLD = new THREE.Color(0xe2b866);
  const additive = (o) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  // ---------- shapes, each sampled to exactly N points ----------
  const segs = [];
  const S = (a, b) => segs.push([a, b]);
  function fromSegments(thick = 0.035) {
    const list = segs.splice(0);
    const lens = list.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    const total = lens.reduce((s, l) => s + l, 0);
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let r = Math.random() * total, k = 0;
      while (r > lens[k]) r -= lens[k++];
      const [a, b] = list[k], t = r / lens[k];
      out[i * 3] = a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * thick;
      out[i * 3 + 1] = a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * thick;
      out[i * 3 + 2] = a[2] + (b[2] - a[2]) * t + (Math.random() - 0.5) * thick;
    }
    return out;
  }
  // centre on x/z, stand on the platform (or float, for the logo), fit to `size`
  function fit(arr, size, float) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], arr[i + k]); max[k] = Math.max(max[k], arr[i + k]); }
    const s = size / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2, cy = (min[1] + max[1]) / 2;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = (arr[i] - cx) * s;
      arr[i + 1] = float ? (arr[i + 1] - cy) * s + 0.55 : (arr[i + 1] - min[1]) * s - 1.6;
      arr[i + 2] = (arr[i + 2] - cz) * s;
    }
    return arr;
  }

  // RW logo, sampled from the brand serif drawn on a hidden canvas
  async function logoShape() {
    try { await document.fonts.load('400 220px Fraunces'); } catch (e) {}
    const c = document.createElement('canvas'); c.width = 640; c.height = 300;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '400 250px Fraunces, Georgia, serif';
    g.fillText('RW', 320, 160);
    const px = g.getImageData(0, 0, c.width, c.height).data, hits = [];
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (px[(y * c.width + x) * 4 + 3] > 128) hits.push([x, y]);
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const [x, y] = hits[(Math.random() * hits.length) | 0];
      out.set([(x - 320) / 100 + (Math.random() - 0.5) * 0.02, -(y - 160) / 100 + (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.35], i * 3);
    }
    return fit(out, 5.4, true);
  }

  function houseShape() {
    const W = 2.2, D = 1.6, H = 2.4, R = 3.85;
    S([-W, 0, -D], [W, 0, -D]); S([-W, 0, D], [W, 0, D]); S([-W, 0, -D], [-W, 0, D]); S([W, 0, -D], [W, 0, D]);
    for (let x = -W; x <= W + 0.01; x += 0.55) { if (x > -0.4 && x < 0.5) continue; S([x, 0, D], [x, H, D]); S([x, 0, -D], [x, H, -D]); }
    S([-0.4, 0, D], [-0.4, H, D]); S([0.5, 0, D], [0.5, H, D]); S([-0.4, 2, D], [0.5, 2, D]);
    for (let z = -D + 0.55; z < D - 0.2; z += 0.55) { S([-W, 0, z], [-W, H, z]); S([W, 0, z], [W, H, z]); }
    S([-W, H, -D], [W, H, -D]); S([-W, H, D], [W, H, D]); S([-W, H, -D], [-W, H, D]); S([W, H, -D], [W, H, D]);
    for (let x = -W - 0.15; x <= W + 0.16; x += 0.55) { S([x, H, D + 0.35], [x, R, 0]); S([x, H, -D - 0.35], [x, R, 0]); }
    S([-W - 0.4, R, 0], [W + 0.4, R, 0]);
    return fit(fromSegments(), 5.2);
  }

  function roofShape() {
    for (let x = -2.6; x <= 2.61; x += 0.52) {
      S([x, 0, -2], [x, 1.9, 0]); S([x, 1.9, 0], [x, 0, 2]); S([x, 0, -2], [x, 0, 2]);
      S([x, 0, 0], [x, 1.9, 0]); S([x, 0, 0], [x, 0.95, -1]); S([x, 0, 0], [x, 0.95, 1]);
    }
    for (const t of [0.15, 0.5, 0.85]) { S([-2.6, 1.9 * (1 - t), -2 * t], [2.6, 1.9 * (1 - t), -2 * t]); S([-2.6, 1.9 * (1 - t), 2 * t], [2.6, 1.9 * (1 - t), 2 * t]); }
    S([-2.6, 1.9, 0], [2.6, 1.9, 0]);
    return fit(fromSegments(), 5.4);
  }

  function terraceShape() {
    const y = 0.7;
    for (let z = -1.6; z <= 1.61; z += 0.2) { S([-2.6, y, z], [2.6, y, z]); }
    for (let x = -2.6; x <= 2.61; x += 0.65) { S([x, y - 0.12, -1.6], [x, y - 0.12, 1.6]); S([x, 0, 1.6], [x, y, 1.6]); S([x, 0, -1.6], [x, y, -1.6]); }
    for (let x = -2.6; x <= 2.61; x += 1.3) { S([x, y, -1.6], [x, y + 1.0, -1.6]); }
    S([-2.6, y + 1.0, -1.6], [2.6, y + 1.0, -1.6]); S([-2.6, y + 0.5, -1.6], [2.6, y + 0.5, -1.6]);
    S([-2.6, y, -1.6], [-2.6, y + 1.0, -1.6]); S([-2.6, y + 1.0, -1.6], [-2.6, y + 1.0, 1.6]); S([-2.6, y, 1.6], [-2.6, y + 1.0, 1.6]);
    for (let i = 0; i < 3; i++) { const z = 1.6 + 0.35 * (i + 1), h = y - 0.23 * (i + 1); S([-0.8, h, z], [0.8, h, z]); S([-0.8, h, z - 0.35], [-0.8, h, z]); S([0.8, h, z - 0.35], [0.8, h, z]); }
    return fit(fromSegments(), 5.4);
  }

  function windowShape() {
    const frame = (x0, x1, y0, y1, z) => { S([x0, y0, z], [x1, y0, z]); S([x1, y0, z], [x1, y1, z]); S([x1, y1, z], [x0, y1, z]); S([x0, y1, z], [x0, y0, z]); };
    for (const d of [0, 0.18]) {
      frame(-2.6, -0.9, 0.9, 3.1, d); frame(0.9, 2.6, 0.9, 3.1, d); frame(-0.6, 0.6, 0, 3.1, d);
      S([-1.75, 0.9, d], [-1.75, 3.1, d]); S([-2.6, 2.1, d], [-0.9, 2.1, d]);
      S([1.75, 0.9, d], [1.75, 3.1, d]); S([0.9, 2.1, d], [2.6, 2.1, d]);
      S([-0.6, 2.4, d], [0.6, 2.4, d]);
    }
    for (const [x, y] of [[-2.6, 0.9], [-0.9, 0.9], [-2.6, 3.1], [-0.9, 3.1], [0.9, 0.9], [2.6, 0.9], [0.9, 3.1], [2.6, 3.1], [-0.6, 0], [0.6, 0], [-0.6, 3.1], [0.6, 3.1]]) S([x, y, 0], [x, y, 0.18]);
    S([-2.75, 0.85, 0.3], [-0.75, 0.85, 0.3]); S([0.75, 0.85, 0.3], [2.75, 0.85, 0.3]);
    S([0.4, 1.4, 0.18], [0.4, 1.6, 0.18]);
    return fit(fromSegments(), 5.4);
  }

  function stairShape() {
    const steps = 22, r0 = 0.25, r1 = 1.9, rise = 0.19;
    S([0, 0, 0], [0, steps * rise + 0.6, 0]);
    for (let i = 0; i < steps; i++) {
      const a0 = i * 0.42, a1 = a0 + 0.36, y = i * rise;
      const p = (r, a, h) => [Math.cos(a) * r, h, Math.sin(a) * r];
      S(p(r0, a0, y), p(r1, a0, y)); S(p(r0, a1, y), p(r1, a1, y)); S(p(r1, a0, y), p(r1, a1, y));
      S(p(r1, a0, y), p(r1, a0, y + 0.9));
      if (i > 0) S(p(r1, a0 - 0.42, y - rise + 0.9), p(r1, a0, y + 0.9));
    }
    return fit(fromSegments(), 5.0);
  }

  const shapes = [
    { name: 'RW Entreprise', pts: await logoShape() },
    { name: 'Totalentrepriser', pts: houseShape() },
    { name: 'Tagentrepriser', pts: roofShape() },
    { name: 'Terrasser', pts: terraceShape() },
    { name: 'Døre og vinduer', pts: windowShape() },
    { name: 'Moderniseringer', pts: stairShape() },
  ];

  // ---------- particles ----------
  const chaos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 3 + Math.random() * 6;
    chaos.set([s * Math.cos(a) * r, u * r * 0.7 + 0.5, s * Math.sin(a) * r], i * 3);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  const aFrom = new THREE.BufferAttribute(chaos.slice(), 3), aTo = new THREE.BufferAttribute(shapes[0].pts.slice(), 3);
  geo.setAttribute('position', aTo);
  geo.setAttribute('aFrom', aFrom);
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

  const uniforms = {
    uMix: { value: reduceMotion ? 1 : 0 }, uTime: { value: 0 }, uPixel: { value: Math.min(devicePixelRatio, 2) },
    uSize: { value: isSmall() ? 24 : 21 }, uMouse: { value: new THREE.Vector2(9, 9) }, uAspect: { value: 1 }, uOpacity: { value: 1 },
  };
  const particles = new THREE.Points(geo, new THREE.ShaderMaterial(additive({
    uniforms,
    vertexShader: `
      uniform float uMix, uTime, uPixel, uSize, uAspect; uniform vec2 uMouse;
      attribute vec3 aFrom; attribute float aSeed; varying float vGlow;
      void main() {
        float m = clamp(uMix * 1.45 - aSeed * 0.45, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        vec3 p = mix(aFrom, position, m);
        float burst = sin(3.14159 * m);
        vec3 dir = normalize(vec3(sin(aSeed * 91.0), cos(aSeed * 57.0) * 0.8, sin(aSeed * 33.0) + 0.01));
        float swirl = burst * (1.0 + aSeed * 2.2);
        p += dir * swirl;
        p.xz = mat2(cos(burst * 1.2), -sin(burst * 1.2), sin(burst * 1.2), cos(burst * 1.2)) * p.xz;
        p += 0.018 * vec3(sin(uTime * 0.9 + aSeed * 40.0), cos(uTime * 0.8 + aSeed * 30.0), sin(uTime * 0.7 + aSeed * 20.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vec2 ndc = gl_Position.xy / gl_Position.w; vec2 d = ndc - uMouse; d.x *= uAspect;
        float f = smoothstep(0.3, 0.0, length(d));
        vec2 push = normalize(d + 1e-4); push.x /= uAspect;
        gl_Position.xy += push * f * 0.08 * gl_Position.w;
        float wave = smoothstep(0.93, 1.0, sin(p.y * 2.2 + p.x * 0.8 - uTime * 1.8 + aSeed * 1.2));
        vGlow = wave + burst * 0.8 + f * 0.6;
        gl_PointSize = uSize * uPixel * (0.55 + aSeed * 0.9) * (1.0 + vGlow * 0.8) / -mv.z;
      }`,
    fragmentShader: `
      uniform float uOpacity; varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        vec3 gold = vec3(0.89, 0.72, 0.42);
        vec3 col = mix(gold, vec3(1.0, 0.96, 0.88), clamp(vGlow, 0.0, 1.0));
        gl_FragColor = vec4(col, smoothstep(0.5, 0.0, d) * uOpacity * (0.85 + vGlow * 0.6));
      }`,
  })));
  const group = new THREE.Group();
  group.add(particles);
  scene.add(group);

  // Projector platform, grid and stars (as in the frame version)
  const platform = new THREE.Group(); platform.position.y = -1.66;
  [[3.6, 0.45], [4.1, 0.2], [5.2, 0.12], [6.6, 0.06]].forEach(([r, o]) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.012, r + 0.012, 160), new THREE.MeshBasicMaterial(additive({ color: GOLD, opacity: o, side: THREE.DoubleSide })));
    ring.rotation.x = -Math.PI / 2; platform.add(ring);
  });
  const tp = [];
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, r2 = i % 10 === 0 ? 4.55 : 4.3; tp.push(Math.cos(a) * 4.1, 0, Math.sin(a) * 4.1, Math.cos(a) * r2, 0, Math.sin(a) * r2); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  platform.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial(additive({ color: GOLD, opacity: 0.32 }))));
  scene.add(platform);
  const grid = new THREE.GridHelper(40, 60, 0x7fa8d8, 0x7fa8d8);
  grid.material.transparent = true; grid.material.opacity = 0.06; grid.position.y = -1.7;
  scene.add(grid);
  const sp = new Float32Array((isSmall() ? 1400 : 2600) * 3);
  for (let i = 0; i < sp.length; i += 3) sp.set([(Math.random() - 0.5) * 140, Math.random() * 70 - 20, (Math.random() - 0.5) * 80 - 50], i);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial(additive({ color: 0xdfe6ff, size: 0.14, opacity: 0.7 }))));

  // ---------- timeline ----------
  const HOLD = 3.4, MORPH = 2.0, FIRST = 2.6;
  let current = 0, phaseStart = performance.now() / 1000, morphing = !reduceMotion, firstRun = true;
  const showLabel = (name) => { if (!label) return; label.classList.remove('in'); void label.offsetWidth; label.querySelector('b').textContent = name; label.classList.add('in'); };
  showLabel(shapes[0].name);
  function nextShape() {
    aFrom.array.set(shapes[current].pts); aFrom.needsUpdate = true;
    current = (current + 1) % shapes.length;
    aTo.array.set(shapes[current].pts); aTo.needsUpdate = true;
    uniforms.uMix.value = 0; morphing = true; phaseStart = performance.now() / 1000;
    showLabel(shapes[current].name);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;
    group.scale.setScalar(isSmall() ? 0.78 : 1);
    if (isSmall()) { camera.position.set(11.5, 6.8, 19); camera.lookAt(0, 0.6, 0); camera.setViewOffset(w, h, 0, h * 0.25, w, h); }
    else { camera.position.set(9.2, 5.0, 12.8); camera.lookAt(0, 0.7, 0); camera.setViewOffset(w, h, -w * 0.21, -h * 0.02, w, h); }
  }
  resize();
  addEventListener('resize', resize);

  const mouse = { x: 9, y: 9, tx: 9, ty: 9 };
  addEventListener('pointermove', e => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = -(e.clientY / innerHeight) * 2 + 1; if (mouse.x > 5) { mouse.x = mouse.tx; mouse.y = mouse.ty; } });
  document.addEventListener('pointerleave', () => { mouse.tx = mouse.x = 9; });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  const facing = Math.atan2(camera.position.x, camera.position.z);
  const t0 = performance.now() / 1000;
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const now = performance.now() / 1000, t = now - t0;
    if (!reduceMotion) {
      const dur = firstRun ? FIRST : MORPH;
      if (morphing) {
        uniforms.uMix.value = Math.min(1, (now - phaseStart) / dur);
        if (uniforms.uMix.value >= 1) { morphing = false; firstRun = false; phaseStart = now; }
      } else if (now - phaseStart > HOLD) nextShape();
    }
    uniforms.uTime.value = reduceMotion ? 0 : t;
    if (mouse.tx < 5) { mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08; }
    uniforms.uMouse.value.set(mouse.tx < 5 ? mouse.x : 9, mouse.tx < 5 ? mouse.y : 9);
    group.rotation.y = facing - 0.15 + (reduceMotion ? 0 : Math.sin(t * 0.22) * 0.55) + (mouse.tx < 5 ? mouse.x * 0.2 : 0) + scrollY * 0.001;
    platform.rotation.y = reduceMotion ? 0 : -t * 0.05;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  document.documentElement.classList.add('house-ready');
}
