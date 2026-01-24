/**
 * AppProviders - Shared provider hierarchy for all app pages
 *
 * Uses WorkOS AuthKit SDK for authentication.
 */

'use client';

import React from 'react';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
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
    <AuthKitProvider>
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
    </AuthKitProvider>
  );
}
