# Document YAML Specification

**Deprecated**: AgentCanvas is Convex-native. YAML is supported only as a **one-way legacy import** format.

Complete specification for generating full AgentCanvas YAML documents. For individual agent specifications, see [AGENT_YAML_SPEC.md](./AGENT_YAML_SPEC.md).

## Overview

A complete YAML document contains document metadata, tool configurations, section defaults, and one or more agent groups. Each group contains multiple agents.

## Complete Document Schema

```yaml
# OPTIONAL TOP-LEVEL FIELDS
documentTitle: string      # Page title (default: "AgentCanvas")

# OPTIONAL TOOL CONFIGURATION
toolsConfig:               # Tool definitions with icons and colors (optional)
  ToolName:                # Tool name (must match tool names used in agents)
    icon: string          # Lucide icon name (e.g., "clipboard-list")
    class: string         # CSS class (e.g., "tool-forms")
    color: string         # Hex color (e.g., "#17a2b8")

# OPTIONAL SECTION DEFAULTS
sectionDefaults:           # Global defaults for agent groups (optional)
  iconType: string        # Lucide icon name (default: "target")
  showInFlow: boolean     # Display in flow view (default: true)
  isSupport: boolean      # Support section flag (default: false)
  color: string           # Hex color override (optional)

# REQUIRED
agentGroups: [object]     # Array of agent groups (required, non-empty)
```

## Field Specifications

### `documentTitle` (string, optional)
- **Type**: String
- **Description**: Title displayed at the top of the dashboard page
- **Default**: `"AgentCanvas"`
- **Example**: `"Sales Operations Dashboard"`

### `toolsConfig` (object, optional)
- **Type**: Object mapping tool names to tool configurations
- **Description**: Defines available tools with their icons, CSS classes, and colors. Tool names defined here can be referenced in agent `tools` arrays.
- **Default**: None (tools may be defined statically in application code)
- **Structure**: Each key is a tool name, each value is an object with:
  - `icon` (string): Lucide icon identifier
  - `class` (string): CSS class name (typically `tool-{name}`)
  - `color` (string): Hex color code (e.g., `"#17a2b8"`)
- **Example**:
  ```yaml
  toolsConfig:
    Forms:
      icon: clipboard-list
      class: tool-forms
      color: '#17a2b8'
    Analytics:
      icon: bar-chart-2
      class: tool-analytics
      color: '#28a745'
  ```

### `sectionDefaults` (object, optional)
- **Type**: Object
- **Description**: Default values applied to all agent groups unless overridden
- **Default**: Object with `iconType: "target"`, `showInFlow: true`, `isSupport: false`
- **Fields**:
  - `iconType` (string, optional): Lucide icon name for section headers (default: `"target"`)
  - `showInFlow` (boolean, optional): Whether section appears in flow visualization (default: `true`)
  - `isSupport` (boolean, optional): Marks section as support/auxiliary (default: `false`)
  - `color` (string, optional): Hex color for section accent (default: auto-generated from palette)
- **Example**:
  ```yaml
  sectionDefaults:
    iconType: target
    showInFlow: true
    isSupport: false
  ```

### `agentGroups` (array, required)
- **Type**: Array of group objects
- **Description**: List of agent groups/sections. Each group contains multiple agents.
- **Required**: Yes, must be non-empty array
- **Structure**: See Agent Group Schema below

## Agent Group Schema

Each item in `agentGroups` is a group object:

```yaml
# REQUIRED
groupName: string          # Section name (non-empty string, trimmed)
agents: [object]          # Array of agent objects (required, see AGENT_YAML_SPEC.md)

# OPTIONAL
groupNumber: number       # Position index, 0-indexed (auto-generated if omitted)
groupId: string          # Unique identifier (auto-generated from groupName if omitted)
phaseTag: string         # Phase label (e.g., "Phase 1", "Pre-Phase")
flowDisplayName: string  # Alternative name for flow visualization
groupClass: string       # CSS class override (auto-generated from groupId if omitted)
```

### Group Field Details

#### `groupName` (string, required)
- **Type**: Non-empty string
- **Description**: Display name for the agent group/section
- **Constraints**: Must be non-empty, whitespace trimmed
- **Example**: `"Sales Phase"`, `"Customer Onboarding"`

#### `agents` (array, required)
- **Type**: Array of agent objects
- **Description**: List of agents in this group
- **Required**: Yes, must be an array (can be empty)
- **Structure**: Each agent follows the schema in [AGENT_YAML_SPEC.md](./AGENT_YAML_SPEC.md)
- **Example**: See Complete Example below

#### `groupNumber` (number, optional)
- **Type**: Integer
- **Description**: Zero-indexed position in groups array
- **Default**: Auto-generated based on array position
- **Example**: `0`, `1`, `2`

#### `groupId` (string, optional)
- **Type**: String (slug format)
- **Description**: Unique identifier for the group, used for CSS classes and DOM attributes
- **Default**: Auto-generated from `groupName` (slugified, e.g., "Sales Phase" → "sales-phase")
- **Constraints**: Must be unique across all groups
- **Example**: `"sales-phase"`, `"customer-onboarding"`

#### `phaseTag` (string, optional)
- **Type**: String
- **Description**: Phase label displayed with section name
- **Default**: None
- **Example**: `"Phase 1"`, `"Pre-Phase"`, `"Post-Implementation"`

#### `flowDisplayName` (string, optional)
- **Type**: String
- **Description**: Alternative name for use in flow visualizations
- **Default**: None (uses `groupName`)
- **Example**: `"Sales"` (when `groupName` is "Sales Phase")

#### `groupClass` (string, optional)
- **Type**: String
- **Description**: CSS class name for styling
- **Default**: Auto-generated as `group-{groupId}`
- **Example**: `"group-sales-phase"`

## Complete Example

```yaml
documentTitle: AgentCanvas

toolsConfig:
  Forms:
    icon: clipboard-list
    class: tool-forms
    color: '#17a2b8'
  Documents:
    icon: file-text
    class: tool-documents
    color: '#28a745'
  Analytics:
    icon: bar-chart-2
    class: tool-analytics
    color: '#ffc107'

sectionDefaults:
  iconType: target
  showInFlow: true
  isSupport: false

agentGroups:
  - groupName: Sales Phase
    phaseTag: Phase 1
    flowDisplayName: Sales
    agents:
      - name: Lead Qualification Agent
        objective: Qualifies inbound leads using scoring criteria
        description: |
          Analyzes lead data from multiple sources, applies scoring rules,
          and routes qualified leads to sales team.
        tools: [Forms, Analytics]
        journeySteps:
          - Lead submission received
          - Data validation and enrichment
          - Scoring calculation
          - Qualification decision
        metrics:
          usageThisWeek: "45"
          timeSaved: "40%"
          roiContribution: High

      - name: Proposal Generator Agent
        objective: Generates customized sales proposals
        description: Creates tailored proposals based on customer requirements and pricing models.
        tools: [Documents, Forms]
        journeySteps:
          - Requirements gathering
          - Template selection
          - Content generation
          - Review and approval
        demoLink: https://demo.example.com/proposal-generator

  - groupName: Customer Onboarding
    phaseTag: Phase 2
    agents:
      - name: Customer Onboarding Agent
        objective: Automates customer data collection and validation
        description: |
          Handles complete onboarding workflow including data validation,
          document processing, and automated welcome communications.
        tools: [Forms, Documents, Email]
        journeySteps:
          - User initiates onboarding request
          - Agent collects customer information
          - Agent validates data completeness
          - Agent processes documents
          - Agent generates welcome package
        demoLink: https://demo.example.com/onboarding
        videoLink: https://youtube.com/watch?v=abc123
        badge: Handover
        metrics:
          usageThisWeek: "150"
          timeSaved: "60%"
          roiContribution: High
```

## Minimal Valid Example

The absolute minimum required document:

```yaml
agentGroups:
  - groupName: My Section
    agents:
      - name: My Agent
```

All other fields will use defaults:
- `documentTitle`: `"AgentCanvas"`
- `sectionDefaults`: `{ iconType: "target", showInFlow: true, isSupport: false }`
- `groupNumber`: Auto-generated (0, 1, 2...)
- `groupId`: Auto-generated from `groupName`
- Agent fields: See [AGENT_YAML_SPEC.md](./AGENT_YAML_SPEC.md) for agent defaults

## Generation Guidelines

When generating a complete YAML document:

1. **Always include `agentGroups`** - This is the only required top-level field
2. **Include `documentTitle`** - Provide a meaningful title for the dashboard
3. **Define `toolsConfig`** - List all tools referenced in agent `tools` arrays
4. **Set `sectionDefaults`** - Only if you need non-default values
5. **For each group**:
   - Always include `groupName` and `agents`
   - Omit `groupNumber` and `groupId` (auto-generated)
   - Include `phaseTag` if needed for labeling
6. **For each agent**: Follow [AGENT_YAML_SPEC.md](./AGENT_YAML_SPEC.md) guidelines
7. **Tool names**: Must match exactly between `toolsConfig` keys and agent `tools` arrays (case-sensitive)

## Validation Rules

1. **Required**: `agentGroups` must be a non-empty array
2. **Group validation**:
   - Each group must have `groupName` (non-empty string)
   - Each group must have `agents` (array, can be empty)
   - `groupNumber` must be a number if provided
3. **Agent validation**: See [AGENT_YAML_SPEC.md](./AGENT_YAML_SPEC.md)
4. **Type safety**: Wrong types (e.g., `agentGroups` as string) → rejected
5. **Defaults**: Missing optional fields are auto-populated

## Common Tool Names

When defining `toolsConfig`, common tool names include:
- `Forms`
- `Documents`
- `Analytics`
- `Email`
- `Calendar`
- `CRM`
- `Database`
- `API`
- `Workflow`
- `Reporting`
- `Code`
- `RAG`
- `Web Search`
- `Deep Research`
- `Context`

**Note**: Tool names in `toolsConfig` must exactly match tool names used in agent `tools` arrays (case-sensitive).

## YAML Formatting

- Use 2-space indentation
- Arrays can use `- item` or `[item1, item2]` syntax
- Multi-line strings use `|` (preserves newlines) or `>` (folds)
- Quote strings with special YAML characters
- URLs should be quoted if they contain special characters

## Reference

- **Agent specification**: See [AGENT_YAML_SPEC.md](./AGENT_YAML_SPEC.md) for complete agent field details
- **Agent examples**: See agent spec for minimal and complete agent examples


