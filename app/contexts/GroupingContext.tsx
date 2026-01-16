/**
 * GroupingContext - Manages agent grouping, filtering, and search state
 */

'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Agent, AgentGroup } from '@/types/agent';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDebounce } from '@/hooks/useDebounce';
import { groupAgentsByTag, filterAgents, searchAgents } from '@/utils/grouping';
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
  searchQuery: string;
  collapsedSections: Record<string, boolean>;
  computedGroups: AgentGroup[];
  setActiveTagType: (tagType: string) => void;
  setFilters: (filters: Record<string, string[]>) => void;
  setSearchQuery: (query: string) => void;
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

  const [searchQuery, setSearchQueryState] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 200);

  // Compute grouped agents with filters and search
  const computedGroups = useMemo(() => {
    let filteredAgents = agents;

    // Apply filters
    if (Object.keys(preferences.filters).length > 0) {
      filteredAgents = filterAgents(filteredAgents, preferences.filters);
    }

    // Apply search
    if (debouncedSearchQuery) {
      filteredAgents = searchAgents(filteredAgents, debouncedSearchQuery);
    }

    // Group by active tag type
    return groupAgentsByTag(filteredAgents, preferences.activeTagType);
  }, [agents, preferences.filters, preferences.activeTagType, debouncedSearchQuery]);

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
    searchQuery,
    collapsedSections,
    computedGroups,
    setActiveTagType,
    setFilters,
    setSearchQuery: setSearchQueryState,
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
