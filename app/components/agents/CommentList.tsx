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
import { formatRelativeTime, getInitialsFromEmail, getColorFromString } from '@/utils/formatting';

interface CommentListProps {
  agentId: Id<"agents">;
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
  const initials = getInitialsFromEmail(comment.userEmail);
  const avatarColor = getColorFromString(comment.userEmail);

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
          <span className={`comment__author ${!comment.userEmail ? 'comment__author--unknown' : ''}`}>
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
