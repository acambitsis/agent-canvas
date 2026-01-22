/**
 * Agent type definitions
 *
 * Agent type is derived from Convex schema to ensure frontend/backend alignment.
 * Changes to agent fields should be made in convex/schema.ts.
 */

import { Doc } from '../../convex/_generated/dataModel';

/**
 * Agent document type - derived from Convex schema
 */
export type Agent = Doc<"agents">;

/**
 * Agent metrics - extracted from Agent type
 */
export type AgentMetrics = NonNullable<Agent['metrics']>;

/**
 * UI grouping structure (not stored in database)
 */
export interface AgentGroup {
  id: string;
  label: string;
  agents: Agent[];
  color?: string;
  icon?: string;
}

/**
 * Form data for creating/editing agents (subset of Agent fields)
 */
export type AgentFormData = Pick<
  Agent,
  'name' | 'objective' | 'description' | 'tools' | 'journeySteps' |
  'demoLink' | 'videoLink' | 'metrics' | 'category' | 'status' |
  'phase' | 'phaseOrder' | 'agentOrder'
>;
