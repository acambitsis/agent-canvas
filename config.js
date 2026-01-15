/**
 * Static tool and phase configurations
 * Canonical source for tool definitions and section color palette
 */

// Tool definitions with display metadata (label, color, icon)
export const TOOL_DEFINITIONS = {
  forms: { label: 'Forms', color: '#06B6D4', icon: 'file-input' },
  code: { label: 'Code', color: '#8B5CF6', icon: 'code-2' },
  rag: { label: 'RAG', color: '#F59E0B', icon: 'file-search' },
  'web-search': { label: 'Web Search', color: '#10B981', icon: 'globe' },
  'deep-research': { label: 'Deep Research', color: '#EC4899', icon: 'search' },
  context: { label: 'Context', color: '#EF4444', icon: 'database' },
  email: { label: 'Email', color: '#3B82F6', icon: 'mail' },
  calendar: { label: 'Calendar', color: '#6366F1', icon: 'calendar' },
  slack: { label: 'Slack', color: '#E11D48', icon: 'message-square' },
  api: { label: 'API', color: '#14B8A6', icon: 'plug' },
};

// Legacy TOOLS format (for backward compatibility with existing code)
export const TOOLS = {
    'Forms': {
        icon: 'file-input',
        colorKey: 'cyan'
    },
    'Code': {
        icon: 'code-2',
        colorKey: 'blue'
    },
    'RAG': {
        icon: 'file-search',
        colorKey: 'orange'
    },
    'Web Search': {
        icon: 'globe',
        colorKey: 'green'
    },
    'Deep Research': {
        icon: 'search',
        colorKey: 'purple'
    },
    'Context': {
        icon: 'database',
        colorKey: 'red'
    },
    'Email': {
        icon: 'mail',
        colorKey: 'blue'
    },
    'Calendar': {
        icon: 'calendar',
        colorKey: 'indigo'
    },
    'Slack': {
        icon: 'message-square',
        colorKey: 'pink'
    },
    'API': {
        icon: 'plug',
        colorKey: 'teal'
    }
};

/**
 * Get tool configuration with fallback (legacy format)
 */
export function getToolConfig(toolName) {
    return TOOLS[toolName] || {
        icon: 'box',
        colorKey: 'gray'
    };
}

/**
 * Get all available tool names
 */
export function getAvailableTools() {
    return Object.keys(TOOLS);
}

/**
 * Get tool display info (canonical format with hex colors)
 * @param {string} toolName - Tool name (case-insensitive, spaces normalized to hyphens)
 * @returns {object} { label, color, icon }
 */
export function getToolDisplay(toolName) {
  const normalized = toolName.toLowerCase().replace(/\s+/g, '-');
  return TOOL_DEFINITIONS[normalized] || {
    label: toolName,
    color: '#6B7280',
    icon: 'box'
  };
}

/**
 * Section color palette - cycles through for agent groups/phases
 * Canonical palette used across the app
 */
export const SECTION_COLOR_PALETTE = [
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
];

/**
 * Get section color from palette based on index
 */
export function getSectionColor(groupIndex) {
    return SECTION_COLOR_PALETTE[groupIndex % SECTION_COLOR_PALETTE.length];
}
