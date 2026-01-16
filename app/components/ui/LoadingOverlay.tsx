/**
 * LoadingOverlay component
 */

'use client';

import React from 'react';
import { useAppState } from '@/contexts/AppStateContext';
import { Icon } from '@/components/ui/Icon';

export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useAppState();

  if (!isLoading) return null;

  return (
    <div className="loading-overlay show">
      <div className="loading-overlay__spinner">
        <Icon name="loader-2" className="loading-icon" />
        {loadingMessage && <p>{loadingMessage}</p>}
      </div>
    </div>
  );
}
