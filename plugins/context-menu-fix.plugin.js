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
        this.navMenuProcessed = new WeakSet();
        this.seasonDropdownProcessed = new WeakSet();
        this.init();
    }

    isNavMenuExpanded(buttonWrapper) {
        const menu = buttonWrapper?.querySelector?.('[class*="menu-container"]');
        if (!menu) return false;
        const inner = menu.querySelector?.('[class*="nav-menu-container"]') || menu;
        const rect = inner.getBoundingClientRect();
        return rect.height > 20 && rect.width > 10;
    }

    init() {
        // Start observing for context menus
        this.setupObserver();
        console.log('[ContextMenuFix] Plugin loaded successfully');
    }

    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.checkAndFixContextMenu(node);
                            this.checkAndFixSeasonDropdown(node);
                        }
                    });
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.checkAndFixSeasonDropdown(mutation.target);
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    findSeasonDropdown(element) {
        const el = element?.nodeType === Node.ELEMENT_NODE ? element : element?.parentElement;
        if (!el) return null;
        const cn = String(el.className || '');
        const isOpenDropdown = (el.getAttribute?.('role') === 'listbox' || cn.includes('dropdown')) && cn.includes('open');
        if (isOpenDropdown) return el;
        return el.querySelector?.('[role="listbox"][class*="open"], [class*="dropdown"][class*="open"]') || null;
    }

    isSeasonDropdownExpanded(dropdown) {
        if (!dropdown?.getBoundingClientRect) return false;
        const rect = dropdown.getBoundingClientRect();
        const hasOptions = dropdown.querySelector?.('[class*="option-"], .option-HcOSE');
        return rect.height > 25 && rect.width > 10 && !!hasOptions;
    }

    checkAndFixSeasonDropdown(element) {
        const dropdown = this.findSeasonDropdown(element);
        if (!dropdown) return;
        if (dropdown.closest('.context-menu-portal')) return;
        if (this.seasonDropdownProcessed.has(dropdown)) return;

        const tryMove = (attempt = 0) => {
            if (!dropdown.isConnected || dropdown.closest('.context-menu-portal')) return;
            if (this.seasonDropdownProcessed.has(dropdown)) return;
            if (this.isSeasonDropdownExpanded(dropdown)) {
                this.moveSeasonDropdownToBody(dropdown);
                return;
            }
            if (attempt < 5) {
                setTimeout(() => tryMove(attempt + 1), 35 + attempt * 30);
            }
        };
        requestAnimationFrame(() => requestAnimationFrame(() => tryMove(0)));
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

        // Nav menu (avatar dropdown) — bring to front so blur works; use real node so it can expand
        const isNavMenu = menuContainer.querySelector?.('.user-info-container-uigVE, [class*="user-info-container"]') ||
                         menuContainer.querySelector?.('.nav-menu-section-j87xd, [class*="nav-menu-section"]') ||
                         menuContainer.querySelector?.('.nav-menu-container-Pl25j, [class*="nav-menu-container"]');

        // Problematic container (side drawer, player, etc.)
        const problematicParent = menuContainer.closest('.side-drawer-r9EuA, [class*="side-drawer"], .series-content-VkYHB, [class*="series-content"], .player-container-wIELK, [class*="player-container"], .theater-container, .player-video');

        if (isNavMenu || problematicParent) {
            const asNav = !!isNavMenu;
            if (asNav) {
                const buttonWrapper = menuContainer.closest('.menu-button-container-DtW4v, [class*="menu-button-container"], .nav-menu-popup-label-XmUBo, [class*="nav-menu-popup-label"], .label-container-XOyzm') || menuContainer.parentElement;
                if (!buttonWrapper?.isConnected || buttonWrapper.closest('.context-menu-portal') || this.navMenuProcessed.has(buttonWrapper)) return;

                const tryMove = (attempt = 0) => {
                    if (!buttonWrapper.isConnected || buttonWrapper.closest('.context-menu-portal')) return;
                    if (this.navMenuProcessed.has(buttonWrapper)) return;
                    if (this.isNavMenuExpanded(buttonWrapper)) {
                        this.moveNavMenuToBody(buttonWrapper, menuContainer);
                        return;
                    }
                    if (attempt < 5) {
                        setTimeout(() => tryMove(attempt + 1), 35 + attempt * 30);
                    }
                };
                requestAnimationFrame(() => requestAnimationFrame(() => tryMove(0)));
            } else {
                this.moveMenuToBody(menuContainer, false);
            }
        }
    }

    moveNavMenuToBody(buttonWrapper, menuContainer) {
        if (!this.isNavMenuExpanded(buttonWrapper)) return;
        if (this.navMenuProcessed.has(buttonWrapper)) return;
        this.navMenuProcessed.add(buttonWrapper);

        const rect = buttonWrapper.getBoundingClientRect();
        const originalParent = buttonWrapper.parentElement;

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

        // Clone the whole button (trigger + expanded dropdown) so content is already there
        const buttonClone = buttonWrapper.cloneNode(true);
        buttonClone.style.position = 'fixed';
        buttonClone.style.top = `${rect.top}px`;
        buttonClone.style.left = `${rect.left}px`;
        buttonClone.style.zIndex = '2147483647';
        buttonClone.style.pointerEvents = 'auto';
        buttonClone.style.visibility = 'visible';
        buttonClone.style.opacity = '1';
        buttonClone.style.isolation = 'isolate';

        const menuInClone = buttonClone.querySelector('[class*="menu-container"]');
        if (menuInClone) {
            const inner = menuInClone.querySelector('.nav-menu-container-Pl25j, [class*="nav-menu-container"]') || menuInClone;
            inner.style.backdropFilter = 'blur(12px)';
            inner.style.webkitBackdropFilter = 'blur(12px)';
            const bg = getComputedStyle(inner).backgroundColor;
            if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
                inner.style.backgroundColor = 'rgba(26, 26, 26, 0.85)';
            }
        }

        wrapper.appendChild(buttonClone);
        document.body.appendChild(wrapper);

        buttonWrapper.style.pointerEvents = 'none';
        menuContainer.style.opacity = '0';
        menuContainer.style.pointerEvents = 'none';
        menuContainer.style.position = 'fixed';
        menuContainer.style.left = '-9999px';
        menuContainer.style.top = '0';

        const optionSelectors = '[class*="nav-menu-option-container"], [class*="logout-button-container"]';
        const cloneOptions = buttonClone.querySelectorAll(optionSelectors);
        const originalOptions = buttonWrapper.querySelectorAll(optionSelectors);
        cloneOptions.forEach((opt, i) => {
            opt.style.pointerEvents = 'auto';
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                if (originalOptions[i]) originalOptions[i].click();
                this.cleanupNavMenu(wrapper, buttonWrapper, menuContainer);
            });
        });
        buttonClone.querySelectorAll('a[href]').forEach((link, i) => {
            link.style.pointerEvents = 'auto';
            const origLinks = buttonWrapper.querySelectorAll('a[href]');
            if (origLinks[i]) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    origLinks[i].click();
                    this.cleanupNavMenu(wrapper, buttonWrapper, menuContainer);
                });
            }
        });

        const closeHandler = (e) => {
            if (!wrapper.contains(e.target)) {
                this.cleanupNavMenu(wrapper, buttonWrapper, menuContainer);
                document.removeEventListener('click', closeHandler, true);
                document.removeEventListener('contextmenu', closeHandler, true);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeHandler, true);
            document.addEventListener('contextmenu', closeHandler, true);
        }, 10);

        const removalObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === buttonWrapper || node.contains?.(buttonWrapper)) {
                        this.navMenuProcessed.delete(buttonWrapper);
                        if (wrapper.parentElement) wrapper.remove();
                        removalObserver.disconnect();
                    }
                });
            });
        });
        if (originalParent) removalObserver.observe(originalParent, { childList: true, subtree: true });

        console.log('[ContextMenuFix] Cloned whole nav button to body');
    }

    cleanupNavMenu(wrapper, buttonWrapper, menuContainer) {
        if (wrapper?.parentElement) wrapper.remove();
        if (buttonWrapper) {
            this.navMenuProcessed.delete(buttonWrapper);
            buttonWrapper.style.visibility = '';
            buttonWrapper.style.pointerEvents = '';
        }
        if (menuContainer?.style) {
            menuContainer.style.visibility = '';
            menuContainer.style.opacity = '';
            menuContainer.style.pointerEvents = '';
            menuContainer.style.position = '';
            menuContainer.style.left = '';
            menuContainer.style.top = '';
        }
    }

    moveSeasonDropdownToBody(dropdown) {
        if (!this.isSeasonDropdownExpanded(dropdown)) return;
        if (this.seasonDropdownProcessed.has(dropdown)) return;
        this.seasonDropdownProcessed.add(dropdown);

        const rect = dropdown.getBoundingClientRect();
        const originalParent = dropdown.parentElement;

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

        const clone = dropdown.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.top = `${rect.top}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.zIndex = '2147483647';
        clone.style.pointerEvents = 'auto';
        clone.style.visibility = 'visible';
        clone.style.opacity = '1';
        clone.style.isolation = 'isolate';
        clone.style.backdropFilter = 'blur(12px)';
        clone.style.webkitBackdropFilter = 'blur(12px)';
        clone.style.maxWidth = '125px';
        const bg = getComputedStyle(dropdown).backgroundColor;
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
            clone.style.backgroundColor = 'rgba(26, 26, 26, 0.9)';
        }

        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        dropdown.style.visibility = 'hidden';
        dropdown.style.opacity = '0';
        dropdown.style.pointerEvents = 'none';
        dropdown.style.position = 'fixed';
        dropdown.style.left = '-9999px';
        dropdown.style.top = '0';

        const optionSelector = '[class*="option-"], .option-HcOSE';
        const cloneOptions = clone.querySelectorAll(optionSelector);
        const originalOptions = dropdown.querySelectorAll(optionSelector);
        cloneOptions.forEach((opt, i) => {
            opt.style.pointerEvents = 'auto';
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                if (originalOptions[i]) originalOptions[i].click();
                this.cleanupSeasonDropdown(wrapper, dropdown);
            });
        });

        const closeHandler = (e) => {
            if (!wrapper.contains(e.target)) {
                this.cleanupSeasonDropdown(wrapper, dropdown);
                document.removeEventListener('click', closeHandler, true);
                document.removeEventListener('contextmenu', closeHandler, true);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeHandler, true);
            document.addEventListener('contextmenu', closeHandler, true);
        }, 10);

        const removalObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === dropdown || node.contains?.(dropdown)) {
                        this.seasonDropdownProcessed.delete(dropdown);
                        if (wrapper.parentElement) wrapper.remove();
                        removalObserver.disconnect();
                    }
                });
            });
        });
        if (originalParent) removalObserver.observe(originalParent, { childList: true, subtree: true });

        console.log('[ContextMenuFix] Cloned season dropdown to body');
    }

    cleanupSeasonDropdown(wrapper, dropdown) {
        if (wrapper?.parentElement) wrapper.remove();
        if (dropdown?.style) {
            this.seasonDropdownProcessed.delete(dropdown);
            dropdown.style.visibility = '';
            dropdown.style.opacity = '';
            dropdown.style.pointerEvents = '';
            dropdown.style.position = '';
            dropdown.style.left = '';
            dropdown.style.top = '';
        }
    }

    moveMenuToBody(menuContainer, isNavMenu = false) {
        const rect = menuContainer.getBoundingClientRect();
        const originalParent = menuContainer.parentElement;

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

        // Context menu: clone and hide original (keeps React refs intact)
        const menuClone = menuContainer.cloneNode(true);
        menuClone.style.position = 'fixed';
        menuClone.style.top = `${rect.top}px`;
        menuClone.style.left = `${rect.left}px`;
        menuClone.style.zIndex = '2147483647';
        menuClone.style.pointerEvents = 'auto';
        menuClone.style.visibility = 'visible';
        menuClone.style.opacity = '1';

        wrapper.appendChild(menuClone);
        document.body.appendChild(wrapper);

        menuContainer.style.visibility = 'hidden';
        menuContainer.style.opacity = '0';
        menuContainer.style.pointerEvents = 'none';
        menuContainer.style.position = 'fixed';
        menuContainer.style.left = '-9999px';
        menuContainer.style.top = '0';

        const options = menuClone.querySelectorAll('[class*="context-menu-option-container"]');
        options.forEach((option) => {
            option.style.pointerEvents = 'auto';
            option.addEventListener('click', (e) => {
                const originalOptions = menuContainer.querySelectorAll('[class*="context-menu-option-container"]');
                const index = Array.from(options).indexOf(option);
                if (originalOptions[index]) originalOptions[index].click();
                this.cleanup(wrapper, menuContainer);
            });
        });

        const closeHandler = (e) => {
            if (!wrapper.contains(e.target)) {
                this.cleanup(wrapper, menuContainer);
                document.removeEventListener('click', closeHandler, true);
                document.removeEventListener('contextmenu', closeHandler, true);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeHandler, true);
            document.addEventListener('contextmenu', closeHandler, true);
        }, 10);

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
