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
        
        const target = document.body || document.documentElement;
        observer.observe(target, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: ${selector}`));
        }, timeout);
    });
}

/**
 * @name Enhanced Video Player
 * @description Enhances the video player with additional features and designs.
 * @version 1.0.0
 * @author Fxy
 */
class EnhancedPlayer {
    constructor() {
        this.init();
    }
   
    init() {
        waitForElement('.player-container, .theater-container, .player-video').then(() => {
             this.splitAndMoveTitles();
             this.addCustomButton();
        }).catch(() => console.log("Player not found immediately"));

        setTimeout(() => {
            this.splitAndMoveTitles();
            this.addCustomButton();
        }, 500);
        const observer = new MutationObserver(() => {
            this.splitAndMoveTitles();
            this.addCustomButton();
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    addCustomButton() {
        const controlBarSelectors = [
            '.control-bar-buttons-menu-container-M6L0_',
            "[class*='control-bar-buttons']",
            "[class*='control-bar'] [class*='buttons']",
            ".control-bar-container-xsWA7 [class*='buttons']",
            ".player-controls",
            ".player-ui"
        ];

        let controlBarContainer = null;
        for (const selector of controlBarSelectors) {
            controlBarContainer = document.querySelector(selector);
            if (controlBarContainer) break;
        }

        if (!controlBarContainer) {
            return;
        }

        if (controlBarContainer.querySelector('.custom-enhanced-button')) {
            return;
        }

        const customButton = document.createElement('div');
        customButton.tabIndex = -1;
        customButton.className = 'control-bar-button-FQUsj button-container-zVLH6 custom-enhanced-button';
        
        customButton.innerHTML = `
            <svg class="icon-qy6I6 custom-icon" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"><g fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.25 18.25h-3.5a3 3 0 0 1-3-3v-8.5a3 3 0 0 1 3-3h12.5a3 3 0 0 1 3 3v3.5"/><rect width="12" height="10" x="11" y="12" fill="currentColor" rx="2"/></g></svg>
        `;

        customButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCustomButtonClick();
        });

        customButton.addEventListener('mouseenter', () => {
            customButton.style.opacity = '0.8';
        });

        customButton.addEventListener('mouseleave', () => {
            customButton.style.opacity = '1';
        });

        controlBarContainer.insertAdjacentElement("afterbegin", customButton);
    }

    handleCustomButtonClick() {
         if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(err => {
                console.error('Failed to exit Picture-in-Picture:', err);
            });
        } else {
            const videoElement = document.querySelector('video');
            if (videoElement) {
                videoElement.requestPictureInPicture().catch(err => {
                    console.error('Failed to enter Picture-in-Picture:', err);
                });
            }
        }
    }
    
    splitAndMoveTitles() {
        const titleSelectors = [
            // Meta/info elements that typically have the actual title
            // Note: Be specific to avoid matching data-enrichment cast/crew names
            ".meta-info-container > [class*='name']:not(.enhanced-cast-name):not(.enhanced-cast-character)",
            ".meta-info-container > [class*='title']:not(.enhanced-section-header)",
            "[class*='meta-preview'] > [class*='name']:not(.enhanced-cast-name)",
            "[class*='meta-preview'] > [class*='title']:not(.enhanced-section-header)",
            "[class*='side-drawer'] > [class*='name']:not(.enhanced-cast-name)",
            "[class*='side-drawer'] .logo-X3hTV",
            // Standard title locations
            "h2.title-DGh6h",
            ".title-DGh6h",
            "[class*='title-bar'] h2",
            ".nav-bar-container h2",
            "#app > div.router-_65XU.routes-container > div:nth-child(3) > div.route-content > div > nav > h2",
            "nav h2[class*='title']",
        ];
        
        // Also try to get title from document title or URL
        let fallbackTitle = null;
        const docTitle = document.title;
        if (docTitle && !docTitle.toLowerCase().includes('stremio') && docTitle.length > 3) {
            fallbackTitle = docTitle.replace(' - Stremio', '').replace('Stremio - ', '').trim();
        }
       
        let titleElement = null;
        let titleText = null;
        
        for (const selector of titleSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                // Skip elements inside data enrichment sections
                if (el.closest('.enhanced-cast-section') || 
                    el.closest('.enhanced-similar-section') || 
                    el.closest('.enhanced-collection-section') ||
                    el.closest('.enhanced-content-wrapper') ||
                    el.closest('[class*="enhanced-"]')) {
                    continue;
                }
                
                const text = el.textContent || el.alt || el.title;
                if (text && this.isValidTitle(text)) {
                    titleElement = el;
                    titleText = text.trim();
                    break;
                }
            }
            if (titleElement) break;
        }
        
        // Use fallback title if no valid title found from elements
        if (!titleText && fallbackTitle && this.isValidTitle(fallbackTitle)) {
            titleText = fallbackTitle;
        }
       
        const containerSelectors = [
            ".control-bar-container-xsWA7",
            "div[class*='control-bar-container']",
            "div[class*='control-bar-layer']",
            "#app > div.router-_65XU.routes-container > div:nth-child(2) > div.route-content > div > div.layer-qalDW.control-bar-layer-m2jto.control-bar-container-xsWA7",
            ".video-player-controls",
            ".player-ui",
            ".player-controls"
        ];
       
        let targetContainer = null;
        for (const selector of containerSelectors) {
            targetContainer = document.querySelector(selector);
            if (targetContainer) break;
        }
       
        if (!titleText || !targetContainer) {
            return;
        }

        if (targetContainer.querySelector('.custom-series-name') || targetContainer.querySelector('.custom-movie-title')) {
            return;
        }
        
        // Try multiple regex patterns for different title formats
        // Pattern 1: "Series Name: Episode Title - Description (1x01)"
        let match = titleText.match(/^(.+?): (.+?) - (.+?) \((\d+x\d+)\)$/);
        
        // Pattern 2: "Series Name - Episode Title (1x01)"
        if (!match) {
            match = titleText.match(/^(.+?) - (.+?) \((\d+x\d+)\)$/);
            if (match) {
                const [, seriesName, episodeTitle, seasonEpisode] = match;
                
                const seriesDiv = document.createElement('div');
                seriesDiv.className = 'custom-series-name';
                seriesDiv.textContent = seriesName;
                
                const episodeDiv = document.createElement('div');
                episodeDiv.className = 'custom-episode-title';
                episodeDiv.textContent = `${episodeTitle} (${seasonEpisode})`;
                
                targetContainer.insertBefore(seriesDiv, targetContainer.firstChild);
                targetContainer.insertBefore(episodeDiv, seriesDiv.nextSibling);
                
                if (titleElement) titleElement.style.display = 'none';
                return;
            }
        }
        
        // Pattern 3: "Series Name (1x01) Episode Title"
        if (!match) {
            match = titleText.match(/^(.+?) \((\d+x\d+)\) (.+?)$/);
            if (match) {
                const [, seriesName, seasonEpisode, episodeTitle] = match;
                
                const seriesDiv = document.createElement('div');
                seriesDiv.className = 'custom-series-name';
                seriesDiv.textContent = seriesName;
                
                const episodeDiv = document.createElement('div');
                episodeDiv.className = 'custom-episode-title';
                episodeDiv.textContent = `${episodeTitle} (${seasonEpisode})`;
                
                targetContainer.insertBefore(seriesDiv, targetContainer.firstChild);
                targetContainer.insertBefore(episodeDiv, seriesDiv.nextSibling);
                
                if (titleElement) titleElement.style.display = 'none';
                return;
            }
        }

        // Original pattern match
        if (match && match.length === 5) {
            const [, seriesName, episodeTitle, description, seasonEpisode] = match;
           
            const seriesDiv = document.createElement('div');
            seriesDiv.className = 'custom-series-name';
            seriesDiv.textContent = `${description} (${seasonEpisode})`;
           
            const episodeDiv = document.createElement('div');
            episodeDiv.className = 'custom-episode-title';
            episodeDiv.textContent = `${seriesName}: ${episodeTitle}`;
           
            targetContainer.insertBefore(seriesDiv, targetContainer.firstChild);
            targetContainer.insertBefore(episodeDiv, seriesDiv.nextSibling);
           
            if (titleElement) titleElement.style.display = 'none';
            return;
        }

        // Fallback: Just display the title as-is (for movies or unrecognized formats)
        if (titleText && titleText.length > 0) {
            const movieDiv = document.createElement('div');
            movieDiv.className = 'custom-series-name';
            movieDiv.textContent = titleText;
            
            targetContainer.insertBefore(movieDiv, targetContainer.firstChild);
            if (titleElement) titleElement.style.display = 'none';
        }
    }
   
    isValidTitle(text) {
        if (!text || text.trim().length === 0) {
            return false;
        }
        
        const trimmed = text.trim();
        
        // Exclude common non-title patterns (stream sources, addon names, quality tags)
        const invalidPatterns = [
            /torrentio/i,
            /^\[RD/i,           // Real-Debrid source tags
            /^\[AD/i,           // AllDebrid source tags  
            /^\[PM/i,           // Premiumize source tags
            /^\[DL/i,           // Direct link tags
            /\[.*debrid.*\]/i,  // Any debrid in brackets
            /^\[.*\]\s*torrentio/i,
            /^\[.*\]$/,         // Just bracketed text
            /^http/i,
            /\.torrent$/i,
            /^magnet:/i,
            /debrid/i,
            /1080p/i,           // Quality indicators
            /720p/i,
            /2160p/i,
            /4k\b/i,
            /HDR/i,
            /HEVC/i,
            /x264/i,
            /x265/i,
            /WEB-?DL/i,
            /BluRay/i,
            /BRRip/i,
            /stream/i,
            /addon/i,
        ];
        
        for (const pattern of invalidPatterns) {
            if (pattern.test(trimmed)) {
                return false;
            }
        }
        
        // Valid if it looks like a series title (has season/episode marker)
        if (trimmed.includes('x') && /\d+x\d+/.test(trimmed)) {
            return true;
        }
        
        // Valid if it has reasonable length and structure for a movie/show title
        if (trimmed.length >= 2 && trimmed.length <= 200) {
            return true;
        }
        
        return false;
    }
}

if (document.body) {
    new EnhancedPlayer();
} else {
    const checkBody = () => {
        if (document.body) {
            new EnhancedPlayer();
        } else {
            setTimeout(checkBody, 50);
        }
    };
    checkBody();
}