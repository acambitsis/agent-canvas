/**
 * Toast notification component
 */

'use client';

import React from 'react';
import { useAppState } from '@/contexts/AppStateContext';
import { Icon } from '@/components/ui/Icon';

export function ToastContainer() {
  const { toasts, hideToast } = useAppState();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast__content">
            <Icon
              name={
                toast.type === 'success'
                  ? 'check-circle'
                  : toast.type === 'error'
                  ? 'alert-circle'
                  : 'info'
              }
            />
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => hideToast(toast.id)}
            aria-label="Close toast"
          >
            <Icon name="x" />
          </button>
        </div>
      ))}
    </div>
  );
}
