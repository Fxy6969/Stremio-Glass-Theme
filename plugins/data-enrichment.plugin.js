function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) return resolve(element);

        const startObservation = () => {
            if (!document.body) {
                setTimeout(startObservation, 50);
                return;
            }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout: ${selector}`));
            }, timeout);
        };
        
        startObservation();
    });
}

/**
 * @name Data Enrichment
 * @description Enriches movie and TV show details with TMDB data including enhanced cast, similar titles, collections, and ratings.
 * @version 2.0.8
 * @author MrBlu03
 * @credits Inspired by the Stremio Neo project
 */

class DataEnrichment {
    constructor() {
        this.config = this.loadConfig();
        this.cache = new Map();
        this.observer = null;
        this.settingsObserver = null;
        this.hashChangeHandler = null;
        this.currentImdbId = null;
        this.currentUrl = null;  // Track URL to detect navigation
        this.currentTmdbId = null;  // Track TMDB ID for StremThru catalogs
        this.lastEnrichmentTime = 0;
        this.isEnriching = false;
        this.enrichmentTimeout = null;
        this.checkDebounceTimer = null;
        this.periodicCheckInterval = null;
        this.reactCheckTimer = null;
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
        console.log('[DataEnrichment] Plugin loaded successfully v2.0.8');
        
        // Wait for body to be ready before setting up observers
        if (!document.body) {
            console.log('[DataEnrichment] Waiting for document.body...');
            const checkBody = () => {
                if (document.body) {
                    this.setupObservers();
                } else {
                    setTimeout(checkBody, 50);
                }
            };
            checkBody();
            return;
        }
        
        this.setupObservers();
    }
    
    setupObservers() {
        this.setupObserver();
        this.setupHashChangeListener();
        this.injectSettingsButton();
        
        // Initial check - wait for React to finish initial render
        this.waitForReactRender(() => {
            this.checkForDetailPage();
            this.checkForPosters();
        });
    }

    // Wait for React to finish rendering (paint phase)
    waitForReactRender(callback, maxAttempts = 30) {
        let attempts = 0;
        
        const check = () => {
            requestAnimationFrame(() => {
                attempts++;
                
                // Check if detail content actually exists
                const hasDetailContent = this.verifyContentLoaded(false);
                
                if (hasDetailContent) {
                    console.log('[DataEnrichment] React content detected after', attempts, 'attempts');
                    callback();
                } else if (attempts < maxAttempts) {
                    // Keep checking
                    setTimeout(check, 100);
                } else {
                    // Max attempts reached, try anyway
                    console.log('[DataEnrichment] Max attempts reached, proceeding anyway');
                    callback();
                }
            });
        };
        
        check();
    }

    // Verify that content is actually loaded (not just empty containers)
    verifyContentLoaded(logDetails = true) {
        // Check for multiple indicators that content is actually loaded
        const indicators = {
            hasDescription: !!document.querySelector('[class*="description"]'),
            hasTitle: !!document.querySelector('[class*="logo"]') || 
                      !!document.querySelector('h1') || 
                      !!document.querySelector('h2'),
            hasMetaInfo: !!document.querySelector('[class*="runtime"]') || 
                         !!document.querySelector('[class*="released"]') ||
                         !!document.querySelector('[class*="release"]'),
            hasActions: !!document.querySelector('[class*="action"]')
        };
        
        // Need at least 2 indicators
        const loadedCount = Object.values(indicators).filter(Boolean).length;
        
        if (logDetails) {
            console.log('[DataEnrichment] Content indicators:', indicators, `( ${loadedCount}/4 )`);
        }
        
        return loadedCount >= 2;
    }
    
    setupHashChangeListener() {
        this.lastHash = window.location.hash;
        
        this.hashChangeHandler = () => {
            const newHash = window.location.hash;
            
            // Only cleanup when leaving detail pages entirely
            const wasOnDetail = this.lastHash.includes('#/detail/');
            const nowOnDetail = newHash.includes('#/detail/');
            
            if (wasOnDetail && !nowOnDetail) {
                // Left detail view completely
                console.log('[DataEnrichment] Left detail page, cleaning up');
                this.cleanup(true);
                this.currentImdbId = null;
                this.currentUrl = null;  // Reset URL tracking
                this.currentTmdbId = null;  // Reset TMDB tracking
                this.lastHash = newHash;
                return;
            }
            
            if (!nowOnDetail) {
                // Not on detail page
                this.lastHash = newHash;
                return;
            }
            
            // Extract IMDB IDs
            const oldMatch = this.lastHash.match(/tt\d+/);
            const newMatch = newHash.match(/tt\d+/);
            const oldId = oldMatch ? oldMatch[0] : null;
            const newId = newMatch ? newMatch[0] : null;
            
            if (oldId && newId && oldId !== newId) {
                // Different title entirely
                console.log('[DataEnrichment] Navigated to different title, cleaning up');
                this.cleanup(true);
                this.currentImdbId = null;
                this.currentUrl = null;  // Reset URL tracking
                this.currentTmdbId = null;  // Reset TMDB tracking
                // Wait for React to render new content
                setTimeout(() => {
                    this.waitForReactRender(() => this.checkForDetailPage());
                }, 300);
            } else if (newId && oldId === newId) {
                // Same title (possibly different episode) - don't cleanup, just check
                console.log('[DataEnrichment] Same title, checking for re-enrichment');
                setTimeout(() => {
                    this.waitForReactRender(() => this.checkForDetailPage());
                }, 300);
            } else if (newId) {
                // First load on detail page
                console.log('[DataEnrichment] First load on detail page');
                setTimeout(() => {
                    this.waitForReactRender(() => this.checkForDetailPage());
                }, 300);
            }
            
            this.lastHash = newHash;
        };
        
        window.addEventListener('hashchange', this.hashChangeHandler);
    }

    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            if (this.isEnriching) return;
            
            // Debounce the check
            if (this.checkDebounceTimer) {
                clearTimeout(this.checkDebounceTimer);
            }
            
            this.checkDebounceTimer = setTimeout(() => {
                // Wait for React to finish any rendering
                this.waitForReactRender(() => {
                    this.checkForDetailPage();
                    this.checkForPosters();
                });
            }, 200);
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Periodic check for late-loading content (especially TV shows)
        this.periodicCheckInterval = setInterval(() => {
            if (!this.isEnriching && window.location.hash.includes('#/detail/')) {
                const existing = document.querySelector('.data-enrichment-container');
                if (!existing && this.verifyContentLoaded(false)) {
                    console.log('[DataEnrichment] Periodic check - content loaded but not enriched');
                    this.checkForDetailPage();
                } else if (existing) {
                    // Stop periodic checking once enriched
                    clearInterval(this.periodicCheckInterval);
                    this.periodicCheckInterval = null;
                }
            }
        }, 2000);
        
        // Stop periodic checking after 30 seconds
        setTimeout(() => {
            if (this.periodicCheckInterval) {
                clearInterval(this.periodicCheckInterval);
                this.periodicCheckInterval = null;
            }
        }, 30000);
    }

    async checkForDetailPage() {
        // Skip if already enriching
        if (this.isEnriching) {
            if (this.enrichmentTimeout && Date.now() - this.enrichmentTimeout > 30000) {
                console.log('[DataEnrichment] Enrichment appears stuck, resetting flag');
                this.isEnriching = false;
                this.enrichmentTimeout = null;
            } else {
                console.log('[DataEnrichment] Already enriching, skipping check');
                return;
            }
        }
        
        // Check URL first
        const hash = window.location.hash;
        let isDetailPage = hash.includes('#/detail/');
        
        // If URL check fails, try to detect detail page by DOM structure
        if (!isDetailPage) {
            const hasMetaInfo = document.querySelector('[class*="meta-info-container"]');
            const hasImdbLink = document.querySelector('a[href*="imdb.com/title/tt"]');
            
            if (hasMetaInfo && hasImdbLink) {
                console.log('[DataEnrichment] URL check failed, but DOM indicates detail page');
                isDetailPage = true;
            }
        }
        
        if (!isDetailPage) {
            console.log('[DataEnrichment] Not on detail page:', hash);
            return;
        }
        
        // CRITICAL: Verify content actually loaded
        const hasLoadedContent = this.verifyContentLoaded(true);
        if (!hasLoadedContent) {
            console.log('[DataEnrichment] Content not loaded yet, will retry');
            return;
        }
        
        // Try to resolve title IDs (IMDB first, then TMDB search fallback)
        console.log('[DataEnrichment] Attempting to resolve title IDs...');
        const ids = await this.resolveTitleIds();
        
        if (!ids) {
            console.log('[DataEnrichment] Could not resolve title IDs from URL, DOM, or TMDB search');
            return;
        }
        
        const { imdbId, tmdbId, mediaType, title } = ids;
        const idKey = imdbId || `tmdb:${tmdbId}`;
        
        // CRITICAL: Verify the extracted ID matches the current URL hash
        // This prevents enriching with stale data during navigation
        const hashMatch = hash.match(/tt\d+/);
        const hashId = hashMatch ? hashMatch[0] : null;
        
        if (hashId && imdbId && hashId !== imdbId) {
            console.log(`[DataEnrichment] ID mismatch! URL has ${hashId}, DOM has ${imdbId}. Waiting for React to update...`);
            return;
        }
        
        // CRITICAL: For StremThru catalogs, check if extracted ID belongs to this URL
        // StremThru uses tmdb:123 format in URL, not tt1234567
        // If we extract an IMDB ID from DOM that doesn't match current tmdb URL, it's stale
        const urlTmdbMatch = hash.match(/tmdb%3A(\d+)/);
        const urlTmdbId = urlTmdbMatch ? urlTmdbMatch[1] : null;
        
        console.log(`[DataEnrichment] StremThru check - urlTmdbId: ${urlTmdbId}, imdbId: ${imdbId}, cache has: ${this.cache.has(imdbId || '')}, currentTmdbId: ${this.currentTmdbId}`);
        
        if (urlTmdbId && imdbId) {
            if (this.cache.has(imdbId)) {
                const cachedData = this.cache.get(imdbId);
                console.log(`[DataEnrichment] Cache check - cached tmdbId: ${cachedData?.id}, url tmdbId: ${urlTmdbId}`);
                // Check if cached tmdbId matches current URL's tmdbId
                if (cachedData && cachedData.id && cachedData.id.toString() !== urlTmdbId) {
                    console.log(`[DataEnrichment] ID mismatch! URL has tmdb:${urlTmdbId}, but DOM shows IMDB ${imdbId} which is tmdb:${cachedData.id}. DOM is stale, skipping...`);
                    return;
                }
            } else if (this.currentTmdbId && this.currentTmdbId.toString() !== urlTmdbId) {
                // We have a current tmdbId tracked but URL is different - previous enrichment was for different item
                console.log(`[DataEnrichment] URL changed from tmdb:${this.currentTmdbId} to tmdb:${urlTmdbId}, but DOM still shows ${imdbId}. DOM is stale, skipping...`);
                return;
            }
        }
        
        // Update current URL
        this.currentUrl = hash;
        
        // Check if already enriched this ID
        if (idKey === this.currentImdbId) {
            const existing = document.querySelector('.data-enrichment-container');
            if (existing) {
                console.log('[DataEnrichment] Already enriched this ID and container exists');
                return;
            } else {
                console.log('[DataEnrichment] Container missing, will re-enrich');
                this.currentImdbId = null;
            }
        }
        
        // Check for different ID in container
        const existingContainer = document.querySelector('.data-enrichment-container');
        if (existingContainer) {
            const existingId = existingContainer.dataset.imdbId || existingContainer.dataset.tmdbId;
            if (existingId && existingId !== idKey) {
                console.log('[DataEnrichment] Different ID in container, cleaning up');
                this.cleanup(true);
                this.currentImdbId = null;
            }
        }
        
        console.log('[DataEnrichment] All checks passed, enriching:', title || idKey);
        this.currentImdbId = idKey;
        this.currentTmdbId = tmdbId || null;  // Track TMDB ID for StremThru
        this.enrichDetailPage({ imdbId, tmdbId, mediaType, title });
    }

    extractImdbId() {
        // Try URL hash first (most reliable)
        const hash = window.location.hash;
        const match = hash.match(/tt\d+/);
        if (match) return match[0];

        // Try IMDB link
        const imdbLink = document.querySelector('a[href*="imdb.com/title/tt"]');
        if (imdbLink) {
            const linkMatch = imdbLink.href.match(/tt\d+/);
            if (linkMatch) return linkMatch[0];
        }
        
        // Try data attributes
        const metaElements = document.querySelectorAll('[data-imdbid], [data-imdb-id]');
        for (const el of metaElements) {
            const id = el.dataset.imdbid || el.dataset.imdbId;
            if (id && id.match(/tt\d+/)) return id;
        }

        return null;
    }

    // Extract title and year from the page for TMDB search fallback
    extractTitleAndYear() {
        // Try to get title from logo image alt text or heading
        let title = null;
        const logoImg = document.querySelector('[class*="logo"]');
        if (logoImg) {
            title = logoImg.getAttribute('alt') || logoImg.getAttribute('title');
        }
        
        // Fallback to any h1 or h2
        if (!title) {
            const heading = document.querySelector('h1') || document.querySelector('h2');
            if (heading) {
                title = heading.textContent.trim();
            }
        }
        
        // Try to get year from release info
        let year = null;
        const releaseInfo = document.querySelector('[class*="release-info"]') || 
                           document.querySelector('[class*="runtime-release-info"]');
        if (releaseInfo) {
            const yearMatch = releaseInfo.textContent.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                year = parseInt(yearMatch[0]);
            }
        }
        
        // Determine media type from URL
        const hash = window.location.hash;
        let mediaType = 'movie'; // default
        if (hash.includes('/series/') || hash.includes('/tv/')) {
            mediaType = 'tv';
        }
        
        return { title, year, mediaType };
    }

    // Search TMDB by title and year
    async searchTMDB(title, year, mediaType) {
        if (!this.config.tmdbApiKey) {
            console.log('[DataEnrichment] No API key for TMDB search');
            return null;
        }
        
        try {
            console.log(`[DataEnrichment] Searching TMDB for: "${title}" (${year || 'unknown year'})`);
            
            // Build search URL
            const encodedTitle = encodeURIComponent(title);
            const yearParam = year ? `&year=${year}` : '';
            const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${this.config.tmdbApiKey}&query=${encodedTitle}${yearParam}&language=en-US`;
            
            const response = await fetch(searchUrl);
            if (!response.ok) {
                console.error('[DataEnrichment] TMDB search failed:', response.status);
                return null;
            }
            
            const data = await response.json();
            
            if (!data.results || data.results.length === 0) {
                console.log('[DataEnrichment] No TMDB results found');
                return null;
            }
            
            // Take the first result (best match)
            const result = data.results[0];
            console.log(`[DataEnrichment] Found TMDB match: ${result.title || result.name} (ID: ${result.id})`);
            
            return {
                tmdbId: result.id,
                mediaType: mediaType,
                title: result.title || result.name,
                imdbId: null // We'll fetch this later if needed
            };
            
        } catch (error) {
            console.error('[DataEnrichment] TMDB search error:', error);
            return null;
        }
    }

    // Resolve title IDs - tries IMDB first, falls back to TMDB search
    async resolveTitleIds() {
        const hash = window.location.hash;
        
        // CRITICAL: For StremThru catalogs, TMDB ID is in URL (tmdb%3A123)
        // Use it directly instead of stale DOM IMDB link
        const urlTmdbMatch = hash.match(/tmdb%3A(\d+)/);
        if (urlTmdbMatch) {
            const urlTmdbId = parseInt(urlTmdbMatch[1]);
            console.log(`[DataEnrichment] Found TMDB ID in URL: ${urlTmdbId}`);
            
            // Determine media type from URL
            let mediaType = 'movie';
            if (hash.includes('/series/') || hash.includes('/tv/')) {
                mediaType = 'tv';
            }
            
            return { imdbId: null, tmdbId: urlTmdbId, mediaType, title: null };
        }
        
        // 1) Try IMDB from URL/DOM first (existing behavior)
        const imdbId = this.extractImdbId();
        if (imdbId) {
            console.log('[DataEnrichment] Found IMDB ID:', imdbId);
            return { imdbId, tmdbId: null, mediaType: null, title: null };
        }
        
        // 2) Fallback: extract title/year and search TMDB
        console.log('[DataEnrichment] No IMDB ID found, attempting TMDB search fallback...');
        const { title, year, mediaType } = this.extractTitleAndYear();
        
        if (!title) {
            console.log('[DataEnrichment] Could not extract title from page');
            return null;
        }
        
        console.log(`[DataEnrichment] Extracted from page: "${title}" (${year || 'unknown'}, ${mediaType})`);
        
        // Try TMDB search
        const searchResult = await this.searchTMDB(title, year, mediaType);
        
        if (searchResult) {
            // Try to get IMDB ID from TMDB external IDs
            try {
                const externalIdsUrl = `https://api.themoviedb.org/3/${searchResult.mediaType}/${searchResult.tmdbId}/external_ids?api_key=${this.config.tmdbApiKey}`;
                const response = await fetch(externalIdsUrl);
                if (response.ok) {
                    const externalIds = await response.json();
                    if (externalIds.imdb_id) {
                        console.log('[DataEnrichment] Found IMDB ID via TMDB:', externalIds.imdb_id);
                        return {
                            imdbId: externalIds.imdb_id,
                            tmdbId: searchResult.tmdbId,
                            mediaType: searchResult.mediaType,
                            title: searchResult.title
                        };
                    }
                }
            } catch (e) {
                console.log('[DataEnrichment] Could not fetch external IDs from TMDB');
            }
            
            // Return TMDB-only result if no IMDB ID available
            return searchResult;
        }
        
        return null;
    }

    async enrichDetailPage(ids) {
        if (!this.config.tmdbApiKey) {
            console.log('[DataEnrichment] No API key configured');
            return;
        }

        const { imdbId, tmdbId, mediaType, title } = ids;
        
        this.isEnriching = true;
        this.enrichmentTimeout = Date.now();

        try {
            console.log('[DataEnrichment] Fetching TMDB data...', { imdbId, tmdbId, mediaType, title });
            const data = await this.fetchTMDBData({ imdbId, tmdbId, mediaType });
            if (!data) {
                console.log('[DataEnrichment] No TMDB data found');
                return;
            }
            
            // Create enrichment container
            const enrichmentContainer = this.createEnrichmentContainer();
            if (!enrichmentContainer) {
                console.log('[DataEnrichment] Could not create container, will retry');
                return;
            }
            
            // Store IDs for tracking
            if (imdbId) {
                enrichmentContainer.dataset.imdbId = imdbId;
            }
            if (tmdbId) {
                enrichmentContainer.dataset.tmdbId = tmdbId;
            }

            // Inject content based on config
            if (this.config.enhancedCast && data.credits) {
                this.injectEnhancedCast(data.credits, enrichmentContainer);
            }

            if (this.config.showCollection && data.belongs_to_collection) {
                await this.injectCollection(data.belongs_to_collection, enrichmentContainer);
            }

            if (this.config.similarTitles && data.similar) {
                this.injectSimilarTitles(data.similar, enrichmentContainer);
            }
            
            this.lastEnrichmentTime = Date.now();
            console.log('[DataEnrichment] Enrichment complete for:', title || imdbId || `tmdb:${tmdbId}`);

        } catch (error) {
            console.error('[DataEnrichment] Error:', error);
        } finally {
            this.isEnriching = false;
            this.enrichmentTimeout = null;
        }
    }

    // Find the correct container for enrichment content
    createEnrichmentContainer() {
        // Remove existing
        const existing = document.querySelector('.data-enrichment-container');
        if (existing) existing.remove();
        
        console.log('[DataEnrichment] Creating enrichment container...');
        
        // Strategy 1: Find meta-info-container and append INSIDE it (at the end)
        // This keeps it within the same layout column
        const metaInfoContainer = document.querySelector('[class*="meta-info-container"]');
        if (metaInfoContainer) {
            console.log('[DataEnrichment] Found meta-info-container, appending inside it');
            const container = document.createElement('div');
            container.className = 'data-enrichment-container';
            container.setAttribute('data-plugin', 'data-enrichment');
            
            // Append at the end of meta-info-container so it appears after description
            metaInfoContainer.appendChild(container);
            return container;
        }
        
        // Strategy 2: Find description container and insert after it
        const descContainer = document.querySelector('[class*="description-container"]');
        if (descContainer && descContainer.parentElement) {
            console.log('[DataEnrichment] Found description-container, inserting after it');
            const container = document.createElement('div');
            container.className = 'data-enrichment-container';
            container.setAttribute('data-plugin', 'data-enrichment');
            
            descContainer.parentElement.insertBefore(container, descContainer.nextSibling);
            return container;
        }
        
        // Strategy 3: Find action buttons and insert before them
        const actionButtons = document.querySelector('[class*="action-buttons"]');
        if (actionButtons && actionButtons.parentElement) {
            console.log('[DataEnrichment] Found action-buttons, inserting before them');
            const container = document.createElement('div');
            container.className = 'data-enrichment-container';
            container.setAttribute('data-plugin', 'data-enrichment');
            
            actionButtons.parentElement.insertBefore(container, actionButtons);
            return container;
        }
        
        // Strategy 4: Find any meta/preview container
        const metaContainer = document.querySelector('[class*="meta-preview"]') || 
                             document.querySelector('[class*="meta-details"]');
        if (metaContainer) {
            console.log('[DataEnrichment] Found meta container, appending to it');
            const container = document.createElement('div');
            container.className = 'data-enrichment-container';
            container.setAttribute('data-plugin', 'data-enrichment');
            
            metaContainer.appendChild(container);
            return container;
        }
        
        console.log('[DataEnrichment] Could not find any suitable container');
        console.log('[DataEnrichment] URL hash:', window.location.hash);
        console.log('[DataEnrichment] Page title:', document.title);
        return null;
    }

    async fetchTMDBData(ids) {
        const { imdbId, tmdbId: providedTmdbId, mediaType: providedMediaType } = ids;
        const apiKey = this.config.tmdbApiKey;
        if (!apiKey) return null;
        
        // Create cache key
        const cacheKey = imdbId || `tmdb:${providedTmdbId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            let tmdbId = providedTmdbId;
            let mediaType = providedMediaType;
            
            // If we have IMDB ID but no TMDB ID, look it up
            if (imdbId && !tmdbId) {
                console.log('[DataEnrichment] Looking up TMDB ID from IMDB ID:', imdbId);
                const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;
                const findResponse = await fetch(findUrl);
                
                if (!findResponse.ok) return null;
                
                const findData = await findResponse.json();

                if (findData.movie_results?.length > 0) {
                    tmdbId = findData.movie_results[0].id;
                    mediaType = 'movie';
                } else if (findData.tv_results?.length > 0) {
                    tmdbId = findData.tv_results[0].id;
                    mediaType = 'tv';
                } else {
                    console.log('[DataEnrichment] No TMDB results for IMDB ID:', imdbId);
                    return null;
                }
            }
            
            // If we still don't have a TMDB ID, we can't proceed
            if (!tmdbId) {
                console.log('[DataEnrichment] No TMDB ID available');
                return null;
            }
            
            // Default to movie if no media type provided
            if (!mediaType) {
                mediaType = 'movie';
            }

            console.log(`[DataEnrichment] Fetching TMDB details for ${mediaType} ID:`, tmdbId);

            // Fetch detailed data
            const detailUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&append_to_response=credits,similar,recommendations,external_ids,content_ratings,release_dates,images&include_image_language=en,null`;
            const detailResponse = await fetch(detailUrl);
            
            if (!detailResponse.ok) return null;
            
            const data = await detailResponse.json();
            data.media_type = mediaType;

            this.cache.set(cacheKey, data);
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

        const mediaType = similar.results[0]?.media_type || 
                         (similar.results[0]?.first_air_date ? 'tv' : 'movie');

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
        try {
            const collectionUrl = `https://api.themoviedb.org/3/collection/${collection.id}?api_key=${this.config.tmdbApiKey}`;
            const response = await fetch(collectionUrl);
            
            if (!response.ok) return;
            
            const collectionData = await response.json();
            const parts = collectionData.parts || [];
            
            if (parts.length <= 1) return;

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
        } catch (error) {
            console.error('[DataEnrichment] Collection error:', error);
        }
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
        setTimeout(updateButtonVisibility, 100);
    }

    setupPosterClickHandlers(section) {
        const posterItems = section.querySelectorAll('.enhanced-poster-item');
        
        posterItems.forEach(item => {
            item.style.cursor = 'pointer';
            
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const tmdbId = item.dataset.id;
                const mediaType = item.dataset.mediaType || 'movie';
                
                if (!tmdbId) return;
                
                item.style.opacity = '0.6';
                item.style.pointerEvents = 'none';
                
                try {
                    const externalIdsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${this.config.tmdbApiKey}`;
                    const response = await fetch(externalIdsUrl);
                    
                    if (!response.ok) return;
                    
                    const externalIds = await response.json();
                    const imdbId = externalIds.imdb_id;
                    
                    if (!imdbId) return;
                    
                    const stremioType = mediaType === 'tv' ? 'series' : 'movie';
                    window.location.hash = `#/detail/${stremioType}/${imdbId}`;
                    
                } catch (error) {
                    console.error('[DataEnrichment] Navigation error:', error);
                } finally {
                    item.style.opacity = '';
                    item.style.pointerEvents = '';
                }
            });
        });
    }

    checkForPosters() {
        if (!this.config.showRatingsOnPosters || !this.config.tmdbApiKey) return;
        // Implementation unchanged
    }

    injectSettingsButton() {
        this.settingsObserver = new MutationObserver(() => {
            this.tryInjectSettingsSection();
        });
        
        this.settingsObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.tryInjectSettingsSection();
    }

    tryInjectSettingsSection() {
        if (!window.location.hash.includes('#/settings')) return;
        
        const sectionsContainer = document.querySelector('[class*="sections-container"]');
        if (!sectionsContainer || document.querySelector('.data-enrichment-settings-section')) return;
        
        const section = document.createElement('div');
        section.className = 'data-enrichment-settings-section';
        section.innerHTML = `
            <div style="margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none';">
                    <span style="font-size: 18px;">⚡</span>
                    <span style="font-size: 16px; font-weight: 600;">Data Enrichment</span>
                    <span style="margin-left: auto; opacity: 0.5;">▼</span>
                </div>
                <div style="display: none;">
                    <div style="margin-bottom: 16px;">
                        <div style="margin-bottom: 8px; font-weight: 500;">TMDB API Key</div>
                        <div style="display: flex; gap: 8px;">
                            <input type="password" class="de-api-input" value="${this.config.tmdbApiKey}" placeholder="Enter your TMDB API key" style="flex: 1; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white;">
                            <button class="de-save-btn" style="padding: 10px 16px; background: #7b5bf5; border: none; border-radius: 6px; color: white; cursor: pointer;">Save</button>
                        </div>
                        <div style="font-size: 12px; opacity: 0.6; margin-top: 6px;">Get your free API key at themoviedb.org/settings/api</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span>Enhanced Cast Section</span>
                        <input type="checkbox" class="de-toggle-cast" ${this.config.enhancedCast ? 'checked' : ''} style="width: 20px; height: 20px;">
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span>Similar Titles</span>
                        <input type="checkbox" class="de-toggle-similar" ${this.config.similarTitles ? 'checked' : ''} style="width: 20px; height: 20px;">
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span>Show Collection</span>
                        <input type="checkbox" class="de-toggle-collection" ${this.config.showCollection ? 'checked' : ''} style="width: 20px; height: 20px;">
                    </div>
                    <div style="font-size: 13px; ${this.config.tmdbApiKey ? 'color: #22b365;' : 'opacity: 0.6;'}">
                        ${this.config.tmdbApiKey ? '● Connected to TMDB' : '○ No API key configured'}
                    </div>
                </div>
            </div>
        `;
        
        sectionsContainer.appendChild(section);
        this.attachSettingsListeners(section);
    }

    attachSettingsListeners(section) {
        const apiInput = section.querySelector('.de-api-input');
        const saveBtn = section.querySelector('.de-save-btn');
        const status = section.querySelector('div:last-child');
        
        saveBtn?.addEventListener('click', () => {
            this.config.tmdbApiKey = apiInput.value.trim();
            this.saveConfig();
            this.cache.clear();
            
            if (this.config.tmdbApiKey) {
                status.style.color = '#22b365';
                status.textContent = '● Connected to TMDB';
            } else {
                status.style.color = '';
                status.style.opacity = '0.6';
                status.textContent = '○ No API key configured';
            }
            
            saveBtn.textContent = '✓ Saved';
            setTimeout(() => { saveBtn.textContent = 'Save'; }, 2000);
        });
        
        const toggles = {
            '.de-toggle-cast': 'enhancedCast',
            '.de-toggle-similar': 'similarTitles',
            '.de-toggle-collection': 'showCollection'
        };
        
        Object.entries(toggles).forEach(([sel, key]) => {
            const toggle = section.querySelector(sel);
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    this.config[key] = e.target.checked;
                    this.saveConfig();
                });
            }
        });
    }

    cleanup(force = false) {
        if (!force) return;
        
        const container = document.querySelector('.data-enrichment-container');
        if (container) container.remove();
        
        console.log('[DataEnrichment] Cleaned up');
    }

    destroy() {
        console.log('[DataEnrichment] Destroying plugin...');
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        if (this.settingsObserver) {
            this.settingsObserver.disconnect();
            this.settingsObserver = null;
        }
        
        if (this.hashChangeHandler) {
            window.removeEventListener('hashchange', this.hashChangeHandler);
            this.hashChangeHandler = null;
        }
        
        if (this.checkDebounceTimer) {
            clearTimeout(this.checkDebounceTimer);
            this.checkDebounceTimer = null;
        }
        
        if (this.periodicCheckInterval) {
            clearInterval(this.periodicCheckInterval);
            this.periodicCheckInterval = null;
        }
        
        if (this.reactCheckTimer) {
            clearTimeout(this.reactCheckTimer);
            this.reactCheckTimer = null;
        }
        
        this.currentUrl = null;
        this.currentImdbId = null;
        this.currentTmdbId = null;
        this.cleanup(true);
        console.log('[DataEnrichment] Plugin destroyed');
    }
}

// Initialize plugin
(function initDataEnrichment() {
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
})();
