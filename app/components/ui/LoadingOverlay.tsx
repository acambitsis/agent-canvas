/**
 * LoadingOverlay component
 */

'use client';

import React, { useEffect } from 'react';
import { useAppState } from '@/contexts/AppStateContext';

export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useAppState();

  // Refresh Lucide icons when loading state changes
  useEffect(() => {
    if (isLoading && typeof window !== 'undefined' && (window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="loading-overlay show">
      <div className="loading-overlay__spinner">
        <i data-lucide="loader-2" className="loading-icon"></i>
        {loadingMessage && <p>{loadingMessage}</p>}
      </div>
    </div>
  );
}
