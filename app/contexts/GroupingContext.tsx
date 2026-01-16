/**
 * GroupingContext - Manages agent grouping and filtering state
 */

'use client';

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { Agent, AgentGroup } from '@/types/agent';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { groupAgentsByTag, filterAgents } from '@/utils/grouping';
import { DEFAULT_GROUPING_TAG } from '@/utils/config';
import { useAgents } from './AgentContext';

const GROUPING_PREFERENCE_KEY = 'agentcanvas-grouping-pref';
const COLLAPSED_SECTIONS_KEY = 'agentcanvas-collapsed-sections';

interface GroupingPreferences {
  activeTagType: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, string[]>;
}

interface GroupingContextValue {
  activeTagType: string;
  filters: Record<string, string[]>;
  collapsedSections: Record<string, boolean>;
  computedGroups: AgentGroup[];
  setActiveTagType: (tagType: string) => void;
  setFilters: (filters: Record<string, string[]>) => void;
  toggleSectionCollapse: (groupId: string) => void;
  collapseAll: (collapsed: boolean) => void;
}

const GroupingContext = createContext<GroupingContextValue | undefined>(undefined);

export function GroupingProvider({ children }: { children: React.ReactNode }) {
  const { agents } = useAgents();

  const [preferences, setPreferences] = useLocalStorage<GroupingPreferences>(
    GROUPING_PREFERENCE_KEY,
    {
      activeTagType: DEFAULT_GROUPING_TAG,
      sortOrder: 'asc',
      filters: {},
    }
  );

  const [collapsedSections, setCollapsedSections] = useLocalStorage<Record<string, boolean>>(
    COLLAPSED_SECTIONS_KEY,
    {}
  );

  // Compute grouped agents with filters
  const computedGroups = useMemo(() => {
    let filteredAgents = agents;

    // Apply filters
    if (Object.keys(preferences.filters).length > 0) {
      filteredAgents = filterAgents(filteredAgents, preferences.filters);
    }

    // Group by active tag type
    return groupAgentsByTag(filteredAgents, preferences.activeTagType);
  }, [agents, preferences.filters, preferences.activeTagType]);

  const setActiveTagType = useCallback((tagType: string) => {
    setPreferences((prev) => ({ ...prev, activeTagType: tagType }));
    window.dispatchEvent(new CustomEvent('groupingChanged', { detail: { tagType } }));
  }, [setPreferences]);

  const setFilters = useCallback((filters: Record<string, string[]>) => {
    setPreferences((prev) => ({ ...prev, filters }));
  }, [setPreferences]);

  const toggleSectionCollapse = useCallback((groupId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, [setCollapsedSections]);

  const collapseAll = useCallback((collapsed: boolean) => {
    const newCollapsedState: Record<string, boolean> = {};
    for (const group of computedGroups) {
      newCollapsedState[group.id] = collapsed;
    }
    setCollapsedSections(newCollapsedState);
  }, [computedGroups, setCollapsedSections]);

  const value: GroupingContextValue = {
    activeTagType: preferences.activeTagType,
    filters: preferences.filters,
    collapsedSections,
    computedGroups,
    setActiveTagType,
    setFilters,
    toggleSectionCollapse,
    collapseAll,
  };

  return <GroupingContext.Provider value={value}>{children}</GroupingContext.Provider>;
}

export function useGrouping() {
  const context = useContext(GroupingContext);
  if (context === undefined) {
    throw new Error('useGrouping must be used within a GroupingProvider');
  }
  return context;
}
