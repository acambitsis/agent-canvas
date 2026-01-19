/**
 * ConfirmDialog - Reusable confirmation dialog component
 */

'use client';

import React from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="small">
      <div className="confirm-dialog">
        {confirmVariant === 'danger' && (
          <div className="confirm-dialog__icon confirm-dialog__icon--danger">
            <Icon name="alert-triangle" />
          </div>
        )}
        <p className="confirm-dialog__message">{message}</p>
        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${confirmVariant === 'danger' ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
