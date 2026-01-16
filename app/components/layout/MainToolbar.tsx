/**
 * MainToolbar - Top toolbar with canvas title, grouping, search
 */

'use client';

import React from 'react';
import { useCanvas } from '@/contexts/CanvasContext';
import { useGrouping } from '@/contexts/GroupingContext';
import { useAgents } from '@/contexts/AgentContext';
import { useLucideIcons } from '@/hooks/useLucideIcons';
import { TAG_TYPES } from '@/utils/config';

interface MainToolbarProps {
  onAddAgent: () => void;
}

export function MainToolbar({ onAddAgent }: MainToolbarProps) {
  const { currentCanvas } = useCanvas();
  const { agents } = useAgents();
  const { activeTagType, setActiveTagType, searchQuery, setSearchQuery, collapseAll } = useGrouping();

  // Initialize Lucide icons
  useLucideIcons();

  return (
    <header className="toolbar">
      <div className="toolbar__left">
        <h1 className="toolbar__title">{currentCanvas?.title || 'AgentCanvas'}</h1>
        <span className="badge">{agents.length} agents</span>
      </div>

      <div className="toolbar__right">
        <div className="toolbar__search">
          <i data-lucide="search"></i>
          <input
            type="search"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="toolbar__grouping"
          value={activeTagType}
          onChange={(e) => setActiveTagType(e.target.value)}
        >
          {Object.values(TAG_TYPES).map((tag) => (
            <option key={tag.id} value={tag.id}>
              Group by {tag.label}
            </option>
          ))}
        </select>

        <button className="btn-secondary" onClick={() => collapseAll(false)} title="Expand all">
          <i data-lucide="maximize-2"></i>
        </button>

        <button className="btn-secondary" onClick={() => collapseAll(true)} title="Collapse all">
          <i data-lucide="minimize-2"></i>
        </button>

        <button className="btn-primary" onClick={onAddAgent}>
          <i data-lucide="plus"></i>
          Add Agent
        </button>
      </div>
    </header>
  );
}
