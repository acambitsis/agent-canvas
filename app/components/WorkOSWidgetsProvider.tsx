/**
 * WorkOSWidgetsProvider - Provides WorkOS Widgets context and theming
 *
 * Wraps the application with WorkOS widget providers and React Query
 * for server state management required by the widgets.
 *
 * Syncs widget theme with the app's theme preference via data-theme attribute.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { WorkOsWidgets } from '@workos-inc/widgets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import WorkOS widget CSS (must be in JS, not CSS @import)
import '@radix-ui/themes/styles.css';
import '@workos-inc/widgets/styles.css';

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

interface WorkOSWidgetsProviderProps {
  children: React.ReactNode;
}

/**
 * Get the current theme from the document's data-theme attribute
 */
function getDocumentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'dark' || theme === 'midnight' ? 'dark' : 'light';
}

export function WorkOSWidgetsProvider({ children }: WorkOSWidgetsProviderProps) {
  const [appearance, setAppearance] = useState<'light' | 'dark'>('light');

  // Sync with document theme on mount and when it changes
  useEffect(() => {
    // Set initial theme
    setAppearance(getDocumentTheme());

    // Watch for theme changes via MutationObserver
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-theme') {
          setAppearance(getDocumentTheme());
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WorkOsWidgets
        theme={{
          appearance,
          accentColor: 'indigo',
          radius: 'medium',
        }}
      >
        {children}
      </WorkOsWidgets>
    </QueryClientProvider>
  );
}
