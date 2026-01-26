/**
 * FeedbackModal - Form for submitting user feedback as GitHub issues
 *
 * Features:
 * - Feedback type selection (bug, feature, general)
 * - Screenshot upload via file input or clipboard paste
 * - Success state with link to created GitHub issue
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Modal } from '../ui/Modal';
import { useAppState } from '@/contexts/AppStateContext';
import { Icon } from '@/components/ui/Icon';
import {
  VALIDATION_CONSTANTS,
  FEEDBACK_TYPE,
  FEEDBACK_TYPE_OPTIONS,
  FeedbackType,
} from '@/types/validationConstants';

const {
  FEEDBACK_DESCRIPTION_MIN_LENGTH,
  FEEDBACK_DESCRIPTION_MAX_LENGTH,
  SCREENSHOT_MAX_SIZE_BYTES,
} = VALIDATION_CONSTANTS;

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SubmissionResult {
  issueNumber: number;
  issueUrl: string;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { showToast } = useAppState();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(FEEDBACK_TYPE.GENERAL);
  const [description, setDescription] = useState('');
  const [includeUrl, setIncludeUrl] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Screenshot state
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Success state
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);

  // Convex mutation for generating upload URL
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const isDescriptionValid = description.trim().length >= FEEDBACK_DESCRIPTION_MIN_LENGTH;

  // Cleanup object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  // Handle file selection (from input or drop)
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    if (file.size > SCREENSHOT_MAX_SIZE_BYTES) {
      showToast('Image must be less than 5MB', 'error');
      return;
    }

    // Revoke previous object URL if exists
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }

    setScreenshot(file);
    // Use object URL for better memory management
    setScreenshotPreview(URL.createObjectURL(file));
  }, [showToast, screenshotPreview]);

  // Handle paste event for clipboard images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(file);
        }
        return;
      }
    }
  }, [handleFileSelect]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Remove screenshot
  const handleRemoveScreenshot = useCallback(() => {
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [screenshotPreview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDescriptionValid) {
      showToast(`Please provide more detail (at least ${FEEDBACK_DESCRIPTION_MIN_LENGTH} characters)`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      let screenshotUrl: string | undefined;

      // Upload screenshot if present
      if (screenshot) {
        try {
          // Get presigned upload URL
          const uploadUrl = await generateUploadUrl();

          // Upload file to Convex storage
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': screenshot.type },
            body: screenshot,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload screenshot');
          }

          const { storageId } = await uploadResponse.json();

          // Get the public URL - construct it from the storage ID
          // Convex storage URLs follow the pattern: https://<deployment>.convex.cloud/api/storage/<storageId>
          const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
          if (convexUrl) {
            screenshotUrl = `${convexUrl}/api/storage/${storageId}`;
          }
        } catch (uploadError) {
          console.error('Screenshot upload failed:', uploadError);
          showToast('Screenshot upload failed, submitting without it', 'info');
        }
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          description: description.trim(),
          pageUrl: includeUrl ? window.location.href : undefined,
          screenshotUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      const result = await response.json();

      // Show success state instead of just closing
      setSubmissionResult({
        issueNumber: result.issueNumber,
        issueUrl: result.issueUrl,
      });
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

  const resetForm = useCallback(() => {
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setFeedbackType(FEEDBACK_TYPE.GENERAL);
    setDescription('');
    setIncludeUrl(true);
    setScreenshot(null);
    setScreenshotPreview(null);
    setSubmissionResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [screenshotPreview]);

  const handleClose = () => {
    // Don't allow closing while submitting
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmitAnother = () => {
    resetForm();
  };

  // Success state
  if (submissionResult) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Feedback Submitted" size="medium">
        <div className="feedback-success">
          <div className="feedback-success__icon">
            <Icon name="CheckCircle" />
          </div>
          <h3 className="feedback-success__title">Thank you for your feedback!</h3>
          <p className="feedback-success__message">
            Your feedback has been submitted as issue #{submissionResult.issueNumber}.
          </p>
          <a
            href={submissionResult.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="feedback-success__link"
          >
            <Icon name="ExternalLink" />
            View on GitHub
          </a>
          <div className="feedback-success__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleSubmitAnother}
            >
              Submit Another
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleClose}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Send Feedback" size="medium">
      <form onSubmit={handleSubmit} className="feedback-form" onPaste={handlePaste}>
        <div className="form-group">
          <label className="form-label">What type of feedback?</label>
          <div className="feedback-type-grid">
            {FEEDBACK_TYPE_OPTIONS.map((type) => (
              <button
                key={type.value}
                type="button"
                className={`feedback-type-btn ${feedbackType === type.value ? 'is-selected' : ''}`}
                onClick={() => setFeedbackType(type.value)}
                disabled={isSubmitting}
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
              feedbackType === FEEDBACK_TYPE.BUG
                ? 'Describe what happened and what you expected...'
                : feedbackType === FEEDBACK_TYPE.FEATURE
                  ? 'Describe the feature you would like to see...'
                  : 'Share your thoughts...'
            }
            required
            minLength={FEEDBACK_DESCRIPTION_MIN_LENGTH}
            maxLength={FEEDBACK_DESCRIPTION_MAX_LENGTH}
            disabled={isSubmitting}
          />
        </div>

        {/* Screenshot upload */}
        <div className="form-group">
          <label className="form-label">Screenshot (optional)</label>
          {screenshotPreview ? (
            <div className="screenshot-preview">
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                className="screenshot-preview__image"
              />
              <button
                type="button"
                className="screenshot-preview__remove"
                onClick={handleRemoveScreenshot}
                disabled={isSubmitting}
                aria-label="Remove screenshot"
              >
                <Icon name="X" />
              </button>
            </div>
          ) : (
            <div
              className={`screenshot-dropzone ${isDragOver ? 'screenshot-dropzone--dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="Image" />
              <span className="screenshot-dropzone__text">
                Drop image here, click to browse, or paste from clipboard
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="screenshot-dropzone__input"
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeUrl}
              onChange={(e) => setIncludeUrl(e.target.checked)}
              disabled={isSubmitting}
            />
            Include current page URL for context
          </label>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSubmitting || !isDescriptionValid}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
