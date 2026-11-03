import { gsap } from 'gsap';

interface LRRecord {
  l: number;
  r: number;
}

export function animateElasticPill(
  pillEl: HTMLElement | null,
  trackEl: HTMLElement | null,
  activeTargetEl: HTMLElement | null,
  animate: boolean = true
) {
  if (!pillEl || !trackEl || !activeTargetEl || !activeTargetEl.offsetWidth) {
    if (pillEl) gsap.set(pillEl, { opacity: 0 });
    return;
  }

  const trackWidth = pillEl.offsetWidth || trackEl.scrollWidth;
  const trackHeight = pillEl.offsetHeight || trackEl.offsetHeight;

  const left = activeTargetEl.offsetLeft;
  const right = trackWidth - (activeTargetEl.offsetLeft + activeTargetEl.offsetWidth);
  const top = activeTargetEl.offsetTop;
  const bottom = trackHeight - (activeTargetEl.offsetTop + activeTargetEl.offsetHeight);

  const getClip = (l: number, r: number) =>
    `inset(${top}px ${r}px ${bottom}px ${l}px round 999px)`;

  const prev = (pillEl as any).__lr as [number, number] | undefined;
  (pillEl as any).__lr = [left, right];

  const currentOpacity = Number(gsap.getProperty(pillEl, 'opacity'));

  if (!animate || !prev || currentOpacity === 0) {
    gsap.set(pillEl, { clipPath: getClip(left, right), opacity: 1 });
    return;
  }

  const state: LRRecord = { l: prev[0], r: prev[1] };
  const movingRight = left > prev[0];

  gsap.killTweensOf(state);

  gsap.to(state, {
    l: left,
    duration: movingRight ? 0.55 : 0.36,
    ease: movingRight ? 'power3.inOut' : 'power3.out',
    onUpdate: () => gsap.set(pillEl, { clipPath: getClip(state.l, state.r) }),
  });

  gsap.to(state, {
    r: right,
    duration: movingRight ? 0.36 : 0.55,
    ease: movingRight ? 'power3.out' : 'power3.inOut',
    onUpdate: () => gsap.set(pillEl, { clipPath: getClip(state.l, state.r) }),
  });
}
