export function setElementText(elementId, text = '') {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = text;
    }
}

export async function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        return false;
    }
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.warn('Clipboard copy failed:', error);
        return false;
    }
}

export function createDualViewController(config) {
    const updateUI = () => {
        const { formContentId, yamlContentId, formToggleId, yamlToggleId } = config.selectors;
        const mode = config.getMode();

        const formContent = document.getElementById(formContentId);
        const yamlContent = document.getElementById(yamlContentId);
        const formToggle = document.getElementById(formToggleId);
        const yamlToggle = document.getElementById(yamlToggleId);

        if (formContent) formContent.style.display = mode === 'form' ? 'block' : 'none';
        if (yamlContent) yamlContent.style.display = mode === 'yaml' ? 'block' : 'none';
        formToggle?.classList.toggle('active', mode === 'form');
        yamlToggle?.classList.toggle('active', mode === 'yaml');
    };

    const setView = mode => {
        if (mode === config.getMode()) return;

        if (mode === 'yaml') {
            if (!config.syncFromForm()) {
                alert(config.formReadError);
                return;
            }
            config.updateYamlEditor();
        } else {
            if (!config.applyFromYaml()) {
                alert(config.yamlValidationError);
                return;
            }
        }

        config.setMode(mode);
        updateUI();
    };

    const ensureStateFromCurrentView = () => (
        config.getMode() === 'yaml'
            ? config.applyFromYaml()
            : config.syncFromForm()
    );

    return { updateUI, setView, ensureStateFromCurrentView };
}
