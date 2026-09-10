import * as THREE from 'three';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const FLOWER_CENTER = new THREE.Vector3(4.9, 0.55, -6.2);
export const GALAXY_CENTER = new THREE.Vector3(5.35, -0.15, -9.75);

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
    return { morphCount: 60000, terrainCount: 30000, starCount: 3800 };
  }

  return { morphCount: 135000, terrainCount: 70000, starCount: 6000 };
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
  { angle: -40, length: 5.05, width: 1.38, tilt: -27, curl: 0.15, bend: 0.46 },
  { angle: 35, length: 4.8, width: 1.5, tilt: 24, curl: 0.12, bend: -0.4 },
  { angle: 92, length: 5.85, width: 1.66, tilt: -13, curl: -0.04, bend: 0.36 },
  { angle: -58, length: 4.55, width: 1.42, tilt: 27, curl: 0.12, bend: -0.32 },
  { angle: -151, length: 5.1, width: 1.58, tilt: -31, curl: 0.18, bend: 0.52 },
  { angle: 156, length: 5.5, width: 1.52, tilt: 32, curl: 0.18, bend: -0.46 },
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
  const edgeSample = random() < 0.52;
  const edgeSign = random() < 0.5 ? -1 : 1;
  const side = edgeSample ? edgeSign * (0.72 + random() * 0.28) : random() * 2 - 1;
  const envelope = Math.pow(Math.sin(Math.PI * t), 0.74);
  const axisBend = config.bend * Math.sin(Math.PI * t) * (0.38 + t * 0.52);
  const lx = side * config.width * envelope * (0.94 + 0.16 * random()) * 1.18 + axisBend;
  const ly = 0.28 + t * config.length * 1.22;
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
  const edgeBrightness = Math.min(0.94, 0.3 + Math.pow(Math.abs(side), 1.8) * 0.52 + (1 - t) * 0.08);

  return {
    x: FLOWER_CENTER.x + lx * cosAngle - yTilted * sinAngle,
    y: FLOWER_CENTER.y + lx * sinAngle + yTilted * cosAngle,
    z: FLOWER_CENTER.z + zTilted,
    warmth: Math.exp(-t * 6.4),
    glyph: random() < 0.11 + t * 0.2 ? 1 : 0,
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
    warmth = 1;
    brightness = 1.04 + random() * 0.2;
  } else {
    const diffuse = random() < 0.27;
    const radiusBase = 0.9 + Math.pow(random(), diffuse ? 0.76 : 0.62) * (diffuse ? 8.15 : 7.25);
    const radius = Math.max(0.35, radiusBase + gaussian(random) * (diffuse ? 0.24 : 0.1));
    let theta: number;

    if (diffuse) {
      theta = random() * TAU;
      brightness = 0.12 + random() * 0.18;
    } else {
      const arm = Math.floor(random() * 4);
      const armOffset = arm * (TAU / 4) + (arm % 2 === 0 ? 0.08 : -0.05);
      const spread = 0.055 + (radius / 8.4) * 0.14;
      theta = armOffset + radius * 0.45 + gaussian(random) * spread;
      brightness = 0.48 + random() * 0.34;
    }

    x = Math.cos(theta) * radius;
    y = Math.sin(theta) * radius;
    z = gaussian(random) * (0.07 + (1 - Math.min(1, radius / 8.4)) * 0.16);
    warmth = Math.max(0, 1 - radius / 5.5) * 0.72 + (random() < 0.085 ? 0.26 : 0);
  }

  const tilt = THREE.MathUtils.degToRad(59);
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
  const flowerCoreCount = Math.floor(count * 0.055);
  const galaxyCoreCount = Math.floor(count * 0.072);
  const white = new THREE.Color(0.82, 0.84, 0.86);
  const warm = new THREE.Color(1.72, 0.55, 0.2);
  const galaxyWhite = new THREE.Color(0.86, 0.84, 0.79);
  const galaxyWarm = new THREE.Color(1.92, 0.72, 0.28);
  const tempColor = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const flower = sampleFlowerPoint(i, flowerCoreCount, random);
    const galaxy = sampleGalaxyPoint(i, galaxyCoreCount, random);
    setVec3(start, i, flower.x, flower.y, flower.z);
    setVec3(end, i, galaxy.x, galaxy.y, galaxy.z);

    const angle = random() * TAU;
    const drift = 0.55 + Math.pow(random(), 0.78) * 1.85;
    const mx = (flower.x + galaxy.x) * 0.5 + Math.cos(angle) * drift;
    const my = (flower.y + galaxy.y) * 0.5 + Math.sin(angle) * drift * 0.52;
    const mz = Math.min(flower.z, galaxy.z) - 0.8 - Math.pow(random(), 0.78) * 2.7;
    setVec3(mid, i, mx, my, mz);

    tempColor.copy(white).lerp(warm, Math.min(1, flower.warmth));
    tempColor.multiplyScalar(flower.brightness * (0.78 + random() * 0.24));
    setColor(colorStart, i, tempColor);
    tempColor.copy(galaxyWhite).lerp(galaxyWarm, Math.min(1, galaxy.warmth));
    tempColor.multiplyScalar(galaxy.brightness * (0.82 + random() * 0.22));
    setColor(colorEnd, i, tempColor);
    sizeStart[i] = (0.58 + random() * 0.76 + flower.glyph * 0.72) *
      (0.82 + flower.brightness * 0.16);
    sizeEnd[i] = (0.5 + random() * 0.68 + (galaxy.warmth > 0.75 ? 0.24 : 0)) *
      (0.74 + galaxy.brightness * 0.32);
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
  -2.72 - x * 0.018 - x * x * 0.0027 +
  Math.sin((x - 0.7) * 0.21) * 0.42 +
  Math.cos(z * 0.29) * 0.17 +
  Math.sin((x + z) * 0.14) * 0.17 +
  Math.exp(-((z - 1.6) ** 2) / 8) * 0.22;
export const createTerrainGeometry = (count: number) => {
  const random = makeRng(90210);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const glyphs = new Float32Array(count);
  const seeds = new Float32Array(count);
  const columns = Math.max(1, Math.floor(Math.sqrt(count * 1.9)));
  const rows = Math.ceil(count / columns);
  const cool = new THREE.Color(0.28, 0.3, 0.32);
  const bright = new THREE.Color(0.72, 0.7, 0.66);
  const amber = new THREE.Color(1.28, 0.5, 0.22);
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
    temp.copy(cool).lerp(bright, 0.15 + depthLift * 0.24);
    temp.lerp(amber, ridge * 0.48);
    setColor(colors, i, temp);
    sizes[i] = 0.52 + random() * 0.78 + ridge * 0.28;
    glyphs[i] = random() < 0.014 ? 1 : 0;
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

export const createMorphGeometryFromReference = (data: Float32Array, maxCount: number) => {
  const stride = 15;
  const total = Math.floor(data.length / stride);
  const count = Math.min(total, maxCount);
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
  const random = makeRng(1906);

  for (let i = 0; i < count; i += 1) {
    const sourceIndex = Math.min(total - 1, Math.floor((i / Math.max(1, count - 1)) * (total - 1)));
    const o = sourceIndex * stride;
    const sx = data[o];
    const sy = data[o + 1];
    const sz = data[o + 2];
    const ex = data[o + 3];
    const ey = data[o + 4];
    const ez = data[o + 5];
    setVec3(start, i, sx, sy, sz);
    setVec3(end, i, ex, ey, ez);

    const angle = random() * TAU;
    const drift = 0.08 + random() * 0.42;
    setVec3(
      mid,
      i,
      (sx + ex) * 0.5 + Math.cos(angle) * drift,
      (sy + ey) * 0.5 + Math.sin(angle) * drift * 0.28,
      (sz + ez) * 0.5 - 0.22 - random() * 0.52,
    );
    setVec3(colorStart, i, data[o + 6], data[o + 7], data[o + 8]);
    setVec3(colorEnd, i, data[o + 9], data[o + 10], data[o + 11]);
    sizeStart[i] = data[o + 12];
    sizeEnd[i] = data[o + 13];
    glyphStart[i] = data[o + 14];
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

export const createTerrainGeometryFromReference = (data: Float32Array, maxCount: number) => {
  const stride = 7;
  const total = Math.floor(data.length / stride);
  const count = Math.min(total, maxCount);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const glyphs = new Float32Array(count);
  const seeds = new Float32Array(count);
  const random = makeRng(7741);

  for (let i = 0; i < count; i += 1) {
    const sourceIndex = Math.min(total - 1, Math.floor((i / Math.max(1, count - 1)) * (total - 1)));
    const o = sourceIndex * stride;
    setVec3(positions, i, data[o], data[o + 1], data[o + 2]);
    setVec3(colors, i, data[o + 3], data[o + 4], data[o + 5]);
    sizes[i] = data[o + 6];
    glyphs[i] = random() < 0.008 ? 1 : 0;
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
