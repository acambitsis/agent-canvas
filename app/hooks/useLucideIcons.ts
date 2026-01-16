/**
 * Hook to initialize Lucide icons after render
 * Waits for Lucide to load and calls createIcons()
 */

import { useEffect } from 'react';

export function useLucideIcons() {
  useEffect(() => {
    const initIcons = () => {
      if (typeof window !== 'undefined' && (window as any).lucide) {
        (window as any).lucide.createIcons();
      }
    };

    // Try immediately
    initIcons();

    // Also try after a short delay to catch late-loading icons
    const timer = setTimeout(initIcons, 100);

    return () => clearTimeout(timer);
  });
}
