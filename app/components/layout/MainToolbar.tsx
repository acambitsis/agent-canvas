/**
 * MainToolbar - Top toolbar with canvas title, grouping controls, actions
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCanvas } from '@/contexts/CanvasContext';
import { useGrouping } from '@/contexts/GroupingContext';
import { useAgents } from '@/contexts/AgentContext';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { TAG_TYPES } from '@/utils/config';

/**
 * CollapseToggle - Button to collapse/expand all agent group sections
 * Only renders when there are 2+ groups
 */
function CollapseToggle() {
  const { computedGroups, collapsedSections, collapseAll } = useGrouping();

  if (computedGroups.length < 1) return null;

  const collapsedCount = computedGroups.filter(g => collapsedSections[g.id]).length;
  const allCollapsed = collapsedCount === computedGroups.length;

  return (
    <Tooltip content={allCollapsed ? 'Expand all sections' : 'Collapse all sections'} placement="bottom">
      <button
        type="button"
        className="collapse-toggle-btn"
        onClick={() => collapseAll(!allCollapsed)}
      >
        <Icon name={allCollapsed ? 'unfold-vertical' : 'fold-vertical'} />
        <span>{allCollapsed ? 'Expand' : 'Collapse'}</span>
      </button>
    </Tooltip>
  );
}

interface MainToolbarProps {
  onAddAgent: () => void;
}

export function MainToolbar({ onAddAgent }: MainToolbarProps) {
  const { currentCanvas, currentCanvasId } = useCanvas();
  const { agents } = useAgents();
  const { activeTagType, setActiveTagType, viewMode, setViewMode } = useGrouping();
  const [isGroupingOpen, setIsGroupingOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const groupingDropdownRef = useRef<HTMLDivElement>(null);

  // Close grouping dropdown on outside click or Escape key
  useEffect(() => {
    if (!isGroupingOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (groupingDropdownRef.current && !groupingDropdownRef.current.contains(event.target as Node)) {
        setIsGroupingOpen(false);
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsGroupingOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isGroupingOpen]);

  const activeTag = TAG_TYPES[activeTagType as keyof typeof TAG_TYPES];

  const handleShare = async () => {
    if (!currentCanvasId) return;
    const url = `${window.location.origin}/c/${currentCanvasId}`;
    try {
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  return (
    <header className="toolbar">
      <div className="toolbar__left">
        <h1 className="toolbar__title">{currentCanvas?.title || ''}</h1>
        <Tooltip content="Copy link to canvas" placement="bottom">
          <button
            type="button"
            className="icon-btn icon-btn--ghost"
            onClick={handleShare}
            disabled={!currentCanvasId}
          >
            <Icon name={showCopied ? 'check' : 'share-2'} />
            {showCopied && <span className="toolbar__copied-badge">Copied!</span>}
          </button>
        </Tooltip>
        <span className="toolbar__badge">
          <Icon name="bot" />
          <span>{agents.length} Agents</span>
        </span>
      </div>

      <div className="toolbar__right">
        {/* Grouping Control */}
        <div className="toolbar__control" ref={groupingDropdownRef}>
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
            aria-pressed={viewMode === 'grid'}
          >
            <Icon name="layout-grid" />
            <span>Normal</span>
          </button>
          <button
            type="button"
            className={`view-mode-toggle__btn ${viewMode === 'dock' ? 'is-active' : ''}`}
            onClick={() => setViewMode('dock')}
            aria-pressed={viewMode === 'dock'}
          >
            <Icon name="panel-bottom" />
            <span>Dock</span>
          </button>
        </div>

        {/* Collapse Toggle */}
        <CollapseToggle />

        {/* Add Agent Button */}
        <button type="button" className="btn btn--primary" onClick={onAddAgent}>
          <Icon name="plus" />
          <span>Add Agent</span>
        </button>
      </div>
    </header>
  );
}
