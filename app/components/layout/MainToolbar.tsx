/**
 * MainToolbar - Top toolbar with canvas title, grouping controls, actions
 */

'use client';

import React, { useState } from 'react';
import { useCanvas } from '@/contexts/CanvasContext';
import { useGrouping } from '@/contexts/GroupingContext';
import { useAgents } from '@/contexts/AgentContext';
import { Icon } from '@/components/ui/Icon';
import { TAG_TYPES } from '@/utils/config';

interface MainToolbarProps {
  onAddAgent: () => void;
}

export function MainToolbar({ onAddAgent }: MainToolbarProps) {
  const { currentCanvas } = useCanvas();
  const { agents } = useAgents();
  const { activeTagType, setActiveTagType, collapsedSections, collapseAll } = useGrouping();
  const [isGroupingOpen, setIsGroupingOpen] = useState(false);

  const activeTag = TAG_TYPES[activeTagType as keyof typeof TAG_TYPES];
  const allCollapsed = Object.values(collapsedSections).every(Boolean);

  return (
    <header className="toolbar">
      <div className="toolbar__left">
        <h1 className="toolbar__title">{currentCanvas?.title || 'AgentCanvas'}</h1>
        <span className="toolbar__badge">
          <Icon name="bot" />
          <span>{agents.length} Agents</span>
        </span>
      </div>

      <div className="toolbar__right">
        {/* Grouping Control */}
        <div className="toolbar__control">
          <span className="toolbar__control-label">Group by</span>
          <button
            type="button"
            className="toolbar__control-btn"
            onClick={() => setIsGroupingOpen(!isGroupingOpen)}
          >
            <span>{activeTag?.label || 'Phase'}</span>
            <Icon name="chevron-down" />
          </button>
          <div className={`toolbar__dropdown ${isGroupingOpen ? 'open' : ''}`}>
            {Object.values(TAG_TYPES).map((tag) => (
              <div
                key={tag.id}
                className={`toolbar__dropdown-item ${activeTagType === tag.id ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveTagType(tag.id);
                  setIsGroupingOpen(false);
                }}
              >
                <Icon name={tag.icon} />
                <span>{tag.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Collapse/Expand All Button */}
        <button
          type="button"
          className="toolbar__btn"
          onClick={() => collapseAll(!allCollapsed)}
          title={allCollapsed ? 'Expand all' : 'Collapse all'}
        >
          <Icon name={allCollapsed ? 'chevrons-up' : 'chevrons-down'} />
          <span>{allCollapsed ? 'Expand' : 'Collapse'}</span>
        </button>

        {/* Add Agent Button */}
        <button type="button" className="btn btn--primary" onClick={onAddAgent}>
          <Icon name="plus" />
          <span>Add Agent</span>
        </button>
      </div>
    </header>
  );
}
