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
        this.splitAndMoveTitles();
        this.addCustomButton();
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
            ".control-bar-container-xsWA7 [class*='buttons']"
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
            "h2.title-DGh6h",
            "#app > div.router-_65XU.routes-container > div:nth-child(3) > div.route-content > div > nav > h2", // Original selector
        ];
       
        let titleElement = null;
        for (const selector of titleSelectors) {
            titleElement = document.querySelector(selector);
            if (titleElement && this.isValidTitle(titleElement.textContent)) {
                break;
            }
        }
       
        const containerSelectors = [
            "#app > div.router-_65XU.routes-container > div:nth-child(2) > div.route-content > div > div.layer-qalDW.control-bar-layer-m2jto.control-bar-container-xsWA7", // Original
            "div[class*='control-bar-container']",
            "div[class*='control-bar-layer']",
            ".video-player-controls",
        ];
       
        let targetContainer = null;
        for (const selector of containerSelectors) {
            targetContainer = document.querySelector(selector);
            if (targetContainer) break;
        }
       
        if (!titleElement || !targetContainer) {
            return;
        }

        if (targetContainer.querySelector('.custom-series-name') || targetContainer.querySelector('.custom-movie-title')) {
            return;
        }
       
        const titleText = titleElement.textContent.trim();
        const match = titleText.match(/^(.+?): (.+?) - (.+?) \((\d+x\d+)\)$/);

        if (!match) {
            const movieDiv = document.createElement('div');
            movieDiv.className = 'custom-series-name';
            movieDiv.textContent = titleText;
            
            targetContainer.insertBefore(movieDiv, targetContainer.firstChild);
            titleElement.style.display = 'none';
            return;
        }
       
        // Handle series title
        const [, seriesName, episodeTitle, description, seasonEpisode] = match;
       
        const seriesDiv = document.createElement('div');
        seriesDiv.className = 'custom-series-name';
        seriesDiv.textContent = `${description} (${seasonEpisode})`;
       
        const episodeDiv = document.createElement('div');
        episodeDiv.className = 'custom-episode-title';
        episodeDiv.textContent = `${seriesName}: ${episodeTitle}`;
       
        targetContainer.insertBefore(seriesDiv, targetContainer.firstChild);
        targetContainer.insertBefore(episodeDiv, seriesDiv.nextSibling);
       
        titleElement.style.display = 'none';
    }
   
    isValidTitle(text) {
        if (text && text.includes(':') && text.includes('(') && text.includes('x')) {
            return true;
        }
        if (text && text.trim().length > 0 && !text.includes('x')) {
            return true;
        }
        return false;
    }
}

new EnhancedPlayer();