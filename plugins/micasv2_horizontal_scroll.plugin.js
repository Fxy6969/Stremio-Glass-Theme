/**
 * @name Horizontal Scroll V2
 * @description Horizontal scroll with drag, wheel and keyboard support
 * @version 1.0.4
 * @author Micas
 */

(() => {
    const GRID_FLAG = 'enhanced-horizontal-grid-v2';
    const WHEEL_SPEED = 1.8;
    const DRAG_SPEED = 1.2;
    const KEY_SCROLL = 0.4;
    const SCROLL_EASE = 0.25; // ligeiramente mais responsivo

    function isLikelyGrid(el) {
        return el?.nodeType === 1 &&
            el.querySelectorAll('[class*="meta-item-container"], [class*="item-card"], [class*="card"], [role="listitem"]').length >= 3;
    }

    function computeIsCarousel(grid) {
        const cs = getComputedStyle(grid);
        return grid.scrollWidth > grid.clientWidth * 1.3 &&
               grid.scrollHeight <= grid.clientHeight * 1.2 &&
               !cs.display.includes('grid');
    }

    function enableGrid(grid) {
        if (grid[GRID_FLAG]) return;
        grid[GRID_FLAG] = true;
        grid.classList.add('enhanced-horizontal-scroll');

        let targetScroll = grid.scrollLeft;
        let rafId = null;
        let isDown = false;
        let middleMode = false;
        let startX = 0;
        let scrollLeft = 0;

        const animate = () => {
            const diff = targetScroll - grid.scrollLeft;
            if (Math.abs(diff) < 0.5) {
                grid.scrollLeft = targetScroll;
                rafId = null;
                return;
            }
            grid.scrollLeft += diff * SCROLL_EASE;
            rafId = requestAnimationFrame(animate);
        };

        const startAnimation = () => {
            if (rafId == null) rafId = requestAnimationFrame(animate);
        };

        const applyMode = () => {
            const carousel = computeIsCarousel(grid);
            grid.style.scrollBehavior = 'auto';
            if (!grid.style.gap) grid.style.gap = '12px';
            if (!grid.style.padding) grid.style.padding = '10px 12px';
            grid.style.webkitOverflowScrolling = 'touch';
            if (carousel) {
                grid.style.display = 'flex';
                grid.style.flexWrap = 'nowrap';
                grid.style.alignItems = 'flex-start';
                grid.style.overflowX = 'auto';
                grid.style.overflowY = 'hidden';
            } else {
                grid.style.display = '';
                grid.style.flexWrap = '';
                grid.style.alignItems = '';
                grid.style.overflowX = 'auto';
                grid.style.overflowY = 'auto';
            }
        };

        // WHEEL: vertical→horizontal quando carrossel ou middleMode
        grid.addEventListener('wheel', (e) => {
            const carouselNow = computeIsCarousel(grid);
            const shouldConvert = carouselNow || middleMode;
            if (!shouldConvert || e.shiftKey) return;
            if (middleMode || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                targetScroll = grid.scrollLeft + e.deltaY * WHEEL_SPEED;
                startAnimation();
            }
        }, { passive: false });

        // AUXCLICK: prevenir autoscroll middle-button
        grid.addEventListener('auxclick', (e) => {
            if (e.button === 1) e.preventDefault();
        });

        // POINTERDOWN: drag
        grid.addEventListener('pointerdown', (e) => {
            if (e.button === 1) middleMode = true;
            isDown = true;
            grid.classList.add('dragging');
            startX = e.clientX;
            scrollLeft = grid.scrollLeft;
            targetScroll = scrollLeft;
            e.preventDefault();
        });

        // POINTERMOVE
        window.addEventListener('pointermove', (e) => {
            if (!isDown) return;
            const x = e.clientX;
            targetScroll = scrollLeft + (startX - x) * DRAG_SPEED;
            startAnimation();
        });

        const clearPointer = () => {
            isDown = false;
            middleMode = false;
            grid.classList.remove('dragging');
        };
        window.addEventListener('pointerup', clearPointer);
        grid.addEventListener('pointerleave', clearPointer);

        // TECLADO
        grid.setAttribute('tabindex', '0');
        grid.addEventListener('keydown', (e) => {
            if (!computeIsCarousel(grid)) return;
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                targetScroll = grid.scrollLeft + grid.clientWidth * KEY_SCROLL;
                startAnimation();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                targetScroll = grid.scrollLeft - grid.clientWidth * KEY_SCROLL;
                startAnimation();
            }
        });

        // estilos globais
        if (!document.getElementById('enhanced-horizontal-grid-styles')) {
            const s = document.createElement('style');
            s.id = 'enhanced-horizontal-grid-styles';
            s.textContent = `
                .enhanced-horizontal-scroll.dragging { cursor: grabbing !important; user-select: none !important; }
                .enhanced-horizontal-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                .enhanced-horizontal-scroll::-webkit-scrollbar { display: none; }
            `;
            document.head.appendChild(s);
        }

        const mo = new MutationObserver(() => {
            applyMode();
            targetScroll = grid.scrollLeft;
        });
        mo.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        applyMode();
    }

    const scanAndEnable = () => {
        document.querySelectorAll(
            '[class*="catalog-grid"], [class*="items-container"], [class*="collection"], [class*="grid"], [class*="catalog-list"], [role="list"]'
        ).forEach(c => {
            try {
                if (isLikelyGrid(c)) enableGrid(c);
            } catch (e) {
                console.error("Grid init error:", e);
            }
        });
    };

    const observer = new MutationObserver(() => requestAnimationFrame(scanAndEnable));
    observer.observe(document.body, { childList: true, subtree: true });

    scanAndEnable();
})();
