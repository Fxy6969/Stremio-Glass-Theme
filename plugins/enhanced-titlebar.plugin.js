/**
 * @name Enhanced Title Bar
 * @description Enhances the title bar with additional information.
 * @version 1.0.0
 * @author Fxy
 */

const CONFIG = {
    apiBase: 'https://v3-cinemeta.strem.io/meta',
    timeout: 5000,
    updateInterval: 2000
};

const metadataCache = new Map();

function injectStyles() {
    if (document.getElementById('enhanced-title-bar-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'enhanced-title-bar-styles';
    style.textContent = `
        .enhanced-title-bar {
            position: relative !important;
            padding: 5px 4px !important;
            padding-right: 10px !important;
            overflow: hidden !important;
            max-width: 400px !important;
            transform: translateZ(0) !important;
        }
            
        .enhanced-title {
            font-size: 16px !important;
            font-weight: 600 !important;
            color: #ffffff !important;
            margin-bottom: 8px !important;
            line-height: 1.3 !important;
        }
        
        .enhanced-metadata {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-wrap: wrap !important;
            font-size: 12px !important;
            color: #999 !important;
        }
        
        .enhanced-metadata-item {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
        }
        
        .enhanced-separator {
            color: #666 !important;
            margin: 0 4px !important;
        }
            
        .enhanced-loading {
            background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%) !important;
            background-size: 200% 100% !important;
            animation: enhanced-loading 1.5s infinite !important;
            border-radius: 3px !important;
            height: 12px !important;
            width: 60px !important;
            display: inline-block !important;
        }
        
        @keyframes enhanced-loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    `;
    document.head.appendChild(style);
}

async function getMetadata(id, type) {
    const cacheKey = `${type}-${id}`;
    
    if (metadataCache.has(cacheKey)) {
        return metadataCache.get(cacheKey);
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
        
        const response = await fetch(
            `${CONFIG.apiBase}/${type}/${id}.json`,
            { signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const meta = data.meta;
        
        if (!meta) return null;
        
        const metadata = {
            title: meta.name || meta.title,
            year: meta.year ? meta.year.toString() : null,
            rating: meta.imdbRating ? meta.imdbRating.toString() : null,
            genres: Array.isArray(meta.genre) ? meta.genre : (Array.isArray(meta.genres) ? meta.genres : []),
            runtime: meta.runtime || null,
            type: meta.type || type,
            poster: meta.poster,
            background: meta.background
        };
        
        console.log(`Fetched metadata for ${id}:`, metadata);
        metadataCache.set(cacheKey, metadata);
        return metadata;
        
    } catch (error) {
        console.log(`Failed to fetch ${id}:`, error);
        return null;
    }
}

function extractMediaInfo(titleText, element) {
    console.log('Extracting from element:', element);
    
    const allImages = element.querySelectorAll('img');
    console.log('Found images:', allImages.length);
    
    for (let img of allImages) {
        console.log('Checking image src:', img.src);
        if (img.src && img.src.includes('tt')) {
            const imdbMatch = img.src.match(/tt\d{7,}/);
            if (imdbMatch) {
                console.log('Found IMDb ID:', imdbMatch[0]);
                return { id: imdbMatch[0], type: 'series' };
            }
        }
    }
    
    const parent = element.parentElement;
    if (parent) {
        const parentImages = parent.querySelectorAll('img');
        for (let img of parentImages) {
            console.log('Checking parent image src:', img.src);
            if (img.src && img.src.includes('tt')) {
                const imdbMatch = img.src.match(/tt\d{7,}/);
                if (imdbMatch) {
                    console.log('Found IMDb ID in parent:', imdbMatch[0]);
                    return { id: imdbMatch[0], type: 'series' };
                }
            }
        }
    }
    
    console.log('No IMDb ID found, using fallback');
    return { id: 'tt0000000', type: 'movie' };
}

function createMetadataElements(metadata) {
    const elements = [];
    
    if (metadata.rating) {
        const rating = document.createElement('span');
        rating.className = 'enhanced-metadata-item enhanced-rating';
        rating.textContent = `★ ${metadata.rating}`;
        elements.push(rating);
    }
    
    if (metadata.year) {
        const year = document.createElement('span');
        year.className = 'enhanced-metadata-item';
        year.textContent = metadata.year;
        elements.push(year);
    }
    
    if (metadata.genres && metadata.genres.length > 0) {
        const genres = document.createElement('span');
        genres.className = 'enhanced-metadata-item';
        genres.textContent = metadata.genres.slice(0, 3).join(', ');
        elements.push(genres);
    }
    
    return elements;
}

async function enhanceTitleBar(titleBarElement) {
    if (titleBarElement.classList.contains('enhanced-title-bar')) {
        return;
    }
    
    const titleElement = titleBarElement.querySelector('.title-label-VnEAc') || 
                        titleBarElement.querySelector('[class*="title-label"]') ||
                        titleBarElement.querySelector('[class*="title"]');
    
    if (!titleElement) {
        return;
    }
    
    const originalTitle = titleElement.textContent.trim();
    
    if (!originalTitle || originalTitle.length < 1) {
        return;
    }
    
    titleBarElement.classList.add('enhanced-title-bar');
    
    const originalHTML = titleBarElement.innerHTML;
    titleBarElement.dataset.originalHtml = originalHTML;
    
    const mediaInfo = extractMediaInfo(originalTitle, titleBarElement);
    
    titleBarElement.innerHTML = '';
    
    const title = document.createElement('div');
    title.className = 'enhanced-title';
    title.textContent = originalTitle;
    titleBarElement.appendChild(title);
    
    const metadataContainer = document.createElement('div');
    metadataContainer.className = 'enhanced-metadata';
    
    const loading = document.createElement('div');
    loading.className = 'enhanced-loading';
    metadataContainer.appendChild(loading);
    
    titleBarElement.appendChild(metadataContainer);
     
    try {
        const metadata = await getMetadata(mediaInfo.id, mediaInfo.type);
        
        if (metadata) {
            if (metadata.title && metadata.title !== originalTitle) {
                title.textContent = metadata.title;
            }
            
            metadataContainer.innerHTML = '';
            
            const elements = createMetadataElements(metadata);
            elements.forEach((element, index) => {
                metadataContainer.appendChild(element);
                if (index < elements.length - 2) {
                    const separator = document.createElement('span');
                    separator.className = 'enhanced-separator';
                    separator.textContent = '•';
                    metadataContainer.appendChild(separator);
                }
            });
        } else {
            metadataContainer.innerHTML = '';
            
            const fallback = document.createElement('span');
            fallback.className = 'enhanced-metadata-item';
            fallback.textContent = '';
            fallback.style.color = '#999';
            metadataContainer.appendChild(fallback);
        }
    } catch (error) {
        metadataContainer.innerHTML = '';
        
        const errorText = document.createElement('span');
        errorText.className = 'enhanced-metadata-item';
        errorText.textContent = 'Loading failed';
        errorText.style.color = '#666';
        metadataContainer.appendChild(errorText);
    }
}

function enhanceAllTitleBars() {
    const selectors = [
        '.title-bar-container-1Ba0x',
        '[class*="title-bar-container"]',
        '[class*="titleBarContainer"]',
        '[class*="title-container"]',
        '[class*="media-title"]'
    ];
    
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            enhanceTitleBar(element).catch(() => {});
        });
    });
}

function init() {
    injectStyles();
    enhanceAllTitleBars();
    
    setInterval(() => {
        enhanceAllTitleBars();
    }, CONFIG.updateInterval);
    
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                }
            });
            
            if (shouldCheck) {
                setTimeout(enhanceAllTitleBars, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

setTimeout(init, 100);