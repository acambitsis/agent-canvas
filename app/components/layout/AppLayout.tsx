/**
 * AppLayout - Main layout wrapper with sidebar and toolbar
 */

'use client';

import React, { useState } from 'react';
import { Agent } from '@/types/agent';
import { Sidebar } from './Sidebar';
import { MainToolbar } from './MainToolbar';
import { AgentModal } from '../forms/AgentModal';
import { AgentGrid } from '../agents/AgentGrid';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { ToastContainer } from '../ui/Toast';
import { QuickLookPanel } from '../ui/QuickLookPanel';
import { useAppState } from '@/contexts/AppStateContext';
import { useAgents } from '@/contexts/AgentContext';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';

export function AppLayout() {
  const { isSidebarCollapsed, toggleSidebar, sidebarWidth, quickLookAgent, setQuickLookAgent } = useAppState();
  const { deleteAgent } = useAgents();
  const executeOperation = useAsyncOperation();
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [defaultPhase, setDefaultPhase] = useState<string | undefined>();

  const handleOpenAgentModal = (agent?: Agent, phase?: string) => {
    setEditingAgent(agent || null);
    setDefaultPhase(phase);
    setIsAgentModalOpen(true);
  };

  const handleCloseAgentModal = () => {
    setIsAgentModalOpen(false);
    setEditingAgent(null);
    setDefaultPhase(undefined);
  };

  // Quick Look handlers
  const handleQuickLook = (agent: Agent) => {
    setQuickLookAgent(agent);
  };

  const handleCloseQuickLook = () => {
    setQuickLookAgent(null);
  };

  const handleEditFromQuickLook = () => {
    if (quickLookAgent) {
      handleOpenAgentModal(quickLookAgent);
      setQuickLookAgent(null);
    }
  };

  const handleDeleteFromQuickLook = async () => {
    if (!quickLookAgent) return;

    if (!window.confirm(`Are you sure you want to delete "${quickLookAgent.name}"?`)) {
      return;
    }

    const agentToDelete = quickLookAgent;
    setQuickLookAgent(null);

    await executeOperation(
      () => deleteAgent(agentToDelete._id),
      {
        loadingMessage: 'Deleting agent...',
        successMessage: 'Agent deleted successfully',
        errorMessage: 'Failed to delete agent',
      }
    );
  };

  return (
    <>
      <Sidebar />
      <div
        className={`main-wrapper ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}
        style={!isSidebarCollapsed ? { '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties : undefined}
      >
        {isSidebarCollapsed && (
          <Tooltip content="Expand sidebar" placement="right" triggerClassName="sidebar-expand-tooltip">
            <button
              className="sidebar-expand-btn"
              onClick={toggleSidebar}
            >
              <Icon name="panel-left-open" />
            </button>
          </Tooltip>
        )}
        <MainToolbar onAddAgent={() => handleOpenAgentModal()} />
        <main className="main-content">
          <AgentGrid
            onEditAgent={(agent) => handleOpenAgentModal(agent)}
            onAddAgent={(phase) => handleOpenAgentModal(undefined, phase)}
            onQuickLook={handleQuickLook}
          />
        </main>
      </div>

      <AgentModal
        isOpen={isAgentModalOpen}
        onClose={handleCloseAgentModal}
        agent={editingAgent}
        defaultPhase={defaultPhase}
      />

      <QuickLookPanel
        agent={quickLookAgent}
        isOpen={quickLookAgent !== null}
        onClose={handleCloseQuickLook}
        onEdit={handleEditFromQuickLook}
        onDelete={handleDeleteFromQuickLook}
      />

      <LoadingOverlay />
      <ToastContainer />
    </>
  );
}
