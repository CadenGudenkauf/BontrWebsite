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
      uColor: { value: new THREE.Color(0xffffff) },
      uAccent: { value: new THREE.Color(0xffad70) },
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

  const surfaceCount = Math.floor(count * 0.82);
  for (let i = 0; i < surfaceCount; i += 1) {
    const x = randomBetween(-15, 15);
    const z = randomBetween(-4.5, 11.5);
    const ridge = Math.sin(x * 0.42) * 0.2 + Math.cos(z * 0.63) * 0.13;
    const secondary = Math.sin((x - z) * 0.2) * 0.09;
    const sweep = Math.sin(x * 0.16 + z * 0.08) * 0.11;
    const falloff = Math.abs(x) * 0.012 + Math.max(0, -z) * 0.035;
    const y =
      -2.72 +
      ridge +
      secondary +
      sweep -
      falloff +
      randomBetween(-0.022, 0.022);
    positions.push(x, y, z);
    sizes.push(randomBetween(0.075, 0.22));
    warmth.push(random() > 0.992 ? randomBetween(0.08, 0.38) : 0);
  }

  const horizonCount = count - surfaceCount;
  for (let i = 0; i < horizonCount; i += 1) {
    const x = randomBetween(-13.5, 13.5);
    const z = randomBetween(-0.25, 0.55);
    const y =
      -2.33 +
      Math.sin(x * 0.34) * 0.16 +
      Math.sin(x * 0.11) * 0.08 +
      randomBetween(-0.018, 0.018);
    positions.push(x, y, z);
    sizes.push(randomBetween(0.08, 0.25));
    warmth.push(random() > 0.94 ? randomBetween(0.12, 0.52) : 0);
  }

  return pointsFromArrays(positions, sizes, warmth, 0.72);
}

function buildFlower(count: number) {
  const positions: number[] = [];
  const sizes: number[] = [];
  const warmth: number[] = [];
  const petalAngles = [-0.18, 0.65, 1.42, 2.18, 2.98, 3.95, 5.05];
  const petalLengths = [4.45, 4.9, 5.2, 4.35, 4.8, 4.65, 4.55];
  const petalWidths = [1.08, 1.2, 1.08, 1.28, 1.26, 1.16, 1.2];
  const petalCount = Math.floor(count * 0.79);

  for (let i = 0; i < petalCount; i += 1) {
    const petal = Math.floor(random() * petalAngles.length);
    const along = Math.pow(random(), 0.92);
    const angle = petalAngles[petal] + Math.sin(along * Math.PI) * 0.055;
    const tangent = angle + Math.PI * 0.5;
    const distance = 0.42 + along * petalLengths[petal];
    const envelope = Math.pow(Math.sin(along * Math.PI), 0.64);
    const edgeSample = random();
    const edgeSign = random() > 0.5 ? 1 : -1;
    const across =
      edgeSample < 0.34
        ? edgeSign * randomBetween(0.72, 1)
        : randomBetween(-0.78, 0.78);
    const lateral = across * envelope * petalWidths[petal];
    const curl = Math.sin(along * Math.PI) * (0.14 + petal * 0.012);
    const ripple = Math.sin(along * Math.PI * 3.1 + petal * 0.7) * 0.055;
    const depth =
      -0.18 -
      curl -
      envelope * randomBetween(0.02, 0.38) +
      ripple +
      randomBetween(-0.07, 0.07);

    positions.push(
      Math.cos(angle) * distance + Math.cos(tangent) * lateral,
      Math.sin(angle) * distance * 0.84 + Math.sin(tangent) * lateral * 0.84,
      depth,
    );
    sizes.push(randomBetween(0.22, edgeSample < 0.34 ? 0.88 : 0.68));
    const centerHeat = Math.max(0, 1 - along * 3.8);
    warmth.push(
      Math.max(
        centerHeat * 0.22,
        random() > 0.992 ? randomBetween(0.08, 0.42) : 0,
      ),
    );
  }

  const coreCount = Math.floor(count * 0.07);
  for (let i = 0; i < coreCount; i += 1) {
    const theta = random() * Math.PI * 2;
    const radius = Math.pow(random(), 0.82) * 0.78;
    positions.push(
      Math.cos(theta) * radius,
      Math.sin(theta) * radius * 0.82,
      randomBetween(-0.24, 0.22),
    );
    sizes.push(randomBetween(0.3, 0.94));
    warmth.push(randomBetween(0.68, 1));
  }

  const dustCount = count - petalCount - coreCount;
  for (let i = 0; i < dustCount; i += 1) {
    const theta = random() * Math.PI * 2;
    const radius = randomBetween(3.2, 7.2);
    positions.push(
      Math.cos(theta) * radius + randomBetween(-0.6, 0.6),
      Math.sin(theta) * radius * randomBetween(0.42, 0.88) +
        randomBetween(-0.55, 0.55),
      randomBetween(-1.5, 0.7),
    );
    sizes.push(randomBetween(0.1, 0.34));
    warmth.push(random() > 0.982 ? randomBetween(0.06, 0.38) : 0);
  }

  return pointsFromArrays(positions, sizes, warmth, 1);
}
function buildGalaxy(count: number) {
  const positions: number[] = [];
  const sizes: number[] = [];
  const warmth: number[] = [];
  const arms = 5;
  const armCount = Math.floor(count * 0.9);

  for (let i = 0; i < armCount; i += 1) {
    const radius = Math.pow(random(), 0.54) * 8.7;
    const arm = i % arms;
    const armNoise = randomBetween(-0.34, 0.34) * (0.42 + radius * 0.055);
    const spur = random() > 0.84 ? randomBetween(-0.42, 0.42) : 0;
    const warp = Math.sin(radius * 1.7 + arm * 0.9) * 0.13;
    const angle =
      arm * ((Math.PI * 2) / arms) + radius * 1.01 + warp + armNoise + spur;
    const eccentricity = 0.7 + random() * 0.16;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * eccentricity;
    const z = randomBetween(-0.28, 0.28) * (0.24 + radius * 0.06);
    positions.push(x, y, z);
    sizes.push(randomBetween(0.24, radius < 1.8 ? 0.98 : 0.68));
    const coreHeat = Math.max(0, 1 - radius / 4.2) * 0.88;
    warmth.push(
      Math.max(coreHeat, random() > 0.976 ? randomBetween(0.16, 0.72) : 0),
    );
  }

  const hazeCount = count - armCount;
  for (let i = 0; i < hazeCount; i += 1) {
    const theta = random() * Math.PI * 2;
    const radius = Math.pow(random(), 0.68) * 9.2;
    positions.push(
      Math.cos(theta) * radius,
      Math.sin(theta) * radius * randomBetween(0.56, 0.9),
      randomBetween(-0.55, 0.55),
    );
    sizes.push(randomBetween(0.12, 0.4));
    warmth.push(random() > 0.99 ? randomBetween(0.08, 0.4) : 0);
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
    sizes.push(randomBetween(0.07, 0.28));
    warmth.push(random() > 0.982 ? randomBetween(0.12, 0.58) : 0);
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

function makeGlowSprite(color: number, opacity: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,.72)");
  gradient.addColorStop(0.42, "rgba(255,255,255,.18)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  return { sprite, material };
}

const heroWorld = new THREE.Group();
const fieldWorld = new THREE.Group();
scene.add(heroWorld, fieldWorld);

const terrain = buildTerrain(compact ? 5600 : 17500);
terrain.points.rotation.x = -0.028;
heroWorld.add(terrain.points);

const flower = buildFlower(compact ? 14000 : 36000);
flower.points.position.set(compact ? 6.2 : 5.15, compact ? 0.15 : 1.2, -12.2);
flower.points.rotation.set(0.04, -0.09, -0.06);
flower.points.scale.setScalar(compact ? 0.8 : 1.72);
heroWorld.add(flower.points);

const flowerGlow = makeGlowSprite(0xff9d58, 0.5);
flowerGlow.sprite.position.copy(flower.points.position);
flowerGlow.sprite.position.z += 0.35;
flowerGlow.sprite.scale.set(compact ? 2.7 : 3.6, compact ? 2.7 : 3.6, 1);
heroWorld.add(flowerGlow.sprite);

const horizonGlow = makeGlowSprite(0xffc18a, 0.28);
horizonGlow.sprite.position.set(compact ? 0.5 : -0.2, -2.15, -0.6);
horizonGlow.sprite.scale.set(compact ? 4.8 : 6.8, compact ? 1.1 : 1.3, 1);
heroWorld.add(horizonGlow.sprite);

const flowerOrbit = buildOrbit(
  compact ? 5.8 : 7.2,
  compact ? 1.3 : 1.65,
  -0.14,
  0.32,
);
flowerOrbit.line.position.copy(flower.points.position);
flowerOrbit.line.rotation.x = 0.24;
heroWorld.add(flowerOrbit.line);

const flowerOrbitB = buildOrbit(
  compact ? 4.8 : 6.1,
  compact ? 0.92 : 1.2,
  0.31,
  0.14,
);
flowerOrbitB.line.position.copy(flower.points.position);
flowerOrbitB.line.rotation.x = -0.16;
heroWorld.add(flowerOrbitB.line);

const galaxy = buildGalaxy(compact ? 19000 : 52000);
galaxy.points.position.set(compact ? 5.8 : 5.15, compact ? 0.5 : 0.25, -30);
galaxy.points.rotation.set(0.12, 0.02, -0.24);
galaxy.points.scale.setScalar(compact ? 0.98 : 1.16);
fieldWorld.add(galaxy.points);

const galaxyGlow = makeGlowSprite(0xffa66a, 0.7);
galaxyGlow.sprite.position.copy(galaxy.points.position);
galaxyGlow.sprite.position.z += 0.25;
galaxyGlow.sprite.scale.set(compact ? 3.7 : 4.8, compact ? 3.7 : 4.8, 1);
fieldWorld.add(galaxyGlow.sprite);

const galaxyOrbitA = buildOrbit(9.8, 2.45, -0.12, 0);
galaxyOrbitA.line.position.copy(galaxy.points.position);
galaxyOrbitA.line.rotation.x = 0.18;
fieldWorld.add(galaxyOrbitA.line);

const galaxyOrbitB = buildOrbit(7.2, 1.35, 0.38, 0);
galaxyOrbitB.line.position.copy(galaxy.points.position);
galaxyOrbitB.line.rotation.x = -0.22;
fieldWorld.add(galaxyOrbitB.line);

const stars = buildStars(compact ? 2400 : 7000);
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
    flowerOrbit.material.opacity = fieldMode ? 0 : 0.55;
    flowerOrbitB.material.opacity = fieldMode ? 0 : 0.22;
    flowerGlow.material.opacity = fieldMode ? 0 : 0.5;
    horizonGlow.material.opacity = fieldMode ? 0 : 0.28;
    setMaterialOpacity(galaxy.material, fieldMode ? 0.98 : 0);
    galaxyGlow.material.opacity = fieldMode ? 0.7 : 0;
    galaxyOrbitA.material.opacity = fieldMode ? 0.4 : 0;
    galaxyOrbitB.material.opacity = fieldMode ? 0.22 : 0;
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

  setMaterialOpacity(terrain.material, 0.72 * terrainFade);
  setMaterialOpacity(flower.material, 0.98 * heroFade);
  flowerOrbit.material.opacity = 0.55 * heroFade;
  flowerOrbitB.material.opacity = 0.22 * heroFade;
  flowerGlow.material.opacity = 0.5 * heroFade;
  horizonGlow.material.opacity = 0.28 * terrainFade;
  setMaterialOpacity(galaxy.material, 0.98 * galaxyReveal);
  galaxyGlow.material.opacity = 0.7 * galaxyReveal;
  galaxyOrbitA.material.opacity = 0.4 * galaxyReveal;
  galaxyOrbitB.material.opacity = 0.22 * galaxyReveal;

  flower.points.rotation.z = -0.08 + p * 0.2 + pointer.x * 0.018;
  flower.points.rotation.x = 0.08 - p * 0.09 + pointer.y * 0.012;
  galaxy.points.rotation.z = -0.34 + p * 0.09;
  galaxy.points.rotation.y = p * 0.045;
  const galaxyScale = THREE.MathUtils.lerp(
    compact ? 0.46 : 0.88,
    compact ? 0.64 : 1.32,
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

  flowerOrbit.line.rotation.z += 0.00042;
  flowerOrbitB.line.rotation.z -= 0.00024;
  galaxyOrbitA.line.rotation.z += 0.00022;
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

if (window.location.hash === "#field") {
  scrollTarget = 1;
  scrollProgress = 1;
  applySceneState(1);
  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "auto",
    });
    ScrollTrigger.update();
  });
}

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
