/**
 * Hook for managing agent feedback (votes and comments)
 * Used by QuickLookPanel for individual agent interactions
 */

'use client';

import { useQuery, useMutation } from './useConvex';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useCallback } from 'react';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useAppState } from '@/contexts/AppStateContext';

interface UseAgentFeedbackOptions {
  agentId: Id<"agents"> | undefined;
}

export function useAgentFeedback({ agentId }: UseAgentFeedbackOptions) {
  // Get current user for email (used for comments)
  const currentUser = useCurrentUser();
  const { showToast } = useAppState();

  // Queries - skip when no agentId
  const voteCounts = useQuery(
    api.agentVotes.getVoteCounts,
    agentId ? { agentId } : "skip"
  );
  const userVote = useQuery(
    api.agentVotes.getUserVote,
    agentId ? { agentId } : "skip"
  );
  const comments = useQuery(
    api.agentComments.list,
    agentId ? { agentId } : "skip"
  );

  // Vote mutations
  const voteMutation = useMutation(api.agentVotes.vote);
  const removeVoteMutation = useMutation(api.agentVotes.removeVote);

  // Comment mutations
  const createCommentMutation = useMutation(api.agentComments.create);
  const updateCommentMutation = useMutation(api.agentComments.update);
  const removeCommentMutation = useMutation(api.agentComments.remove);

  // Vote actions with error handling
  const handleVote = useCallback(
    async (voteType: "up" | "down") => {
      if (!agentId) return;
      const id = agentId;
      try {
        // Toggle behavior: clicking same vote removes it
        if (userVote === voteType) {
          await removeVoteMutation({ agentId: id });
        } else {
          await voteMutation({ agentId: id, vote: voteType });
        }
      } catch (error) {
        console.error('Vote error:', error);
        showToast('Failed to update vote', 'error');
      }
    },
    [agentId, userVote, voteMutation, removeVoteMutation, showToast]
  );

  // Comment actions with error handling
  const addComment = useCallback(
    async (content: string) => {
      if (!agentId) return;
      const id = agentId;
      try {
        await createCommentMutation({
          agentId: id,
          content,
          userEmail: currentUser?.email || undefined,
        });
      } catch (error) {
        console.error('Add comment error:', error);
        showToast('Failed to add comment', 'error');
        throw error; // Re-throw so CommentForm can handle it
      }
    },
    [agentId, createCommentMutation, currentUser?.email, showToast]
  );

  const editComment = useCallback(
    async (commentId: Id<"agentComments">, content: string) => {
      try {
        await updateCommentMutation({ commentId, content });
      } catch (error) {
        console.error('Edit comment error:', error);
        showToast('Failed to update comment', 'error');
        throw error;
      }
    },
    [updateCommentMutation, showToast]
  );

  const deleteComment = useCallback(
    async (commentId: Id<"agentComments">) => {
      try {
        await removeCommentMutation({ commentId });
      } catch (error) {
        console.error('Delete comment error:', error);
        showToast('Failed to delete comment', 'error');
        throw error;
      }
    },
    [removeCommentMutation, showToast]
  );

  return {
    // Vote state
    voteCounts,
    userVote,
    handleVote,

    // Comments state
    comments,
    addComment,
    editComment,
    deleteComment,

    // Loading states
    isLoading: voteCounts === undefined || comments === undefined,
  };
}
