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

export function AppLayout() {
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

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <MainToolbar onAddAgent={() => handleOpenAgentModal()} />
        <main className="main-content">
          <AgentGrid
            onEditAgent={(agent) => handleOpenAgentModal(agent)}
            onAddAgent={(phase) => handleOpenAgentModal(undefined, phase)}
          />
        </main>
      </div>

      <AgentModal
        isOpen={isAgentModalOpen}
        onClose={handleCloseAgentModal}
        agent={editingAgent}
        defaultPhase={defaultPhase}
      />

      <LoadingOverlay />
      <ToastContainer />
    </>
  );
}
