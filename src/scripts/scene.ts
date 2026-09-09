import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function requireElement(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Bontr scene mount point missing: ${selector}`);
  return element;
}

const mount = requireElement("#webgl");
const heroCopy = requireElement("[data-hero-copy]");
const heroChrome = requireElement("[data-hero-chrome]");
const fieldCopy = requireElement("[data-field-copy]");
const person = requireElement("[data-person]");
const story = requireElement(".story");

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const compact = window.matchMedia("(max-width: 700px)").matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070707);
scene.fog = new THREE.FogExp2(0x070707, 0.014);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);
camera.position.set(0, 0.1, 10);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.1 : 1.5));
mount.appendChild(renderer.domElement);
document.documentElement.classList.add("webgl-ready");

let seed = 0x0b07cafe;
function random() {
  seed += 0x6d2b79f5;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomBetween(min: number, max: number) {
  return min + random() * (max - min);
}

const vertexShader = `
  attribute float aSize;
  attribute float aWarm;
  varying float vWarm;

  void main() {
    vWarm = aWarm;    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (145.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;
  varying float vWarm;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float horizontal = step(abs(p.y), 0.095) * step(abs(p.x), 0.47);
    float vertical = step(abs(p.x), 0.095) * step(abs(p.y), 0.47);
    float core = step(max(abs(p.x), abs(p.y)), 0.15);
    float alpha = max(max(horizontal, vertical), core);
    if (alpha < 0.5) discard;
    vec3 color = mix(uColor, uAccent, vWarm);
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

function makeCrossMaterial(opacity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xe9e7e0) },
      uAccent: { value: new THREE.Color(0xff9b54) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
  });
}

function pointsFromArrays(
  positions: number[],
  sizes: number[],
  warmth: number[],
  opacity = 1,
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aWarm", new THREE.Float32BufferAttribute(warmth, 1));
  const material = makeCrossMaterial(opacity);
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

function buildTerrain(count: number) {
  const positions: number[] = [];
  const sizes: number[] = [];
  const warmth: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const x = randomBetween(-12, 12);
    const z = randomBetween(-3.5, 8.2);
    const ridge = Math.sin(x * 0.58) * 0.23 + Math.cos(z * 0.72) * 0.17;
    const secondary = Math.sin((x + z) * 0.27) * 0.12;
    const falloff = Math.abs(x) * 0.016 + Math.max(0, -z) * 0.045;
    const y = -2.65 + ridge + secondary - falloff + randomBetween(-0.04, 0.04);
    positions.push(x, y, z);
    sizes.push(randomBetween(0.46, 1.05));
    warmth.push(random() > 0.975 ? randomBetween(0.14, 0.48) : 0);
  }

  return pointsFromArrays(positions, sizes, warmth, 0.64);
}

function buildFlower(count: number) {
  const positions: number[] = [];
  const sizes: number[] = [];
  const warmth: number[] = [];
  const petals = 5;
  const petalCount = Math.floor(count * 0.72);

  for (let i = 0; i < petalCount; i += 1) {
    const petal = Math.floor(random() * petals);
    const along = random();
    const angle = petal * ((Math.PI * 2) / petals) - 0.18;
    const tangent = angle + Math.PI * 0.5;
    const distance = 0.55 + along * 3.15;
    const envelope = Math.pow(Math.sin(along * Math.PI), 0.62);
    const lateral = randomBetween(-1, 1) * (0.2 + envelope * 0.92);
    const depth =
      -0.12 - envelope * randomBetween(0.16, 0.5) + randomBetween(-0.12, 0.12);

    positions.push(
      Math.cos(angle) * distance + Math.cos(tangent) * lateral,
      Math.sin(angle) * distance * 0.83 + Math.sin(tangent) * lateral * 0.83,
      depth,
    );
    sizes.push(randomBetween(0.5, 1.18));
    const centerHeat = Math.max(0, 1 - along * 3.4);
    warmth.push(
      Math.max(
        centerHeat * 0.8,
        random() > 0.985 ? randomBetween(0.14, 0.5) : 0,
      ),
    );
  }

  const coreCount = Math.floor(count * 0.12);
  for (let i = 0; i < coreCount; i += 1) {
    const theta = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.86;
    positions.push(
      Math.cos(theta) * radius,
      Math.sin(theta) * radius * 0.78,
      randomBetween(-0.22, 0.2),
    );
    sizes.push(randomBetween(0.62, 1.36));
    warmth.push(randomBetween(0.62, 1));
  }

  const stemCount = Math.floor(count * 0.1);
  for (let i = 0; i < stemCount; i += 1) {
    const t = random();
    positions.push(
      -0.04 + Math.sin(t * 2.2) * 0.14 + randomBetween(-0.035, 0.035),
      -0.48 - t * 4.25,
      randomBetween(-0.08, 0.08),
    );
    sizes.push(randomBetween(0.42, 0.88));
    warmth.push(random() > 0.992 ? randomBetween(0.1, 0.32) : 0);
  }

  const leafCount = Math.floor(count * 0.06);
  for (let i = 0; i < leafCount; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const t = random();
    const angle = side > 0 ? 0.58 : Math.PI - 0.46;
    const tangent = angle + Math.PI * 0.5;
    const distance = 0.15 + t * 1.45;
    const lateral = randomBetween(-1, 1) * Math.sin(t * Math.PI) * 0.38;
    const baseY = side > 0 ? -2.35 : -3.05;
    positions.push(
      Math.cos(angle) * distance + Math.cos(tangent) * lateral,
      baseY + Math.sin(angle) * distance + Math.sin(tangent) * lateral,
      randomBetween(-0.08, 0.08),
    );
    sizes.push(randomBetween(0.42, 0.9));
    warmth.push(0);
  }

  return pointsFromArrays(positions, sizes, warmth, 0.92);
}
function buildGalaxy(count: number) {
  const positions: number[] = [];
  const sizes: number[] = [];
  const warmth: number[] = [];
  const arms = 4;

  for (let i = 0; i < count; i += 1) {
    const radius = Math.pow(random(), 0.58) * 7.6;
    const arm = i % arms;
    const angle =
      arm * ((Math.PI * 2) / arms) + radius * 0.9 + randomBetween(-0.36, 0.36);
    const eccentricity = 0.68 + random() * 0.22;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * eccentricity;
    const z = randomBetween(-0.34, 0.34) * (0.35 + radius * 0.08);
    positions.push(x, y, z);
    sizes.push(randomBetween(0.44, radius < 1.7 ? 1.45 : 1.02));
    const coreHeat = Math.max(0, 1 - radius / 2.25);
    warmth.push(
      Math.max(coreHeat, random() > 0.978 ? randomBetween(0.2, 0.72) : 0),
    );
  }

  return pointsFromArrays(positions, sizes, warmth, 0);
}

function buildStars(count: number) {
  const positions: number[] = [];
  const sizes: number[] = [];
  const warmth: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(randomBetween(-1, 1));
    const radius = randomBetween(18, 42);
    positions.push(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius * 0.64,
      Math.sin(phi) * Math.sin(theta) * radius - 16,
    );
    sizes.push(randomBetween(0.3, 0.78));
    warmth.push(random() > 0.985 ? randomBetween(0.18, 0.55) : 0);
  }

  return pointsFromArrays(positions, sizes, warmth, 0.38);
}

function buildOrbit(
  radiusX: number,
  radiusY: number,
  rotation: number,
  opacity: number,
) {
  const curve: THREE.Vector3[] = [];
  for (let i = 0; i <= 180; i += 1) {
    const angle = (i / 180) * Math.PI * 2;
    curve.push(
      new THREE.Vector3(
        Math.cos(angle) * radiusX,
        Math.sin(angle) * radiusY,
        0,
      ),
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(curve);
  const material = new THREE.LineBasicMaterial({
    color: 0xffa15b,
    transparent: true,
    opacity,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.rotation.z = rotation;
  line.frustumCulled = false;
  return { line, material };
}

const heroWorld = new THREE.Group();
const fieldWorld = new THREE.Group();
scene.add(heroWorld, fieldWorld);

const terrain = buildTerrain(compact ? 1500 : 3000);
terrain.points.rotation.x = -0.035;
heroWorld.add(terrain.points);

const flower = buildFlower(compact ? 3600 : 7200);
flower.points.position.set(compact ? 2.55 : 3.65, 1.25, -12.5);
flower.points.rotation.set(0.08, -0.06, -0.08);
heroWorld.add(flower.points);

const flowerOrbit = buildOrbit(
  compact ? 4.5 : 5.8,
  compact ? 1.2 : 1.5,
  -0.14,
  0.08,
);
flowerOrbit.line.position.copy(flower.points.position);
flowerOrbit.line.rotation.x = 0.28;
heroWorld.add(flowerOrbit.line);

const galaxy = buildGalaxy(compact ? 5200 : 10500);
galaxy.points.position.set(compact ? 1.25 : 3.2, 0.3, -30);
galaxy.points.rotation.set(0.16, 0.02, -0.34);
galaxy.points.scale.setScalar(compact ? 0.86 : 1);
fieldWorld.add(galaxy.points);

const galaxyOrbitA = buildOrbit(8.8, 2.3, -0.12, 0);
galaxyOrbitA.line.position.copy(galaxy.points.position);
galaxyOrbitA.line.rotation.x = 0.18;
fieldWorld.add(galaxyOrbitA.line);

const galaxyOrbitB = buildOrbit(6.5, 1.25, 0.38, 0);
galaxyOrbitB.line.position.copy(galaxy.points.position);
galaxyOrbitB.line.rotation.x = -0.22;
fieldWorld.add(galaxyOrbitB.line);

const stars = buildStars(compact ? 700 : 1500);
scene.add(stars.points);

const pointerTarget = new THREE.Vector2();
const pointer = new THREE.Vector2();
let scrollTarget = 0;
let scrollProgress = 0;
let visible = !document.hidden;
let rafId = 0;

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function setMaterialOpacity(material: THREE.ShaderMaterial, value: number) {
  material.uniforms.uOpacity.value = THREE.MathUtils.clamp(value, 0, 1);
}

function applySceneState(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const heroFade = 1 - smoothstep(0.22, 0.68, p);
  const terrainFade = 1 - smoothstep(0.3, 0.72, p);
  const galaxyReveal = smoothstep(0.5, 0.86, p);

  if (reducedMotion) {
    const fieldMode = p >= 0.5;
    camera.position.set(
      fieldMode ? 0.5 : 0,
      fieldMode ? 0.3 : 0.1,
      fieldMode ? -16 : 10,
    );
    camera.lookAt(
      fieldMode ? 1.65 : 1.5,
      fieldMode ? 0.15 : 0.1,
      fieldMode ? -30 : -12.5,
    );
    setMaterialOpacity(terrain.material, fieldMode ? 0 : 0.64);
    setMaterialOpacity(flower.material, fieldMode ? 0 : 0.92);
    flowerOrbit.material.opacity = fieldMode ? 0 : 0.08;
    setMaterialOpacity(galaxy.material, fieldMode ? 0.96 : 0);
    galaxyOrbitA.material.opacity = fieldMode ? 0.2 : 0;
    galaxyOrbitB.material.opacity = fieldMode ? 0.12 : 0;
    heroCopy.style.opacity = fieldMode ? "0" : "1";
    heroChrome.style.opacity = fieldMode ? "0" : "1";
    person.style.opacity = fieldMode ? "0" : "1";
    fieldCopy.style.opacity = fieldMode ? "1" : "0";
    fieldCopy.style.transform = "translateY(0)";
    return;
  }

  const travel = smoothstep(0.05, 0.98, p);
  const cameraZ = THREE.MathUtils.lerp(10, -16, travel);
  const cameraX = THREE.MathUtils.lerp(
    0,
    compact ? 0.35 : 0.7,
    smoothstep(0.25, 1, p),
  );
  const cameraY = THREE.MathUtils.lerp(0.1, 0.42, smoothstep(0.45, 1, p));
  const lookX = THREE.MathUtils.lerp(
    1.3,
    compact ? 1.3 : 2.05,
    smoothstep(0.35, 1, p),
  );
  const lookZ = THREE.MathUtils.lerp(-12.2, -30, smoothstep(0.28, 1, p));

  camera.position.set(
    cameraX + pointer.x * 0.18,
    cameraY + pointer.y * 0.11,
    cameraZ,
  );
  camera.lookAt(lookX, 0.08 + pointer.y * 0.04, lookZ);

  setMaterialOpacity(terrain.material, 0.64 * terrainFade);
  setMaterialOpacity(flower.material, 0.92 * heroFade);
  flowerOrbit.material.opacity = 0.08 * heroFade;
  setMaterialOpacity(galaxy.material, 0.98 * galaxyReveal);
  galaxyOrbitA.material.opacity = 0.22 * galaxyReveal;
  galaxyOrbitB.material.opacity = 0.13 * galaxyReveal;

  flower.points.rotation.z = -0.08 + p * 0.2 + pointer.x * 0.018;
  flower.points.rotation.x = 0.08 - p * 0.09 + pointer.y * 0.012;
  galaxy.points.rotation.z = -0.34 + p * 0.09;
  galaxy.points.rotation.y = p * 0.045;
  const galaxyScale = THREE.MathUtils.lerp(
    compact ? 0.66 : 0.72,
    compact ? 0.95 : 1.08,
    galaxyReveal,
  );
  galaxy.points.scale.setScalar(galaxyScale);

  const heroDomFade = 1 - smoothstep(0.1, 0.48, p);
  const personFade = 1 - smoothstep(0.26, 0.62, p);
  const fieldDomReveal = smoothstep(0.62, 0.86, p);
  heroCopy.style.opacity = `${heroDomFade}`;
  heroCopy.style.transform = `translateY(calc(-47% - ${p * 22}px))`;
  heroChrome.style.opacity = `${1 - smoothstep(0.04, 0.34, p)}`;
  person.style.opacity = `${personFade}`;
  person.style.transform = `translateY(${p * 58}px) scale(${compact ? 0.7 : 1})`;
  fieldCopy.style.opacity = `${fieldDomReveal}`;
  fieldCopy.style.transform = `translateY(${(1 - fieldDomReveal) * 30}px)`;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, width <= 700 ? 1.1 : 1.5),
  );
  if (reducedMotion) renderOnce();
}

function renderOnce() {
  renderer.render(scene, camera);
}

function tick() {
  if (!visible) return;
  scrollProgress += (scrollTarget - scrollProgress) * 0.085;
  pointer.x += (pointerTarget.x - pointer.x) * 0.055;
  pointer.y += (pointerTarget.y - pointer.y) * 0.055;

  flowerOrbit.line.rotation.z += 0.00055;
  galaxyOrbitA.line.rotation.z += 0.00028;
  galaxyOrbitB.line.rotation.z -= 0.0002;
  stars.points.rotation.y += 0.00008;

  applySceneState(scrollProgress);
  renderer.render(scene, camera);
  rafId = window.requestAnimationFrame(tick);
}

window.addEventListener("resize", resize, { passive: true });
window.addEventListener(
  "pointermove",
  (event) => {
    if (reducedMotion) return;
    pointerTarget.set(
      (event.clientX / window.innerWidth - 0.5) * 2,
      -(event.clientY / window.innerHeight - 0.5) * 2,
    );
  },
  { passive: true },
);

window.addEventListener("pointerleave", () => pointerTarget.set(0, 0));

document.addEventListener("visibilitychange", () => {
  visible = !document.hidden;
  if (visible && !reducedMotion) {
    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(tick);
  }
});

ScrollTrigger.create({
  trigger: story,
  start: "top top",
  end: "bottom bottom",
  scrub: reducedMotion ? false : 0.35,
  onUpdate: (self) => {
    scrollTarget = self.progress;
    if (reducedMotion) {
      scrollProgress = scrollTarget;
      applySceneState(scrollProgress);
      renderOnce();
    }
  },
});

resize();
applySceneState(0);

if (reducedMotion) {
  renderOnce();
} else {
  gsap.fromTo(
    [heroChrome, heroCopy],
    { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 1.15, stagger: 0.09, ease: "power3.out" },
  );
  rafId = window.requestAnimationFrame(tick);
}
