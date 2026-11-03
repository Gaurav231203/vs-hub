import gsap from 'gsap';

/**
 * Universal Murmura Page & View Entrance Animation
 * Staggers entrance for header, stats, toolbars, grids, and cards across all pages
 * Paced with deliberate delays and smooth cubic easing for a luxury feel
 */
export function animatePageEntrance(container: HTMLElement) {
  if (typeof window === 'undefined' || !container) return;

  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReduced) return;

  // Kill any previous tweens on these elements to avoid conflicts
  gsap.killTweensOf(container.querySelectorAll('*'));

  const tl = gsap.timeline({
    delay: 0.12, // Gentle deliberate pause before entrance sequence begins
  });

  // 1. Header Title & Lead Elements
  const leads = container.querySelectorAll(
    '.head__lead, .head__title, .head__back, .head > h1, .view > h1'
  );
  if (leads.length) {
    tl.fromTo(
      leads,
      { opacity: 0, y: 22 },
      {
        opacity: 1,
        y: 0,
        duration: 0.68,
        ease: 'power3.out',
        stagger: 0.06,
        clearProps: 'transform,opacity',
      },
      0
    );
  }

  // 2. Stats Badges & Stat Cards
  const stats = container.querySelectorAll(
    '.head__stats .stat, .stat, [data-stat], .stat-card'
  );
  if (stats.length) {
    tl.fromTo(
      stats,
      { opacity: 0, y: 18, scale: 0.94 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.62,
        ease: 'back.out(1.35)',
        stagger: 0.07,
        clearProps: 'transform,opacity',
      },
      0.14
    );
  }

  // 2b. Specifically Animate The Three Stat Icons (.stat__ico) with dynamic spring pop & rotation!
  const statIcons = container.querySelectorAll<HTMLElement>(
    '.head__stats .stat .stat__ico, .stat .stat__ico, .stat__ico'
  );
  if (statIcons.length) {
    tl.fromTo(
      statIcons,
      { scale: 0.55, rotation: -22, opacity: 0 },
      {
        scale: 1,
        rotation: 0,
        opacity: 1,
        duration: 0.72,
        ease: 'back.out(2.4)',
        stagger: 0.08,
        clearProps: 'all',
        onComplete: () => {
          initContinuousIconFloat(container);
        },
      },
      0.18
    );
  } else {
    initContinuousIconFloat(container);
  }

  // 2c. Stat Number Counter Count-Up Animation
  const statValues = container.querySelectorAll<HTMLElement>(
    '.head__stats .stat__value b, .stat__value b, .stat__value, [data-count]'
  );
  statValues.forEach((el, idx) => {
    const raw = el.dataset.count || el.textContent || '';
    const match = raw.match(/\d+/);
    if (match) {
      const targetCount = parseInt(match[0], 10);
      if (targetCount > 0) {
        const obj = { count: 0 };
        tl.to(
          obj,
          {
            count: targetCount,
            duration: 1.15,
            ease: 'power2.out',
            onUpdate: () => {
              const current = Math.round(obj.count);
              if (el.dataset.count !== undefined || el.tagName === 'B') {
                el.textContent = current.toLocaleString();
              } else {
                el.innerHTML = raw.replace(/\d+/, current.toLocaleString());
              }
            },
          },
          0.26 + idx * 0.08
        );
      }
    }
  });


  // 3. Header Action Controls (Pill switcher, buttons, nav arrows)
  const actions = container.querySelectorAll(
    '.head__actions > *, .head__tools > *, .cl-nav, .seg'
  );
  if (actions.length) {
    tl.fromTo(
      actions,
      { opacity: 0, y: 15 },
      {
        opacity: 1,
        y: 0,
        duration: 0.58,
        ease: 'power2.out',
        stagger: 0.05,
        clearProps: 'transform,opacity',
      },
      0.22
    );
  }

  // 4. Toolbar & Filter Chips across all pages
  const toolbars = container.querySelectorAll(
    '.toolbar, .toolbar > *, .cl-bar, .cl-filters, .cl-chips > *, .ap-bar, .filters'
  );
  if (toolbars.length) {
    tl.fromTo(
      toolbars,
      { opacity: 0, y: 14 },
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: 'power3.out',
        stagger: 0.035,
        clearProps: 'transform,opacity',
      },
      0.28
    );
  }

  // 5. Main Content Cards, Sidebars & Grids
  const cards = container.querySelectorAll(
    '.cl-cal, .cl-side > .card, .card:not(.top), .ap-card, .ap-rule, .ap-who, .st-side, .st-main, .ov-grid > *, .ls-grid > *, .an-grid > *, .inbox-layout > *, .team-card, .channel-card'
  );
  if (cards.length) {
    tl.fromTo(
      cards,
      { opacity: 0, y: 26, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.72,
        ease: 'power3.out',
        stagger: 0.08,
        clearProps: 'transform,opacity',
      },
      0.34
    );
  }

  // 6. Calendar Ribbons
  const ribs = container.querySelectorAll('.cl-rib');
  if (ribs.length) {
    tl.fromTo(
      ribs,
      { scaleX: 0, transformOrigin: '0 50%' },
      {
        scaleX: 1,
        duration: 0.75,
        ease: 'power3.inOut',
        stagger: 0.06,
        clearProps: 'transform',
      },
      0.44
    );
  }

  // 7. Individual Content Items, Post Tiles, Rows & Tables
  const items = container.querySelectorAll(
    '.cl-tile, .cl-dlist > li, .ap-list > li, .table tbody tr, .feed__item, .pop__row'
  );
  if (items.length) {
    tl.fromTo(
      items,
      { opacity: 0, y: 16, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        ease: 'back.out(1.4)',
        stagger: 0.04,
        clearProps: 'transform,opacity',
      },
      0.5
    );
  }

  return tl;
}

/**
 * Continuous Organic Floating & Tilting for all Header Stat Icons
 * Guarantees that the icons are always in fluid, lifelike perpetual motion
 */
export function initContinuousIconFloat(container: HTMLElement | Document = document) {
  if (typeof window === 'undefined') return;

  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReduced) return;

  const statIcons = container.querySelectorAll<HTMLElement>(
    '.head__stats .stat .stat__ico, .stat .stat__ico, .stat__ico'
  );

  statIcons.forEach((wrapper, idx) => {
    const ico = wrapper.querySelector<HTMLElement>('.ico, svg') || wrapper;

    // Reset previous float tweens if any
    gsap.killTweensOf(ico);

    // Continuous perpetual floating and subtle organic tilting
    gsap.to(ico, {
      y: idx % 2 === 0 ? -4.5 : -5.5,
      rotation: idx === 0 ? -3.5 : idx === 1 ? 4 : -2.5,
      scale: 1.04,
      duration: 2.3 + (idx % 3) * 0.45,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      delay: (idx % 3) * 0.28,
    });
  });
}

