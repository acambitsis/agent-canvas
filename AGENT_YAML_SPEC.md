# Agent YAML Specification

**Deprecated**: AgentCanvas is Convex-native. YAML is supported only as a **one-way legacy import** format.

```yaml
# REQUIRED
name: string              # Non-empty, trimmed

# OPTIONAL
agentNumber: number       # 1-indexed position (auto-generated)
objective: string         # One-line summary (default: "")
description: string       # Multiline with | or > (default: "")
tools: [string]           # From toolsConfig (default: [])
journeySteps: [string]    # 3-7 workflow steps (default: [])
demoLink: string          # URL (optional)
videoLink: string         # URL (optional)
badge: string             # "Handover", "New", "Beta" (optional)
metrics:                  # Object (not array)
  usageThisWeek: string   # e.g., "150" (default: "0")
  timeSaved: string       # e.g., "60%" (default: "0")
  roiContribution: string # "Very High"|"High"|"Medium"|"Low" (default: "Medium")
```

## Examples

**Complete:**
```yaml
name: Customer Onboarding Agent
objective: Automates customer data collection and validation
description: |
  Handles complete onboarding workflow including data validation,
  document processing, and automated welcome communications.
tools: [Forms, Documents, Analytics, Email]
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

**Minimal:**
```yaml
name: Basic Agent
```

## Guidelines

1. Always include `name`
2. Provide `objective` (one sentence), `description` (multiline with `|`)
3. Select 2-5 tools (Forms, Documents, Analytics, Email, Calendar, CRM, Database, API, Workflow, Reporting)
4. Include 3-7 `journeySteps`
5. Omit `agentNumber` (auto-generated)
6. Tool names are case-sensitive, must match `toolsConfig` keys

## Validation

- Missing/empty `name` → rejected
- Wrong types (`tools` as string, `metrics` as array) → rejected
- Invalid `roiContribution` → defaults to "Medium"
- Omitted fields → defaults (arrays: [], strings: "", metrics: defaults)
