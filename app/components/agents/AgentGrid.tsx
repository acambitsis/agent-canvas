/**
 * AgentGrid - main container for agent groups with premium empty state
 */

'use client';

import React from 'react';
import { Agent } from '@/types/agent';
import { AgentGroupSection } from './AgentGroupSection';
import { useGrouping } from '@/contexts/GroupingContext';
import { useAgents } from '@/contexts/AgentContext';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { Icon } from '@/components/ui/Icon';

interface AgentGridProps {
  onEditAgent: (agent: Agent) => void;
  onAddAgent: (phase: string) => void;
  onQuickLook?: (agent: Agent) => void;
}

export function AgentGrid({ onEditAgent, onAddAgent, onQuickLook }: AgentGridProps) {
  const { computedGroups } = useGrouping();
  const { deleteAgent, isLoading } = useAgents();
  const executeOperation = useAsyncOperation();

  const handleDeleteAgent = async (agent: Agent) => {
    if (!window.confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      return;
    }

    await executeOperation(
      () => deleteAgent(agent._id),
      {
        loadingMessage: 'Deleting agent...',
        successMessage: 'Agent deleted successfully',
        errorMessage: 'Failed to delete agent',
      }
    );
  };

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <Icon name="loader-2" className="loading-icon" />
        </div>
        <h3 className="empty-state__title">Loading...</h3>
      </div>
    );
  }

  if (computedGroups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <Icon name="bot" />
        </div>
        <h3 className="empty-state__title">No agents found</h3>
        <p className="empty-state__description">
          Create your first agent to get started building your AI workflow
        </p>
        <button
          className="empty-state__btn"
          onClick={() => onAddAgent('default')}
        >
          <Icon name="plus" />
          Add Agent
        </button>
      </div>
    );
  }

  return (
    <div className="agent-groups-container">
      {computedGroups.map((group, idx) => (
        <AgentGroupSection
          key={group.id}
          group={group}
          groupIndex={idx}
          onEditAgent={onEditAgent}
          onDeleteAgent={handleDeleteAgent}
          onAddAgent={onAddAgent}
          onQuickLook={onQuickLook}
        />
      ))}
    </div>
  );
}
