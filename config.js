/**
 * Static tool and phase configurations
 * This replaces the toolsConfig section from YAML
 */

export const TOOLS = {
    'Forms': {
        icon: 'clipboard-list',
        colorKey: 'cyan'
    },
    'Code': {
        icon: 'code-2',
        colorKey: 'blue'
    },
    'RAG': {
        icon: 'file-text',
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
        icon: 'book-open',
        colorKey: 'red'
    }
};

/**
 * Get tool configuration with fallback
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
 * Section color palette - cycles through for agent groups
 */
export const SECTION_COLOR_PALETTE = [
    '#1a5f73',  // Teal
    '#2c5f8d',  // Blue
    '#5f4a8b',  // Purple
    '#8b4a6f',  // Magenta
    '#8b5f4a',  // Brown
    '#4a8b5f',  // Green
    '#8b7a4a',  // Gold
    '#4a6f8b'   // Steel Blue
];

/**
 * Get section color from palette based on index
 */
export function getSectionColor(groupIndex) {
    return SECTION_COLOR_PALETTE[groupIndex % SECTION_COLOR_PALETTE.length];
}
