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
if (!canvas || !home) {
  throw new Error('Bontr scene mount was not found.');
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = getQualityProfile();
const mobile = window.innerWidth < 720;
const worldGap = mobile ? 19.2 : 16.6;
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

const morphGeometry = referenceMorph
  ? createMorphGeometryFromReference(referenceMorph, quality.morphCount)
  : createMorphGeometry(quality.morphCount);

const flowerMaterial = createMorphMaterial(pixelRatio);
flowerMaterial.uniforms.uMorph.value = 0;
const flowerPoints = new THREE.Points(morphGeometry, flowerMaterial);
flowerPoints.frustumCulled = false;
scene.add(flowerPoints);

const galaxyMaterial = createMorphMaterial(pixelRatio);
galaxyMaterial.uniforms.uMorph.value = 1;
const galaxyPoints = new THREE.Points(morphGeometry, galaxyMaterial);
galaxyPoints.position.y = -worldGap;
galaxyPoints.frustumCulled = false;
scene.add(galaxyPoints);

const foreground = new THREE.Group();
scene.add(foreground);

const terrainMaterial = createTerrainPointMaterial(pixelRatio, 0.95);
const terrainGeometry = referenceTerrain
  ? createTerrainGeometryFromReference(referenceTerrain, quality.terrainCount)
  : createTerrainGeometry(quality.terrainCount);
const terrainPoints = new THREE.Points(terrainGeometry, terrainMaterial);
terrainPoints.frustumCulled = false;
foreground.add(terrainPoints);

const starMaterial = createSimplePointMaterial(pixelRatio, 0.58);
const starGeometry = createStarGeometry(quality.starCount);
[0, -worldGap * 0.5, -worldGap].forEach((offsetY) => {
  const points = new THREE.Points(starGeometry, starMaterial);
  points.position.y = offsetY;
  points.frustumCulled = false;
  scene.add(points);
});

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
galaxyGlow.position.copy(GALAXY_CENTER).add(new THREE.Vector3(0.05, -worldGap + 0.02, -0.3));
scene.add(galaxyGlow);

const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: 0x050505 });
const person = new THREE.Group();
const personX = -1.65;
const personZ = 1.7;
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

// Rebuild the person's backlight on the same depth plane as the person/ridge.
// Keeping the z delta tiny prevents the halo from developing separate parallax.
const personHaloMaterial = createGlowMaterial();
personHaloMaterial.uniforms.uOpacity.value = 0.16;
const personHalo = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.18), personHaloMaterial);
personHalo.position.set(personX, personGround + 0.31, personZ - 0.04);
personHalo.frustumCulled = false;
foreground.add(personHalo);

const contactShadowMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: false,
  uniforms: { uOpacity: { value: 0.58 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uOpacity; varying vec2 vUv; void main(){ vec2 p=(vUv-0.5)*vec2(1.0,1.65); float d=dot(p,p); float a=(1.0-smoothstep(0.018,0.24,d))*uOpacity; if(a<0.008) discard; gl_FragColor=vec4(0.0,0.0,0.0,a); }`,
});
const contactShadowGeometry = new THREE.PlaneGeometry(1, 1);
contactShadowGeometry.rotateX(-Math.PI / 2);
const contactShadow = new THREE.Mesh(contactShadowGeometry, contactShadowMaterial);
contactShadow.position.set(personX, personGround + 0.025, personZ + 0.015);
contactShadow.scale.set(0.5, 0.78, 1);
contactShadow.renderOrder = 5;
foreground.add(contactShadow);

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
const galaxyWorldCenter = GALAXY_CENTER.clone().add(new THREE.Vector3(0, -worldGap, 0));
const galaxyOrbitA = createOrbit(galaxyWorldCenter, 8.4, 2.5, 53, -7, 0.14);
const galaxyOrbitB = createOrbit(galaxyWorldCenter, 6.35, 1.9, -48, 10, 0.07);

const travelRandom = makeRng(7411);
const travelPositions: number[] = [];
const travelCount = mobile ? 260 : 520;
for (let i = 0; i < travelCount; i += 1) {
  const angle = travelRandom() * Math.PI * 2;
  const radius = 0.7 + Math.pow(travelRandom(), 0.75) * 7.4;
  const z = -4.2 - travelRandom() * 12.5;
  const x = 3.35 + Math.cos(angle) * radius;
  const y = -worldGap * travelRandom() + Math.sin(angle) * radius * 0.24;
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
        new THREE.Vector3(0.04, -worldGap * 0.2, 16.3),
        new THREE.Vector3(0.1, -worldGap * 0.48, 14.9),
        new THREE.Vector3(0.14, -worldGap * 0.76, 14.1),
        new THREE.Vector3(0.18, -worldGap + 0.02, 13.8),
      ]
    : [
        new THREE.Vector3(0, 0, 12.6),
        new THREE.Vector3(0.02, -worldGap * 0.2, 12.0),
        new THREE.Vector3(0.08, -worldGap * 0.48, 11.45),
        new THREE.Vector3(0.05, -worldGap * 0.76, 11.05),
        new THREE.Vector3(0, -worldGap, 10.9),
      ],
  false,
  'catmullrom',
  0.5,
);

const targetCurve = new THREE.CatmullRomCurve3(
  mobile
    ? [
        new THREE.Vector3(2.1, 0.12, -4.0),
        new THREE.Vector3(2.5, -worldGap * 0.2, -4.9),
        new THREE.Vector3(3.15, -worldGap * 0.48, -6.2),
        new THREE.Vector3(3.9, -worldGap * 0.76, -7.55),
        new THREE.Vector3(4.5, -worldGap - 0.1, -8.6),
      ]
    : [
        new THREE.Vector3(0, 0, -6.2),
        new THREE.Vector3(0.04, -worldGap * 0.2, -6.6),
        new THREE.Vector3(0.12, -worldGap * 0.48, -7.45),
        new THREE.Vector3(0.08, -worldGap * 0.76, -8.65),
        new THREE.Vector3(0, -worldGap, -9.75),
      ],
  false,
  'catmullrom',
  0.5,
);

const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const scrollState = { progress: 0 };
const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
const cameraTarget = new THREE.Vector3();

const applyScene = (progress: number, time: number) => {
  const p = clamp01(progress);
  const travelStart = mobile ? 0.16 : 0.18;
  const travelEnd = mobile ? 0.82 : 0.78;
  let travelProgress: number;
  if (p <= travelStart) {
    travelProgress = (p / travelStart) * 0.055;
  } else if (p >= travelEnd) {
    travelProgress = 0.945 + ((p - travelEnd) / (1 - travelEnd)) * 0.055;
  } else {
    const t = (p - travelStart) / (travelEnd - travelStart);
    const eased = t * t * (3 - 2 * t);
    travelProgress = 0.055 + eased * 0.89;
  }
  const travelPulse = Math.sin(travelProgress * Math.PI);
  const flowerExit = 1 - THREE.MathUtils.smoothstep(p, 0.2, 0.44);

  cameraCurve.getPointAt(travelProgress, camera.position);
  targetCurve.getPointAt(travelProgress, cameraTarget);
  pointer.x += (pointer.targetX - pointer.x) * 0.045;
  pointer.y += (pointer.targetY - pointer.y) * 0.045;
  camera.position.x += pointer.x * (0.18 - p * 0.07);
  camera.position.y += pointer.y * (0.12 - p * 0.04);
  cameraTarget.x += pointer.x * 0.08;
  cameraTarget.y += pointer.y * 0.055;
  camera.lookAt(cameraTarget);

  flowerMaterial.uniforms.uMorph.value = 0;
  flowerMaterial.uniforms.uTime.value = time;
  flowerMaterial.uniforms.uOpacity.value = 0.98 * flowerExit;
  galaxyMaterial.uniforms.uMorph.value = 1;
  galaxyMaterial.uniforms.uTime.value = time;
  galaxyMaterial.uniforms.uOpacity.value = 0.98;

  foreground.position.set(0, 0, 0);
  terrainMaterial.uniforms.uTime.value = time;
  terrainMaterial.uniforms.uOpacity.value = 0.95;
  const shadowDirection = terrainMaterial.uniforms.uShadowDir.value as THREE.Vector2;
  shadowDirection.set((personX - FLOWER_CENTER.x) * 0.24, (personZ - FLOWER_CENTER.z) * 1.34).normalize();
  (terrainMaterial.uniforms.uShadowOrigin.value as THREE.Vector2).set(personX, personZ);
  terrainMaterial.uniforms.uShadowLength.value = 4.9;
  terrainMaterial.uniforms.uShadowOpacity.value = 0.94;

  starMaterial.uniforms.uTime.value = time;
  starMaterial.uniforms.uProgress.value = 0.018 + travelPulse * 0.012;
  starMaterial.uniforms.uOpacity.value = 0.42;
  flowerCoreMaterial.opacity = 0.82 * flowerExit;
  flowerCore.visible = flowerExit > 0.002;
  flowerGlowMaterial.uniforms.uOpacity.value = 0.24 * flowerExit;
  flowerGlow.quaternion.copy(camera.quaternion);
  galaxyGlowMaterial.uniforms.uOpacity.value = 0.2;
  galaxyGlow.quaternion.copy(camera.quaternion);

  person.visible = true;
  person.position.set(personX, personGround + 0.14, personZ);
  person.scale.setScalar(personBaseScale);
  personHalo.position.set(personX, personGround + 0.31, personZ - 0.04);
  personHalo.quaternion.copy(camera.quaternion);
  personHaloMaterial.uniforms.uOpacity.value = 0.16;
  contactShadow.position.set(personX, personGround + 0.025, personZ + 0.015);
  contactShadowMaterial.uniforms.uOpacity.value = 0.58;

  flowerOrbitA.material.opacity = 0.18 * flowerExit;
  flowerOrbitB.material.opacity = 0.08 * flowerExit;
  galaxyOrbitA.material.opacity = 0.14;
  galaxyOrbitB.material.opacity = 0.07;
  travelMaterial.opacity = mobile ? 0.006 : 0.009;
  travelStreaks.position.set(0, 0, 0);
  travelStreaks.rotation.z = time * 0.0025;

  const baseBloom = mobile ? 0.25 : 0.31;
  bloomPass.strength = baseBloom + travelPulse * (mobile ? 0.012 : 0.02);
  bloomPass.radius = 0.14 + travelPulse * 0.01;
};

if (reduceMotion) {
  const syncReducedMotion = () => {
    const maxScroll = Math.max(1, home.offsetHeight - window.innerHeight);
    scrollState.progress = clamp01((window.scrollY - home.offsetTop) / maxScroll);
  };
  window.addEventListener('scroll', syncReducedMotion, { passive: true });
  window.addEventListener('resize', syncReducedMotion, { passive: true });
  syncReducedMotion();
} else {
  gsap.to(scrollState, {
    progress: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: home,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.35,
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
  const exploreTraveling = document.documentElement.classList.contains('explore-traveling');
  const qualityCap = exploreTraveling ? (width < 720 ? 1.0 : 1.2) : (width < 720 ? 1.45 : 1.85);
  const nextPixelRatio = Math.min(window.devicePixelRatio || 1, qualityCap);
  renderer.setPixelRatio(nextPixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(nextPixelRatio);
  composer.setSize(width, height);
  smaaPass.enabled = !exploreTraveling;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  flowerMaterial.uniforms.uPixelRatio.value = nextPixelRatio;
  galaxyMaterial.uniforms.uPixelRatio.value = nextPixelRatio;
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
  morphGeometry.dispose();
  terrainPoints.geometry.dispose();
  starGeometry.dispose();
  flowerMaterial.dispose();
  galaxyMaterial.dispose();
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
  personHalo.geometry.dispose();
  personHaloMaterial.dispose();
  contactShadowGeometry.dispose();
  contactShadowMaterial.dispose();
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
