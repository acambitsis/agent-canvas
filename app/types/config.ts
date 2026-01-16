/**
 * Configuration type definitions
 */

export interface ToolConfig {
  label: string;
  icon: string;
  color: string;
}

export interface TagDefinition {
  label: string;
  values: string[];
  icon?: string;
}

export interface OrgSettings {
  _id: string;
  _creationTime: number;
  workosOrgId: string;
  tools: Record<string, ToolConfig>;
  tags: Record<string, TagDefinition>;
  defaultPhase: string;
  createdAt: number;
  updatedAt: number;
}
