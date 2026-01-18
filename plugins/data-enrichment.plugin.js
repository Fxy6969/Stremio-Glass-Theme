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
 * @name Data Enrichment
 * @description Enriches movie and TV show details with TMDB data including enhanced cast, similar titles, collections, and ratings.
 * @version 1.0.0
 * @author MrBlu03
 * @credits Inspired by the Stremio Neo project
 */

class DataEnrichment {
    constructor() {
        this.config = this.loadConfig();
        this.cache = new Map();
        this.observer = null;
        this.currentImdbId = null;
        this.lastEnrichmentTime = 0; // Track when we last created content
        this.isEnriching = false; // Flag to prevent re-entrancy
        this.checkDebounceTimer = null;
        this.init();
    }

    loadConfig() {
        const saved = localStorage.getItem('dataEnrichmentConfig');
        const defaults = {
            tmdbApiKey: '',
            enhancedCast: true,
            description: true,
            maturityRating: true,
            similarTitles: true,
            showCollection: true,
            showRatingsOnPosters: true
        };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }

    saveConfig() {
        localStorage.setItem('dataEnrichmentConfig', JSON.stringify(this.config));
    }

    init() {
        console.log('[DataEnrichment] Plugin loaded successfully v1.0.0');
        this.setupObserver();
        this.setupHashChangeListener();
        this.injectSettingsButton();
        
        // Initial check using waitForElement for robustness
        waitForElement('.meta-details-container').then(() => {
             this.checkForDetailPage();
        }).catch(() => {
             // Fallback or just wait for observer
             setTimeout(() => this.checkForDetailPage(), 1000);
        });
    }
    
    setupHashChangeListener() {
        // Monitor URL hash changes (Stremio uses hash-based routing)
        this.lastHash = window.location.hash;
        
        const handleHashChange = () => {
            const newHash = window.location.hash;
            const oldImdbMatch = this.lastHash.match(/tt\d+/);
            const newImdbMatch = newHash.match(/tt\d+/);
            
            // Only cleanup when navigating AWAY from a detail page (no IMDB ID in new URL)
            // or when navigating to a DIFFERENT detail page
            if (!newImdbMatch) {
                // Navigated away from detail view entirely
                console.log('[DataEnrichment] Navigated away from detail page, cleaning up');
                this.cleanup(true);
            } else if (oldImdbMatch && newImdbMatch && oldImdbMatch[0] !== newImdbMatch[0]) {
                // Navigated to a different detail page
                console.log('[DataEnrichment] Navigated to different title, cleaning up old content');
                this.cleanup(true);
                this.currentImdbId = null;
                setTimeout(() => this.checkForDetailPage(), 300);
            }
            
            this.lastHash = newHash;
        };
        
        // Use hashchange event
        window.addEventListener('hashchange', handleHashChange);
    }

    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            // Skip if we're currently enriching
            if (this.isEnriching) {
                return;
            }
            
            // Debounce the check
            if (this.checkDebounceTimer) {
                clearTimeout(this.checkDebounceTimer);
            }
            this.checkDebounceTimer = setTimeout(() => {
                this.checkForDetailPage();
                this.checkForPosters();
            }, 300);
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial check
        setTimeout(() => {
            this.checkForDetailPage();
            this.checkForPosters();
        }, 1000);
        
        // Hash change is handled by setupHashChangeListener
    }

    checkForDetailPage() {
        // Skip if already enriching
        if (this.isEnriching) return;
        
        // Check if we're actually on a detail page (URL should contain an IMDB ID)
        const urlHasImdbId = window.location.hash.match(/tt\d+/);
        
        if (!urlHasImdbId) {
            // Not on a detail page - don't do anything, cleanup is handled by hash change
            return;
        }
        
        // Check if the meta-info-container exists (this means the detail view is loaded)
        const metaInfoContainer = document.querySelector('.meta-details-container') || document.querySelector('[class*="meta-info-container"]');
        if (!metaInfoContainer) {
            // Detail view not loaded yet, wait for next check
            return;
        }

        // Extract IMDB ID from the page
        const imdbId = this.extractImdbId();
        if (!imdbId) {
            console.log('[DataEnrichment] No IMDB ID found');
            this.cleanup();
            return;
        }
        
        if (imdbId === this.currentImdbId) {
            // Already enriched this item
            return;
        }

        console.log('[DataEnrichment] Found new IMDB ID:', imdbId);
        this.currentImdbId = imdbId;
        this.enrichDetailPage(imdbId, metaInfoContainer);
    }
    
    cleanup(force = false) {
        // Only cleanup when forced (navigation) or when explicitly called
        if (!force) {
            return;
        }
        
        // Remove all enrichment elements from the page
        const container = document.querySelector('.data-enrichment-container');
        if (container) container.remove();
        const badge = document.querySelector('.enhanced-tmdb-badge');
        if (badge) badge.remove();
        this.currentImdbId = null;
        console.log('[DataEnrichment] Cleaned up enrichment content');
    }

    extractImdbId() {
        // Try to get IMDB ID from URL hash
        const url = window.location.hash || window.location.href;
        const match = url.match(/tt\d+/);
        if (match) return match[0];

        // Try to find it in IMDB link on the page
        const imdbLink = document.querySelector('a[href*="imdb.com/title/tt"]');
        if (imdbLink) {
            const linkMatch = imdbLink.href.match(/tt\d+/);
            if (linkMatch) return linkMatch[0];
        }
        
        // Try to find in any data attributes or meta elements
        const metaElements = document.querySelectorAll('[data-imdbid], [data-imdb-id]');
        for (const el of metaElements) {
            const id = el.dataset.imdbid || el.dataset.imdbId;
            if (id && id.match(/tt\d+/)) return id;
        }
        
        // Try finding in any visible IMDB rating/link text
        const allLinks = document.querySelectorAll('a[href*="imdb"]');
        for (const link of allLinks) {
            const idMatch = link.href.match(/tt\d+/);
            if (idMatch) return idMatch[0];
        }

        return null;
    }

    async enrichDetailPage(imdbId, container) {
        if (!this.config.tmdbApiKey) {
            console.log('[DataEnrichment] No API key configured');
            return;
        }

        // Set enriching flag
        this.isEnriching = true;

        try {
            console.log('[DataEnrichment] Fetching TMDB data for:', imdbId);
            const data = await this.fetchTMDBData(imdbId);
            if (!data) {
                console.log('[DataEnrichment] No TMDB data found for:', imdbId);
                this.isEnriching = false;
                return;
            }
            
            console.log('[DataEnrichment] Got TMDB data:', data.title || data.name);

            // Force remove old container before creating new one
            const oldContainer = document.querySelector('.data-enrichment-container');
            if (oldContainer) oldContainer.remove();
            const oldBadge = document.querySelector('.enhanced-tmdb-badge');
            if (oldBadge) oldBadge.remove();
            
            // Verify we're still on the same IMDB ID (user might have navigated during fetch)
            const currentUrlImdbId = window.location.hash.match(/tt\d+/);
            if (!currentUrlImdbId || currentUrlImdbId[0] !== imdbId) {
                console.log('[DataEnrichment] User navigated away during fetch, aborting');
                this.isEnriching = false;
                return;
            }
            
            // Set the current IMDB ID
            this.currentImdbId = imdbId;
            
            // Create fresh enrichment container
            const enrichmentContainer = this.createEnrichmentContainer();
            
            if (!enrichmentContainer) {
                console.log('[DataEnrichment] Could not create enrichment container');
                this.isEnriching = false;
                return;
            }
            
            // Tag the container with the IMDB ID it belongs to
            enrichmentContainer.dataset.imdbId = imdbId;

            // Add TMDB rating badge near the existing ratings/action buttons
            this.injectRatingBadge(data, container);

            // Enrich with various data in the dedicated container based on current config
            console.log('[DataEnrichment] Config state - enhancedCast:', this.config.enhancedCast, 
                        'showCollection:', this.config.showCollection, 
                        'similarTitles:', this.config.similarTitles);
            
            if (this.config.enhancedCast && data.credits) {
                console.log('[DataEnrichment] Injecting cast section');
                this.injectEnhancedCast(data.credits, enrichmentContainer);
            } else if (!this.config.enhancedCast) {
                console.log('[DataEnrichment] Cast section disabled by config');
            }

            if (this.config.showCollection && data.belongs_to_collection) {
                console.log('[DataEnrichment] Injecting collection:', data.belongs_to_collection.name);
                await this.injectCollection(data.belongs_to_collection, enrichmentContainer);
            } else if (!this.config.showCollection && data.belongs_to_collection) {
                console.log('[DataEnrichment] Collection disabled by config');
            }

            if (this.config.similarTitles && data.similar) {
                console.log('[DataEnrichment] Injecting similar titles, count:', data.similar.results?.length);
                this.injectSimilarTitles(data.similar, enrichmentContainer);
            } else if (!this.config.similarTitles) {
                console.log('[DataEnrichment] Similar titles disabled by config');
            }
            
            // Mark enrichment as complete and set timestamp
            this.lastEnrichmentTime = Date.now();
            console.log('[DataEnrichment] Enrichment complete');

        } catch (error) {
            console.error('[DataEnrichment] Error enriching page:', error);
        } finally {
            // Always clear the enriching flag
            this.isEnriching = false;
        }
    }

    createEnrichmentContainer() {
        // Remove any existing container first
        const existing = document.querySelector('.data-enrichment-container');
        if (existing) existing.remove();
        
        console.log('[DataEnrichment] Scanning page for detail view...');
        
        // In Stremio, the detail view has a meta-info-container that holds all the metadata
        // We want to append our enrichment content at the END of that container
        
        // Priority 1: Look for the meta-info-container (this is where metadata is displayed)
        let metaInfoContainer = document.querySelector('.meta-details-container') || document.querySelector('[class*="meta-info-container"]');
        
        if (metaInfoContainer) {
            console.log('[DataEnrichment] Found meta-info-container');
            
            // Create the enrichment container
            const enrichmentContainer = document.createElement('div');
            enrichmentContainer.className = 'data-enrichment-container';
            
            // Append at the end of the meta-info-container
            metaInfoContainer.appendChild(enrichmentContainer);
            console.log('[DataEnrichment] Created enrichment container inside meta-info-container');
            
            return enrichmentContainer;
        }
        
        // Priority 2: Look for description container and insert after it
        const descriptionContainer = document.querySelector('[class*="description-container"]');
        if (descriptionContainer && descriptionContainer.parentElement) {
            console.log('[DataEnrichment] Found description-container, inserting after it');
            
            const enrichmentContainer = document.createElement('div');
            enrichmentContainer.className = 'data-enrichment-container';
            
            // Insert after the description container
            descriptionContainer.parentElement.appendChild(enrichmentContainer);
            console.log('[DataEnrichment] Created enrichment container after description');
            
            return enrichmentContainer;
        }
        
        // Priority 3: Try to find scrollable menu container (for sidebar/drawer views)
        const menuContainer = document.querySelector('[class*="menu-container-B6cqK"], [class*="menu-container"]');
        if (menuContainer) {
            console.log('[DataEnrichment] Found menu-container');
            
            const enrichmentContainer = document.createElement('div');
            enrichmentContainer.className = 'data-enrichment-container';
            
            menuContainer.appendChild(enrichmentContainer);
            console.log('[DataEnrichment] Created enrichment container inside menu-container');
            
            return enrichmentContainer;
        }
        
        console.log('[DataEnrichment] Could not find any suitable container');
        // Debug: show what's on the page
        console.log('[DataEnrichment] URL hash:', window.location.hash);
        const allClasses = [...document.querySelectorAll('[class]')]
            .map(el => el.className)
            .filter(c => typeof c === 'string' && (c.includes('meta') || c.includes('description') || c.includes('info')))
            .slice(0, 20);
        console.log('[DataEnrichment] Relevant classes on page:', allClasses);
        return null;
    }

    injectRatingBadge(data, container) {
        // Remove existing badge
        const existingBadge = document.querySelector('.enhanced-tmdb-badge');
        if (existingBadge) existingBadge.remove();

        if (!data.vote_average) return;

        const badge = document.createElement('div');
        badge.className = 'enhanced-tmdb-badge';
        badge.innerHTML = `
            <span class="tmdb-icon">🎬</span>
            <span class="tmdb-label">TMDB</span>
            <span class="tmdb-score">${data.vote_average.toFixed(1)}</span>
        `;

        // Find the action buttons or rating area to insert nearby
        const actionButtons = container.querySelector('[class*="action-buttons"], .action-buttons-container-XbKVa');
        const ratingsArea = container.querySelector('[class*="ratings"], .ratings-zUtHH');
        
        if (ratingsArea) {
            ratingsArea.insertAdjacentElement('afterend', badge);
        } else if (actionButtons) {
            actionButtons.insertAdjacentElement('beforebegin', badge);
        }
    }

    async fetchTMDBData(imdbId) {
        if (this.cache.has(imdbId)) {
            console.log('[DataEnrichment] Using cached data for:', imdbId);
            return this.cache.get(imdbId);
        }

        const apiKey = this.config.tmdbApiKey;
        if (!apiKey) {
            console.log('[DataEnrichment] No API key');
            return null;
        }
        
        try {
            // First, find the TMDB ID from IMDB ID
            const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;
            console.log('[DataEnrichment] Finding TMDB ID for:', imdbId);
            const findResponse = await fetch(findUrl);
            
            if (!findResponse.ok) {
                console.error('[DataEnrichment] TMDB find API error:', findResponse.status);
                return null;
            }
            
            const findData = await findResponse.json();

            let tmdbId, mediaType;
            if (findData.movie_results && findData.movie_results.length > 0) {
                tmdbId = findData.movie_results[0].id;
                mediaType = 'movie';
            } else if (findData.tv_results && findData.tv_results.length > 0) {
                tmdbId = findData.tv_results[0].id;
                mediaType = 'tv';
            } else {
                console.log('[DataEnrichment] No TMDB results for IMDB ID:', imdbId);
                return null;
            }
            
            console.log('[DataEnrichment] Found TMDB ID:', tmdbId, 'Type:', mediaType);

            // Fetch detailed data with append_to_response
            const detailUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&append_to_response=credits,similar,recommendations,external_ids,content_ratings,release_dates,images&include_image_language=en,null`;
            const detailResponse = await fetch(detailUrl);
            
            if (!detailResponse.ok) {
                console.error('[DataEnrichment] TMDB detail API error:', detailResponse.status);
                return null;
            }
            
            const data = await detailResponse.json();
            data.media_type = mediaType;

            this.cache.set(imdbId, data);
            return data;
        } catch (error) {
            console.error('[DataEnrichment] Fetch error:', error);
            return null;
        }
    }

    injectEnhancedCast(credits, container) {
        const cast = credits.cast?.slice(0, 15) || [];
        if (cast.length === 0) return;

        const section = document.createElement('div');
        section.className = 'enhanced-cast-section enhanced-carousel';
        section.innerHTML = `
            <div class="enhanced-section-header">Cast</div>
            <div class="enhanced-carousel-wrapper">
                <button class="enhanced-scroll-btn enhanced-scroll-left" aria-label="Scroll left">‹</button>
                <div class="enhanced-cast-container enhanced-scroll-container">
                    ${cast.map(actor => `
                        <div class="enhanced-cast-item">
                            <div class="enhanced-cast-image-container">
                                ${actor.profile_path 
                                    ? `<img class="enhanced-cast-image" src="https://image.tmdb.org/t/p/w185${actor.profile_path}" alt="${actor.name}" loading="lazy">`
                                    : `<div class="enhanced-cast-placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`
                                }
                            </div>
                            <div class="enhanced-cast-info">
                                <div class="enhanced-cast-name">${actor.name}</div>
                                <div class="enhanced-cast-character">${actor.character || ''}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="enhanced-scroll-btn enhanced-scroll-right" aria-label="Scroll right">›</button>
            </div>
        `;
        
        container.appendChild(section);
        this.setupScrollButtons(section);
    }

    injectSimilarTitles(similar, container) {
        const titles = similar.results?.slice(0, 15) || [];
        if (titles.length === 0) return;

        // Determine media type from the current data
        const mediaType = similar.results[0]?.media_type || (similar.results[0]?.first_air_date ? 'tv' : 'movie');

        const section = document.createElement('div');
        section.className = 'enhanced-similar-section enhanced-carousel';
        section.innerHTML = `
            <div class="enhanced-section-header">More like this</div>
            <div class="enhanced-carousel-wrapper">
                <button class="enhanced-scroll-btn enhanced-scroll-left" aria-label="Scroll left">‹</button>
                <div class="enhanced-similar-container enhanced-scroll-container">
                    ${titles.map(item => `
                        <div class="enhanced-similar-item enhanced-poster-item" data-id="${item.id}" data-media-type="${item.media_type || mediaType}">
                            ${item.poster_path 
                                ? `<img class="enhanced-similar-poster" src="https://image.tmdb.org/t/p/w342${item.poster_path}" alt="${item.title || item.name}" loading="lazy">`
                                : `<div class="enhanced-similar-placeholder">${item.title || item.name}</div>`
                            }
                            <div class="enhanced-poster-title">${item.title || item.name}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="enhanced-scroll-btn enhanced-scroll-right" aria-label="Scroll right">›</button>
            </div>
        `;
        
        container.appendChild(section);
        this.setupScrollButtons(section);
        this.setupPosterClickHandlers(section);
    }

    async injectCollection(collection, container) {
        // Fetch full collection details
        const collectionUrl = `https://api.themoviedb.org/3/collection/${collection.id}?api_key=${this.config.tmdbApiKey}`;
        const response = await fetch(collectionUrl);
        const collectionData = await response.json();

        const parts = collectionData.parts || [];
        if (parts.length <= 1) return;

        // Sort by release date
        parts.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

        const section = document.createElement('div');
        section.className = 'enhanced-collection-section enhanced-carousel';
        section.innerHTML = `
            <div class="enhanced-section-header">${collectionData.name}</div>
            <div class="enhanced-carousel-wrapper">
                <button class="enhanced-scroll-btn enhanced-scroll-left" aria-label="Scroll left">‹</button>
                <div class="enhanced-collection-container enhanced-scroll-container">
                    ${parts.map(item => `
                        <div class="enhanced-collection-item enhanced-poster-item" data-id="${item.id}" data-media-type="movie">
                            ${item.poster_path 
                                ? `<img class="enhanced-collection-poster" src="https://image.tmdb.org/t/p/w342${item.poster_path}" alt="${item.title}" loading="lazy">`
                                : `<div class="enhanced-collection-placeholder">${item.title}</div>`
                            }
                            <div class="enhanced-poster-title">${item.title}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="enhanced-scroll-btn enhanced-scroll-right" aria-label="Scroll right">›</button>
            </div>
        `;
        
        container.appendChild(section);
        this.setupScrollButtons(section);
        this.setupPosterClickHandlers(section);
    }

    setupScrollButtons(section) {
        const container = section.querySelector('.enhanced-scroll-container');
        const leftBtn = section.querySelector('.enhanced-scroll-left');
        const rightBtn = section.querySelector('.enhanced-scroll-right');
        
        if (!container || !leftBtn || !rightBtn) return;
        
        const scrollAmount = 400;
        
        const updateButtonVisibility = () => {
            leftBtn.style.opacity = container.scrollLeft > 10 ? '1' : '0';
            leftBtn.style.pointerEvents = container.scrollLeft > 10 ? 'auto' : 'none';
            
            const maxScroll = container.scrollWidth - container.clientWidth - 10;
            rightBtn.style.opacity = container.scrollLeft < maxScroll ? '1' : '0';
            rightBtn.style.pointerEvents = container.scrollLeft < maxScroll ? 'auto' : 'none';
        };
        
        leftBtn.addEventListener('click', () => {
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
        
        rightBtn.addEventListener('click', () => {
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });
        
        container.addEventListener('scroll', updateButtonVisibility);
        
        // Initial check
        setTimeout(updateButtonVisibility, 100);
    }

    setupPosterClickHandlers(section) {
        const posterItems = section.querySelectorAll('.enhanced-poster-item');
        
        posterItems.forEach(item => {
            // Add cursor pointer style
            item.style.cursor = 'pointer';
            
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const tmdbId = item.dataset.id;
                const mediaType = item.dataset.mediaType || 'movie';
                
                if (!tmdbId) {
                    console.log('[DataEnrichment] No TMDB ID found on poster item');
                    return;
                }
                
                // Show loading state
                item.style.opacity = '0.6';
                item.style.pointerEvents = 'none';
                
                try {
                    // Fetch external IDs to get IMDB ID
                    const externalIdsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${this.config.tmdbApiKey}`;
                    const response = await fetch(externalIdsUrl);
                    
                    if (!response.ok) {
                        console.error('[DataEnrichment] Failed to fetch external IDs:', response.status);
                        return;
                    }
                    
                    const externalIds = await response.json();
                    const imdbId = externalIds.imdb_id;
                    
                    if (!imdbId) {
                        console.log('[DataEnrichment] No IMDB ID found for TMDB ID:', tmdbId);
                        // Try to show a notification or fallback
                        return;
                    }
                    
                    console.log('[DataEnrichment] Navigating to:', imdbId);
                    
                    // Navigate to the detail page using Stremio's hash-based routing
                    // Format: #/detail/{type}/{imdbId}
                    const stremioType = mediaType === 'tv' ? 'series' : 'movie';
                    window.location.hash = `#/detail/${stremioType}/${imdbId}`;
                    
                } catch (error) {
                    console.error('[DataEnrichment] Error navigating to item:', error);
                } finally {
                    // Restore item state
                    item.style.opacity = '';
                    item.style.pointerEvents = '';
                }
            });
        });
    }

    checkForPosters() {
        if (!this.config.showRatingsOnPosters || !this.config.tmdbApiKey) return;

        const posters = document.querySelectorAll('.meta-item-container-Tj0Ib:not([data-enriched]), [class*="meta-item-container"]:not([data-enriched])');
        posters.forEach(poster => {
            poster.setAttribute('data-enriched', 'true');
            // Rating on posters could be implemented here
        });
    }

    injectSettingsButton() {
        // Watch for settings page and inject our settings section
        this.settingsObserver = new MutationObserver(() => {
            this.tryInjectSettingsSection();
        });
        
        this.settingsObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Initial check
        this.tryInjectSettingsSection();
    }

    tryInjectSettingsSection() {
        // Only inject when on settings page
        if (!window.location.hash.includes('#/settings')) return;
        
        const sectionsContainer = document.querySelector('.sections-container-ZaZpD, [class*="sections-container"]');
        if (!sectionsContainer || document.querySelector('.data-enrichment-settings-section')) return;
        
        const section = document.createElement('div');
        section.className = 'data-enrichment-settings-section section-container-_VVMF';
        section.innerHTML = `
            <div class="section-heading-Zp2bz" style="cursor: pointer;" onclick="this.parentElement.querySelector('.de-settings-content').classList.toggle('de-collapsed')">
                <div class="icon-mYqgJ">⚡</div>
                <div class="section-label-EgxHt">Data Enrichment</div>
                <div style="margin-left: auto; opacity: 0.5;">▼</div>
            </div>
            <div class="de-settings-content">
                <div class="option-container-pZ9Ip">
                    <div class="label-YVD3e">TMDB API Key</div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="password" class="tmdb-api-input de-input" value="${this.config.tmdbApiKey}" placeholder="Enter your TMDB API key">
                        <button class="de-save-btn">Save</button>
                    </div>
                    <div class="de-hint">Get your free API key at themoviedb.org/settings/api</div>
                </div>
                <div class="option-container-pZ9Ip de-toggle-row">
                    <div class="label-YVD3e">Enhanced Cast Section</div>
                    <label class="de-toggle"><input type="checkbox" class="toggle-enhanced-cast" ${this.config.enhancedCast ? 'checked' : ''}><span class="de-toggle-slider"></span></label>
                </div>
                <div class="option-container-pZ9Ip de-toggle-row">
                    <div class="label-YVD3e">Similar Titles</div>
                    <label class="de-toggle"><input type="checkbox" class="toggle-similar-titles" ${this.config.similarTitles ? 'checked' : ''}><span class="de-toggle-slider"></span></label>
                </div>
                <div class="option-container-pZ9Ip de-toggle-row">
                    <div class="label-YVD3e">Show Collection</div>
                    <label class="de-toggle"><input type="checkbox" class="toggle-collection" ${this.config.showCollection ? 'checked' : ''}><span class="de-toggle-slider"></span></label>
                </div>
                <div class="option-container-pZ9Ip de-toggle-row">
                    <div class="label-YVD3e">Ratings on Posters</div>
                    <label class="de-toggle"><input type="checkbox" class="toggle-poster-ratings" ${this.config.showRatingsOnPosters ? 'checked' : ''}><span class="de-toggle-slider"></span></label>
                </div>
                <div class="de-status ${this.config.tmdbApiKey ? 'de-status-active' : ''}">
                    ${this.config.tmdbApiKey ? '● Connected to TMDB' : '○ No API key configured'}
                </div>
            </div>
        `;
        
        sectionsContainer.appendChild(section);
        this.attachInlineSettingsListeners(section);
        this.injectSettingsStyles();
    }

    injectSettingsStyles() {
        if (document.getElementById('de-settings-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'de-settings-styles';
        style.textContent = `
            .data-enrichment-settings-section { margin-top: 16px; }
            .de-settings-content { padding: 0 16px 16px; }
            .de-settings-content.de-collapsed { display: none; }
            .de-input { flex: 1; padding: 10px 14px; background: rgba(70, 70, 70, 0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-size: 14px; outline: none; }
            .de-input:focus { border-color: rgba(255,255,255,0.3); }
            .de-save-btn { padding: 10px 18px; background: rgba(123, 91, 245, 0.8); border: none; border-radius: 8px; color: white; font-size: 14px; cursor: pointer; }
            .de-save-btn:hover { background: rgba(123, 91, 245, 1); }
            .de-hint { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 6px; }
            .de-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
            .de-toggle { position: relative; width: 50px; height: 28px; }
            .de-toggle input { opacity: 0; width: 0; height: 0; }
            .de-toggle-slider { position: absolute; cursor: pointer; inset: 0; background: rgba(70,70,70,0.6); border-radius: 28px; transition: 0.3s; border: 1px solid rgba(255,255,255,0.15); }
            .de-toggle-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
            .de-toggle input:checked + .de-toggle-slider { background: rgba(34,179,101,0.7); border-color: rgba(34,179,101,0.9); }
            .de-toggle input:checked + .de-toggle-slider:before { transform: translateX(22px); }
            .de-status { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 12px; }
            .de-status.de-status-active { color: #22b365; }
        `;
        document.head.appendChild(style);
    }

    attachInlineSettingsListeners(section) {
        const apiInput = section.querySelector('.tmdb-api-input');
        const saveBtn = section.querySelector('.de-save-btn');
        const status = section.querySelector('.de-status');
        
        saveBtn?.addEventListener('click', () => {
            this.config.tmdbApiKey = apiInput.value.trim();
            this.saveConfig();
            this.cache.clear();
            
            if (this.config.tmdbApiKey) {
                status.className = 'de-status de-status-active';
                status.textContent = '● Connected to TMDB';
            } else {
                status.className = 'de-status';
                status.textContent = '○ No API key configured';
            }
            
            saveBtn.textContent = '✓ Saved';
            saveBtn.style.background = 'rgba(34,179,101,0.8)';
            setTimeout(() => { saveBtn.textContent = 'Save'; saveBtn.style.background = ''; }, 2000);
        });
        
        const toggles = {
            '.toggle-enhanced-cast': 'enhancedCast',
            '.toggle-similar-titles': 'similarTitles',
            '.toggle-collection': 'showCollection',
            '.toggle-poster-ratings': 'showRatingsOnPosters'
        };
        
        Object.entries(toggles).forEach(([sel, key]) => {
            const toggle = section.querySelector(sel);
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    this.config[key] = e.target.checked;
                    this.saveConfig();
                    console.log(`[DataEnrichment] ${key} set to ${e.target.checked}`);
                    
                    // Show visual feedback
                    const row = toggle.closest('.de-toggle-row');
                    if (row) {
                        row.style.transition = 'background 0.3s ease';
                        row.style.background = e.target.checked 
                            ? 'rgba(76, 175, 80, 0.15)' 
                            : 'rgba(244, 67, 54, 0.1)';
                        setTimeout(() => {
                            row.style.background = '';
                        }, 500);
                    }
                });
            }
        });
    }



    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// Initialize plugin
if (document.body) {
    new DataEnrichment();
} else {
    const checkBody = () => {
        if (document.body) {
            new DataEnrichment();
        } else {
            setTimeout(checkBody, 50);
        }
    };
    checkBody();
}
