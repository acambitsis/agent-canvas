/**
 * AgentGrid - main container for agent groups
 */

'use client';

import React, { useState } from 'react';
import { Agent } from '@/types/agent';
import { AgentGroupSection } from './AgentGroupSection';
import { useGrouping } from '@/contexts/GroupingContext';
import { useAgents } from '@/contexts/AgentContext';
import { useAppState } from '@/contexts/AppStateContext';
import { useLucideIcons } from '@/hooks/useLucideIcons';

interface AgentGridProps {
  onEditAgent: (agent: Agent) => void;
  onAddAgent: (phase: string) => void;
}

export function AgentGrid({ onEditAgent, onAddAgent }: AgentGridProps) {
  const { computedGroups } = useGrouping();
  const { deleteAgent } = useAgents();
  const { showLoading, hideLoading, showToast } = useAppState();

  // Initialize Lucide icons
  useLucideIcons();

  const handleDeleteAgent = async (agent: Agent) => {
    if (!window.confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      return;
    }

    try {
      showLoading('Deleting agent...');
      await deleteAgent(agent._id);
      showToast('Agent deleted successfully', 'success');
    } catch (error) {
      console.error('Delete agent error:', error);
      showToast('Failed to delete agent', 'error');
    } finally {
      hideLoading();
    }
  };

  if (computedGroups.length === 0) {
    return (
      <div className="empty-state">
        <i data-lucide="inbox"></i>
        <h3>No agents found</h3>
        <p>Create your first agent to get started</p>
      </div>
    );
  }

  return (
    <div className="agent-groups-container">
      {computedGroups.map((group) => (
        <AgentGroupSection
          key={group.id}
          group={group}
          onEditAgent={onEditAgent}
          onDeleteAgent={handleDeleteAgent}
          onAddAgent={onAddAgent}
        />
      ))}
    </div>
  );
}
