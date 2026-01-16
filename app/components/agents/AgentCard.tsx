/**
 * AgentCard component - displays individual agent
 */

'use client';

import React, { useEffect } from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay } from '@/utils/config';

interface AgentCardProps {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
}

export function AgentCard({ agent, onEdit, onDelete }: AgentCardProps) {
  const metrics = agent.metrics || { adoption: 0, satisfaction: 0 };
  const roiContribution = agent.roiContribution || 'Medium';

  // Refresh Lucide icons after render
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  });

  const statusColor = agent.status === 'active' ? '#10B981' : agent.status === 'draft' ? '#6B7280' : '#F59E0B';

  return (
    <div className="agent-card" data-agent-id={agent._id}>
      <div className="agent-card__status-strip" style={{ backgroundColor: statusColor }}></div>

      <div className="agent-card__header">
        <div className="agent-card__number">{agent.agentOrder || 0}</div>
        <h3 className="agent-card__name">{agent.name}</h3>
        <div className="agent-card__menu">
          <button className="btn-icon" onClick={onEdit} title="Edit agent">
            <i data-lucide="edit-3"></i>
          </button>
          <button className="btn-icon" onClick={onDelete} title="Delete agent">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>

      {agent.department && (
        <div className="agent-card__tags">
          <span className="badge">{agent.department}</span>
        </div>
      )}

      {agent.objective && <p className="agent-card__objective">{agent.objective}</p>}
      {agent.description && <p className="agent-card__description">{agent.description}</p>}

      {agent.tools && agent.tools.length > 0 && (
        <div className="agent-card__tools">
          {agent.tools.map((tool) => {
            const toolDisplay = getToolDisplay(tool);
            return (
              <span key={tool} className="chip" style={{ backgroundColor: toolDisplay.color }}>
                <i data-lucide={toolDisplay.icon}></i>
                {toolDisplay.label}
              </span>
            );
          })}
        </div>
      )}

      <div className="agent-card__footer">
        <div className="agent-card__metrics">
          <span>Usage: {metrics.adoption}</span>
          <span>Satisfaction: {metrics.satisfaction}</span>
          <span>ROI: {roiContribution}</span>
        </div>
        {agent.journeySteps && agent.journeySteps.length > 0 && (
          <div className="agent-card__journey">
            <button className="btn-link" title="View journey">
              <i data-lucide="route"></i>
            </button>
          </div>
        )}
      </div>

      {(agent.demoLink || agent.videoLink) && (
        <div className="agent-card__actions">
          {agent.demoLink && (
            <a href={agent.demoLink} target="_blank" rel="noopener noreferrer" className="btn-link">
              <i data-lucide="external-link"></i> Demo
            </a>
          )}
          {agent.videoLink && (
            <a href={agent.videoLink} target="_blank" rel="noopener noreferrer" className="btn-link">
              <i data-lucide="video"></i> Video
            </a>
          )}
        </div>
      )}
    </div>
  );
}
