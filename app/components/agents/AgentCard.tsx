/**
 * AgentCard component - Premium design with micro-interactions
 */

'use client';

import React from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay } from '@/utils/config';
import { Icon } from '@/components/ui/Icon';

interface AgentCardProps {
  agent: Agent;
  index?: number;
  onEdit: () => void;
  onDelete: () => void;
}

// Map tool colors to CSS-friendly names
function getToolColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    '#06B6D4': 'cyan',
    '#3B82F6': 'blue',
    '#8B5CF6': 'violet',
    '#A855F7': 'purple',
    '#EC4899': 'pink',
    '#F43F5E': 'rose',
    '#F97316': 'orange',
    '#F59E0B': 'amber',
    '#10B981': 'emerald',
    '#14B8A6': 'teal',
  };
  return colorMap[color] || 'default';
}

// Get status color
function getStatusColor(status?: string): string {
  switch (status) {
    case 'active':
      return '#10B981';
    case 'draft':
      return '#A8A29E';
    case 'deprecated':
      return '#EF4444';
    default:
      return '#6366F1';
  }
}

// Format currency for ROI display
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value}`;
}

export function AgentCard({ agent, index = 0, onEdit, onDelete }: AgentCardProps) {
  const metrics = agent.metrics || {};
  const statusColor = getStatusColor(agent.status);

  return (
    <div
      className="agent-card"
      data-agent-id={agent._id}
      style={{
        '--status-color': statusColor,
        '--animation-delay': `${index * 50}ms`
      } as React.CSSProperties}
    >
      {/* Status indicator strip */}
      <div
        className="agent-card__status-strip"
        style={{ backgroundColor: statusColor }}
      />

      {/* Card Header */}
      <div className="agent-card__header">
        <div className="agent-card__number">
          {(agent.agentOrder ?? 0) + 1}
        </div>

        <div className="agent-card__title">
          <h3 className="agent-card__name">{agent.name}</h3>
          {agent.status && (
            <span className={`agent-card__status-badge badge badge--${agent.status === 'active' ? 'success' : agent.status === 'draft' ? 'default' : 'error'}`}>
              <span className={`status-dot status-dot--${agent.status}`} />
              {agent.status}
            </span>
          )}
        </div>

        <div className="agent-card__actions">
          <button
            className="agent-card__menu"
            onClick={onEdit}
            title="Edit agent"
            aria-label="Edit agent"
          >
            <Icon name="edit-3" />
          </button>
          <button
            className="agent-card__menu agent-card__menu--danger"
            onClick={onDelete}
            title="Delete agent"
            aria-label="Delete agent"
          >
            <Icon name="trash-2" />
          </button>
        </div>
      </div>

      {/* Department Tag */}
      {agent.department && (
        <div className="agent-card__tags">
          <span className="tag-indicator">
            <Icon name="building-2" />
            {agent.department}
          </span>
        </div>
      )}

      {/* Objective - highlighted */}
      {agent.objective && (
        <p className="agent-card__objective">{agent.objective}</p>
      )}

      {/* Description */}
      {agent.description && (
        <p className="agent-card__description">{agent.description}</p>
      )}

      {/* Tools */}
      {agent.tools && agent.tools.length > 0 && (
        <div className="agent-card__tools">
          {agent.tools.map((tool) => {
            const toolDisplay = getToolDisplay(tool);
            const colorClass = getToolColorClass(toolDisplay.color);
            return (
              <span
                key={tool}
                className={`chip tool-chip tool-chip--${colorClass}`}
                data-color={colorClass}
                style={{
                  '--chip-accent': toolDisplay.color
                } as React.CSSProperties}
              >
                <Icon name={toolDisplay.icon} />
                {toolDisplay.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Footer with Metrics */}
      <div className="agent-card__footer">
        <div className="agent-card__metrics">
          {metrics.numberOfUsers !== undefined && (
            <div className="metric">
              <Icon name="users" />
              <span className="metric__label">Users:</span>
              <span className="metric__value">{metrics.numberOfUsers}</span>
            </div>
          )}
          {metrics.timesUsed !== undefined && (
            <div className="metric">
              <Icon name="activity" />
              <span className="metric__label">Uses:</span>
              <span className="metric__value">{metrics.timesUsed}</span>
            </div>
          )}
          {metrics.timeSaved !== undefined && (
            <div className="metric">
              <Icon name="clock" />
              <span className="metric__label">Saved:</span>
              <span className="metric__value">{metrics.timeSaved}h</span>
            </div>
          )}
          {metrics.roi !== undefined && (
            <div className="metric">
              <Icon name="trending-up" />
              <span className="metric__label">ROI:</span>
              <span className="metric__value">{formatCurrency(metrics.roi)}</span>
            </div>
          )}
        </div>

        {agent.journeySteps && agent.journeySteps.length > 0 && (
          <div className="agent-card__journey">
            <button className="btn-link" title="View journey">
              <Icon name="route" />
              <span>{agent.journeySteps.length} steps</span>
            </button>
          </div>
        )}
      </div>

      {/* Links */}
      {(agent.demoLink || agent.videoLink) && (
        <div className="agent-card__links">
          {agent.demoLink && (
            <a
              href={agent.demoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-link"
            >
              <Icon name="external-link" />
              Demo
            </a>
          )}
          {agent.videoLink && (
            <a
              href={agent.videoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-link"
            >
              <Icon name="video" />
              Video
            </a>
          )}
        </div>
      )}
    </div>
  );
}
