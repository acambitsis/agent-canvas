/**
 * Agent type definitions
 */

export interface AgentMetrics {
  numberOfUsers?: number;
  timesUsed?: number;
  timeSaved?: number; // hours
  roi?: number; // integer currency
}

export interface Agent {
  _id: string;
  _creationTime: number;
  canvasId: string;
  phase: string;
  phaseOrder: number;
  agentOrder: number;
  name: string;
  objective?: string;
  description?: string;
  tools: string[];
  journeySteps: string[];
  demoLink?: string;
  videoLink?: string;
  metrics?: AgentMetrics;
  department?: string;
  status?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface AgentGroup {
  id: string;
  label: string;
  agents: Agent[];
  color?: string;
  icon?: string;
}

export interface AgentFormData {
  name: string;
  objective?: string;
  description?: string;
  tools: string[];
  journeySteps: string[];
  demoLink?: string;
  videoLink?: string;
  metrics?: AgentMetrics;
  department?: string;
  status?: string;
  phase: string;
  phaseOrder: number;
  agentOrder: number;
}
