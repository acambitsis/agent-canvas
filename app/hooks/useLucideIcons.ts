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

    // Try multiple times to catch dynamically added icons
    const timers = [
      setTimeout(initIcons, 50),
      setTimeout(initIcons, 150),
      setTimeout(initIcons, 300),
    ];

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  });
}
