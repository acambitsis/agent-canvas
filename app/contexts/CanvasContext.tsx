/**
 * CanvasContext - Manages canvas list and current canvas state
 */

'use client';

import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { Canvas } from '@/types/canvas';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useQuery, useMutation } from '@/hooks/useConvex';
import { useAuth } from './AuthContext';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

const CURRENT_CANVAS_KEY = 'agentcanvas-current-canvas';

interface CanvasContextValue {
  canvases: Canvas[];
  currentCanvasId: string | null;
  currentCanvas: Canvas | null;
  isLoading: boolean;
  initialCanvasError: 'not_found' | 'no_access' | null;
  setCurrentCanvasId: (canvasId: string | null) => void;
  createCanvas: (title: string, slug: string) => Promise<string>;
  updateCanvas: (canvasId: string, data: Partial<Canvas>) => Promise<void>;
  deleteCanvas: (canvasId: string) => Promise<void>;
}

const CanvasContext = createContext<CanvasContextValue | undefined>(undefined);

interface CanvasProviderProps {
  children: React.ReactNode;
  initialCanvasId?: string;
}

export function CanvasProvider({ children, initialCanvasId }: CanvasProviderProps) {
  const { currentOrgId, isInitialized, isAuthenticated, userOrgs, setCurrentOrgId } = useAuth();
  const [currentCanvasId, setCurrentCanvasIdState] = useLocalStorage<string | null>(CURRENT_CANVAS_KEY, null);
  const [initialCanvasError, setInitialCanvasError] = useState<'not_found' | 'no_access' | null>(null);
  // Use state instead of ref so that setting it to true triggers a re-render
  // and causes the query to switch to 'skip' (fixes race condition)
  const [initialCanvasHandled, setInitialCanvasHandled] = useState(false);

  // Subscribe to canvases using official Convex hook
  // Only query if authenticated AND has orgId
  const canvases = useQuery(
    api.canvases.list,
    isAuthenticated && currentOrgId ? { workosOrgId: currentOrgId } : 'skip'
  ) || [];

  // Query the initial canvas by ID if provided (for shareable links)
  // Using state for initialCanvasHandled ensures query skips after handling
  const initialCanvas = useQuery(
    api.canvases.get,
    isAuthenticated && initialCanvasId && !initialCanvasHandled
      ? { canvasId: initialCanvasId as Id<"canvases"> }
      : 'skip'
  );

  const createCanvasMutation = useMutation(api.canvases.create);
  const updateCanvasMutation = useMutation(api.canvases.update);
  const deleteCanvasMutation = useMutation(api.canvases.remove);

  // Find current canvas
  const currentCanvas = currentCanvasId
    ? canvases.find((c: Canvas) => c._id === currentCanvasId) || null
    : null;

  // Handle initial canvas from URL (shareable links)
  useEffect(() => {
    // Skip if no initialCanvasId, already handled, or query not yet completed
    if (!initialCanvasId || initialCanvasHandled || initialCanvas === undefined) {
      return;
    }

    // Query returned null - canvas not found or no access
    if (initialCanvas === null) {
      setInitialCanvasHandled(true);
      setInitialCanvasError('not_found');
      return;
    }

    // Canvas found - check if user has access to its org
    const canvasOrgId = initialCanvas.workosOrgId;
    const hasOrgAccess = userOrgs.some(org => org.id === canvasOrgId);

    if (!hasOrgAccess) {
      // User doesn't have access to this org
      setInitialCanvasHandled(true);
      setInitialCanvasError('no_access');
      return;
    }

    // User has access - switch org if needed and select canvas
    setInitialCanvasHandled(true);
    if (currentOrgId !== canvasOrgId) {
      setCurrentOrgId(canvasOrgId);
    }
    setCurrentCanvasIdState(initialCanvas._id);
    // Update URL to reflect the canvas
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/c/${initialCanvas._id}`);
    }
  }, [initialCanvasId, initialCanvas, initialCanvasHandled, userOrgs, currentOrgId, setCurrentOrgId, setCurrentCanvasIdState]);

  // Auto-select first canvas if none selected or current canvas was deleted
  // Skip this if we have an initialCanvasId that hasn't been handled yet
  useEffect(() => {
    if (initialCanvasId && !initialCanvasHandled) {
      return; // Wait for initial canvas handling
    }

    if (canvases.length > 0) {
      // If current canvas doesn't exist in the list (was deleted), select first available
      const currentExists = currentCanvasId && canvases.some((c: Canvas) => c._id === currentCanvasId);
      if (!currentExists) {
        setCurrentCanvasIdState(canvases[0]._id);
      }
    } else if (currentCanvasId) {
      // No canvases available, clear selection
      setCurrentCanvasIdState(null);
    }
  }, [canvases, currentCanvasId, setCurrentCanvasIdState, initialCanvasId, initialCanvasHandled]);

  const setCurrentCanvasId = useCallback((canvasId: string | null) => {
    setCurrentCanvasIdState(canvasId);
  }, [setCurrentCanvasIdState]);

  const createCanvas = useCallback(async (title: string, slug: string) => {
    if (!currentOrgId) throw new Error('No organization selected');
    const canvasId = await createCanvasMutation({
      workosOrgId: currentOrgId,
      title,
      slug,
    });
    return canvasId as string;
  }, [currentOrgId, createCanvasMutation]);

  const updateCanvas = useCallback(async (canvasId: string, data: Partial<Canvas>) => {
    await updateCanvasMutation({ canvasId: canvasId as any, ...data });
  }, [updateCanvasMutation]);

  const deleteCanvas = useCallback(async (canvasId: string) => {
    await deleteCanvasMutation({ canvasId: canvasId as any, confirmDelete: true });
  }, [deleteCanvasMutation]);

  const value: CanvasContextValue = {
    canvases,
    currentCanvasId,
    currentCanvas,
    isLoading: !isInitialized,
    initialCanvasError,
    setCurrentCanvasId,
    createCanvas,
    updateCanvas,
    deleteCanvas,
  };

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
}
