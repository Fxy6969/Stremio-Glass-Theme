/**
 * @name Move Progress Bar
 * @description Moves the progress bar into the title container.
 * @version 1.0.0
 * @author Fxy
 */

(() => {
    function moveAllProgressBars() {
        const metaItems = document.querySelectorAll('[class*="meta-item-container"]');

        metaItems.forEach(item => {
            const posterBar = item.querySelector('[class*="poster-container"] [class*="progress-bar-layer"]');
            const titleContainer = item.querySelector('[class*="title-bar-container"]');

            if (!posterBar || !titleContainer) return;

            // Only move if it hasn't already been moved
            if (posterBar.parentElement === titleContainer) return;

            titleContainer.insertBefore(posterBar, titleContainer.firstChild);
        });
    }

    setTimeout(moveAllProgressBars, 500);

    const observer = new MutationObserver(moveAllProgressBars);
    observer.observe(document.body, { childList: true, subtree: true });
})();

