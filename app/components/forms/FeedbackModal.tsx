/**
 * FeedbackModal - Form for submitting user feedback as GitHub issues
 */

'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useAppState } from '@/contexts/AppStateContext';
import { Icon } from '@/components/ui/Icon';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'feature' | 'general';

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: string }[] = [
  { value: 'bug', label: 'Bug', icon: 'bug' },
  { value: 'feature', label: 'Feature', icon: 'lightbulb' },
  { value: 'general', label: 'General', icon: 'message-circle' },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { showToast } = useAppState();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [description, setDescription] = useState('');
  const [includeUrl, setIncludeUrl] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (description.trim().length < 10) {
      showToast('Please provide more detail (at least 10 characters)', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          description: description.trim(),
          pageUrl: includeUrl ? window.location.href : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      showToast('Thanks for your feedback!', 'success');
      handleClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to submit feedback',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFeedbackType('general');
    setDescription('');
    setIncludeUrl(true);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Send Feedback" size="medium">
      <form onSubmit={handleSubmit} className="feedback-form">
        <div className="form-group">
          <label className="form-label">What type of feedback?</label>
          <div className="feedback-type-grid">
            {FEEDBACK_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                className={`feedback-type-btn ${feedbackType === type.value ? 'is-selected' : ''}`}
                onClick={() => setFeedbackType(type.value)}
              >
                <Icon name={type.icon} />
                <span className="feedback-type-btn__label">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="feedback-description" className="form-label">
            Description <span className="required">*</span>
          </label>
          <textarea
            id="feedback-description"
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              feedbackType === 'bug'
                ? 'Describe what happened and what you expected...'
                : feedbackType === 'feature'
                  ? 'Describe the feature you would like to see...'
                  : 'Share your thoughts...'
            }
            required
            minLength={10}
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeUrl}
              onChange={(e) => setIncludeUrl(e.target.checked)}
            />
            Include current page URL for context
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSubmitting || description.trim().length < 10}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
