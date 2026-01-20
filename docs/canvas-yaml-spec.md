# Canvas YAML Specification

Compact spec for LLM-generated agent canvas documents.

## Structure

```yaml
documentTitle: string (required, max 200 chars)
agentGroups:                    # optional, defaults to []
  - groupName: string           # optional, defaults to "Phase N", max 50 chars
    agents:                     # optional, defaults to []
      - name: string            # required, max 100 chars
        objective: string       # max 500 chars
        description: string     # max 1000 chars
        tools: [string]         # defaults to []
        journeySteps: [string]  # defaults to []
        demoLink: url
        videoLink: url
        metrics:
          numberOfUsers: number # >= 0
          timesUsed: number     # >= 0
          timeSaved: number     # >= 0, hours saved
          roi: number           # >= 0, currency value
        tags:
          department: string    # maps to "category" in database
          status: string        # e.g., "active", "draft", "deprecated"
```

## Rules

- `documentTitle`: Required. Canvas name, max 200 chars
- `agentGroups`: Optional. Array of phases/stages. Omit or use `[]` if empty
- `groupName`: Optional. Defaults to "Phase 1", "Phase 2", etc. Max 50 chars
- `name`: Required per agent. Max 100 chars
- `metrics`: All values must be numbers ≥ 0. Can also be numeric strings (e.g., `"42"`)
- `tags.department`: Maps to `category` field in database
- All other fields: Optional—omit if empty/unused

## Example

```yaml
documentTitle: Customer Onboarding Agents

agentGroups:
  - groupName: Initial Contact
    agents:
      - name: Lead Qualifier
        objective: Assess and score incoming leads based on fit criteria
        description: |
          Analyzes lead data from multiple sources, applies scoring rules,
          and routes qualified leads to the appropriate sales team.
        tools:
          - CRM
          - Email
          - Analytics
        journeySteps:
          - Receive lead notification
          - Pull company profile data
          - Calculate fit score
          - Route to sales or nurture
        demoLink: https://demo.example.com/lead-qualifier
        videoLink: https://videos.example.com/lead-qualifier-overview
        metrics:
          numberOfUsers: 12
          timesUsed: 450
          timeSaved: 120
          roi: 25000
        tags:
          department: Sales
          status: active

  - groupName: Account Setup
    agents:
      - name: Account Creator
        objective: Provision new customer accounts automatically
        tools:
          - Admin Portal
          - Billing System
        journeySteps:
          - Create account record
          - Set initial permissions
          - Generate welcome email
```
