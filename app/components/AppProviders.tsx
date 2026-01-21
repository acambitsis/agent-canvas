/**
 * AppProviders - Shared provider hierarchy for all app pages
 */

'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConvexClientProvider } from '@/contexts/ConvexClientProvider';
import { CanvasProvider } from '@/contexts/CanvasContext';
import { AgentProvider } from '@/contexts/AgentContext';
import { GroupingProvider } from '@/contexts/GroupingContext';
import { AppStateProvider } from '@/contexts/AppStateContext';

interface AppProvidersProps {
  children: React.ReactNode;
  initialCanvasId?: string;
}

export function AppProviders({ children, initialCanvasId }: AppProvidersProps) {
  return (
    <AuthProvider>
      <ConvexClientProvider>
        <CanvasProvider initialCanvasId={initialCanvasId}>
          <AgentProvider>
            <GroupingProvider>
              <AppStateProvider>
                {children}
              </AppStateProvider>
            </GroupingProvider>
          </AgentProvider>
        </CanvasProvider>
      </ConvexClientProvider>
    </AuthProvider>
  );
}
