/**
 * Shared menu controller utilities
 * Handles toggle, aria-expanded, and click-outside dismissal for dropdown menus
 */

/**
 * Bind a toggle menu with click-outside dismissal
 * @param {Object} options
 * @param {HTMLElement} options.buttonEl - Button that toggles the menu
 * @param {HTMLElement} options.menuEl - Menu element to show/hide
 * @param {string} [options.openClass='open'] - CSS class to toggle
 * @param {Function} [options.onAction] - Callback when action button is clicked (receives action string)
 * @param {string} [options.actionSelector='button[data-action]'] - Selector for action buttons
 * @param {Function} [options.onClose] - Callback when menu closes
 * @returns {Function} Cleanup function to remove event listeners
 */
export function bindToggleMenu({ buttonEl, menuEl, openClass = 'open', onAction, actionSelector = 'button[data-action]', onClose }) {
    if (!buttonEl || !menuEl) return () => {};

    function openMenu() {
        menuEl.classList.add(openClass);
        buttonEl.setAttribute('aria-expanded', 'true');
    }

    function closeMenuInternal() {
        menuEl.classList.remove(openClass);
        buttonEl.setAttribute('aria-expanded', 'false');
        if (onClose) onClose();
    }

    function toggleMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (menuEl.classList.contains(openClass)) {
            closeMenuInternal();
        } else {
            openMenu();
        }
    }

    function handleClickOutside(event) {
        if (!menuEl.classList.contains(openClass)) return;
        if (menuEl.contains(event.target) || buttonEl.contains(event.target)) return;
        closeMenuInternal();
    }

    function handleMenuClick(event) {
        const actionButton = event.target.closest(actionSelector);
        if (actionButton) {
            event.preventDefault();
            // Extract action value from any data-* attribute in the selector
            // Supports: data-action, data-board-action, data-tag-type, data-org-id, etc.
            let action = null;
            for (const key of Object.keys(actionButton.dataset)) {
                if (actionButton.dataset[key]) {
                    action = actionButton.dataset[key];
                    break;
                }
            }
            if (action) {
                closeMenuInternal();
                onAction(action);
            }
            return;
        }

        // Handle menu links (allow default navigation)
        const menuLink = event.target.closest('a.menu-link');
        if (menuLink) {
            closeMenuInternal();
        }
    }

    // Bind events
    buttonEl.addEventListener('click', toggleMenu);
    document.addEventListener('click', handleClickOutside);
    if (onAction) {
        menuEl.addEventListener('click', handleMenuClick);
    }

    // Return cleanup function
    return function cleanup() {
        buttonEl.removeEventListener('click', toggleMenu);
        document.removeEventListener('click', handleClickOutside);
        if (onAction) {
            menuEl.removeEventListener('click', handleMenuClick);
        }
    };
}

/**
 * Close a menu programmatically
 * @param {HTMLElement} menuEl - Menu element
 * @param {HTMLElement} buttonEl - Button element (optional, for aria-expanded)
 * @param {string} [openClass='open'] - CSS class to remove
 */
export function closeMenu(menuEl, buttonEl, openClass = 'open') {
    if (menuEl) {
        menuEl.classList.remove(openClass);
    }
    if (buttonEl) {
        buttonEl.setAttribute('aria-expanded', 'false');
    }
}
