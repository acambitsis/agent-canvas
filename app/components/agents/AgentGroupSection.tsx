/**
 * AgentGroupSection - Premium group display with animations
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Agent, AgentGroup } from '@/types/agent';
import { AgentCard } from './AgentCard';
import { ExpandedAgentCard } from './ExpandedAgentCard';
import { CompactAgentRow } from './CompactAgentRow';
import { useGrouping } from '@/contexts/GroupingContext';
import { Icon } from '@/components/ui/Icon';
import { getToolDisplay, getStatusColor } from '@/utils/config';

interface AgentGroupSectionProps {
  group: AgentGroup;
  groupIndex?: number;
  onEditAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  onAddAgent: (phase: string) => void;
  onQuickLook?: (agent: Agent) => void;
}

export function AgentGroupSection({
  group,
  groupIndex = 0,
  onEditAgent,
  onDeleteAgent,
  onAddAgent,
  onQuickLook
}: AgentGroupSectionProps) {
  const { collapsedSections, toggleSectionCollapse, viewMode } = useGrouping();
  const isCollapsed = collapsedSections[group.id] || false;
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), groupIndex * 100);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [groupIndex]);

  return (
    <section
      ref={sectionRef}
      className={`agent-group ${isCollapsed ? 'collapsed' : ''} ${isVisible ? 'is-visible' : ''}`}
      data-group-id={group.id}
      style={{
        '--group-color': group.color,
        '--animation-delay': `${groupIndex * 100}ms`
      } as React.CSSProperties}
    >
      {/* Group Header */}
      <div className="agent-group__header">
        <button
          className="agent-group__toggle"
          onClick={() => toggleSectionCollapse(group.id)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        >
          {/* Group Icon with gradient */}
          <div className="group-icon">
            <Icon name={group.icon || 'layers'} />
          </div>

          {/* Group Title */}
          <div className="group-title">
            <h2>{group.label}</h2>
            <span className="group-subtitle">
              {group.agents.length} {group.agents.length === 1 ? 'agent' : 'agents'}
            </span>
          </div>

          {/* Agent Count Badge */}
          <span className="agent-group__count">{group.agents.length}</span>

          {/* Chevron */}
          <div className="collapse-toggle">
            <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} className="chevron" />
          </div>
        </button>

        {/* Actions */}
        <div className="agent-group__actions">
          <button
            className="btn btn--sm btn--primary"
            onClick={() => onAddAgent(group.id)}
            title={`Add agent to ${group.label}`}
          >
            <Icon name="plus" />
          </button>
        </div>
      </div>

      {/* Collapsed Preview - List Format */}
      {isCollapsed && group.agents.length > 0 && (
        <div className="agent-group__collapsed-list">
          {group.agents.map((agent, idx) => (
            <button
              key={agent._id}
              className="collapsed-list-item"
              onClick={() => onQuickLook ? onQuickLook(agent) : onEditAgent(agent)}
              title={agent.objective || agent.name}
            >
              <span className="collapsed-list-item__number">{idx + 1}</span>
              <span className="collapsed-list-item__name">{agent.name}</span>
              <span
                className="collapsed-list-item__status"
                style={{ backgroundColor: getStatusColor(agent.status) }}
              />
              <span className="collapsed-list-item__tools">
                {agent.tools.slice(0, 3).map((tool, toolIdx) => (
                  <span
                    key={toolIdx}
                    className="tool-dot"
                    style={{ backgroundColor: getToolDisplay(tool).color }}
                    title={getToolDisplay(tool).label}
                  />
                ))}
                {agent.tools.length > 3 && (
                  <span className="tool-dot tool-dot--more">+{agent.tools.length - 3}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Expanded Content - Compact, Grid, or Detail View */}
      {!isCollapsed && (
        <div className={`agent-group__content agent-group__content--${viewMode}`}>
          {viewMode === 'compact' ? (
            <div className="agents-compact-view">
              {group.agents.map((agent, idx) => (
                <CompactAgentRow
                  key={agent._id}
                  agent={agent}
                  index={idx}
                  onEdit={() => onEditAgent(agent)}
                  onDelete={() => onDeleteAgent(agent)}
                  onQuickLook={() => onQuickLook ? onQuickLook(agent) : onEditAgent(agent)}
                />
              ))}
            </div>
          ) : viewMode === 'detail' ? (
            <div className="agents-detail-view">
              {group.agents.map((agent, idx) => (
                <ExpandedAgentCard
                  key={agent._id}
                  agent={agent}
                  index={idx}
                  onEdit={() => onEditAgent(agent)}
                  onDelete={() => onDeleteAgent(agent)}
                />
              ))}
            </div>
          ) : (
            <div className="agents-grid">
              {group.agents.map((agent, idx) => (
                <AgentCard
                  key={agent._id}
                  agent={agent}
                  index={idx}
                  onEdit={() => onEditAgent(agent)}
                  onDelete={() => onDeleteAgent(agent)}
                  onQuickLook={() => onQuickLook?.(agent)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
