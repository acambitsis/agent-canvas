# TPS Agent Ecosystem Style Guide

## Overview
This document defines the design system and coding standards for the TPS Agent Ecosystem application. All future development should follow these guidelines to ensure consistency and maintainability.

---

## Color Palette

### Primary Colors
- **Deep Teal** `#0a3d4d` - Phase 1, Primary brand color
- **Medium Teal** `#1a5f73` - Phase 2
- **Light Teal** `#2a7f93` - Phase 3
- **Bright Teal** `#3a9fb3` - Phase 4
- **Sky Teal** `#4abfd3` - Phase 5
- **Interactive Teal** `#17a2b8` - CTAs, hover states, focus elements

### Functional Colors
- **Sales Red** `#e74c3c` - Sales phase indicator
- **Background Gradient** `linear-gradient(135deg, #0a3d4d 0%, #1a5f73 100%)`
- **Card Background** `#fafafa`
- **White** `#ffffff` - Cards, overlays
- **Dark Text** `#333`
- **Medium Gray** `#555`
- **Light Gray** `#f5f5f5` - Subtle backgrounds
- **Border Gray** `#e0e0e0`

### Tool Badge Colors
- **Forms** `#17a2b8`
- **Code** `#3776ab`
- **RAG** `#e67e22`
- **Web Search** `#27ae60`
- **Deep Research** `#8e44ad`
- **Context** `#c0392b`

---

## Icon System

### Icon Library
We use **Lucide Icons** (https://lucide.dev) exclusively. Load via CDN:
```html
<script src="https://unpkg.com/lucide@latest"></script>
```

### Icon Usage Patterns

#### Phase Icons
```html
<!-- Phase workflow icons -->
<i data-lucide="briefcase"></i>    <!-- Sales -->
<i data-lucide="target"></i>       <!-- Aspiration -->
<i data-lucide="search"></i>       <!-- Value Analysis -->
<i data-lucide="settings"></i>     <!-- New Ways -->
<i data-lucide="activity"></i>     <!-- Installation -->
<i data-lucide="refresh-cw"></i>   <!-- Sustain -->
<i data-lucide="wrench"></i>       <!-- Support -->
```

#### Tool Icons
```html
<!-- Tool type icons -->
<i data-lucide="clipboard-list"></i>  <!-- Forms -->
<i data-lucide="code-2"></i>          <!-- Code -->
<i data-lucide="file-text"></i>       <!-- RAG -->
<i data-lucide="globe"></i>           <!-- Web Search -->
<i data-lucide="search"></i>          <!-- Deep Research -->
<i data-lucide="book-open"></i>       <!-- Context -->
```

#### UI Action Icons
```html
<!-- Navigation and actions -->
<i data-lucide="map"></i>          <!-- Journey/Process -->
<i data-lucide="external-link"></i> <!-- External links -->
<i data-lucide="video"></i>        <!-- Video content -->
<i data-lucide="trending-up"></i>   <!-- Metrics/Analytics -->
<i data-lucide="eye"></i>          <!-- View/Focus mode -->
<i data-lucide="chevron-up"></i>   <!-- Collapse/Expand -->
<i data-lucide="user"></i>         <!-- User avatar -->
<i data-lucide="bot"></i>          <!-- AI/Bot avatar -->
```

### Icon Implementation Rules
1. Always use `data-lucide` attribute (not classes)
2. Initialize after dynamic content: `lucide.createIcons()`
3. Default size: 18px for inline, 24px for standalone
4. Stroke width: 2 for normal, 2.5 for emphasis

---

## Component Styling

### Cards
```css
.agent-card {
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    padding: 20px;
    background: #fafafa;
    transition: all 0.3s ease;
    cursor: pointer;
}

.agent-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.15);
    border-color: #17a2b8;
}
```

### Buttons & Interactive Elements
```css
.icon-panel-item {
    width: 36px;
    height: 36px;
    background: #f5f5f5;
    border-radius: 8px;
    transition: all 0.3s ease;
}

.icon-panel-item:hover {
    background: #17a2b8;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}
```

### Badges & Chips
```css
.tool-chip {
    padding: 5px 12px;
    border-radius: 16px;
    font-size: 0.85em;
    color: white;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
```

---

## Hover Effects

### Image Overlays
```css
/* Phase block hover images */
.phase-image-overlay {
    position: absolute;
    top: -250px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 200px;
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    padding: 10px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
    z-index: 1000;
    pointer-events: none;
}

/* Agent card icon hover images */
.icon-image-overlay {
    position: absolute;
    bottom: 50px;
    width: 250px;
    height: 180px;
    /* Similar properties as above */
}
```

### Tooltips
```css
.metrics-tooltip {
    position: fixed;
    background: linear-gradient(135deg, #ffffff, #f8f9fa);
    padding: 24px;
    border-radius: 16px;
    width: 340px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25);
    border: 1px solid rgba(0,0,0,0.08);
}
```

### Arrow Indicators
```css
/* Downward arrow for overlays */
.overlay::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid white;
}
```

---

## Animation Guidelines

### Standard Transitions
- **Quick interactions**: `transition: all 0.3s ease`
- **Card hovers**: `transition: all 0.3s ease`
- **Focus changes**: `transition: all 0.4s ease`
- **Transform on hover**: `transform: translateY(-5px)` or `scale(1.05)`

### Z-Index Hierarchy
- Base content: `auto`
- Floating cards: `10`
- Dropdowns: `100`
- Tooltips: `10000`
- Overlays: `1000`
- Modals: `10000`

---

## Typography

### Font Stack
```css
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
```

### Size Scale
- Headers: `3em` (main), `1.2em` (sub)
- Card titles: `1.1em`
- Body text: `1em`
- Small text: `0.9em`
- Tool badges: `0.85em`

---

## Responsive Design

### Breakpoints
- Desktop: `1600px` max container width
- Tablet: `1024px`
- Mobile: `768px`

### Grid Layouts
```css
.agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 20px;
}
```

---

## JavaScript Patterns

### Dynamic Icon Initialization
```javascript
// After adding dynamic content with icons
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}
```

### Tooltip Management
```javascript
// Show tooltip on hover
element.addEventListener('mouseenter', (e) => {
    tooltip.style.display = 'block';
    // Position calculation
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
});
```

### Image Mapping
```javascript
// Phase to image mapping
const phaseImages = {
    'Aspiration': 'img/aspiration.png',
    'Value Analysis': 'img/value-analysis.png',
    'New Ways': 'img/new-ways-of-working.png',
    'Installation': 'img/installation.png',
    'Sustain': 'img/sustain.png'
};
```

---

## File Structure

```
tps-agent-ecosystem/
├── data/
│   └── config.yaml          # Main configuration file (YAML)
├── img/
│   ├── aspiration.png
│   ├── value-analysis.png
│   ├── new-ways-of-working.png
│   ├── installation.png
│   └── sustain.png
├── index.html               # Main application (includes all JS)
└── claude.md                # This style guide
```

## Configuration-Driven Architecture

The application is **fully data-driven** from `data/config.yaml`. All content, styling, and behavior is configured through this single YAML file:

### YAML Configuration Structure

```yaml
# Tool definitions
toolsConfig:
  Forms:
    icon: clipboard-list
    class: tool-forms
    color: '#17a2b8'
  # ... more tools

# Agent groups and phases
agentGroups:
  - groupNumber: 0
    groupName: Sales & Pre-Engagement
    groupId: sales
    color: '#e74c3c'
    phaseImage: null
    showInFlow: true
    isSupport: false
    flowDisplayName: Sales
    agents:
      - agentNumber: 1
        name: TPS Opportunity Qualifier
        # ... agent details
```

### Dynamic Elements Generated from Config

1. **Flow Diagram** - Automatically generated from `agentGroups` with `showInFlow: true`
2. **Group Colors** - CSS dynamically injected from `color` field in each group
3. **Tool Chips** - Icons and colors from `toolsConfig` section
4. **Phase Images** - Loaded from `phaseImage` field
5. **Agent Cards** - All content from agent objects

### Adding New Content

To add a new agent or modify existing ones, simply edit `data/config.yaml`:

```yaml
# Add a new agent to any group
agents:
  - agentNumber: 20
    name: New Agent Name
    objective: What it does
    description: Detailed description
    tools:
      - Forms
      - Code
    journeySteps:
      - Step 1
      - Step 2
    metrics:
      usageThisWeek: 10 uses
      timeSaved: 50%
```

No code changes required - the application automatically renders everything from the config.

---

## Best Practices

### 1. Consistency
- Use established color variables
- Follow naming conventions (kebab-case for CSS, camelCase for JS)
- Maintain uniform spacing (8px grid system)

### 2. Performance
- Minimize reflows with transform instead of position changes
- Use CSS transitions instead of JavaScript animations
- Lazy load images where appropriate

### 3. Accessibility
- Include alt text for images
- Ensure color contrast ratios meet WCAG standards
- Provide keyboard navigation support

### 4. Code Quality
- Comment complex logic
- Use semantic HTML elements
- Keep specificity low in CSS selectors

---

## Future Enhancements

### Planned Features
1. Dark mode support (using CSS custom properties)
2. Enhanced animation system
3. Component library expansion
4. Improved mobile responsiveness

### Migration Path
When adding new features:
1. Reference this guide for styling
2. Test across all breakpoints
3. Ensure Lucide icon compatibility
4. Update this documentation

---

## Version History
- v1.0 (2025-11-07): Initial style guide creation based on current implementation

---

## Contact
For questions or updates to this guide, please reference the TPS Agent Ecosystem project documentation.