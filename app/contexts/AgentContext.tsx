/**
 * AgentContext - Manages agents and CRUD operations
 */

'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { Agent, AgentFormData } from '@/types/agent';
import { useQuery, useMutation, useConvexAuth } from '@/hooks/useConvex';
import { useAuth } from './AuthContext';
import { useCanvas } from './CanvasContext';
import { api } from '../../convex/_generated/api';

interface AgentContextValue {
  agents: Agent[];
  isLoading: boolean;
  createAgent: (data: AgentFormData) => Promise<string>;
  updateAgent: (agentId: string, data: Partial<AgentFormData>) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized } = useAuth();
  // Use Convex's auth state to gate queries - this ensures token is actually set
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const canQuery = isConvexAuthenticated && !isConvexAuthLoading;
  const { currentCanvasId, currentCanvas, isLoading: isCanvasLoading } = useCanvas();

  // Subscribe to agents using official Convex hook
  // Only query if Convex has the token AND has a valid canvas (not just canvasId, as it may be stale after deletion)
  const agentsQueryResult = useQuery(
    api.agents.list,
    canQuery && currentCanvas ? { canvasId: currentCanvasId as any } : 'skip'
  );

  // Track loading state: loading if auth not initialized, canvas loading, or agents query pending
  const isQueryLoading = canQuery && !!currentCanvasId && agentsQueryResult === undefined;
  const agents = agentsQueryResult || [];

  const createAgentMutation = useMutation(api.agents.create);
  const updateAgentMutation = useMutation(api.agents.update);
  const deleteAgentMutation = useMutation(api.agents.remove);

  const createAgent = useCallback(async (data: AgentFormData) => {
    if (!currentCanvasId) throw new Error('No canvas selected');
    const agentId = await createAgentMutation({
      canvasId: currentCanvasId as any,
      ...data,
    });
    return agentId as string;
  }, [currentCanvasId, createAgentMutation]);

  const updateAgent = useCallback(async (agentId: string, data: Partial<AgentFormData>) => {
    await updateAgentMutation({ agentId: agentId as any, ...data });
  }, [updateAgentMutation]);

  const deleteAgent = useCallback(async (agentId: string) => {
    await deleteAgentMutation({ agentId: agentId as any });
  }, [deleteAgentMutation]);

  const value: AgentContextValue = {
    agents,
    isLoading: !isInitialized || isCanvasLoading || isQueryLoading || isConvexAuthLoading,
    createAgent,
    updateAgent,
    deleteAgent,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgents() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgents must be used within an AgentProvider');
  }
  return context;
}
