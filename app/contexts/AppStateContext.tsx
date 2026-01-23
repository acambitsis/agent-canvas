/**
 * AppStateContext - Manages global UI state (loading, toasts, modals, sidebar, theme)
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Agent } from '@/types/agent';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { ThemePreference, ThemeValue } from '@/constants/themes';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppStateContextValue {
  isLoading: boolean;
  loadingMessage: string;
  toasts: Toast[];
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  quickLookAgent: Agent | null;
  themePreference: ThemePreference;
  resolvedTheme: ThemeValue;
  showLoading: (message: string) => void;
  hideLoading: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: (id: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setQuickLookAgent: (agent: Agent | null) => void;
  setThemePreference: (theme: ThemePreference) => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

function getSystemTheme(): ThemeValue {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage(STORAGE_KEYS.SIDEBAR_COLLAPSED, false);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage(STORAGE_KEYS.SIDEBAR_WIDTH, 280);
  const [quickLookAgent, setQuickLookAgent] = useState<Agent | null>(null);
  const [themePreference, setThemePreference] = useLocalStorage<ThemePreference>(STORAGE_KEYS.THEME, 'system');
  const [resolvedTheme, setResolvedTheme] = useState<ThemeValue>('light');

  // Resolve theme preference to actual theme value
  useEffect(() => {
    const resolved = themePreference === 'system' ? getSystemTheme() : themePreference;
    setResolvedTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, [themePreference]);

  // Listen for system theme changes when preference is 'system'
  useEffect(() => {
    if (themePreference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference]);

  const showLoading = useCallback((message: string) => {
    setIsLoading(true);
    setLoadingMessage(message);
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingMessage('');
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, [setIsSidebarCollapsed]);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  }, [setIsSidebarCollapsed]);

  const value: AppStateContextValue = {
    isLoading,
    loadingMessage,
    toasts,
    isSidebarCollapsed,
    sidebarWidth,
    quickLookAgent,
    themePreference,
    resolvedTheme,
    showLoading,
    hideLoading,
    showToast,
    hideToast,
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarWidth,
    setQuickLookAgent,
    setThemePreference,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
