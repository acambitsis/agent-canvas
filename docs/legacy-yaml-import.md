# Legacy YAML Import

AgentCanvas is **Convex-native**. YAML is supported only as a **one-way legacy import** format.

## Overview

The legacy YAML import allows you to import existing agent configurations from YAML files into AgentCanvas. Once imported, all editing happens through the Convex-native UI—there is no YAML export or round-trip support.

## Import Format

A valid YAML document contains:

1. **Optional document metadata**:
   - `documentTitle`: Page title (defaults to "Imported Canvas")

2. **Required agent groups**:
   - `agentGroups`: Array of group objects, each containing:
     - `groupName`: Section name (required)
     - `agents`: Array of agent objects (required)

### Agent Schema

Each agent object supports:

**Required:**
- `name`: Agent name (non-empty string)

**Optional:**
- `objective`: One-line summary
- `description`: Multiline description
- `tools`: Array of tool names (e.g., `["Forms", "RAG", "Code"]`)
- `journeySteps`: Array of workflow steps (3-7 steps recommended)
- `demoLink`: URL to demo
- `videoLink`: URL to video
- `metrics`: Object with:
  - `usageThisWeek`: String (e.g., `"150"`)
  - `timeSaved`: String (e.g., `"60%"`)
  - `roiContribution`: `"Very High"`, `"High"`, `"Medium"`, or `"Low"`
- `tags`: Object with:
  - `department`: `"sales"`, `"engineering"`, `"marketing"`, etc.
  - `status`: `"active"`, `"draft"`, `"review"`, `"deprecated"`
  - `implementationStatus`: `"ideation"`, `"planning"`, `"development"`, `"testing"`, `"deployed"`, `"monitoring"`
  - `priority`: `"p0"`, `"p1"`, `"p2"`, `"p3"`

## Example

```yaml
documentTitle: Sales Operations Dashboard

agentGroups:
  - groupName: Sales Phase
    agents:
      - name: Lead Qualification Agent
        objective: Qualifies inbound leads using scoring criteria
        description: |
          Analyzes lead data from multiple sources, applies scoring rules,
          and routes qualified leads to sales team.
        tools: [Forms, RAG, Email]
        journeySteps:
          - Lead submission received
          - Data validation and enrichment
          - Scoring calculation
          - Qualification decision
        metrics:
          usageThisWeek: "45"
          timeSaved: "40%"
          roiContribution: High
        tags:
          department: sales
          status: active
          priority: p1

  - groupName: Customer Onboarding
    agents:
      - name: Customer Onboarding Agent
        objective: Automates customer data collection and validation
        description: |
          Handles complete onboarding workflow including data validation,
          document processing, and automated welcome communications.
        tools: [Forms, RAG, Email]
        journeySteps:
          - User initiates onboarding request
          - Agent collects customer information
          - Agent validates data completeness
          - Agent processes documents
          - Agent generates welcome package
        demoLink: https://demo.example.com/onboarding
        metrics:
          usageThisWeek: "150"
          timeSaved: "60%"
          roiContribution: High
        tags:
          department: sales
          status: active
          implementationStatus: deployed
          priority: p0
```

## Import Process

1. Use the "Upload" action in the canvas menu
2. Select a YAML file
3. Optionally override the canvas title
4. The importer creates a new canvas and bulk-creates all agents

## Notes

- Imported agents are stored in Convex with the canonical schema (no YAML round-trip)
- Tool names must match available tools (see `config.js` for canonical list)
- Metrics are converted to numeric format (`adoption`, `satisfaction`) for storage
- Tags are preserved as-is if they match the tag type definitions
- Phase information is derived from `groupName`
