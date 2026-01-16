/**
 * LoadingOverlay component
 */

'use client';

import React from 'react';
import { useAppState } from '@/contexts/AppStateContext';
import { useLucideIcons } from '@/hooks/useLucideIcons';

export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useAppState();

  // Initialize Lucide icons
  useLucideIcons();

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
