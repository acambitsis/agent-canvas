/**
 * AgentCard component - displays individual agent
 */

'use client';

import React from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay } from '@/utils/config';
import { Icon } from '@/components/ui/Icon';

interface AgentCardProps {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
}

export function AgentCard({ agent, onEdit, onDelete }: AgentCardProps) {
  const metrics = agent.metrics || { adoption: 0, satisfaction: 0 };
  const roiContribution = agent.roiContribution || 'Medium';

  const statusColor = agent.status === 'active' ? '#10B981' : agent.status === 'draft' ? '#6B7280' : '#F59E0B';

  return (
    <div className="agent-card" data-agent-id={agent._id}>
      <div className="agent-card__status-strip" style={{ backgroundColor: statusColor }}></div>

      <div className="agent-card__header">
        <div className="agent-card__number">{agent.agentOrder || 0}</div>
        <h3 className="agent-card__name">{agent.name}</h3>
        <div className="agent-card__actions">
          <button className="agent-card__menu" onClick={onEdit} title="Edit agent">
            <Icon name="edit-3" />
          </button>
          <button className="agent-card__menu" onClick={onDelete} title="Delete agent">
            <Icon name="trash-2" />
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
                <Icon name={toolDisplay.icon} />
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
              <Icon name="route" />
            </button>
          </div>
        )}
      </div>

      {(agent.demoLink || agent.videoLink) && (
        <div className="agent-card__actions">
          {agent.demoLink && (
            <a href={agent.demoLink} target="_blank" rel="noopener noreferrer" className="btn-link">
              <Icon name="external-link" /> Demo
            </a>
          )}
          {agent.videoLink && (
            <a href={agent.videoLink} target="_blank" rel="noopener noreferrer" className="btn-link">
              <Icon name="video" /> Video
            </a>
          )}
        </div>
      )}
    </div>
  );
}
