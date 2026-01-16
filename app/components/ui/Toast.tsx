/**
 * Toast notification component
 */

'use client';

import React from 'react';
import { useAppState } from '@/contexts/AppStateContext';
import { useLucideIcons } from '@/hooks/useLucideIcons';

export function ToastContainer() {
  const { toasts, hideToast } = useAppState();

  // Initialize Lucide icons
  useLucideIcons();

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
