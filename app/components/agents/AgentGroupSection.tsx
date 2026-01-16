/**
 * AgentGroupSection - displays a group of agents
 */

'use client';

import React from 'react';
import { Agent, AgentGroup } from '@/types/agent';
import { AgentCard } from './AgentCard';
import { useGrouping } from '@/contexts/GroupingContext';
import { useLucideIcons } from '@/hooks/useLucideIcons';

interface AgentGroupSectionProps {
  group: AgentGroup;
  onEditAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  onAddAgent: (phase: string) => void;
}

export function AgentGroupSection({ group, onEditAgent, onDeleteAgent, onAddAgent }: AgentGroupSectionProps) {
  const { collapsedSections, toggleSectionCollapse } = useGrouping();
  const isCollapsed = collapsedSections[group.id] || false;

  // Initialize Lucide icons
  useLucideIcons();

  return (
    <section
      className={`agent-group ${isCollapsed ? 'collapsed' : ''}`}
      data-group-id={group.id}
      style={{ '--group-color': group.color } as React.CSSProperties}
    >
      <div className="agent-group__header">
        <button
          className="agent-group__toggle"
          onClick={() => toggleSectionCollapse(group.id)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        >
          <i data-lucide={group.icon || 'layers'}></i>
          <h2>{group.label}</h2>
          <span className="agent-group__count">{group.agents.length}</span>
          <i data-lucide={isCollapsed ? 'chevron-down' : 'chevron-up'} className="chevron"></i>
        </button>

        <div className="agent-group__actions">
          <button className="btn-sm" onClick={() => onAddAgent(group.id)} title="Add agent">
            <i data-lucide="plus"></i>
          </button>
        </div>
      </div>

      {isCollapsed && group.agents.length > 0 && (
        <div className="agent-group__collapsed-preview">
          {group.agents.slice(0, 4).map((agent, idx) => (
            <div key={agent._id} className={`collapsed-pill pill-palette-${idx % 5}`}>
              {agent.name}
            </div>
          ))}
          {group.agents.length > 4 && (
            <div className="collapsed-pill pill-palette-4">+{group.agents.length - 4} more</div>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="agent-group__content">
          <div className="agents-grid">
            {group.agents.map((agent) => (
              <AgentCard
                key={agent._id}
                agent={agent}
                onEdit={() => onEditAgent(agent)}
                onDelete={() => onDeleteAgent(agent)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
