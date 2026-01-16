/**
 * AgentContext - Manages agents and CRUD operations
 */

'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { Agent, AgentFormData } from '@/types/agent';
import { useQuery, useMutation } from '@/hooks/useConvex';
import { useAuth } from './AuthContext';
import { useCanvas } from './CanvasContext';

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
  const { currentCanvasId } = useCanvas();

  // Subscribe to agents using official Convex hook
  const agents = useQuery('agents:list', currentCanvasId ? { canvasId: currentCanvasId } : 'skip') || [];
  const createAgentMutation = useMutation('agents:create');
  const updateAgentMutation = useMutation('agents:update');
  const deleteAgentMutation = useMutation('agents:remove');

  const createAgent = useCallback(async (data: AgentFormData) => {
    if (!currentCanvasId) throw new Error('No canvas selected');
    const agentId = await createAgentMutation({
      canvasId: currentCanvasId,
      ...data,
    });
    return agentId as string;
  }, [currentCanvasId, createAgentMutation]);

  const updateAgent = useCallback(async (agentId: string, data: Partial<AgentFormData>) => {
    await updateAgentMutation({ agentId, ...data });
  }, [updateAgentMutation]);

  const deleteAgent = useCallback(async (agentId: string) => {
    await deleteAgentMutation({ agentId });
  }, [deleteAgentMutation]);

  const value: AgentContextValue = {
    agents,
    isLoading: !isInitialized,
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
