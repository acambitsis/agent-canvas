import { describe, expect, it } from 'vitest';
import { groupAgentsByTag, GroupAgentsOptions } from '@/utils/grouping';
import { Agent } from '@/types/agent';
import { Id } from '../../convex/_generated/dataModel';

/**
 * Create a mock agent for testing
 */
function mockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    _id: `agent-${Math.random()}` as Id<"agents">,
    _creationTime: Date.now(),
    canvasId: 'canvas-id' as Id<"canvases">,
    phase: 'Phase 1',
    agentOrder: 0,
    name: 'Test Agent',
    tools: [],
    journeySteps: [],
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('groupAgentsByTag', () => {
  describe('basic grouping', () => {
    it('groups agents by phase', () => {
      const agents: Agent[] = [
        mockAgent({ name: 'Agent 1', phase: 'Phase A' }),
        mockAgent({ name: 'Agent 2', phase: 'Phase B' }),
        mockAgent({ name: 'Agent 3', phase: 'Phase A' }),
      ];

      const groups = groupAgentsByTag(agents, 'phase');

      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.id === 'Phase A')?.agents).toHaveLength(2);
      expect(groups.find(g => g.id === 'Phase B')?.agents).toHaveLength(1);
    });

    it('groups agents by category', () => {
      const agents: Agent[] = [
        mockAgent({ name: 'Agent 1', category: 'Sales' }),
        mockAgent({ name: 'Agent 2', category: 'Support' }),
        mockAgent({ name: 'Agent 3', category: 'Sales' }),
      ];

      const groups = groupAgentsByTag(agents, 'category');

      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.id === 'Sales')?.agents).toHaveLength(2);
      expect(groups.find(g => g.id === 'Support')?.agents).toHaveLength(1);
    });

    it('excludes soft-deleted agents', () => {
      const agents: Agent[] = [
        mockAgent({ name: 'Active', phase: 'Phase A' }),
        mockAgent({ name: 'Deleted', phase: 'Phase A', deletedAt: Date.now() }),
      ];

      const groups = groupAgentsByTag(agents, 'phase');

      expect(groups).toHaveLength(1);
      expect(groups[0].agents).toHaveLength(1);
      expect(groups[0].agents[0].name).toBe('Active');
    });
  });

  describe('phase ordering with phaseOrder option', () => {
    it('sorts groups by canvas phaseOrder array', () => {
      const agents: Agent[] = [
        mockAgent({ name: 'Agent C', phase: 'Phase C', agentOrder: 0 }),
        mockAgent({ name: 'Agent A', phase: 'Phase A', agentOrder: 0 }),
        mockAgent({ name: 'Agent B', phase: 'Phase B', agentOrder: 0 }),
      ];

      const options: GroupAgentsOptions = {
        tagType: 'phase',
        phaseOrder: ['Phase A', 'Phase B', 'Phase C'],
      };

      const groups = groupAgentsByTag(agents, options);

      expect(groups.map(g => g.id)).toEqual(['Phase A', 'Phase B', 'Phase C']);
    });

    it('places unknown phases at the end', () => {
      const agents: Agent[] = [
        mockAgent({ name: 'Agent Unknown', phase: 'Unknown Phase', agentOrder: 0 }),
        mockAgent({ name: 'Agent A', phase: 'Phase A', agentOrder: 0 }),
        mockAgent({ name: 'Agent B', phase: 'Phase B', agentOrder: 0 }),
      ];

      const options: GroupAgentsOptions = {
        tagType: 'phase',
        phaseOrder: ['Phase A', 'Phase B'],
      };

      const groups = groupAgentsByTag(agents, options);

      expect(groups.map(g => g.id)).toEqual(['Phase A', 'Phase B', 'Unknown Phase']);
    });

    it('handles multiple unknown phases', () => {
      const agents: Agent[] = [
        mockAgent({ phase: 'Unknown 2' }),
        mockAgent({ phase: 'Phase A' }),
        mockAgent({ phase: 'Unknown 1' }),
      ];

      const options: GroupAgentsOptions = {
        tagType: 'phase',
        phaseOrder: ['Phase A'],
      };

      const groups = groupAgentsByTag(agents, options);

      // Known phase first, unknown phases at end (order among unknowns is not guaranteed)
      expect(groups[0].id).toBe('Phase A');
      expect(groups.slice(1).map(g => g.id).sort()).toEqual(['Unknown 1', 'Unknown 2']);
    });
  });

  describe('category ordering with categoryOrder option', () => {
    it('sorts groups by canvas categoryOrder array', () => {
      const agents: Agent[] = [
        mockAgent({ name: 'Agent C', category: 'Support', agentOrder: 0 }),
        mockAgent({ name: 'Agent A', category: 'Sales', agentOrder: 0 }),
        mockAgent({ name: 'Agent B', category: 'Marketing', agentOrder: 0 }),
      ];

      const options: GroupAgentsOptions = {
        tagType: 'category',
        categoryOrder: ['Sales', 'Marketing', 'Support'],
      };

      const groups = groupAgentsByTag(agents, options);

      expect(groups.map(g => g.id)).toEqual(['Sales', 'Marketing', 'Support']);
    });

    it('places unknown categories at the end', () => {
      const agents: Agent[] = [
        mockAgent({ category: 'Unknown Dept' }),
        mockAgent({ category: 'Sales' }),
      ];

      const options: GroupAgentsOptions = {
        tagType: 'category',
        categoryOrder: ['Sales'],
      };

      const groups = groupAgentsByTag(agents, options);

      expect(groups.map(g => g.id)).toEqual(['Sales', 'Unknown Dept']);
    });
  });

  describe('agent ordering within groups', () => {
    it('sorts agents by agentOrder within each group', () => {
      const agents: Agent[] = [
        mockAgent({ name: 'Third', phase: 'Phase A', agentOrder: 2 }),
        mockAgent({ name: 'First', phase: 'Phase A', agentOrder: 0 }),
        mockAgent({ name: 'Second', phase: 'Phase A', agentOrder: 1 }),
      ];

      const groups = groupAgentsByTag(agents, 'phase');

      expect(groups[0].agents.map(a => a.name)).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('backward compatibility', () => {
    it('accepts string argument for tagType', () => {
      const agents: Agent[] = [
        mockAgent({ phase: 'Phase A' }),
        mockAgent({ phase: 'Phase B' }),
      ];

      // Should work with just a string (original API)
      const groups = groupAgentsByTag(agents, 'phase');

      expect(groups).toHaveLength(2);
    });

    it('defaults to category grouping when no options provided', () => {
      const agents: Agent[] = [
        mockAgent({ phase: 'Phase A', category: 'Sales' }),
        mockAgent({ phase: 'Phase B', category: 'Support' }),
      ];

      // Default behavior groups by category (DEFAULT_GROUPING_TAG = CATEGORY)
      const groups = groupAgentsByTag(agents);

      expect(groups).toHaveLength(2);
      expect(groups.map(g => g.id).sort()).toEqual(['Sales', 'Support']);
    });
  });
});
