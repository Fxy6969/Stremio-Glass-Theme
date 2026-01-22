function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) return resolve(element);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        
        // Safe observation target
        const target = document.body || document.documentElement;
        observer.observe(target, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: ${selector}`));
        }, timeout);
    });
}

/**
 * @name Context Menu Fix
 * @description Fixes context menus appearing behind UI elements by moving them to the document root.
 * @version 1.0.0
 * @author MrBlu03
 */
class ContextMenuFix {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        // Start observing for context menus
        this.setupObserver();
        console.log('[ContextMenuFix] Plugin loaded successfully');
    }

    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.checkAndFixContextMenu(node);
                    }
                });
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    checkAndFixContextMenu(element) {
        // Check if this is a context menu or contains one (handle multiple class name variations)
        const isContextMenu = element.classList?.contains('menu-container-B6cqK') ||
                              element.classList?.contains('meta-item-menu') ||
                              element.classList?.contains('player-controls-menu') ||
                              element.querySelector?.('.menu-container-B6cqK') ||
                              element.querySelector?.('.meta-item-menu') ||
                              element.querySelector?.('.player-controls-menu') ||
                              element.classList?.contains('context-menu-content-ItIFy') ||
                              element.classList?.contains('context-menu-content-Xe_lN') ||
                              element.querySelector?.('[class*="context-menu-content"]') ||
                              element.hasAttribute?.('data-focus-lock-disabled');

        if (!isContextMenu) return;

        // Find the actual menu container
        let menuContainer = element;
        if (!element.classList?.contains('menu-container-B6cqK') &&
            !element.classList?.contains('meta-item-menu') &&
            !element.classList?.contains('player-controls-menu')) {
            menuContainer = element.querySelector?.('.menu-container-B6cqK') || 
                            element.querySelector?.('.meta-item-menu') ||
                            element.querySelector?.('.player-controls-menu') ||
                            element;
        }

        // Check if it's already a direct child of body or inside our portal
        if (menuContainer.parentElement === document.body) return;
        if (menuContainer.closest('.context-menu-portal')) return;

        // Check if it's inside a problematic container (side drawer, player, etc.)
        const problematicParent = menuContainer.closest('.side-drawer-r9EuA, [class*="side-drawer"], .series-content-VkYHB, [class*="series-content"], .player-container-wIELK, [class*="player-container"], .theater-container, .player-video');
        
        if (problematicParent) {
            this.moveMenuToBody(menuContainer);
        }
    }

    moveMenuToBody(menuContainer) {
        // Get current position before moving
        const rect = menuContainer.getBoundingClientRect();
        
        // Store original parent for potential cleanup
        const originalParent = menuContainer.parentElement;
        
        // Create a wrapper if needed to maintain React's DOM expectations
        const wrapper = document.createElement('div');
        wrapper.className = 'context-menu-portal';
        wrapper.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 2147483647;
        `;

        // Clone the menu to avoid breaking React's reference
        const menuClone = menuContainer.cloneNode(true);
        
        // Preserve all original classes and add positioning
        menuClone.style.position = 'fixed';
        menuClone.style.top = `${rect.top}px`;
        menuClone.style.left = `${rect.left}px`;
        menuClone.style.zIndex = '2147483647';
        menuClone.style.pointerEvents = 'auto';
        menuClone.style.visibility = 'visible';
        menuClone.style.opacity = '1';

        wrapper.appendChild(menuClone);
        document.body.appendChild(wrapper);

        // Hide the original (don't remove it to keep React happy)
        menuContainer.style.visibility = 'hidden';
        menuContainer.style.pointerEvents = 'none';

        // Add click handlers to the cloned menu options (handle multiple class variations)
        const options = menuClone.querySelectorAll('[class*="context-menu-option-container"]');
        options.forEach((option) => {
            option.style.pointerEvents = 'auto';
            option.addEventListener('click', (e) => {
                // Find and click the corresponding original option
                const originalOptions = menuContainer.querySelectorAll('[class*="context-menu-option-container"]');
                const index = Array.from(options).indexOf(option);
                if (originalOptions[index]) {
                    originalOptions[index].click();
                }
                // Clean up
                this.cleanup(wrapper, menuContainer);
            });
        });

        // Close menu when clicking outside
        const closeHandler = (e) => {
            if (!wrapper.contains(e.target)) {
                this.cleanup(wrapper, menuContainer);
                document.removeEventListener('click', closeHandler, true);
                document.removeEventListener('contextmenu', closeHandler, true);
            }
        };

        // Use capture to catch clicks before they bubble
        setTimeout(() => {
            document.addEventListener('click', closeHandler, true);
            document.addEventListener('contextmenu', closeHandler, true);
        }, 10);

        // Also watch for the original menu being removed
        const removalObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === menuContainer || node.contains?.(menuContainer)) {
                        this.cleanup(wrapper, null);
                        removalObserver.disconnect();
                    }
                });
            });
        });

        if (originalParent) {
            removalObserver.observe(originalParent, { childList: true, subtree: true });
        }

        console.log('[ContextMenuFix] Moved context menu to body');
    }

    cleanup(wrapper, originalMenu) {
        if (wrapper && wrapper.parentElement) {
            wrapper.remove();
        }
        if (originalMenu) {
            originalMenu.style.visibility = '';
            originalMenu.style.pointerEvents = '';
        }
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        // Clean up any remaining portals
        document.querySelectorAll('.context-menu-portal').forEach(el => el.remove());
    }
}

if (document.body) {
    new ContextMenuFix();
} else {
    const checkBody = () => {
        if (document.body) {
            new ContextMenuFix();
        } else {
            setTimeout(checkBody, 50);
        }
    };
    checkBody();
}
