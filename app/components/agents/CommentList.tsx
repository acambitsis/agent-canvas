/**
 * CommentList - Display comments on an agent
 * Shows author, relative time, and edit/delete for own comments
 */

'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Id } from '../../../convex/_generated/dataModel';
import { useAgentFeedback } from '@/hooks/useAgentFeedback';

interface CommentListProps {
  agentId: Id<"agents">;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  return 'Just now';
}

interface CommentItemProps {
  comment: {
    _id: Id<"agentComments">;
    content: string;
    userEmail: string;
    createdAt: number;
    updatedAt: number;
    isOwner: boolean;
  };
  onEdit: (commentId: Id<"agentComments">, content: string) => Promise<void>;
  onRequestDelete: (commentId: Id<"agentComments">) => void;
}

// Get initials from email for avatar
function getInitials(email: string): string {
  if (!email) return '??';
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Generate consistent color from email or fallback
function getAvatarColor(email: string): string {
  const colors = [
    '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
    '#F59E0B', '#10B981', '#06B6D4', '#3B82F6'
  ];
  const str = email || 'unknown';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Check if email is unknown/empty
function isUnknownUser(email: string): boolean {
  return !email;
}

function CommentItem({ comment, onEdit, onRequestDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!editContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onEdit(comment._id, editContent);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    onRequestDelete(comment._id);
  };

  const handleCancel = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const wasEdited = comment.updatedAt > comment.createdAt;
  const initials = getInitials(comment.userEmail);
  const avatarColor = getAvatarColor(comment.userEmail);

  if (isEditing) {
    return (
      <div className="comment comment--editing">
        <div className="comment__avatar" style={{ backgroundColor: avatarColor }}>
          {initials}
        </div>
        <div className="comment__body">
          <textarea
            className="comment__edit-input"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={isSubmitting}
            autoFocus
          />
          <div className="comment__edit-actions">
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={handleSave}
              disabled={isSubmitting || !editContent.trim()}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="comment">
      <div className="comment__avatar" style={{ backgroundColor: avatarColor }}>
        {initials}
      </div>
      <div className="comment__body">
        <div className="comment__header">
          <span className={`comment__author ${isUnknownUser(comment.userEmail) ? 'comment__author--unknown' : ''}`}>
            {comment.userEmail || 'Unknown user'}
          </span>
          <span className="comment__separator">·</span>
          <span className="comment__meta">
            <span className="comment__time">{formatRelativeTime(comment.createdAt)}</span>
            {wasEdited && <span className="comment__edited">edited</span>}
          </span>
          {comment.isOwner && (
            <div className="comment__actions">
              <button
                type="button"
                className="comment__action-btn"
                onClick={() => setIsEditing(true)}
                aria-label="Edit comment"
              >
                <Icon name="edit-2" />
              </button>
              <button
                type="button"
                className="comment__action-btn comment__action-btn--danger"
                onClick={handleDeleteClick}
                aria-label="Delete comment"
              >
                <Icon name="trash-2" />
              </button>
            </div>
          )}
        </div>
        <p className="comment__content">{comment.content}</p>
      </div>
    </div>
  );
}

export function CommentList({ agentId }: CommentListProps) {
  const { comments, editComment, deleteComment, isLoading } = useAgentFeedback({ agentId });
  const [deletingCommentId, setDeletingCommentId] = useState<Id<"agentComments"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRequestDelete = (commentId: Id<"agentComments">) => {
    setDeletingCommentId(commentId);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCommentId || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteComment(deletingCommentId);
      setDeletingCommentId(null);
    } catch {
      // Error already shown via toast in useAgentFeedback
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeletingCommentId(null);
  };

  if (isLoading) {
    return (
      <div className="comment-list comment-list--loading">
        <div className="comment comment--skeleton" />
        <div className="comment comment--skeleton" />
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <div className="comment-list comment-list--empty">
        <div className="comment-list__empty-icon">
          <Icon name="message-circle" />
        </div>
        <p className="comment-list__empty-title">No comments yet</p>
        <p className="comment-list__empty-text">Be the first to share feedback on this agent.</p>
      </div>
    );
  }

  return (
    <>
      <div className="comment-list">
        {comments.map((comment) => (
          <CommentItem
            key={comment._id}
            comment={comment}
            onEdit={editComment}
            onRequestDelete={handleRequestDelete}
          />
        ))}
      </div>
      <ConfirmDialog
        isOpen={deletingCommentId !== null}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
