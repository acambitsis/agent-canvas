/**
 * Home page - Main application entry point
 */

'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ConvexClientProvider } from '@/contexts/ConvexClientProvider';
import { CanvasProvider } from '@/contexts/CanvasContext';
import { AgentProvider } from '@/contexts/AgentContext';
import { GroupingProvider } from '@/contexts/GroupingContext';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { AppLayout } from '@/components/layout/AppLayout';

export default function HomePage() {
  return (
    <AuthProvider>
      <ConvexClientProvider>
        <CanvasProvider>
          <AgentProvider>
            <GroupingProvider>
              <AppStateProvider>
                <AppLayout />
              </AppStateProvider>
            </GroupingProvider>
          </AgentProvider>
        </CanvasProvider>
      </ConvexClientProvider>
    </AuthProvider>
  );
}
