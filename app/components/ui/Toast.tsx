/**
 * Toast notification component
 */

'use client';

import React, { useEffect } from 'react';
import { useAppState } from '@/contexts/AppStateContext';

export function ToastContainer() {
  const { toasts, hideToast } = useAppState();

  // Refresh Lucide icons when toasts change
  useEffect(() => {
    if (toasts.length > 0 && typeof window !== 'undefined' && (window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast__content">
            <i
              data-lucide={
                toast.type === 'success'
                  ? 'check-circle'
                  : toast.type === 'error'
                  ? 'alert-circle'
                  : 'info'
              }
            ></i>
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => hideToast(toast.id)}
            aria-label="Close toast"
          >
            <i data-lucide="x"></i>
          </button>
        </div>
      ))}
    </div>
  );
}
