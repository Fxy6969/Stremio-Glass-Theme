/**
 * @name Horizontal Navigation
 * @description Moves your vertical navigation bar to a horizontal position.
 * @version 1.0.0
 * @author Fxy
 */

let cachedNavbars = new Map();

function moveNavbar(verticalNavbar, targetParent) {
    if (!verticalNavbar || !targetParent) return;
    if (verticalNavbar.parentElement !== targetParent) {
        verticalNavbar.style.visibility = "hidden";
        targetParent.appendChild(verticalNavbar);
        verticalNavbar.style.visibility = "visible";
    }
}

function fixAllNavbars() {
    const verticalNavbars = Array.from(document.querySelectorAll('[class*="vertical-nav-bar"]'));

    verticalNavbars.forEach(vNav => {
        if (!cachedNavbars.has(vNav) || !document.body.contains(cachedNavbars.get(vNav))) {
            cachedNavbars.set(vNav, vNav.parentElement);
        }
        const originalParent = cachedNavbars.get(vNav);

        const hNav = vNav.closest('div')?.querySelector('[class*="horizontal-nav-bar"]');
        const horizontalVisible = hNav?.offsetParent !== null;
        const originalVisible = originalParent?.offsetParent !== null;

        if (horizontalVisible) {
            moveNavbar(vNav, hNav);
            hNav.querySelectorAll("a").forEach(link => {
                link.querySelector("svg")?.remove();
                const label = link.querySelector("div");
                if (label) label.className = "nav-label";
            });
        } else if (!horizontalVisible && originalVisible) {
            moveNavbar(vNav, originalParent);
        }
    });
}

// fallback
let timeoutId;
const observer = new MutationObserver(() => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(fixAllNavbars, 50);
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true });
setInterval(fixAllNavbars, 20);

// Initial call
fixAllNavbars();