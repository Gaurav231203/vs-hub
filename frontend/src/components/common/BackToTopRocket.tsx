import React, { useEffect, useState, useRef } from 'react';
import { Rocket, ChevronUp } from 'lucide-react';

export function BackToTopRocket() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const shouldShow = scrollY > 180;
        setIsScrolled((prev) => (prev !== shouldShow ? shouldShow : prev));
        rafRef.current = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLaunch = () => {
    if (isLaunching) return;
    setIsLaunching(true);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    setTimeout(() => {
      setIsLaunching(false);
    }, 1100);
  };

  const isVisible = isScrolled || isLaunching;

  return (
    <aside
      className="fixed-rocket-dock"
      aria-label="Back to top ascent rocket"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--mnav-h, 0px) + 20px)',
        right: 'clamp(14px, 3vw, 24px)',
        zIndex: 9999,
        pointerEvents: isVisible ? 'auto' : 'none',
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? isLaunching
            ? 'translateY(-140px) scale(0.92)'
            : 'translateY(0) scale(1)'
          : 'translateY(20px) scale(0.9)',
        transition: isLaunching
          ? 'transform 0.9s cubic-bezier(0.12, 0.8, 0.32, 1), opacity 0.9s cubic-bezier(0.12, 0.8, 0.32, 1)'
          : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease',
      }}
    >
      <button
        type="button"
        onClick={handleLaunch}
        className="rocket-launch-btn"
        title="Scroll back to top"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          borderRadius: '9999px',
          border: '1px solid var(--rim, rgba(255, 255, 255, 0.15))',
          background: 'var(--float, #18181b)',
          color: 'var(--text, #ffffff)',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: isLaunching
            ? '0 0 24px rgba(79, 140, 255, 0.55), 0 8px 32px rgba(0, 0, 0, 0.45)'
            : '0 4px 20px rgba(0, 0, 0, 0.3)',
          cursor: 'pointer',
          outline: 'none',
          userSelect: 'none',
          position: 'relative',
          overflow: 'visible',
          transition: 'all 0.25s ease',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            transform: isLaunching ? 'translateY(-3px) rotate(-12deg)' : 'none',
            transition: 'transform 0.3s ease',
            color: 'var(--sea, #38bdf8)',
          }}
        >
          <Rocket size={16} />
        </span>
        <span>Go to top</span>
        <ChevronUp size={14} style={{ opacity: 0.6 }} />

        {/* Thruster Flame Plume on Launch */}
        {isLaunching && (
          <span
            style={{
              position: 'absolute',
              bottom: '-16px',
              left: '26px',
              width: '12px',
              height: '24px',
              background: 'linear-gradient(180deg, #38bdf8, #f59e0b, transparent)',
              borderRadius: '50%',
              filter: 'blur(2px)',
              animation: 'rocketFlamePulse 0.12s infinite alternate',
            }}
          />
        )}
      </button>

      <style>{`
        @keyframes rocketFlamePulse {
          0% { transform: scaleY(0.85) scaleX(0.9); opacity: 0.8; }
          100% { transform: scaleY(1.3) scaleX(1.1); opacity: 1; }
        }
        .rocket-launch-btn:hover {
          filter: brightness(1.12);
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(56, 189, 248, 0.25), 0 4px 16px rgba(0, 0, 0, 0.3);
        }
        .rocket-launch-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </aside>
  );
}
