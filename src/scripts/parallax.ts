const scene = document.querySelector<HTMLElement>('[data-parallax-scene]');

if (scene) {
  const flower = scene.querySelector<HTMLElement>('[data-layer="flower"]');
  const terrain = scene.querySelector<HTMLElement>('[data-layer="terrain"]');
  const galaxy = scene.querySelector<HTMLElement>('[data-layer="galaxy"]');
  const stars = scene.querySelector<HTMLElement>('[data-layer="stars"]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const smoothstep = (edge0: number, edge1: number, value: number) => {
    const x = clamp((value - edge0) / (edge1 - edge0));
    return x * x * (3 - 2 * x);
  };

  let target = 0;
  let current = 0;
  let frameId = 0;

  const setTransform = (el: HTMLElement | null, value: string) => {
    if (el) el.style.transform = value;
  };

  const setOpacity = (el: HTMLElement | null, value: number) => {
    if (el) el.style.opacity = String(clamp(value));
  };

  const apply = (progress: number) => {
    const p = clamp(progress);
    const hero = 1 - smoothstep(0.34, 0.72, p);
    const ground = 1 - smoothstep(0.22, 0.64, p);
    const galaxyIn = smoothstep(0.4, 0.9, p);

    setTransform(stars, `translate3d(0, ${-42 * p}px, -240px) scale(1.04)`);
    setTransform(
      flower,
      `translate3d(0, ${-120 * p}px, -80px) scale(${1 - p * 0.075})`,
    );
    setTransform(
      terrain,
      `translate3d(0, ${-320 * p}px, 140px) scale(${1 + p * 0.065})`,
    );
    setTransform(
      galaxy,
      `translate3d(0, ${(1 - galaxyIn) * 165}px, -120px) scale(${0.82 + galaxyIn * 0.18})`,
    );

    setOpacity(flower, hero);
    setOpacity(terrain, ground);
    setOpacity(galaxy, galaxyIn);
  };

  const readScroll = () => {
    const travel = Math.max(1, window.innerHeight);
    target = clamp(window.scrollY / travel);
    if (reduceMotion) {
      current = target < 0.5 ? 0 : 1;
      apply(current);
    }
  };

  const tick = () => {
    current += (target - current) * 0.075;
    if (Math.abs(target - current) < 0.0005) current = target;
    apply(current);
    frameId = window.requestAnimationFrame(tick);
  };

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', readScroll, { passive: true });
  readScroll();
  apply(current);

  if (!reduceMotion) frameId = window.requestAnimationFrame(tick);

  window.addEventListener('pagehide', () => {
    if (frameId) window.cancelAnimationFrame(frameId);
  });
}
