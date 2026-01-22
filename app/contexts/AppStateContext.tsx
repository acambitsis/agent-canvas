/**
 * AppStateContext - Manages global UI state (loading, toasts, modals, sidebar)
 */

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Agent } from '@/types/agent';
import { STORAGE_KEYS } from '@/constants/storageKeys';

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
  showLoading: (message: string) => void;
  hideLoading: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: (id: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setQuickLookAgent: (agent: Agent | null) => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage(STORAGE_KEYS.SIDEBAR_COLLAPSED, false);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage(STORAGE_KEYS.SIDEBAR_WIDTH, 280);
  const [quickLookAgent, setQuickLookAgent] = useState<Agent | null>(null);

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
    showLoading,
    hideLoading,
    showToast,
    hideToast,
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarWidth,
    setQuickLookAgent,
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
