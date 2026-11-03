import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  // Reset scroll instantly to top when navigating routes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return <>{children}</>;
}
