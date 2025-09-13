/**
 * @name Horizontal Scroll 
 * @description Horizontal scroll with drag, wheel, and keyboard
 * @version 1.0.4 
 * @author Micas
 */

(() => {
    const GRID_FLAG = 'enhanced-horizontal-grid-v3';
    const WHEEL_SPEED = 1.8;
    const DRAG_SPEED = 1.2;
    const KEY_SCROLL_RATIO = 0.5; // % da largura do container
    const SCROLL_EASE = 0.2;

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
        let isAnimating = false;
        let isDown = false;
        let middleMode = false;
        let startX = 0;
        let scrollLeft = 0;

        const animate = () => {
            if (!isAnimating) return;
            const diff = targetScroll - grid.scrollLeft;
            if (Math.abs(diff) < 0.5) { 
                grid.scrollLeft = targetScroll; 
                isAnimating = false; 
                return; 
            }
            grid.scrollLeft += diff * SCROLL_EASE;
            requestAnimationFrame(animate);
        };

        const startAnimation = () => { if (!isAnimating) { isAnimating = true; animate(); } };

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
                targetScroll += e.deltaY * WHEEL_SPEED;
                startAnimation();
            }
        }, { passive: false });

        // AUXCLICK: prevenir autoscroll middle-button
        grid.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

        // POINTERDOWN: drag com qualquer botão do mouse
        grid.addEventListener('pointerdown', (e) => {
            if (e.button === 1) middleMode = true;

            isDown = true;
            grid.classList.add('dragging');
            startX = e.clientX;
            scrollLeft = targetScroll = grid.scrollLeft;
            e.preventDefault();
        });

        // POINTERMOVE: drag horizontal sempre ativo
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

        // TECLADO: sempre ativado se grid tem scroll horizontal
        grid.setAttribute('tabindex', '0');
        grid.addEventListener('keydown', (e) => {
            const width = grid.clientWidth * KEY_SCROLL_RATIO;
            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    targetScroll += width;
                    startAnimation();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    targetScroll -= width;
                    startAnimation();
                    break;
                case 'Home':
                    e.preventDefault();
                    targetScroll = 0;
                    startAnimation();
                    break;
                case 'End':
                    e.preventDefault();
                    targetScroll = grid.scrollWidth;
                    startAnimation();
                    break;
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
            targetScroll = Math.max(0, Math.min(grid.scrollWidth, grid.scrollLeft));
        });
        mo.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        applyMode();
    }

    const scanAndEnable = () => {
        document.querySelectorAll(
            '[class*="catalog-grid"], [class*="items-container"], [class*="collection"], [class*="grid"], [class*="catalog-list"], [role="list"]'
        ).forEach(c => { 
            try { if (isLikelyGrid(c)) enableGrid(c); } catch (e) { console.error(e); }
        });
    };

    const observer = new MutationObserver(() => requestAnimationFrame(scanAndEnable));
    observer.observe(document.body, { childList: true, subtree: true });

    scanAndEnable();
})();

})();

