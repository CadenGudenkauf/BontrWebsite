import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import {
  FLOWER_CENTER,
  GALAXY_CENTER,
  createMorphGeometry,
  createMorphGeometryFromReference,
  createStarGeometry,
  createTerrainGeometry,
  createTerrainGeometryFromReference,
  getQualityProfile,
  makeRng,
  terrainHeight,
} from './generators';
import {
  createGlowMaterial,
  createMorphMaterial,
  createSimplePointMaterial,
  createTerrainPointMaterial,
} from './materials';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector<HTMLCanvasElement>('[data-scene-canvas]');
const home = document.querySelector<HTMLElement>('.home');
const heroBrand = document.querySelector<HTMLElement>('.hero__brand');
const heroCopy = document.querySelector<HTMLElement>('.hero__copy');
const fieldCopy = document.querySelector<HTMLElement>('.field__copy');
if (!canvas || !home) {
  throw new Error('Bontr scene mount was not found.');
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = getQualityProfile();
const mobile = window.innerWidth < 720;
const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.45 : 1.85);

const loadFloatArray = async (path: string) => {
  const response = await fetch(new URL(path, document.baseURI));
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return new Float32Array(await response.arrayBuffer());
};

let referenceMorph: Float32Array | null = null;
let referenceTerrain: Float32Array | null = null;
try {
  [referenceMorph, referenceTerrain] = await Promise.all([
    loadFloatArray('data/home-morph.f32'),
    loadFloatArray('data/home-terrain.f32'),
  ]);
} catch (error) {
  console.warn('Reference point cloud unavailable; using procedural fallback.', error);
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setClearColor(0x020202, 1);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
const camera = new THREE.PerspectiveCamera(mobile ? 52 : 44, window.innerWidth / window.innerHeight, 0.1, 70);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth, window.innerHeight);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), mobile ? 0.28 : 0.34, 0.16, 1.15);
const smaaPass = new SMAAPass();
const outputPass = new OutputPass();
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(smaaPass);
composer.addPass(outputPass);

const morphMaterial = createMorphMaterial(pixelRatio);
const morphGeometry = referenceMorph
  ? createMorphGeometryFromReference(referenceMorph, quality.morphCount)
  : createMorphGeometry(quality.morphCount);
const morphPoints = new THREE.Points(morphGeometry, morphMaterial);
morphPoints.frustumCulled = false;
scene.add(morphPoints);

const foreground = new THREE.Group();
scene.add(foreground);

const terrainMaterial = createTerrainPointMaterial(pixelRatio, 0.95);
const terrainGeometry = referenceTerrain
  ? createTerrainGeometryFromReference(referenceTerrain, quality.terrainCount)
  : createTerrainGeometry(quality.terrainCount);
const terrainPoints = new THREE.Points(terrainGeometry, terrainMaterial);
terrainPoints.frustumCulled = false;
foreground.add(terrainPoints);

const starMaterial = createSimplePointMaterial(pixelRatio, 0.72);
const stars = new THREE.Points(createStarGeometry(quality.starCount), starMaterial);
stars.frustumCulled = false;
scene.add(stars);

const flowerCoreMaterial = new THREE.MeshBasicMaterial({
  color: 0x010101,
  transparent: true,
  opacity: 0.92,
  depthWrite: true,
});
const flowerCore = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 20), flowerCoreMaterial);
flowerCore.position.copy(FLOWER_CENTER).add(new THREE.Vector3(0.12, -0.42, 0.08));
flowerCore.scale.set(1.18, 0.7, 0.76);
scene.add(flowerCore);

const flowerGlowMaterial = createGlowMaterial();
const flowerGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.05), flowerGlowMaterial);
flowerGlow.position.copy(FLOWER_CENTER).add(new THREE.Vector3(0.05, 0.08, -0.35));
scene.add(flowerGlow);
const galaxyGlowMaterial = createGlowMaterial();
const galaxyGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.45, 2.15), galaxyGlowMaterial);
galaxyGlow.position.copy(GALAXY_CENTER).add(new THREE.Vector3(0.05, 0.02, -0.3));
scene.add(galaxyGlow);

const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: 0x050505 });
const person = new THREE.Group();
const personX = -1.65;
const personZ = 1.45;
const personBaseScale = 0.58;
const personGround = terrainHeight(personX, personZ);
person.position.set(personX, personGround + 0.14, personZ);
person.scale.setScalar(personBaseScale);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 12), silhouetteMaterial);
head.position.y = 0.73;
person.add(head);
const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.36, 10), silhouetteMaterial);
torso.position.y = 0.48;
person.add(torso);

const addLimb = (x: number, y: number, rotation: number, length: number, radius: number) => {
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), silhouetteMaterial);
  limb.position.set(x, y, 0);
  limb.rotation.z = rotation;
  person.add(limb);
};

addLimb(-0.08, 0.2, 0.08, 0.42, 0.026);
addLimb(0.08, 0.2, -0.08, 0.42, 0.026);
addLimb(-0.1, 0.49, -0.18, 0.34, 0.022);
addLimb(0.1, 0.49, 0.18, 0.34, 0.022);
foreground.add(person);
const glowMaterial = createGlowMaterial();
const personGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.72), glowMaterial);
personGlow.position.set(personX, personGround + 0.18, personZ - 0.55);
foreground.add(personGlow);

const createOrbit = (
  center: THREE.Vector3,
  radiusX: number,
  radiusY: number,
  tiltX: number,
  rotationZ: number,
  opacity: number,
) => {
  const positions: number[] = [];
  const tilt = THREE.MathUtils.degToRad(tiltX);
  const spin = THREE.MathUtils.degToRad(rotationZ);
  for (let i = 0; i <= 220; i += 1) {
    const theta = (i / 220) * Math.PI * 2;
    const x = Math.cos(theta) * radiusX;
    const y = Math.sin(theta) * radiusY;
    const yTilted = y * Math.cos(tilt);
    const zTilted = y * Math.sin(tilt);
    const xSpun = x * Math.cos(spin) - yTilted * Math.sin(spin);
    const ySpun = x * Math.sin(spin) + yTilted * Math.cos(spin);
    positions.push(center.x + xSpun, center.y + ySpun, center.z + zTilted);
  }

  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color: 0xf0a064,
    linewidth: 0.75,
    transparent: true,
    opacity,
    worldUnits: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  scene.add(line);
  return { line, material };
};
const flowerOrbitA = createOrbit(FLOWER_CENTER, 5.4, 1.3, 62, -6, 0.55);
const flowerOrbitB = createOrbit(FLOWER_CENTER, 4.2, 1.02, -55, 22, 0.34);
const galaxyOrbitA = createOrbit(GALAXY_CENTER, 8.4, 2.5, 53, -7, 0);
const galaxyOrbitB = createOrbit(GALAXY_CENTER, 6.35, 1.9, -48, 10, 0);

const travelRandom = makeRng(7411);
const travelPositions: number[] = [];
const travelCount = mobile ? 260 : 520;
for (let i = 0; i < travelCount; i += 1) {
  const angle = travelRandom() * Math.PI * 2;
  const radius = 0.7 + Math.pow(travelRandom(), 0.75) * 7.4;
  const z = -4.2 - travelRandom() * 12.5;
  const x = 3.35 + Math.cos(angle) * radius;
  const y = -0.05 + Math.sin(angle) * radius * 0.56;
  const length = 0.65 + travelRandom() * 1.45;
  travelPositions.push(
    x, y, z,
    x + Math.cos(angle) * length * 0.28,
    y + Math.sin(angle) * length * 0.15,
    z + length,
  );
}
const travelGeometry = new LineSegmentsGeometry();
travelGeometry.setPositions(travelPositions);
const travelMaterial = new LineMaterial({
  color: 0xdac5b5,
  linewidth: mobile ? 0.45 : 0.62,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const travelStreaks = new LineSegments2(travelGeometry, travelMaterial);
travelStreaks.frustumCulled = false;
scene.add(travelStreaks);

const cameraCurve = new THREE.CatmullRomCurve3(
  mobile
    ? [
        new THREE.Vector3(0, 0.1, 18.0),
        new THREE.Vector3(0.08, 0.06, 15.4),
        new THREE.Vector3(0.32, 0.12, 12.2),
        new THREE.Vector3(0.18, 0.02, 13.8),
      ]
    : [
        new THREE.Vector3(0, 0, 12.6),
        new THREE.Vector3(0.03, 0.01, 11.0),
        new THREE.Vector3(0.16, 0.05, 9.15),
        new THREE.Vector3(0, 0, 10.9),
      ],
  false,
  'catmullrom',
  0.5,
);

const targetCurve = new THREE.CatmullRomCurve3(
  mobile
    ? [
        new THREE.Vector3(2.1, 0.12, -4.0),
        new THREE.Vector3(2.45, 0.08, -4.9),
        new THREE.Vector3(3.55, -0.04, -6.7),
        new THREE.Vector3(4.5, -0.1, -8.6),
      ]
    : [
        new THREE.Vector3(0, 0, -6.2),
        new THREE.Vector3(0.04, 0, -6.8),
        new THREE.Vector3(0.22, -0.02, -8.1),
        new THREE.Vector3(0, 0, -9.75),
      ],
  false,
  'catmullrom',
  0.5,
);

const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const smooth = (start: number, end: number, value: number) => {
  const x = clamp01((value - start) / (end - start));
  return x * x * (3 - 2 * x);
};
const scrollState = { progress: 0 };
const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
const cameraTarget = new THREE.Vector3();

const applyScene = (progress: number, time: number) => {
  const p = clamp01(progress);
  const morph = smooth(0.22, 0.92, p);
  const foregroundExit = smooth(0.08, 0.5, p);
  const flowerFade = 1 - smooth(0.38, 0.72, p);
  const coreFade = 1 - smooth(0.34, 0.66, p);
  const galaxyReveal = smooth(0.54, 0.92, p);
  const travelPulse = Math.sin(morph * Math.PI);
  const heroContent = 1 - smooth(0.08, 0.3, p);
  const fieldContent = smooth(0.67, 0.9, p);

  if (heroBrand) {
    heroBrand.style.opacity = String(heroContent);
    heroBrand.style.transform = `translate3d(0, ${-10 * (1 - heroContent)}px, 0)`;
  }
  if (heroCopy) {
    heroCopy.style.opacity = String(heroContent);
    heroCopy.style.transform = `translate3d(0, ${-18 * (1 - heroContent)}px, 0)`;
  }
  if (fieldCopy) {
    fieldCopy.style.opacity = String(fieldContent);
    fieldCopy.style.transform = `translate3d(0, ${18 * (1 - fieldContent)}px, 0)`;
  }

  cameraCurve.getPointAt(smooth(0.02, 0.98, p), camera.position);
  targetCurve.getPointAt(smooth(0.02, 0.98, p), cameraTarget);
  pointer.x += (pointer.targetX - pointer.x) * 0.045;
  pointer.y += (pointer.targetY - pointer.y) * 0.045;
  camera.position.x += pointer.x * (0.18 - p * 0.07);
  camera.position.y += pointer.y * (0.12 - p * 0.04);
  cameraTarget.x += pointer.x * 0.08;
  cameraTarget.y += pointer.y * 0.055;
  camera.lookAt(cameraTarget);

  morphMaterial.uniforms.uMorph.value = morph;
  morphMaterial.uniforms.uTime.value = time;
  morphMaterial.uniforms.uOpacity.value = 0.98 * (1 - travelPulse * 0.12);

  const foregroundTravel = smooth(0.0, 1.0, foregroundExit);
  foreground.position.set(-0.08 * foregroundTravel, -0.54 * foregroundTravel, 1.08 * foregroundTravel);

  terrainMaterial.uniforms.uTime.value = time;
  terrainMaterial.uniforms.uOpacity.value = 0.95 * (1 - foregroundTravel);
  const lightLocalX = FLOWER_CENTER.x - foreground.position.x;
  const lightLocalZ = FLOWER_CENTER.z - foreground.position.z;
  const shadowDirection = terrainMaterial.uniforms.uShadowDir.value as THREE.Vector2;
  shadowDirection.set((personX - lightLocalX) * 0.24, (personZ - lightLocalZ) * 1.34).normalize();
  (terrainMaterial.uniforms.uShadowOrigin.value as THREE.Vector2).set(personX, personZ);
  terrainMaterial.uniforms.uShadowLength.value = 4.75 + foregroundTravel * 0.45;
  terrainMaterial.uniforms.uShadowOpacity.value = 0.9 * (1 - smooth(0.68, 1, foregroundTravel));

  starMaterial.uniforms.uTime.value = time;
  starMaterial.uniforms.uProgress.value = p * 0.05;
  starMaterial.uniforms.uOpacity.value = 0.38 + p * 0.16;
  flowerCoreMaterial.opacity = 0.82 * coreFade;
  flowerCore.visible = flowerCoreMaterial.opacity > 0.01;
  flowerGlowMaterial.uniforms.uOpacity.value = 0.24 * flowerFade;
  flowerGlow.quaternion.copy(camera.quaternion);
  galaxyGlowMaterial.uniforms.uOpacity.value = 0.2 * galaxyReveal;
  galaxyGlow.quaternion.copy(camera.quaternion);

  person.visible = foregroundTravel < 0.995;
  person.position.set(personX, personGround + 0.14, personZ);
  person.scale.setScalar(personBaseScale * (1 + foregroundTravel * 0.04));
  glowMaterial.uniforms.uOpacity.value = (1 - foregroundTravel) * (0.075 + travelPulse * 0.012);
  personGlow.position.set(personX, personGround + 0.18, personZ - 0.55);
  personGlow.quaternion.copy(camera.quaternion);

  flowerOrbitA.material.opacity = 0.18 * flowerFade;
  flowerOrbitB.material.opacity = 0.08 * flowerFade;
  galaxyOrbitA.material.opacity = 0.14 * galaxyReveal;
  galaxyOrbitB.material.opacity = 0.07 * galaxyReveal;
  travelMaterial.opacity = travelPulse * travelPulse * (mobile ? 0.004 : 0.007);
  travelStreaks.position.z = (p - 0.5) * 2.1;
  travelStreaks.rotation.z = p * 0.025;

  const baseBloom = mobile ? 0.25 : 0.31;
  bloomPass.strength = baseBloom + travelPulse * (mobile ? 0.015 : 0.025) + galaxyReveal * 0.02;
  bloomPass.radius = 0.14 + travelPulse * 0.012;
};

if (reduceMotion) {
  const syncReducedMotion = () => {
    scrollState.progress = window.scrollY >= window.innerHeight * 0.5 ? 1 : 0;
  };
  window.addEventListener('scroll', syncReducedMotion, { passive: true });
  syncReducedMotion();
} else {
  gsap.to(scrollState, {
    progress: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: home,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.45,
      invalidateOnRefresh: true,
    },
  });
}

window.addEventListener(
  'pointermove',
  (event) => {
    if (event.pointerType === 'touch') return;
    pointer.targetX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    pointer.targetY = (0.5 - event.clientY / Math.max(1, window.innerHeight)) * 2;
  },
  { passive: true },
);

const resize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const nextPixelRatio = Math.min(window.devicePixelRatio || 1, width < 720 ? 1.45 : 1.85);
  renderer.setPixelRatio(nextPixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(nextPixelRatio);
  composer.setSize(width, height);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  morphMaterial.uniforms.uPixelRatio.value = nextPixelRatio;
  terrainMaterial.uniforms.uPixelRatio.value = nextPixelRatio;
  starMaterial.uniforms.uPixelRatio.value = nextPixelRatio;
  [flowerOrbitA.material, flowerOrbitB.material, galaxyOrbitA.material, galaxyOrbitB.material, travelMaterial]
    .forEach((material) => material.resolution.set(width, height));
};
window.addEventListener('resize', resize, { passive: true });
resize();
ScrollTrigger.refresh();

const startedAt = performance.now();
renderer.setAnimationLoop((timeMs) => {
  const elapsed = reduceMotion ? 0 : (timeMs - startedAt) * 0.001;
  applyScene(scrollState.progress, elapsed);
  composer.render();
});

window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  morphPoints.geometry.dispose();
  terrainPoints.geometry.dispose();
  stars.geometry.dispose();
  morphMaterial.dispose();
  terrainMaterial.dispose();
  starMaterial.dispose();
  flowerCore.geometry.dispose();
  flowerCoreMaterial.dispose();
  flowerGlow.geometry.dispose();
  flowerGlowMaterial.dispose();
  galaxyGlow.geometry.dispose();
  galaxyGlowMaterial.dispose();
  person.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  silhouetteMaterial.dispose();
  personGlow.geometry.dispose();
  glowMaterial.dispose();
  [flowerOrbitA, flowerOrbitB, galaxyOrbitA, galaxyOrbitB].forEach(({ line, material }) => {
    line.geometry.dispose();
    material.dispose();
  });
  travelGeometry.dispose();
  travelMaterial.dispose();
  bloomPass.dispose();
  smaaPass.dispose();
  outputPass.dispose();
  composer.dispose();
  renderer.dispose();
});
