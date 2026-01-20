/**
 * AgentCard component - Premium design with micro-interactions
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay } from '@/utils/config';
import { formatCurrency } from '@/utils/formatting';
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

export function AgentCard({ agent, index = 0, onEdit, onDelete }: AgentCardProps) {
  const metrics = agent.metrics || {};
  const statusColor = getStatusColor(agent.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click or Escape key
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [menuOpen]);

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

        <div className="agent-card__actions" ref={menuRef}>
          <button
            className="agent-card__menu-trigger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            <Icon name="more-vertical" />
          </button>
          {menuOpen && (
            <div className="agent-card__dropdown">
              <button
                className="agent-card__dropdown-item"
                onClick={() => { onEdit(); setMenuOpen(false); }}
              >
                <Icon name="edit-3" />
                Edit
              </button>
              <button
                className="agent-card__dropdown-item agent-card__dropdown-item--danger"
                onClick={() => { onDelete(); setMenuOpen(false); }}
              >
                <Icon name="trash-2" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category Tag */}
      {agent.category && (
        <div className="agent-card__tags">
          <span className="tag-indicator">
            <Icon name="folder" />
            {agent.category}
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

      {/* Footer with Links, Metrics, and Journey */}
      <div className="agent-card__footer">
        <div className="agent-card__footer-left">
          {agent.demoLink && (
            <a
              href={agent.demoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-link"
            >
              <Icon name="play-circle" />
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

        <div className="agent-card__footer-right">
          {(metrics.numberOfUsers !== undefined || metrics.timesUsed !== undefined ||
            metrics.timeSaved !== undefined || metrics.roi !== undefined) && (
            <div className="agent-card__stats">
              <button type="button" className="btn-link" aria-label="View performance stats">
                <Icon name="bar-chart-2" />
                <span>Stats</span>
              </button>
              <div className="agent-card__stats-tooltip">
                <div className="stats-tooltip__title">Performance</div>
                <div className="stats-tooltip__grid">
                  {metrics.numberOfUsers !== undefined && (
                    <div className="stats-tooltip__item">
                      <Icon name="users" />
                      <span className="stats-tooltip__label">Users</span>
                      <span className="stats-tooltip__value">{metrics.numberOfUsers}</span>
                    </div>
                  )}
                  {metrics.timesUsed !== undefined && (
                    <div className="stats-tooltip__item">
                      <Icon name="activity" />
                      <span className="stats-tooltip__label">Uses</span>
                      <span className="stats-tooltip__value">{metrics.timesUsed}</span>
                    </div>
                  )}
                  {metrics.timeSaved !== undefined && (
                    <div className="stats-tooltip__item">
                      <Icon name="clock" />
                      <span className="stats-tooltip__label">Saved</span>
                      <span className="stats-tooltip__value">{metrics.timeSaved}h</span>
                    </div>
                  )}
                  {metrics.roi !== undefined && (
                    <div className="stats-tooltip__item">
                      <Icon name="trending-up" />
                      <span className="stats-tooltip__label">ROI</span>
                      <span className="stats-tooltip__value">{formatCurrency(metrics.roi)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {agent.journeySteps && agent.journeySteps.length > 0 && (
            <div className="agent-card__journey">
              <button type="button" className="btn-link" aria-label="View user journey steps">
                <Icon name="route" />
                <span>{agent.journeySteps.length} steps</span>
              </button>
              <div className="agent-card__journey-tooltip">
                <div className="journey-tooltip__title">User Journey</div>
                <ol className="journey-tooltip__steps">
                  {agent.journeySteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
