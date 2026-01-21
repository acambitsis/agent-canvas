/**
 * AppStateContext - Manages global UI state (loading, toasts, modals, sidebar)
 */

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

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
  showLoading: (message: string) => void;
  hideLoading: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: (id: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

const SIDEBAR_COLLAPSED_KEY = 'agentcanvas-sidebar-collapsed';
const SIDEBAR_WIDTH_KEY = 'agentcanvas-sidebar-width';

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage(SIDEBAR_COLLAPSED_KEY, false);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage(SIDEBAR_WIDTH_KEY, 280);

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
    showLoading,
    hideLoading,
    showToast,
    hideToast,
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarWidth,
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
