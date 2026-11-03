import gsap from 'gsap';

/**
 * Murmura Magnetic Attraction Physics
 * Pulls interactive elements towards cursor on pointermove and springs back on leave
 */
export function initMagnetic(container: HTMLElement | Document = document) {
  if (typeof window === 'undefined') return;

  const isFine = window.matchMedia('(pointer: fine)').matches;
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!isFine || isReduced) return;

  const elements = container.querySelectorAll<HTMLElement>('.magnetic, .stat__ico, .stat');
  elements.forEach((el) => {
    if ((el as any).__magInitialized) return;
    (el as any).__magInitialized = true;

    const quickX = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
    const quickY = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) * 0.28;
      const dy = (e.clientY - centerY) * 0.32;
      quickX(dx);
      quickY(dy);
    };

    const onPointerLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1.1, 0.4)',
        overwrite: 'auto',
        onComplete: () => {
          gsap.set(el, { clearProps: 'transform' });
        },
      });
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);
  });
}
