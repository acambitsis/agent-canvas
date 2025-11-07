/**
 * TPS Operating System - Main Application Logic
 * Handles rendering, filtering, and interactive features
 */

class TPSApp {
    constructor() {
        this.agentsData = null;
        this.metricsData = null;
        this.activeFilter = null; // Will store phase filter when implemented
        this.init();
    }

    async init() {
        await this.loadData();
        this.renderAgentGroups();
        this.renderMetricsDashboard();
        this.setupEventListeners();
    }

    async loadData() {
        try {
            const [agentsResponse, metricsResponse] = await Promise.all([
                fetch('data/agents.json'),
                fetch('data/metrics.json')
            ]);
            this.agentsData = await agentsResponse.json();
            this.metricsData = await metricsResponse.json();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    renderAgentGroups() {
        const container = document.getElementById('agentGroupsContainer');
        if (!container || !this.agentsData) return;

        const groups = this.agentsData.agentGroups;
        const filteredGroups = this.activeFilter
            ? groups.filter(g => g.id === this.activeFilter)
            : groups;

        container.innerHTML = filteredGroups.map(group => this.createGroupHTML(group)).join('');

        // Re-initialize Lucide icons after rendering
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Setup tooltip positioning for newly rendered elements
        this.setupTooltipPositioning();
    }

    createGroupHTML(group) {
        const groupClass = `${group.id}-group`;
        return `
            <div class="agent-group ${groupClass}" data-group-id="${group.id}">
                <div class="group-header">
                    <div class="group-icon" style="background: ${group.color};"><i data-lucide="${group.icon}"></i></div>
                    <div class="group-title">
                        <h2>${group.name}</h2>
                        <span class="phase-tag" style="background: ${group.color};">${group.phaseTag}</span>
                    </div>
                </div>
                <div class="agents-grid">
                    ${group.agents.map(agent => this.createAgentHTML(agent)).join('')}
                </div>
            </div>
        `;
    }

    createAgentHTML(agent) {
        const statusInfo = this.agentsData.statusMapping[agent.status];
        const handoverBadge = agent.handover
            ? '<span class="handover-badge">CLIENT HANDOVER</span>'
            : '';

        // Use demo URL if available, otherwise use agent URL
        const externalLinkUrl = agent.hasDemo ? agent.demoUrl : agent.agentUrl;
        const externalLinkTitle = agent.hasDemo ? 'Try Demo' : 'Go to agent';

        return `
            <div class="agent-card" data-agent-id="${agent.id}">
                <div class="agent-number">${agent.id}</div>
                <h3>${agent.title}${handoverBadge}</h3>
                <div class="agent-objective">Objective: ${agent.objective}</div>
                <div class="agent-description">${agent.description}</div>
                <div class="tools-container">
                    ${agent.tools.map(tool => this.createToolChip(tool)).join('')}
                </div>
                <div class="icon-panel">
                    <div class="icon-panel-item journey-icon" data-agent-id="${agent.id}">
                        <i data-lucide="map"></i>
                        <div class="journey-tooltip">
                            <strong>User Journey:</strong><br>
                            ${agent.journey}
                        </div>
                    </div>
                    <a href="${externalLinkUrl}" target="_blank" class="icon-panel-item agent-link-icon" title="${externalLinkTitle}">
                        <i data-lucide="external-link"></i>
                    </a>
                    <a href="${agent.videoUrl}" class="icon-panel-item video-icon" title="Watch video overview">
                        <i data-lucide="video"></i>
                    </a>
                    <div class="icon-panel-item metrics-icon" data-agent-id="${agent.id}">
                        <i data-lucide="bar-chart-2"></i>
                        <div class="metrics-tooltip">
                            <div class="metrics-tooltip-header">
                                <h4>${agent.title}</h4>
                            </div>
                            <div class="metrics-tooltip-content">
                                <div class="metric-row">
                                    <span class="metric-label">Usage This Week</span>
                                    <span class="metric-value" style="margin-left: auto; font-size: 1.1em;">${agent.usageCount} uses</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Time Saved</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill time-saved" style="width: ${agent.metrics.timeSaved}%;"></div>
                                    </div>
                                    <span class="metric-value">${agent.metrics.timeSaved}%</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">ROI Contribution</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill roi-contribution" style="width: ${agent.metrics.roiContributionValue}%;"></div>
                                    </div>
                                    <span class="metric-value">${agent.metrics.roiContribution}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Adoption Complexity</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill adoption-complexity" style="width: ${agent.metrics.adoptionComplexityValue}%;"></div>
                                    </div>
                                    <span class="metric-value">${agent.metrics.adoptionComplexity}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createToolChip(toolName) {
        const tool = this.agentsData.toolMapping[toolName];
        if (!tool) return '';
        return `<span class="tool-chip ${tool.class}"><i data-lucide="${tool.icon}"></i> ${toolName}</span>`;
    }

    renderMetricsDashboard() {
        const container = document.getElementById('metricsDashboard');
        if (!container || !this.metricsData) return;

        const filteredMetrics = this.activeFilter
            ? this.metricsData.metrics.filter(m => m.groupId === this.activeFilter)
            : this.metricsData.metrics;

        container.innerHTML = filteredMetrics.map(metric => this.createMetricCardHTML(metric)).join('');

        // Re-initialize Lucide icons after rendering
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        this.observeMetrics();
    }

    createMetricCardHTML(metric) {
        return `
            <div class="metric-card">
                <div class="metric-header">
                    <span class="metric-icon"><i data-lucide="${metric.icon}"></i></span>
                    <h3>${metric.groupName}</h3>
                </div>
                <div class="metric-bars">
                    <div class="metric-row">
                        <span class="metric-label">Time Saved</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%;" data-value="${metric.timeSaved}%"></div>
                        </div>
                        <span class="metric-value">${metric.timeSaved}%</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">ROI Contribution</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%;" data-value="${metric.roiContribution}%"></div>
                        </div>
                        <span class="metric-value">${metric.roiLabel}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Adoption Complexity</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%;" data-value="${metric.adoptionComplexity}%"></div>
                        </div>
                        <span class="metric-value">${metric.complexityLabel}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Future feature: Filter by phase
    filterByPhase(phaseId) {
        this.activeFilter = this.activeFilter === phaseId ? null : phaseId;
        this.renderAgentGroups();
        this.renderMetricsDashboard();
        this.updateFlowBoxHighlights();
    }

    updateFlowBoxHighlights() {
        document.querySelectorAll('.flow-box, .flow-support-box').forEach(box => {
            if (this.activeFilter && box.dataset.group === this.activeFilter) {
                box.classList.add('active-filter');
            } else {
                box.classList.remove('active-filter');
            }
        });
    }

    // Toggle Functions
    toggleFlowDiagram(event) {
        const diagram = document.getElementById('flowDiagram');
        const btn = event.target.closest('button');

        if (diagram.style.display === 'none' || diagram.style.display === '') {
            diagram.style.display = 'block';
            btn.innerHTML = '<span class="toggle-icon">▲</span> Hide Flow Diagram';
        } else {
            diagram.style.display = 'none';
            btn.innerHTML = '<span class="toggle-icon">▼</span> Show Flow Diagram';
        }
    }

    // Simulator Functions
    openSimulator(agentNumber) {
        const modal = document.getElementById('simulatorModal');
        const agentName = agentNumber === 1 ? 'TPS Opportunity Qualifier' : 'Perfect Day Architect';
        document.getElementById('simulatorAgentName').textContent = agentName;

        this.currentConversation = this.conversations[agentNumber];
        this.currentMessageIndex = 0;

        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = '';

        modal.style.display = 'block';
        this.nextMessage();
    }

    nextMessage() {
        if (this.currentMessageIndex < this.currentConversation.length) {
            const message = this.currentConversation[this.currentMessageIndex];
            const chatContainer = document.getElementById('chatContainer');

            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${message.type}-message`;

            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.textContent = message.type === 'user' ? '👤' : '🤖';

            const content = document.createElement('div');
            content.className = 'message-content';
            content.textContent = message.text;

            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
            chatContainer.appendChild(messageDiv);

            chatContainer.scrollTop = chatContainer.scrollHeight;
            this.currentMessageIndex++;
        }
    }

    resetSimulator() {
        this.currentMessageIndex = 0;
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = '';
        this.nextMessage();
    }

    closeSimulator() {
        const modal = document.getElementById('simulatorModal');
        modal.style.display = 'none';
        this.currentMessageIndex = 0;
        this.currentConversation = [];
    }

    // Observers
    observeMetrics() {
        const metricsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const progressBars = entry.target.querySelectorAll('.progress-fill');
                    progressBars.forEach(bar => {
                        bar.style.width = bar.dataset.value;
                    });
                    metricsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        const dashboard = document.querySelector('.metrics-dashboard');
        if (dashboard) metricsObserver.observe(dashboard);
    }

    observeFadeIn() {
        const fadeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                    fadeObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.agent-group, .agent-card').forEach(el => {
            fadeObserver.observe(el);
        });
    }

    setupFlowBoxInteractions() {
        const flowBoxes = document.querySelectorAll('.flow-box, .flow-support-box');
        const agentGroups = document.querySelectorAll('.agent-group');

        const groupMapping = {
            'sales': 0,
            'aspiration': 1,
            'value': 2,
            'working': 3,
            'installation': 4,
            'sustain': 5,
            'support': 6
        };

        flowBoxes.forEach(box => {
            box.addEventListener('click', () => {
                const group = box.dataset.group;

                // Future feature: uncomment to enable filtering
                // this.filterByPhase(group);

                // Current behavior: scroll and highlight
                flowBoxes.forEach(b => b.classList.remove('highlighted'));
                agentGroups.forEach(g => g.style.border = 'none');

                box.classList.add('highlighted');
                if (groupMapping[group] !== undefined) {
                    const targetGroup = agentGroups[groupMapping[group]];
                    targetGroup.style.border = '4px solid #17a2b8';
                    targetGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    setTimeout(() => {
                        box.classList.remove('highlighted');
                        targetGroup.style.border = 'none';
                    }, 3000);
                }
            });
        });
    }

    setupEventListeners() {
        // Modal close on outside click
        window.onclick = (event) => {
            const modal = document.getElementById('simulatorModal');
            if (event.target === modal) {
                this.closeSimulator();
            }
        };

        // Setup flow box interactions
        this.setupFlowBoxInteractions();

        // Observe for fade-in animations
        this.observeFadeIn();

        // Setup tooltip positioning for hardcoded cards in HTML
        this.setupTooltipPositioning();
    }

    setupTooltipPositioning() {
        // Handle journey tooltips
        const journeyIcons = document.querySelectorAll('.journey-icon');
        console.log('Found journey icons:', journeyIcons.length);

        journeyIcons.forEach(icon => {
            const tooltip = icon.querySelector('.journey-tooltip');
            if (!tooltip) {
                console.log('No tooltip found for journey icon');
                return;
            }

            icon.addEventListener('mouseenter', () => {
                console.log('Journey icon hovered');
                this.showTooltip(icon, tooltip);
            });

            icon.addEventListener('mouseleave', () => {
                this.hideTooltip(tooltip);
            });
        });

        // Handle metrics tooltips
        const metricsIcons = document.querySelectorAll('.metrics-icon');
        console.log('Found metrics icons:', metricsIcons.length);

        metricsIcons.forEach(icon => {
            const tooltip = icon.querySelector('.metrics-tooltip');
            if (!tooltip) {
                console.log('No tooltip found for metrics icon');
                return;
            }

            icon.addEventListener('mouseenter', () => {
                console.log('Metrics icon hovered');
                this.showTooltip(icon, tooltip);
            });

            icon.addEventListener('mouseleave', () => {
                this.hideTooltip(tooltip);
            });
        });
    }

    showTooltip(icon, tooltip) {
        console.log('showTooltip called');

        // First, make it visible but off-screen to measure it
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'hidden';
        tooltip.style.left = '-9999px';
        tooltip.style.top = '0px';

        // Force a reflow to get accurate measurements
        tooltip.offsetHeight;

        const iconRect = icon.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;

        console.log('Icon rect:', iconRect);
        console.log('Tooltip size:', tooltipWidth, 'x', tooltipHeight);

        // Calculate position - default is above the icon
        let top = iconRect.top - tooltipHeight - 10;
        let left = iconRect.left + (iconRect.width / 2) - (tooltipWidth / 2);

        // Check if tooltip goes off the left edge
        if (left < 10) {
            left = 10;
        }

        // Check if tooltip goes off the right edge
        if (left + tooltipWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipWidth - 10;
        }

        // Check if tooltip goes off the top edge, if so position below
        if (top < 10) {
            top = iconRect.bottom + 10;
        }

        console.log('Final position:', top, left);

        // Apply final position and make visible
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.visibility = 'visible';

        console.log('Tooltip should be visible now');
    }

    hideTooltip(tooltip) {
        tooltip.style.display = 'none';
    }

    // Simulator conversations data
    conversations = {
        1: [
            { type: 'agent', text: 'Hello! I\'m the TPS Opportunity Qualifier. I\'ll help assess if TPS is a good fit for your organization. Let\'s start with some questions.' },
            { type: 'agent', text: 'What are the main operational challenges you\'re currently facing?' },
            { type: 'user', text: 'We\'re struggling with production downtime and inconsistent output quality.' },
            { type: 'agent', text: 'Thank you. Those are common pain points we address. Can you quantify the impact? For example, what percentage of production time is lost to downtime?' },
            { type: 'user', text: 'We estimate about 15-20% downtime, and quality issues affect roughly 8% of our output.' },
            { type: 'agent', text: 'Based on industry benchmarks, I\'m calculating potential improvements...' },
            { type: 'agent', text: '📊 Preliminary Assessment:\n• Potential throughput increase: 12-18%\n• Quality improvement opportunity: 5-7%\n• Estimated ROI: 3.5-4.5x project cost\n• TPS Fit Score: 8.5/10 - Strong Candidate' },
            { type: 'agent', text: 'Would you like me to generate a detailed opportunity sizing report?' }
        ],
        8: [
            { type: 'agent', text: 'Hi! I\'m the Perfect Day Architect. I design customized Perfect Day routines that integrate MOS cycles and Active Management Behaviors.' },
            { type: 'agent', text: 'Tell me about your operation. What shift patterns do you run?' },
            { type: 'user', text: 'We run three 8-hour shifts, 24/7 operation in automotive parts manufacturing.' },
            { type: 'agent', text: 'Perfect. And what are your key operational activities during a shift?' },
            { type: 'user', text: 'Production runs, quality checks, shift handovers, maintenance windows, and daily production meetings.' },
            { type: 'agent', text: 'Excellent. I\'m designing a Perfect Day model that embeds LEAN principles...' },
            { type: 'agent', text: '⚙️ Perfect Day Design:\n\n**Shift Start (0:00-0:30)**\n• Safety briefing & Gemba walk\n• Review production schedule\n• Check equipment status\n\n**Production Block 1 (0:30-2:00)**\n• Execute standard work\n• Hourly quality checks\n• Real-time problem solving\n\n**Mid-Shift Review (2:00-2:15)**\n• Performance vs. target\n• Adjust resources if needed\n\n**Production Block 2 (2:15-4:00)**\n• Continue execution\n• Document variances\n\n**And so on...**' },
            { type: 'agent', text: 'This integrates all 8 Active Management Behaviors. Would you like me to generate the full Perfect Day implementation guide?' }
        ]
    };
}

// Initialize app when DOM is ready
let tpsApp;
document.addEventListener('DOMContentLoaded', () => {
    tpsApp = new TPSApp();
});

// Expose functions to global scope for onclick handlers
function toggleFlowDiagram(event) {
    if (tpsApp) tpsApp.toggleFlowDiagram(event);
}

function openSimulator(agentNumber) {
    if (tpsApp) tpsApp.openSimulator(agentNumber);
}

function nextMessage() {
    if (tpsApp) tpsApp.nextMessage();
}

function resetSimulator() {
    if (tpsApp) tpsApp.resetSimulator();
}

function closeSimulator() {
    if (tpsApp) tpsApp.closeSimulator();
}
