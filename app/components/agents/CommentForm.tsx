/**
 * CommentForm - Form for adding new comments to an agent
 * Includes character counter and optimistic submission
 */

'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Id } from '../../../convex/_generated/dataModel';
import { useAgentFeedback } from '@/hooks/useAgentFeedback';

interface CommentFormProps {
  agentId: Id<"agents">;
}

const MAX_COMMENT_LENGTH = 2000;

export function CommentForm({ agentId }: CommentFormProps) {
  const { addComment } = useAgentFeedback({ agentId });
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await addComment(trimmedContent);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > MAX_COMMENT_LENGTH;
  const isEmpty = content.trim().length === 0;

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <textarea
        className={`comment-form__input ${isOverLimit ? 'comment-form__input--error' : ''}`}
        placeholder="Add a comment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        disabled={isSubmitting}
        aria-label="Comment text"
      />
      <div className="comment-form__footer">
        <span className={`comment-form__char-count ${isOverLimit ? 'comment-form__char-count--error' : ''}`}>
          {charCount}/{MAX_COMMENT_LENGTH}
        </span>
        <button
          type="submit"
          className="btn btn--sm btn--primary"
          disabled={isEmpty || isOverLimit || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="btn__spinner" />
              Posting...
            </>
          ) : (
            <>
              <Icon name="send" />
              Post
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="comment-form__error">{error}</p>
      )}
    </form>
  );
}
