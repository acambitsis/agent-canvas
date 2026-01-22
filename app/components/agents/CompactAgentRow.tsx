/**
 * CompactAgentRow - Horizontal row for compact view mode
 * Shows agent order, name, status, tool indicators, and quick actions
 */

'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay, getStatusColor } from '@/utils/config';
import { Icon } from '@/components/ui/Icon';
import { AGENT_STATUS, getAgentStatusConfig } from '@/types/validationConstants';

interface CompactAgentRowProps {
  agent: Agent;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onQuickLook: () => void;
}

export const CompactAgentRow = memo(function CompactAgentRow({
  agent,
  index,
  onEdit,
  onDelete,
  onQuickLook
}: CompactAgentRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const statusColor = getStatusColor(agent.status);

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

  // Get tool displays for dots (max 4)
  const toolDisplays = agent.tools.slice(0, 4).map(tool => getToolDisplay(tool));
  const extraToolsCount = Math.max(0, agent.tools.length - 4);

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger quick look if clicking on the menu
    if ((e.target as HTMLElement).closest('.compact-row__actions')) {
      return;
    }
    onQuickLook();
  };

  return (
    <div
      className="compact-row"
      data-agent-id={agent._id}
      onClick={handleRowClick}
      title={agent.objective || agent.name}
      style={{
        '--status-color': statusColor,
        '--animation-delay': `${index * 30}ms`
      } as React.CSSProperties}
    >
      {/* Order number */}
      <span className="compact-row__number">
        {(agent.agentOrder ?? index) + 1}
      </span>

      {/* Agent name */}
      <span className="compact-row__name">
        {agent.name}
      </span>

      {/* Status badge */}
      <span className={`compact-row__status status-dot--${agent.status || AGENT_STATUS.DRAFT}`}>
        <span className="status-dot" style={{ backgroundColor: statusColor }} />
        <span className="compact-row__status-label">{getAgentStatusConfig(agent.status).label}</span>
      </span>

      {/* Tool indicators (colored dots) */}
      <span className="compact-row__tools">
        {toolDisplays.map((tool, idx) => (
          <span
            key={idx}
            className="tool-dot"
            style={{ backgroundColor: tool.color }}
            title={tool.label}
          />
        ))}
        {extraToolsCount > 0 && (
          <span className="tool-dot tool-dot--more">+{extraToolsCount}</span>
        )}
      </span>

      {/* Actions menu */}
      <div className="compact-row__actions" ref={menuRef}>
        <button
          className="compact-row__menu-trigger"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          aria-label="More actions"
          aria-expanded={menuOpen}
        >
          <Icon name="more-vertical" />
        </button>
        {menuOpen && (
          <div className="compact-row__dropdown">
            <button
              className="compact-row__dropdown-item"
              onClick={(e) => {
                e.stopPropagation();
                onQuickLook();
                setMenuOpen(false);
              }}
            >
              <Icon name="eye" />
              Quick Look
            </button>
            <button
              className="compact-row__dropdown-item"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
                setMenuOpen(false);
              }}
            >
              <Icon name="edit-3" />
              Edit
            </button>
            <button
              className="compact-row__dropdown-item compact-row__dropdown-item--danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setMenuOpen(false);
              }}
            >
              <Icon name="trash-2" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
