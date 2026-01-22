/**
 * AgentCard component - Premium design with micro-interactions
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay, getStatusColor } from '@/utils/config';
import { formatCurrency } from '@/utils/formatting';
import { Icon } from '@/components/ui/Icon';

interface AgentCardProps {
  agent: Agent;
  index?: number;
  onEdit: () => void;
  onDelete: () => void;
  onQuickLook?: () => void;
}

export function AgentCard({ agent, index = 0, onEdit, onDelete, onQuickLook }: AgentCardProps) {
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

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger quick look if clicking on actions menu or links
    if ((e.target as HTMLElement).closest('.agent-card__actions, .btn-link, a')) {
      return;
    }
    if (onQuickLook) {
      onQuickLook();
    }
  };

  return (
    <div
      className={`agent-card ${onQuickLook ? 'agent-card--clickable' : ''}`}
      data-agent-id={agent._id}
      onClick={handleCardClick}
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
        <div className="agent-card__header-left">
          <span className="agent-card__number">
            {(agent.agentOrder ?? 0) + 1}
          </span>
          {agent.status && (
            <span className={`agent-card__status-badge badge badge--${agent.status === 'active' ? 'success' : agent.status === 'draft' ? 'default' : 'error'}`}>
              <span className={`status-dot status-dot--${agent.status}`} />
              {agent.status}
            </span>
          )}
        </div>

        <div className="agent-card__header-right">
          {/* Tool dots - right aligned */}
          {agent.tools && agent.tools.length > 0 && (
            <div className="tool-dots-container">
              {agent.tools.slice(0, 5).map((tool) => {
                const toolDisplay = getToolDisplay(tool);
                return (
                  <span
                    key={tool}
                    className="tool-dot"
                    style={{ backgroundColor: toolDisplay.color }}
                  />
                );
              })}
              {agent.tools.length > 5 && (
                <span className="tool-dots-more">+{agent.tools.length - 5}</span>
              )}
              {/* Styled tooltip on hover */}
              <div className="tool-dots-tooltip">
                <div className="tool-dots-tooltip__title">Capabilities</div>
                <div className="tool-dots-tooltip__list">
                  {agent.tools.map((tool) => {
                    const toolDisplay = getToolDisplay(tool);
                    return (
                      <div key={tool} className="tool-dots-tooltip__item">
                        <span className="tool-dot" style={{ backgroundColor: toolDisplay.color }} />
                        <span>{toolDisplay.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
              {onQuickLook && (
                <button
                  className="agent-card__dropdown-item"
                  onClick={() => { onQuickLook(); setMenuOpen(false); }}
                >
                  <Icon name="eye" />
                  Quick Look
                </button>
              )}
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
      </div>

      {/* Title - line clamped to 2 lines */}
      <h3 className="agent-card__name" title={agent.name}>{agent.name}</h3>

      {/* Objective - highlighted (primary content) */}
      {agent.objective && (
        <p className="agent-card__objective">{agent.objective}</p>
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
