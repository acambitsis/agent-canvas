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
  const { activeTagType, setActiveTagType, viewMode, setViewMode } = useGrouping();
  const [isGroupingOpen, setIsGroupingOpen] = useState(false);

  const activeTag = TAG_TYPES[activeTagType as keyof typeof TAG_TYPES];

  return (
    <header className="toolbar">
      <div className="toolbar__left">
        <h1 className="toolbar__title">{currentCanvas?.title || 'Agent Canvas'}</h1>
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

        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button
            type="button"
            className={`view-mode-toggle__btn ${viewMode === 'grid' ? 'is-active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <Icon name="layout-grid" />
            <span>Grid</span>
          </button>
          <button
            type="button"
            className={`view-mode-toggle__btn ${viewMode === 'detail' ? 'is-active' : ''}`}
            onClick={() => setViewMode('detail')}
            title="Detail view"
            aria-pressed={viewMode === 'detail'}
          >
            <Icon name="layout-list" />
            <span>Detail</span>
          </button>
        </div>

        {/* Add Agent Button */}
        <button type="button" className="btn btn--primary" onClick={onAddAgent}>
          <Icon name="plus" />
          <span>Add Agent</span>
        </button>
      </div>
    </header>
  );
}
