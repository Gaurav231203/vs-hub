import { gsap } from 'gsap';

export interface ApprovalsPhysics {
  stampCard: (
    cardEl: HTMLElement,
    approverName: string,
    timeStr: string,
    onStampDone?: () => void,
    onExited?: () => void
  ) => gsap.core.Timeline;

  flipCardForChanges: (
    cardEl: HTMLElement,
    authorName: string,
    reviewerName: string,
    noteText: string,
    onMidFlip?: () => void,
    onExited?: () => void
  ) => gsap.core.Timeline;

  withdrawCard: (cardEl: HTMLElement, onExited?: () => void) => gsap.core.Tween;

  animateEmptyState: (containerEl: HTMLElement) => void;

  animateBulkBar: (barEl: HTMLElement, isVisible: boolean) => void;

  animatePhotoDot: (
    images: HTMLElement[],
    targetIndex: number,
    currentIndex: number
  ) => void;

  flipAnimateList: (
    listEl: HTMLElement,
    captureAction: () => void
  ) => void;
}

export function stampCard(
  cardEl: HTMLElement,
  approverName: string,
  timeStr: string,
  onStampDone?: () => void,
  onExited?: () => void
) {
  const stampEl = cardEl.querySelector<HTMLElement>('.ap-stamp');
  if (stampEl) {
    stampEl.hidden = false;
    const smallEl = stampEl.querySelector('small');
    if (smallEl) {
      smallEl.textContent = `${approverName} · ${timeStr}`;
    }
  }

  cardEl.classList.add('is-leaving');
  const tl = gsap.timeline();

  if (stampEl) {
    tl.fromTo(
      stampEl,
      { scale: 2.1, opacity: 0, rotation: -26 },
      { scale: 1, opacity: 1, rotation: -11, duration: 0.34, ease: 'back.out(1.5)' }
    )
      .fromTo(
        cardEl,
        { scale: 0.975 },
        { scale: 1, duration: 0.45, ease: 'back.out(1.8)' },
        '>-0.02'
      )
      .to(
        cardEl,
        { keyframes: { x: [0, -5, 4, -2, 1, 0] }, duration: 0.32, ease: 'none' },
        '<'
      );
  }

  tl.add(() => {
    onStampDone?.();
  }, '+=0.15');

  // Sweep off to the right
  tl.to(
    cardEl,
    {
      x: () => Math.max(260, window.innerWidth * 0.55),
      rotation: 6,
      opacity: 0,
      duration: 0.6,
      ease: 'power3.in',
    },
    '+=0.35'
  ).add(() => {
    onExited?.();
  });

  return tl;
}

export function flipCardForChanges(
  cardEl: HTMLElement,
  authorName: string,
  reviewerName: string,
  noteText: string,
  onMidFlip?: () => void,
  onExited?: () => void
) {
  cardEl.classList.add('is-leaving');
  const backEl = cardEl.querySelector<HTMLElement>('.ap-back');
  if (backEl) {
    backEl.hidden = true;
  }

  const tl = gsap.timeline();

  tl.to(cardEl, {
    rotationY: 90,
    transformPerspective: 1400,
    duration: 0.26,
    ease: 'power2.in',
  })
    .add(() => {
      if (backEl) backEl.hidden = false;
      onMidFlip?.();
    })
    .fromTo(
      cardEl,
      { rotationY: -90 },
      { rotationY: 0, transformPerspective: 1400, duration: 0.6, ease: 'back.out(1.5)' }
    );

  if (backEl) {
    const children = backEl.querySelectorAll('*');
    if (children.length > 0) {
      tl.fromTo(
        children,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, stagger: 0.07, duration: 0.3, ease: 'power2.out' },
        '<0.1'
      );
    }
  }

  tl.to(
    cardEl,
    {
      y: 40,
      scale: 0.92,
      opacity: 0,
      duration: 0.45,
      ease: 'power3.in',
    },
    '+=1.2'
  ).add(() => {
    onExited?.();
  });

  return tl;
}

export function withdrawCard(cardEl: HTMLElement, onExited?: () => void) {
  cardEl.classList.add('is-leaving');
  return gsap.to(cardEl, {
    x: -40,
    opacity: 0,
    scale: 0.95,
    duration: 0.35,
    ease: 'power2.in',
    onComplete: () => {
      onExited?.();
    },
  });
}

export function animateEmptyState(containerEl: HTMLElement) {
  const zeroEl = containerEl.querySelector('.ap-zero');
  const tiles = containerEl.querySelectorAll('.ap-zero__tile');
  const art = containerEl.querySelector('.ap-zero__art');

  if (zeroEl) {
    gsap.fromTo(
      zeroEl,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' }
    );
  }

  if (tiles.length > 0) {
    gsap.fromTo(
      tiles,
      { opacity: 0, y: 30, scale: 0.8 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: 'back.out(1.8)',
        stagger: 0.09,
        delay: 0.1,
        clearProps: 'transform,opacity',
      }
    );
  }

  if (art) {
    gsap.to(art, {
      y: -6,
      duration: 2.6,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: 0.9,
    });
  }
}

export function animateBulkBar(barEl: HTMLElement, isVisible: boolean) {
  if (isVisible) {
    gsap.fromTo(
      barEl,
      { xPercent: -50, y: 50, autoAlpha: 0, scale: 0.95 },
      { xPercent: -50, y: 0, autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
    );
  } else {
    gsap.to(barEl, {
      xPercent: -50,
      y: 50,
      autoAlpha: 0,
      scale: 0.95,
      duration: 0.25,
      ease: 'power2.in',
    });
  }
}

export function flipAnimateList(
  listEl: HTMLElement | null,
  updateStateAction: () => void
) {
  if (!listEl) {
    updateStateAction();
    return;
  }

  const cards = Array.from(listEl.querySelectorAll<HTMLElement>('.ap-card:not(.is-leaving)'));
  const firstRects = new Map<HTMLElement, DOMRect>();
  cards.forEach((card) => {
    firstRects.set(card, card.getBoundingClientRect());
  });

  updateStateAction();

  requestAnimationFrame(() => {
    firstRects.forEach((firstRect, card) => {
      if (!card.isConnected || card.classList.contains('is-leaving')) return;
      const lastRect = card.getBoundingClientRect();
      const deltaX = firstRect.left - lastRect.left;
      const deltaY = firstRect.top - lastRect.top;

      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        gsap.fromTo(
          card,
          { x: deltaX, y: deltaY },
          { x: 0, y: 0, duration: 0.55, ease: 'power3.inOut', clearProps: 'transform' }
        );
      }
    });
  });
}

export function animatePhotoDot(
  images: HTMLElement[],
  targetIndex: number,
  currentIndex: number
) {
  const currentImg = images[currentIndex];
  const targetImg = images[targetIndex];

  if (currentImg && currentImg !== targetImg) {
    currentImg.classList.remove('is-on');
    gsap.to(currentImg, { opacity: 0, duration: 0.35, ease: 'power2.out' });
  }

  if (targetImg) {
    targetImg.classList.add('is-on');
    gsap.fromTo(
      targetImg,
      { opacity: 0, scale: 1.06 },
      { opacity: 1, scale: 1, duration: 0.55, ease: 'power3.out' }
    );
  }
}

