/**
 * ExpandedAgentCard - Premium detailed agent view
 * Editorial layout with comprehensive information display
 */

'use client';

import React, { useRef } from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay } from '@/utils/config';
import { formatCurrency } from '@/utils/formatting';
import { Icon } from '@/components/ui/Icon';

interface ExpandedAgentCardProps {
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

// Get status configuration
function getStatusConfig(status?: string): { color: string; bgColor: string; label: string } {
  switch (status) {
    case 'active':
      return { color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)', label: 'Active' };
    case 'draft':
      return { color: '#A8A29E', bgColor: 'rgba(168, 162, 158, 0.1)', label: 'Draft' };
    case 'deprecated':
      return { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)', label: 'Deprecated' };
    default:
      return { color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.1)', label: status || 'Unknown' };
  }
}

export function ExpandedAgentCard({ agent, index = 0, onEdit, onDelete }: ExpandedAgentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const metrics = agent.metrics || {};
  const statusConfig = getStatusConfig(agent.status);

  return (
    <article
      ref={cardRef}
      className="expanded-card"
      data-agent-id={agent._id}
      style={{
        '--status-color': statusConfig.color,
        '--animation-delay': `${index * 50}ms`
      } as React.CSSProperties}
    >
      {/* Accent Border */}
      <div className="expanded-card__accent" style={{ backgroundColor: statusConfig.color }} />

      {/* Header Section */}
      <header className="expanded-card__header">
        <div className="expanded-card__identity">
          <div className="expanded-card__number">
            <span>{String(index + 1).padStart(2, '0')}</span>
          </div>
          <div className="expanded-card__title-group">
            <h3 className="expanded-card__name">{agent.name}</h3>
            <div className="expanded-card__meta">
              {agent.category && (
                <span className="expanded-card__category">
                  <Icon name="folder" />
                  {agent.category}
                </span>
              )}
              {agent.phase && (
                <span className="expanded-card__phase">
                  <Icon name="milestone" />
                  {agent.phase}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="expanded-card__header-right">
          <span
            className="expanded-card__status"
            style={{ color: statusConfig.color, backgroundColor: statusConfig.bgColor }}
          >
            <span className="status-dot" style={{ backgroundColor: statusConfig.color }} />
            {statusConfig.label}
          </span>
          <div className="expanded-card__actions">
            <button
              className="expanded-card__action"
              onClick={onEdit}
              title="Edit agent"
              aria-label="Edit agent"
            >
              <Icon name="edit-3" />
            </button>
            <button
              className="expanded-card__action expanded-card__action--danger"
              onClick={onDelete}
              title="Delete agent"
              aria-label="Delete agent"
            >
              <Icon name="trash-2" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Sections */}
      <div className="expanded-card__body">
        {/* Left Column - Description */}
        <div className="expanded-card__main">
          {agent.objective && (
            <section className="expanded-card__section">
              <h4 className="expanded-card__section-title">
                <Icon name="target" />
                Objective
              </h4>
              <p className="expanded-card__objective">{agent.objective}</p>
            </section>
          )}

          {agent.description && (
            <section className="expanded-card__section">
              <h4 className="expanded-card__section-title">
                <Icon name="file-text" />
                Description
              </h4>
              <p className="expanded-card__description">{agent.description}</p>
            </section>
          )}

          {/* Tools / Capabilities */}
          {agent.tools && agent.tools.length > 0 && (
            <section className="expanded-card__section">
              <h4 className="expanded-card__section-title">
                <Icon name="wrench" />
                Capabilities
              </h4>
              <div className="expanded-card__tools">
                {agent.tools.map((tool) => {
                  const toolDisplay = getToolDisplay(tool);
                  const colorClass = getToolColorClass(toolDisplay.color);
                  return (
                    <span
                      key={tool}
                      className={`expanded-card__tool tool-chip tool-chip--${colorClass}`}
                      style={{ '--chip-accent': toolDisplay.color } as React.CSSProperties}
                    >
                      <Icon name={toolDisplay.icon} />
                      {toolDisplay.label}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {/* Journey Steps */}
          {agent.journeySteps && agent.journeySteps.length > 0 && (
            <section className="expanded-card__section">
              <h4 className="expanded-card__section-title">
                <Icon name="route" />
                Journey Steps
              </h4>
              <div className="expanded-card__journey">
                {agent.journeySteps.map((step, idx) => (
                  <div key={idx} className="expanded-card__journey-step">
                    <span className="journey-step__number">{idx + 1}</span>
                    <span className="journey-step__text">{step}</span>
                    {idx < agent.journeySteps.length - 1 && (
                      <Icon name="chevron-right" className="journey-step__arrow" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Metrics & Links */}
        <aside className="expanded-card__sidebar">
          {/* Metrics */}
          <section className="expanded-card__metrics-section">
            <h4 className="expanded-card__section-title">
              <Icon name="bar-chart-2" />
              Performance
            </h4>

            {metrics.numberOfUsers !== undefined && (
              <div className="expanded-card__metric">
                <div className="metric-header">
                  <Icon name="users" />
                  <span className="metric-label">No. of Users</span>
                  <span className="metric-value">{metrics.numberOfUsers}</span>
                </div>
              </div>
            )}

            {metrics.timesUsed !== undefined && (
              <div className="expanded-card__metric">
                <div className="metric-header">
                  <Icon name="activity" />
                  <span className="metric-label">Times Used</span>
                  <span className="metric-value">{metrics.timesUsed}</span>
                </div>
              </div>
            )}

            {metrics.timeSaved !== undefined && (
              <div className="expanded-card__metric">
                <div className="metric-header">
                  <Icon name="clock" />
                  <span className="metric-label">Time Saved</span>
                  <span className="metric-value">{metrics.timeSaved} hours</span>
                </div>
              </div>
            )}

            {metrics.roi !== undefined && (
              <div className="expanded-card__metric expanded-card__roi">
                <div className="metric-header">
                  <Icon name="trending-up" />
                  <span className="metric-label">ROI</span>
                  <span className="metric-value">{formatCurrency(metrics.roi)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Links */}
          {(agent.demoLink || agent.videoLink) && (
            <section className="expanded-card__links-section">
              <h4 className="expanded-card__section-title">
                <Icon name="link" />
                Resources
              </h4>
              <div className="expanded-card__links">
                {agent.demoLink && (
                  <a
                    href={agent.demoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="expanded-card__link"
                  >
                    <Icon name="external-link" />
                    <span>View Demo</span>
                    <Icon name="arrow-up-right" className="link-arrow" />
                  </a>
                )}
                {agent.videoLink && (
                  <a
                    href={agent.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="expanded-card__link"
                  >
                    <Icon name="play-circle" />
                    <span>Watch Video</span>
                    <Icon name="arrow-up-right" className="link-arrow" />
                  </a>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
