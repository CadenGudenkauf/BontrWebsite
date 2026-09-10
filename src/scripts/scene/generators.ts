import * as THREE from 'three';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const FLOWER_CENTER = new THREE.Vector3(5.7, 0.5, -5.5);
export const GALAXY_CENTER = new THREE.Vector3(6.9, -0.38, -9.65);

export type QualityProfile = {
  morphCount: number;
  terrainCount: number;
  starCount: number;
};

export const getQualityProfile = (): QualityProfile => {
  const mobile = window.innerWidth < 720;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const constrained = cores <= 4 || memory <= 4;

  if (mobile || constrained) {
    return { morphCount: 42000, terrainCount: 14500, starCount: 5600 };
  }

  return { morphCount: 86000, terrainCount: 28500, starCount: 11800 };
};
export const makeRng = (seed = 1337) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const gaussian = (random: () => number) => {
  const u = Math.max(1e-7, random());
  const v = Math.max(1e-7, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};

const setVec3 = (array: Float32Array, index: number, x: number, y: number, z: number) => {
  const offset = index * 3;
  array[offset] = x;
  array[offset + 1] = y;
  array[offset + 2] = z;
};

const setColor = (array: Float32Array, index: number, color: THREE.Color) => {
  const offset = index * 3;
  array[offset] = color.r;
  array[offset + 1] = color.g;
  array[offset + 2] = color.b;
};

const petalConfigs = [
  { angle: -42, length: 5.35, width: 1.45, tilt: -28, curl: 0.16, bend: 0.5 },
  { angle: 38, length: 4.95, width: 1.62, tilt: 24, curl: 0.13, bend: -0.46 },
  { angle: 91, length: 6.55, width: 1.9, tilt: -14, curl: -0.05, bend: 0.44 },
  { angle: -82, length: 5.05, width: 1.58, tilt: 31, curl: 0.14, bend: -0.38 },
  { angle: -142, length: 5.9, width: 1.82, tilt: -34, curl: 0.2, bend: 0.62 },
  { angle: 142, length: 5.15, width: 1.68, tilt: 36, curl: 0.19, bend: -0.54 },
];

const sampleFlowerPoint = (
  index: number,
  coreCount: number,
  random: () => number,
) => {
  if (index < coreCount) {
    const t = Math.sqrt((index + 0.5) / coreCount);
    const theta = index * GOLDEN_ANGLE + (random() - 0.5) * 0.08;
    const x = Math.cos(theta) * t * 1.08;
    const y = Math.sin(theta) * t * 0.74;
    const z = gaussian(random) * 0.18 + (1 - t) * 0.22;
    return {
      x: FLOWER_CENTER.x + x,
      y: FLOWER_CENTER.y + y,
      z: FLOWER_CENTER.z + z,
      warmth: 0.9,
      glyph: random() < 0.28 ? 1 : 0,
      brightness: 0.92 + random() * 0.14,
    };
  }
  const config = petalConfigs[Math.floor(random() * petalConfigs.length)];
  const t = Math.pow(random(), 0.92);
  const edgeSample = random() < 0.3;
  const edgeSign = random() < 0.5 ? -1 : 1;
  const side = edgeSample ? edgeSign * (0.66 + random() * 0.34) : random() * 2 - 1;
  const envelope = Math.pow(Math.sin(Math.PI * t), 0.7);
  const axisBend = config.bend * Math.sin(Math.PI * t) * (0.42 + t * 0.58);
  const lx = side * config.width * envelope * (0.94 + 0.2 * random()) * 1.32 + axisBend;
  const ly = 0.28 + t * config.length * 1.34;
  const lz =
    0.52 * Math.sin(Math.PI * t) * (1 - side * side) +
    config.curl * t * t +
    gaussian(random) * 0.045;

  const tilt = THREE.MathUtils.degToRad(config.tilt);
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  const yTilted = ly * cosTilt - lz * sinTilt;
  const zTilted = ly * sinTilt + lz * cosTilt;
  const angle = THREE.MathUtils.degToRad(config.angle);
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const edgeBrightness = Math.min(1.08, 0.55 + Math.pow(Math.abs(side), 1.6) * 0.42 + (1 - t) * 0.1);

  return {
    x: FLOWER_CENTER.x + lx * cosAngle - yTilted * sinAngle,
    y: FLOWER_CENTER.y + lx * sinAngle + yTilted * cosAngle,
    z: FLOWER_CENTER.z + zTilted,
    warmth: Math.exp(-t * 4.2),
    glyph: random() < 0.22 + t * 0.36 ? 1 : 0,
    brightness: edgeBrightness,
  };
};
const sampleGalaxyPoint = (
  index: number,
  coreCount: number,
  random: () => number,
) => {
  let x: number;
  let y: number;
  let z: number;
  let warmth: number;
  let brightness: number;

  if (index < coreCount) {
    const radial = Math.pow(random(), 1.8) * 1.55;
    const theta = random() * TAU;
    x = Math.cos(theta) * radial;
    y = Math.sin(theta) * radial;
    z = gaussian(random) * (0.2 + (1 - radial / 1.55) * 0.2);
    warmth = 0.96;
    brightness = 0.92 + random() * 0.16;
  } else {
    const diffuse = random() < 0.28;
    const radiusBase = 0.88 + Math.pow(random(), diffuse ? 0.72 : 0.6) * 7.5;
    const radius = Math.max(0.35, radiusBase + gaussian(random) * (diffuse ? 0.24 : 0.1));
    let theta: number;

    if (diffuse) {
      theta = random() * TAU;
      brightness = 0.28 + random() * 0.34;
    } else {
      const arm = Math.floor(random() * 4);
      const armOffset = arm * (TAU / 4) + (arm % 2 === 0 ? 0.08 : -0.05);
      const spread = 0.08 + (radius / 8.4) * 0.2;
      theta = armOffset + radius * 0.45 + gaussian(random) * spread;
      brightness = 0.56 + random() * 0.42;
    }

    x = Math.cos(theta) * radius;
    y = Math.sin(theta) * radius;
    z = gaussian(random) * (0.07 + (1 - Math.min(1, radius / 8.4)) * 0.16);
    warmth = Math.max(0, 1 - radius / 5.5) * 0.72 + (random() < 0.085 ? 0.26 : 0);
  }

  const tilt = THREE.MathUtils.degToRad(50);
  const yTilted = y * Math.cos(tilt) - z * Math.sin(tilt);
  const zTilted = y * Math.sin(tilt) + z * Math.cos(tilt);
  const spin = THREE.MathUtils.degToRad(-7);
  const xSpun = x * Math.cos(spin) - yTilted * Math.sin(spin);
  const ySpun = x * Math.sin(spin) + yTilted * Math.cos(spin);

  return {
    x: GALAXY_CENTER.x + xSpun,
    y: GALAXY_CENTER.y + ySpun,
    z: GALAXY_CENTER.z + zTilted,
    warmth: Math.min(1, warmth),
    brightness,
  };
};

export const createMorphGeometry = (count: number) => {
  const random = makeRng(481516);
  const start = new Float32Array(count * 3);
  const mid = new Float32Array(count * 3);
  const end = new Float32Array(count * 3);
  const colorStart = new Float32Array(count * 3);
  const colorEnd = new Float32Array(count * 3);
  const sizeStart = new Float32Array(count);
  const sizeEnd = new Float32Array(count);
  const glyphStart = new Float32Array(count);
  const glyphEnd = new Float32Array(count);
  const seed = new Float32Array(count);
  const flowerCoreCount = Math.floor(count * 0.09);
  const galaxyCoreCount = Math.floor(count * 0.085);
  const white = new THREE.Color(0.94, 0.95, 0.96);
  const warm = new THREE.Color(2.35, 0.67, 0.2);
  const galaxyWhite = new THREE.Color(0.93, 0.91, 0.86);
  const galaxyWarm = new THREE.Color(2.42, 0.86, 0.3);
  const tempColor = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const flower = sampleFlowerPoint(i, flowerCoreCount, random);
    const galaxy = sampleGalaxyPoint(i, galaxyCoreCount, random);
    setVec3(start, i, flower.x, flower.y, flower.z);
    setVec3(end, i, galaxy.x, galaxy.y, galaxy.z);

    const angle = random() * TAU;
    const drift = 1.6 + Math.pow(random(), 0.7) * 4.35;
    const mx = (flower.x + galaxy.x) * 0.5 + Math.cos(angle) * drift;
    const my = (flower.y + galaxy.y) * 0.5 + Math.sin(angle) * drift * 0.68;
    const mz = Math.min(flower.z, galaxy.z) - 1.4 - Math.pow(random(), 0.72) * 5.4;
    setVec3(mid, i, mx, my, mz);

    tempColor.copy(white).lerp(warm, Math.min(1, flower.warmth));
    tempColor.multiplyScalar(flower.brightness * (0.78 + random() * 0.24));
    setColor(colorStart, i, tempColor);
    tempColor.copy(galaxyWhite).lerp(galaxyWarm, Math.min(1, galaxy.warmth));
    tempColor.multiplyScalar(galaxy.brightness * (0.82 + random() * 0.22));
    setColor(colorEnd, i, tempColor);
    sizeStart[i] = (0.82 + random() * 1.04 + flower.glyph * 1.55) *
      (0.86 + flower.brightness * 0.2);
    sizeEnd[i] = (0.62 + random() * 0.86 + (galaxy.warmth > 0.75 ? 0.34 : 0)) *
      (0.72 + galaxy.brightness * 0.45);
    glyphStart[i] = flower.glyph;
    glyphEnd[i] = 0;
    seed[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(start, 3));
  geometry.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  geometry.setAttribute('aMid', new THREE.BufferAttribute(mid, 3));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(end, 3));
  geometry.setAttribute('aColorStart', new THREE.BufferAttribute(colorStart, 3));
  geometry.setAttribute('aColorEnd', new THREE.BufferAttribute(colorEnd, 3));
  geometry.setAttribute('aSizeStart', new THREE.BufferAttribute(sizeStart, 1));
  geometry.setAttribute('aSizeEnd', new THREE.BufferAttribute(sizeEnd, 1));
  geometry.setAttribute('aGlyphStart', new THREE.BufferAttribute(glyphStart, 1));
  geometry.setAttribute('aGlyphEnd', new THREE.BufferAttribute(glyphEnd, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geometry.computeBoundingSphere();
  return geometry;
};

export const terrainHeight = (x: number, z: number) =>
  -2.13 - x * 0.022 - x * x * 0.0033 +
  Math.sin(x * 0.23) * 0.31 +
  Math.cos(z * 0.31) * 0.19 +
  Math.sin((x + z) * 0.17) * 0.14 +
  Math.exp(-((z - 1.6) ** 2) / 8) * 0.24;
export const createTerrainGeometry = (count: number) => {
  const random = makeRng(90210);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const glyphs = new Float32Array(count);
  const seeds = new Float32Array(count);
  const columns = Math.max(1, Math.floor(Math.sqrt(count * 1.9)));
  const rows = Math.ceil(count / columns);
  const cool = new THREE.Color(0.46, 0.49, 0.52);
  const bright = new THREE.Color(1.05, 1.0, 0.9);
  const amber = new THREE.Color(1.95, 0.73, 0.28);
  const temp = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const cx = i % columns;
    const cz = Math.floor(i / columns);
    const x = -14 + (cx / Math.max(1, columns - 1)) * 28 + (random() - 0.5) * 0.11;
    const z = -8 + (cz / Math.max(1, rows - 1)) * 17 + (random() - 0.5) * 0.1;
    const y = terrainHeight(x, z) + (random() - 0.5) * 0.025;
    setVec3(positions, i, x, y, z);

    const ridge = Math.exp(-((z - 1.5) ** 2) / 0.52) * Math.exp(-(x * x) / 85);
    const depthLift = THREE.MathUtils.clamp((z + 8) / 17, 0, 1);
    temp.copy(cool).lerp(bright, 0.22 + depthLift * 0.32);
    temp.lerp(amber, ridge * 0.62);
    setColor(colors, i, temp);
    sizes[i] = 0.78 + random() * 1.18 + ridge * 0.5;
    glyphs[i] = random() < 0.025 ? 1 : 0;
    seeds[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aGlyph', new THREE.BufferAttribute(glyphs, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
};

export const createStarGeometry = (count: number) => {
  const random = makeRng(20260909);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const glyphs = new Float32Array(count);
  const seeds = new Float32Array(count);
  const white = new THREE.Color(0.72, 0.78, 0.82);
  const amber = new THREE.Color(1.75, 0.69, 0.26);
  const temp = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const x = (random() * 2 - 1) * 18;
    const y = (random() * 2 - 1) * 10;
    const z = -7 - random() * 18;
    setVec3(positions, i, x, y, z);
    const warm = random() < 0.075 ? 0.65 + random() * 0.35 : 0;
    temp.copy(white).lerp(amber, warm).multiplyScalar(0.62 + random() * 0.48);
    setColor(colors, i, temp);
    sizes[i] = 0.65 + random() * 1.05 + (random() < 0.025 ? 1.2 : 0);
    glyphs[i] = random() < 0.012 ? 1 : 0;
    seeds[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aGlyph', new THREE.BufferAttribute(glyphs, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
};
