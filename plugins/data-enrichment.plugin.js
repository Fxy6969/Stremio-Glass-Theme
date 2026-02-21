(() => {
    // Prevent multiple injections from Stremio's Mod Manager
    if (window.__DataEnrichmentLoaded) return;
    window.__DataEnrichmentLoaded = true;

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
                rpdbApiKey: '', 
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
            
            waitForElement('.meta-details-container').then(() => {
                 this.checkForDetailPage();
            }).catch(() => {
                 setTimeout(() => this.checkForDetailPage(), 1000);
            });
        }
        
        setupHashChangeListener() {
            this.lastHash = window.location.hash;
            
            const handleHashChange = () => {
                const newHash = window.location.hash;
                const oldImdbMatch = this.lastHash.match(/tt\d+/);
                const newImdbMatch = newHash.match(/tt\d+/);
                
                if (!newImdbMatch) {
                    console.log('[DataEnrichment] Navigated away from detail page, cleaning up');
                    this.cleanup(true);
                } else if (oldImdbMatch && newImdbMatch && oldImdbMatch[0] !== newImdbMatch[0]) {
                    console.log('[DataEnrichment] Navigated to different title, cleaning up old content');
                    this.cleanup(true);
                    this.currentImdbId = null;
                    setTimeout(() => this.checkForDetailPage(), 300);
                }
                
                this.lastHash = newHash;
            };
            
            window.addEventListener('hashchange', handleHashChange);
        }

        setupObserver() {
            this.observer = new MutationObserver((mutations) => {
                if (this.isEnriching) return;
                
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

            setTimeout(() => {
                this.checkForDetailPage();
                this.checkForPosters();
            }, 1000);
        }

        checkForDetailPage() {
            if (this.isEnriching) return;
            
            const urlHasImdbId = window.location.hash.match(/tt\d+/);
            if (!urlHasImdbId) return;
            
            const metaInfoContainer = document.querySelector('.meta-details-container') || document.querySelector('[class*="meta-info-container"]');
            if (!metaInfoContainer) return;

            const imdbId = this.extractImdbId();
            if (!imdbId) {
                console.log('[DataEnrichment] No IMDB ID found');
                this.cleanup();
                return;
            }
            
            if (imdbId === this.currentImdbId) return;

            console.log('[DataEnrichment] Found new IMDB ID:', imdbId);
            this.currentImdbId = imdbId;
            this.enrichDetailPage(imdbId, metaInfoContainer);
        }
        
        cleanup(force = false) {
            if (!force) return;
            const container = document.querySelector('.data-enrichment-container');
            if (container) container.remove();
            const badge = document.querySelector('.enhanced-tmdb-badge');
            if (badge) badge.remove();
            this.currentImdbId = null;
            console.log('[DataEnrichment] Cleaned up enrichment content');
        }

        extractImdbId() {
            const url = window.location.hash || window.location.href;
            const match = url.match(/tt\d+/);
            if (match) return match[0];

            const imdbLink = document.querySelector('a[href*="imdb.com/title/tt"]');
            if (imdbLink) {
                const linkMatch = imdbLink.href.match(/tt\d+/);
                if (linkMatch) return linkMatch[0];
            }
            
            const metaElements = document.querySelectorAll('[data-imdbid], [data-imdb-id]');
            for (const el of metaElements) {
                const id = el.dataset.imdbid || el.dataset.imdbId;
                if (id && id.match(/tt\d+/)) return id;
            }
            
            const allLinks = document.querySelectorAll('a[href*="imdb"]');
            for (const link of allLinks) {
                const idMatch = link.href.match(/tt\d+/);
                if (idMatch) return idMatch[0];
            }

            return null;
        }

        async enrichDetailPage(imdbId, container) {
            if (!this.config.tmdbApiKey) return;

            this.isEnriching = true;

            try {
                const data = await this.fetchTMDBData(imdbId);
                if (!data) {
                    this.isEnriching = false;
                    return;
                }

                const oldContainer = document.querySelector('.data-enrichment-container');
                if (oldContainer) oldContainer.remove();
                const oldBadge = document.querySelector('.enhanced-tmdb-badge');
                if (oldBadge) oldBadge.remove();
                
                const currentUrlImdbId = window.location.hash.match(/tt\d+/);
                if (!currentUrlImdbId || currentUrlImdbId[0] !== imdbId) {
                    this.isEnriching = false;
                    return;
                }
                
                this.currentImdbId = imdbId;
                
                const enrichmentContainer = this.createEnrichmentContainer();
                if (!enrichmentContainer) {
                    this.isEnriching = false;
                    return;
                }
                
                enrichmentContainer.dataset.imdbId = imdbId;
                this.injectRatingBadge(data, container);

                if (this.config.enhancedCast && data.credits) {
                    this.injectEnhancedCast(data.credits, enrichmentContainer);
                }

                if (this.config.showCollection && data.belongs_to_collection) {
                    await this.injectCollection(data.belongs_to_collection, enrichmentContainer);
                }

                if (this.config.similarTitles) {
                    let similarItems = [];
                    
                    // Priority 1: Use TMDB's behavior-based user recommendations (Highly Accurate)
                    if (data.recommendations && data.recommendations.results && data.recommendations.results.length > 0) {
                        console.log('[DataEnrichment] Using high-accuracy TMDB Recommendations');
                        similarItems = data.recommendations.results.slice(0, 15);
                    } 
                    // Priority 2: Fallback to keyword-based similar titles if recommendations are empty
                    else if (data.similar && data.similar.results) {
                        console.log('[DataEnrichment] Falling back to standard TMDB Similar titles');
                        similarItems = data.similar.results.slice(0, 15);
                    }

                    if (similarItems.length > 0) {
                        this.injectSimilarTitles({ results: similarItems }, enrichmentContainer);
                    }
                }

                this.lastEnrichmentTime = Date.now();

            } catch (error) {
                console.error('[DataEnrichment] Error enriching page:', error);
            } finally {
                this.isEnriching = false;
            }
        }

        createEnrichmentContainer() {
            const existing = document.querySelector('.data-enrichment-container');
            if (existing) existing.remove();
            
            let metaInfoContainer = document.querySelector('.meta-details-container') || document.querySelector('[class*="meta-info-container"]');
            if (metaInfoContainer) {
                const enrichmentContainer = document.createElement('div');
                enrichmentContainer.className = 'data-enrichment-container';
                metaInfoContainer.appendChild(enrichmentContainer);
                return enrichmentContainer;
            }
            
            const descriptionContainer = document.querySelector('[class*="description-container"]');
            if (descriptionContainer && descriptionContainer.parentElement) {
                const enrichmentContainer = document.createElement('div');
                enrichmentContainer.className = 'data-enrichment-container';
                descriptionContainer.parentElement.appendChild(enrichmentContainer);
                return enrichmentContainer;
            }
            
            const menuContainer = document.querySelector('[class*="menu-container-B6cqK"], [class*="menu-container"]');
            if (menuContainer) {
                const enrichmentContainer = document.createElement('div');
                enrichmentContainer.className = 'data-enrichment-container';
                menuContainer.appendChild(enrichmentContainer);
                return enrichmentContainer;
            }
            return null;
        }

        injectRatingBadge(data, container) {
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
                return this.cache.get(imdbId);
            }

            const apiKey = this.config.tmdbApiKey;
            if (!apiKey) return null;
            
            try {
                const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;
                const findResponse = await fetch(findUrl);
                
                if (!findResponse.ok) return null;
                
                const findData = await findResponse.json();

                let tmdbId, mediaType;
                if (findData.movie_results && findData.movie_results.length > 0) {
                    tmdbId = findData.movie_results[0].id;
                    mediaType = 'movie';
                } else if (findData.tv_results && findData.tv_results.length > 0) {
                    tmdbId = findData.tv_results[0].id;
                    mediaType = 'tv';
                } else {
                    return null;
                }
                
                const detailUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&append_to_response=credits,similar,recommendations,external_ids,content_ratings,release_dates,images&include_image_language=en,null`;
                const detailResponse = await fetch(detailUrl);
                
                if (!detailResponse.ok) return null;
                
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
            const collectionUrl = `https://api.themoviedb.org/3/collection/${collection.id}?api_key=${this.config.tmdbApiKey}`;
            const response = await fetch(collectionUrl);
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
                        console.error('[DataEnrichment] Error navigating to item:', error);
                    } finally {
                        item.style.opacity = '';
                        item.style.pointerEvents = '';
                    }
                });
            });
        }

        checkForPosters() {
            if (!this.config.showRatingsOnPosters || !this.config.rpdbApiKey) return;

            const posters = document.querySelectorAll('.meta-item-container-Tj0Ib:not([data-rpdb-enriched]), [class*="meta-item-container"]:not([data-rpdb-enriched]), .poster-container:not([data-rpdb-enriched]), .enhanced-poster-item:not([data-rpdb-enriched])');
            
            posters.forEach(poster => {
                poster.dataset.rpdbEnriched = 'true';
                
                const imgElement = poster.querySelector('img');
                if (!imgElement) return;

                let mediaId = null;
                let idType = 'imdb';

                if (poster.classList.contains('enhanced-poster-item')) {
                    const rawId = poster.dataset.id;
                    idType = 'tmdb';
                    mediaId = poster.dataset.mediaType === 'tv' ? `series-${rawId}` : `movie-${rawId}`;
                } else {
                    const linkElement = poster.tagName === 'A' ? poster : poster.querySelector('a');
                    if (!linkElement || !linkElement.href) return;

                    const imdbMatch = linkElement.href.match(/(tt\d+)/);
                    if (imdbMatch) {
                        mediaId = imdbMatch[1];
                        idType = 'imdb';
                    } else {
                        const tmdbMatch = linkElement.href.match(/tmdb[:\/](\d+)/);
                        if (tmdbMatch) {
                            idType = 'tmdb';
                            mediaId = linkElement.href.includes('series') ? `series-${tmdbMatch[1]}` : `movie-${tmdbMatch[1]}`;
                        }
                    }
                }

                if (mediaId) {
                    const rpdbKey = this.config.rpdbApiKey;
                    const rpdbUrl = `https://api.ratingposterdb.com/${rpdbKey}/${idType}/poster-default/${mediaId}.jpg?fallback=true`;

                    const tempImg = new Image();
                    tempImg.onload = () => {
                        imgElement.src = rpdbUrl; 
                        imgElement.removeAttribute('srcset'); 
                        
                        imgElement.style.setProperty('content', `url("${rpdbUrl}")`, 'important');
                        imgElement.style.setProperty('object-fit', 'cover', 'important');
                        
                        const bgContainer = poster.querySelector('.poster-image-container, .poster-image');
                        if (bgContainer) {
                            bgContainer.style.setProperty('background-image', `url("${rpdbUrl}")`, 'important');
                        }
                    };
                    
                    tempImg.onerror = () => {
                        console.debug(`[RPDB] Failed to load poster for ${mediaId}`);
                    };
                    
                    tempImg.src = rpdbUrl;
                }
            });
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
                            <button class="de-toggle-vis-btn" aria-label="Toggle visibility" title="Show/Hide">👁️</button>
                            <button class="tmdb-save-btn de-save-btn">Save</button>
                        </div>
                        <div class="de-hint">Get your free API key at themoviedb.org/settings/api</div>
                    </div>
                    <div class="option-container-pZ9Ip">
                        <div class="label-YVD3e">RPDB API Key</div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="password" class="rpdb-api-input de-input" value="${this.config.rpdbApiKey}" placeholder="Enter your RPDB API key">
                            <button class="de-toggle-vis-btn" aria-label="Toggle visibility" title="Show/Hide">👁️</button>
                            <button class="rpdb-save-btn de-save-btn">Save</button>
                        </div>
                        <div class="de-hint">Get your API key at ratingposterdb.com</div>
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
                .de-toggle-vis-btn { background: none; border: none; cursor: pointer; color: white; font-size: 16px; padding: 0 4px; opacity: 0.6; transition: 0.2s ease; }
                .de-toggle-vis-btn:hover { opacity: 1; }
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
            const tmdbApiInput = section.querySelector('.tmdb-api-input');
            const tmdbSaveBtn = section.querySelector('.tmdb-save-btn');
            const rpdbApiInput = section.querySelector('.rpdb-api-input');
            const rpdbSaveBtn = section.querySelector('.rpdb-save-btn');
            const status = section.querySelector('.de-status');
            
            // Visibility Toggle Logic
            const visBtns = section.querySelectorAll('.de-toggle-vis-btn');
            visBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const input = btn.previousElementSibling;
                    if (input && input.tagName === 'INPUT') {
                        if (input.type === 'password') {
                            input.type = 'text';
                            btn.textContent = '🙈';
                        } else {
                            input.type = 'password';
                            btn.textContent = '👁️';
                        }
                    }
                });
            });
            
            // TMDB Save
            tmdbSaveBtn?.addEventListener('click', () => {
                this.config.tmdbApiKey = tmdbApiInput.value.trim();
                this.saveConfig();
                this.cache.clear();
                
                if (this.config.tmdbApiKey) {
                    status.className = 'de-status de-status-active';
                    status.textContent = '● Connected to TMDB';
                } else {
                    status.className = 'de-status';
                    status.textContent = '○ No API key configured';
                }
                
                tmdbSaveBtn.textContent = '✓ Saved';
                tmdbSaveBtn.style.background = 'rgba(34,179,101,0.8)';
                setTimeout(() => { tmdbSaveBtn.textContent = 'Save'; tmdbSaveBtn.style.background = ''; }, 2000);
            });

            // RPDB Save
            rpdbSaveBtn?.addEventListener('click', () => {
                this.config.rpdbApiKey = rpdbApiInput.value.trim();
                this.saveConfig();
                
                rpdbSaveBtn.textContent = '✓ Saved';
                rpdbSaveBtn.style.background = 'rgba(34,179,101,0.8)';
                setTimeout(() => { rpdbSaveBtn.textContent = 'Save'; rpdbSaveBtn.style.background = ''; }, 2000);
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
})();
