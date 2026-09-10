import * as THREE from 'three';

const pointFragment = `
uniform float uOpacity;
varying vec3 vColor;
varying float vGlyph;
varying float vShimmer;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float radius = length(uv);
  float circle = 1.0 - smoothstep(0.34, 0.5, radius);
  float horizontal = (1.0 - smoothstep(0.065, 0.13, abs(uv.y))) *
    (1.0 - smoothstep(0.34, 0.48, abs(uv.x)));
  float vertical = (1.0 - smoothstep(0.065, 0.13, abs(uv.x))) *
    (1.0 - smoothstep(0.34, 0.48, abs(uv.y)));
  float crossShape = max(horizontal, vertical);
  float shape = mix(circle, crossShape, step(0.5, vGlyph));
  float glow = 1.0 - smoothstep(0.08, 0.5, radius);
  float alpha = shape * uOpacity * (0.82 + vShimmer * 0.18);

  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor * (1.0 + glow * 0.16), alpha);
}
`;
const morphVertex = `
uniform float uMorph;
uniform float uTime;
uniform float uPixelRatio;
attribute vec3 aStart;
attribute vec3 aMid;
attribute vec3 aEnd;
attribute vec3 aColorStart;
attribute vec3 aColorEnd;
attribute float aSizeStart;
attribute float aSizeEnd;
attribute float aGlyphStart;
attribute float aGlyphEnd;
attribute float aSeed;
varying vec3 vColor;
varying float vGlyph;
varying float vShimmer;

void main() {
  float m = smoothstep(0.0, 1.0, uMorph);
  vec3 first = mix(aStart, aMid, m);
  vec3 second = mix(aMid, aEnd, m);
  vec3 position = mix(first, second, m);
  float travel = sin(m * 3.14159265);
  position += vec3(
    sin(aSeed * 71.3 + uTime * 0.18),
    cos(aSeed * 53.7 + uTime * 0.15),
    sin(aSeed * 37.9 + uTime * 0.12)
  ) * (0.045 * travel);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float distanceScale = clamp(11.5 / max(1.0, -mvPosition.z), 0.48, 1.85);
  float size = mix(aSizeStart, aSizeEnd, m);
  gl_PointSize = clamp(size * uPixelRatio * distanceScale, 1.0, 8.5 * uPixelRatio);
  gl_Position = projectionMatrix * mvPosition;

  vColor = mix(aColorStart, aColorEnd, m);
  vGlyph = mix(aGlyphStart, aGlyphEnd, m);
  vShimmer = 0.5 + 0.5 * sin(aSeed * 79.1 + uTime * 0.7);
}
`;

const terrainFragment = `
uniform float uOpacity;
varying vec3 vColor;
varying float vGlyph;
varying float vShimmer;
varying float vShadow;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float radius = length(uv);
  float circle = 1.0 - smoothstep(0.34, 0.5, radius);
  float horizontal = (1.0 - smoothstep(0.065, 0.13, abs(uv.y))) *
    (1.0 - smoothstep(0.34, 0.48, abs(uv.x)));
  float vertical = (1.0 - smoothstep(0.065, 0.13, abs(uv.x))) *
    (1.0 - smoothstep(0.34, 0.48, abs(uv.y)));
  float shape = mix(circle, max(horizontal, vertical), step(0.5, vGlyph));
  float glow = 1.0 - smoothstep(0.08, 0.5, radius);
  float shadowFade = 1.0 - vShadow * 0.88;
  float alpha = shape * uOpacity * (0.82 + vShimmer * 0.18) * (1.0 - vShadow * 0.34);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor * shadowFade * (1.0 + glow * 0.14), alpha);
}
`;

const terrainVertex = `
uniform float uTime;
uniform float uPixelRatio;
uniform vec2 uShadowOrigin;
uniform vec2 uShadowDir;
uniform float uShadowLength;
uniform float uShadowOpacity;
attribute vec3 aColor;
attribute float aSize;
attribute float aGlyph;
attribute float aSeed;
varying vec3 vColor;
varying float vGlyph;
varying float vShimmer;
varying float vShadow;

void main() {
  vec3 localPosition = position;
  vec2 rel = localPosition.xz - uShadowOrigin;
  float along = dot(rel, uShadowDir);
  float safeLength = max(0.001, uShadowLength);
  float t = clamp(along / safeLength, 0.0, 1.0);
  float lateral = abs(rel.x * uShadowDir.y - rel.y * uShadowDir.x);
  float width = mix(0.12, 0.58, t);
  float longitudinal = smoothstep(0.0, 0.13, along) *
    (1.0 - smoothstep(safeLength * 0.76, safeLength, along));
  float lateralMask = 1.0 - smoothstep(width * 0.28, width, lateral);
  float contact = 1.0 - smoothstep(0.04, 0.32, length(rel / vec2(1.0, 0.72)));
  vShadow = clamp(max(longitudinal * lateralMask, contact * 0.62) * uShadowOpacity, 0.0, 1.0);

  vec4 mvPosition = modelViewMatrix * vec4(localPosition, 1.0);
  float distanceScale = clamp(9.8 / max(1.0, -mvPosition.z), 0.46, 1.75);
  gl_PointSize = clamp(aSize * uPixelRatio * distanceScale, 1.0, 7.0 * uPixelRatio);
  gl_Position = projectionMatrix * mvPosition;
  vColor = aColor;
  vGlyph = aGlyph;
  vShimmer = 0.5 + 0.5 * sin(aSeed * 61.7 + uTime * 0.55);
}
`;

const simpleVertex = `
uniform float uTime;
uniform float uPixelRatio;
uniform float uProgress;
attribute vec3 aColor;
attribute float aSize;
attribute float aGlyph;
attribute float aSeed;
varying vec3 vColor;
varying float vGlyph;
varying float vShimmer;

void main() {
  vec3 localPosition = position;
  localPosition.y -= uProgress * (0.44 + aSeed * 0.025);
  localPosition.z += uProgress * (0.82 + aSeed * 0.04);
  vec4 mvPosition = modelViewMatrix * vec4(localPosition, 1.0);
  float distanceScale = clamp(9.8 / max(1.0, -mvPosition.z), 0.46, 1.75);
  gl_PointSize = clamp(aSize * uPixelRatio * distanceScale, 1.0, 7.0 * uPixelRatio);
  gl_Position = projectionMatrix * mvPosition;
  vColor = aColor;
  vGlyph = aGlyph;
  vShimmer = 0.5 + 0.5 * sin(aSeed * 61.7 + uTime * 0.55);
}
`;

export const createMorphMaterial = (pixelRatio: number) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 1 },
    },
    vertexShader: morphVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
  });

export const createTerrainPointMaterial = (pixelRatio: number, opacity = 1) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: opacity },
      uShadowOrigin: { value: new THREE.Vector2(0, 0) },
      uShadowDir: { value: new THREE.Vector2(-0.6, 0.8).normalize() },
      uShadowLength: { value: 4.8 },
      uShadowOpacity: { value: 0.86 },
    },
    vertexShader: terrainVertex,
    fragmentShader: terrainFragment,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
  });

export const createSimplePointMaterial = (pixelRatio: number, opacity = 1) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uProgress: { value: 0 },
      uOpacity: { value: opacity },
    },
    vertexShader: simpleVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
  });

export const createGlowMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(1.35, 0.82, 0.52) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float d = length(p);
        float halo = 1.0 - smoothstep(0.02, 0.5, d);
        halo *= halo;
        gl_FragColor = vec4(uColor, halo * uOpacity * 0.3);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
