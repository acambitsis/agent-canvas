/**
 * QuickLookPanel - Slide-out panel for viewing agent details
 * Shows full agent information without opening the edit modal
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay, getStatusConfig, getToolColorClass } from '@/utils/config';
import { formatCurrency } from '@/utils/formatting';
import { Icon } from '@/components/ui/Icon';

interface QuickLookPanelProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function QuickLookPanel({
  agent,
  isOpen,
  onClose,
  onEdit,
  onDelete
}: QuickLookPanelProps) {
  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!agent) return null;

  const statusConfig = getStatusConfig(agent.status);
  const metrics = agent.metrics || {};

  return (
    <div
      className={`quick-look-overlay ${isOpen ? 'is-open' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      {/* Modal */}
      <div
        className={`quick-look-panel ${isOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Agent details: ${agent.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="quick-look-panel__header">
          <div className="quick-look-panel__title-group">
            <span className="quick-look-panel__number">
              {(agent.agentOrder ?? 0) + 1}
            </span>
            <h2 className="quick-look-panel__name">{agent.name}</h2>
            <div className="quick-look-panel__meta">
              {agent.category && (
                <span className="quick-look-panel__category">
                  <Icon name="folder" />
                  {agent.category}
                </span>
              )}
              {agent.phase && (
                <span className="quick-look-panel__phase">
                  <Icon name="milestone" />
                  {agent.phase}
                </span>
              )}
              <span
                className="quick-look-panel__status"
                style={{ color: statusConfig.color, backgroundColor: statusConfig.bgColor }}
              >
                <span className="status-dot" style={{ backgroundColor: statusConfig.color }} />
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button
            className="quick-look-panel__close"
            onClick={onClose}
            aria-label="Close panel"
          >
            <Icon name="x" />
          </button>
        </header>

        {/* Body */}
        <div className="quick-look-panel__body">
          {/* Objective */}
          {agent.objective && (
            <section className="quick-look-panel__section">
              <h3 className="quick-look-panel__section-title">
                <Icon name="target" />
                Objective
              </h3>
              <p className="quick-look-panel__objective">{agent.objective}</p>
            </section>
          )}

          {/* Description */}
          {agent.description && (
            <section className="quick-look-panel__section">
              <h3 className="quick-look-panel__section-title">
                <Icon name="file-text" />
                Description
              </h3>
              <p className="quick-look-panel__description">{agent.description}</p>
            </section>
          )}

          {/* Tools / Capabilities */}
          {agent.tools && agent.tools.length > 0 && (
            <section className="quick-look-panel__section">
              <h3 className="quick-look-panel__section-title">
                <Icon name="wrench" />
                Capabilities
              </h3>
              <div className="quick-look-panel__tools">
                {agent.tools.map((tool) => {
                  const toolDisplay = getToolDisplay(tool);
                  const colorClass = getToolColorClass(toolDisplay.color);
                  return (
                    <span
                      key={tool}
                      className={`chip tool-chip tool-chip--${colorClass}`}
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
            <section className="quick-look-panel__section">
              <h3 className="quick-look-panel__section-title">
                <Icon name="route" />
                Journey Steps
              </h3>
              <div className="quick-look-panel__journey">
                {agent.journeySteps.map((step, idx) => (
                  <div key={idx} className="quick-look-panel__journey-step">
                    <span className="quick-look-panel__journey-step-number">{idx + 1}</span>
                    <span className="quick-look-panel__journey-step-text">{step}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Metrics */}
          {(metrics.numberOfUsers !== undefined || metrics.timesUsed !== undefined ||
            metrics.timeSaved !== undefined || metrics.roi !== undefined) && (
            <section className="quick-look-panel__section">
              <h3 className="quick-look-panel__section-title">
                <Icon name="bar-chart-2" />
                Performance
              </h3>
              <div className="quick-look-panel__metrics">
                {metrics.numberOfUsers !== undefined && (
                  <div className="quick-look-panel__metric">
                    <span className="quick-look-panel__metric-label">
                      <Icon name="users" />
                      Users
                    </span>
                    <span className="quick-look-panel__metric-value">{metrics.numberOfUsers}</span>
                  </div>
                )}
                {metrics.timesUsed !== undefined && (
                  <div className="quick-look-panel__metric">
                    <span className="quick-look-panel__metric-label">
                      <Icon name="activity" />
                      Times Used
                    </span>
                    <span className="quick-look-panel__metric-value">{metrics.timesUsed}</span>
                  </div>
                )}
                {metrics.timeSaved !== undefined && (
                  <div className="quick-look-panel__metric">
                    <span className="quick-look-panel__metric-label">
                      <Icon name="clock" />
                      Time Saved
                    </span>
                    <span className="quick-look-panel__metric-value">{metrics.timeSaved}h</span>
                  </div>
                )}
                {metrics.roi !== undefined && (
                  <div className="quick-look-panel__metric">
                    <span className="quick-look-panel__metric-label">
                      <Icon name="trending-up" />
                      ROI
                    </span>
                    <span className="quick-look-panel__metric-value">{formatCurrency(metrics.roi)}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Links */}
          {(agent.demoLink || agent.videoLink) && (
            <section className="quick-look-panel__section">
              <h3 className="quick-look-panel__section-title">
                <Icon name="link" />
                Resources
              </h3>
              <div className="quick-look-panel__links">
                {agent.demoLink && (
                  <a
                    href={agent.demoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-look-panel__link"
                  >
                    <Icon name="external-link" />
                    <span>View Demo</span>
                  </a>
                )}
                {agent.videoLink && (
                  <a
                    href={agent.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-look-panel__link"
                  >
                    <Icon name="play-circle" />
                    <span>Watch Video</span>
                  </a>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <footer className="quick-look-panel__footer">
          <button
            className="btn btn--secondary"
            onClick={onDelete}
          >
            <Icon name="trash-2" />
            Delete
          </button>
          <button
            className="btn btn--primary"
            onClick={onEdit}
          >
            <Icon name="edit-3" />
            Edit Agent
          </button>
        </footer>
      </div>
    </div>
  );
}
