/**
 * CommentsPanel - Dedicated slide-out panel for agent comments
 * Focused view for reading and adding comments on a specific agent
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import { Agent } from '@/types/agent';
import { Icon } from '@/components/ui/Icon';
import { CommentList } from '@/components/agents/CommentList';
import { CommentForm } from '@/components/agents/CommentForm';
import { useAgentFeedback } from '@/hooks/useAgentFeedback';

interface CommentsPanelProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CommentsPanel({ agent, isOpen, onClose }: CommentsPanelProps) {
  const { voteCounts, comments } = useAgentFeedback({
    agentId: agent?._id
  });

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!agent) return null;

  const commentCount = comments?.length ?? 0;

  return (
    <div
      className={`comments-panel-overlay ${isOpen ? 'is-open' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`comments-panel ${isOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Comments for ${agent.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="comments-panel__header">
          <div className="comments-panel__title-row">
            <h2 className="comments-panel__title">
              Comments
              {commentCount > 0 && (
                <span className="comments-panel__count">{commentCount}</span>
              )}
            </h2>
            <button
              className="comments-panel__close"
              onClick={onClose}
              aria-label="Close panel"
            >
              <Icon name="x" />
            </button>
          </div>
          <p className="comments-panel__agent-name">
            {agent.name}
          </p>
          {/* Stats */}
          <div className="comments-panel__stats">
            {voteCounts && (voteCounts.up > 0 || voteCounts.down > 0) && (
              <>
                <span className="comments-panel__stat comments-panel__stat--up">
                  <Icon name="thumbs-up" />
                  {voteCounts.up}
                </span>
                <span className="comments-panel__stat comments-panel__stat--down">
                  <Icon name="thumbs-down" />
                  {voteCounts.down}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Comments list */}
        <div className="comments-panel__body">
          <CommentList agentId={agent._id} />
        </div>

        {/* Comment form - sticky at bottom */}
        <div className="comments-panel__footer">
          <CommentForm agentId={agent._id} />
        </div>
      </div>
    </div>
  );
}
