/**
 * CanvasContext - Manages canvas list and current canvas state
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@/types/canvas';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useQuery, useMutation } from '@/hooks/useConvex';
import { useAuth } from './AuthContext';
import { api } from '../../convex/_generated/api';

const CURRENT_CANVAS_KEY = 'agentcanvas-current-canvas';

interface CanvasContextValue {
  canvases: Canvas[];
  currentCanvasId: string | null;
  currentCanvas: Canvas | null;
  isLoading: boolean;
  setCurrentCanvasId: (canvasId: string | null) => void;
  createCanvas: (title: string, slug: string) => Promise<string>;
  updateCanvas: (canvasId: string, data: Partial<Canvas>) => Promise<void>;
  deleteCanvas: (canvasId: string) => Promise<void>;
}

const CanvasContext = createContext<CanvasContextValue | undefined>(undefined);

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const { currentOrgId, isInitialized, isAuthenticated } = useAuth();
  const [currentCanvasId, setCurrentCanvasIdState] = useLocalStorage<string | null>(CURRENT_CANVAS_KEY, null);

  // Subscribe to canvases using official Convex hook
  // Only query if authenticated AND has orgId
  const canvases = useQuery(
    api.canvases.list,
    isAuthenticated && currentOrgId ? { workosOrgId: currentOrgId } : 'skip'
  ) || [];
  const createCanvasMutation = useMutation(api.canvases.create);
  const updateCanvasMutation = useMutation(api.canvases.update);
  const deleteCanvasMutation = useMutation(api.canvases.remove);

  // Find current canvas
  const currentCanvas = currentCanvasId
    ? canvases.find((c: Canvas) => c._id === currentCanvasId) || null
    : null;

  // Auto-select first canvas if none selected
  useEffect(() => {
    if (!currentCanvasId && canvases.length > 0) {
      setCurrentCanvasIdState(canvases[0]._id);
    }
  }, [canvases, currentCanvasId, setCurrentCanvasIdState]);

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
