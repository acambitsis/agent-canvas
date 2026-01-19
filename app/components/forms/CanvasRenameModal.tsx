/**
 * CanvasRenameModal - Modal for renaming a canvas
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useCanvas } from '@/contexts/CanvasContext';
import { useAppState } from '@/contexts/AppStateContext';

interface CanvasRenameModalProps {
  isOpen: boolean;
  canvasId: string;
  currentTitle: string;
  onClose: () => void;
}

export function CanvasRenameModal({ isOpen, canvasId, currentTitle, onClose }: CanvasRenameModalProps) {
  const { updateCanvas } = useCanvas();
  const { showToast } = useAppState();
  const [title, setTitle] = useState(currentTitle);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle);
      setError(null);
    }
  }, [isOpen, currentTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }

    if (trimmedTitle === currentTitle) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateCanvas(canvasId, { title: trimmedTitle });
      showToast('Canvas renamed successfully', 'success');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename canvas';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rename Canvas" size="small">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="canvas-title" className="form-label">
            Canvas Name
          </label>
          <input
            id="canvas-title"
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter canvas name"
            autoFocus
            disabled={isSubmitting}
          />
          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
