/**
 * @name Dynamic Hero
 * @description Netflix-style rotating hero banner.
 * @version 1.0.1
 * @author Fxy
 */

(function() {
    if (window.heroObserver) {
        window.heroObserver.disconnect();
        delete window.heroObserver;
    }

    let heroTitles = [];
    let currentIndex = 0;
    let autoRotateInterval;
    let isAutoRotating = true;
    
    const MAX_RETRIES = 2;
    const ROTATION_INTERVAL = 8000;

    let heroState = {
        isInitializing: false,
        initializationComplete: false,
        retryCount: 0,
        titlesReady: false,
        lastKnownHash: window.location.hash
    };

    const fallbackTitles = [
        {
            id: "tt0903747",
            title: "Breaking Bad",
            background: "https://images.metahub.space/background/large/tt0903747/img",
            logo: "https://images.metahub.space/logo/medium/tt0903747/img",
            description: "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student to secure his family's future.",
            year: "2008",
            duration: "45 min",
            seasons: "5 seasons",
            rating: "9.5",
            numericRating: 9.5,
            href: null,
            type: "series"
        },
        {
            id: "tt1375666",
            title: "Inception",
            background: "https://images.metahub.space/background/large/tt1375666/img",
            logo: "https://images.metahub.space/logo/medium/tt1375666/img",
            description: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into a CEO's mind.",
            year: "2010",
            duration: "148 min",
            seasons: "Movie",
            rating: "8.8",
            numericRating: 8.8,
            href: null,
            type: "movie"
        },
        {
            id: "tt0468569",
            title: "The Dark Knight",
            background: "https://images.metahub.space/background/large/tt0468569/img",
            logo: "https://images.metahub.space/logo/medium/tt0468569/img",
            description: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests.",
            year: "2008",
            duration: "152 min",
            seasons: "Movie",
            rating: "9.0",
            numericRating: 9.0,
            href: null,
            type: "movie"
        }
    ];

    async function fetchCatalogTitles(type, limit = 10) {
        const url = `https://cinemeta-catalogs.strem.io/top/catalog/${type}/top.json`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const metas = data.metas || [];
            
            return metas.slice(0, limit).map(meta => ({
                id: meta.id,
                title: meta.name,
                background: `https://images.metahub.space/background/large/${meta.id}/img`,
                logo: `https://images.metahub.space/logo/medium/${meta.id}/img`,
                description: meta.description || `Discover ${meta.name} and dive into an incredible viewing experience.`,
                year: meta.year ? meta.year.toString() : "2024",
                duration: meta.runtime ? `${meta.runtime}` : "Unknown",
                seasons: type === 'movie' ? 'Movie' : 'Series',
                rating: meta.imdbRating || "na",
                numericRating: parseFloat(meta.imdbRating) || 0,
                type: type,
                href: null,
                originalElement: null
            }));
            
        } catch (error) {
            console.error(`Failed to fetch ${type} catalog:`, error);
            return [];
        }
    }

    function formatDuration(runtime, type) {
        if (!runtime) return "Unknown";
        
        // Clean up the runtime string - remove extra text like "min min", "/10", etc.
        let cleanRuntime = runtime.toString().trim();
        
        // Remove common suffixes that cause duplication
        cleanRuntime = cleanRuntime.replace(/\s*min\s*min/gi, ' min');
        cleanRuntime = cleanRuntime.replace(/\s*\/\d+/g, ''); // Remove "/10" or similar
        cleanRuntime = cleanRuntime.replace(/\s*min\s*\/\d+/gi, ' min'); // Remove "min/10" patterns
        
        // Extract just the number if it's a pure number
        const numMatch = cleanRuntime.match(/^(\d+)/);
        if (numMatch) {
            const minutes = parseInt(numMatch[1]);
            if (type === 'movie' && minutes > 0) {
                return `${minutes} min`;
            } else if (type === 'series') {
                // For series, assume it's episode length
                return `${minutes} min per episode`;
            }
        }
        
        // If it already has "min" and looks correct, return as is
        if (cleanRuntime.match(/^\d+\s*min$/i)) {
            return cleanRuntime;
        }
        
        return cleanRuntime || "Unknown";
    }

    function formatSeasons(meta, type) {
        if (type === 'movie') {
            return 'Movie';
        }
        
        // For series, try to get season information
        if (meta.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
            const seasonSet = new Set();
            meta.videos.forEach(video => {
                if (video.season) seasonSet.add(video.season);
            });
            
            if (seasonSet.size > 1) {
                return `${seasonSet.size} seasons`;
            } else if (seasonSet.size === 1) {
                const episodeCount = meta.videos.length;
                return episodeCount > 1 ? `${episodeCount} episodes` : '1 episode';
            }
        }
        
        // Fallback for series
        return 'Series';
    }

    async function getDetailedMetaData(id, type) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(
                `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const meta = data.meta;
            
            if (!meta) return null;
            
            // Determine actual type from the metadata
            let actualType = type;
            if (meta.type) {
                actualType = meta.type;
            } else if (meta.videos && meta.videos.length > 0) {
                // If it has episodes/videos, it's likely a series
                actualType = 'series';
            }
            
            // Format duration properly
            let duration = "Unknown";
            if (meta.runtime) {
                duration = formatDuration(meta.runtime, actualType);
            } else if (actualType === 'series') {
                duration = "45 min per episode"; // Default for series
            }
            
            // Format seasons/type info
            let seasons = formatSeasons(meta, actualType);
            
            return {
                year: meta.year ? meta.year.toString() : "2024",
                duration: duration,
                rating: meta.imdbRating || "na",
                numericRating: parseFloat(meta.imdbRating) || 0,
                seasons: seasons,
                description: meta.description || `Discover ${meta.name} and dive into an incredible viewing experience.`,
                type: actualType, // Return the corrected type
                genres: meta.genre || meta.genres || [],
                cast: meta.cast || [],
                director: Array.isArray(meta.director) ? meta.director.join(', ') : meta.director || '',
                awards: meta.awards || ''
            };
            
        } catch (error) {
            console.error(`Failed to fetch detailed metadata for ${id}:`, error);
            return null;
        }
    }

    function resetHeroState() {
        heroState.isInitializing = false;
        heroState.retryCount = 0;
        stopAutoRotate();
    }

    function isBoardTabSelected() {
        const boardTab = document.querySelector(
            'a[title="Board"].selected, a[href="#/"].selected, .nav-tab-button-container-dYhs0.selected[href="#/"]'
        );
        return boardTab !== null;
    }

    function isBoardPage() {
        const currentHash = window.location.hash;
        return currentHash === '#/' || currentHash === '' || currentHash === '#';
    }

    function shouldShowHero() {
        return isBoardTabSelected() && isBoardPage();
    }

    function findParentElement() {
        const parentSelectors = [
            "#app > div.router-_65XU.routes-container > div > div.route-content > div.board-container-DTN_b > div > div > div",
            ".board-container-DTN_b > div > div > div",
            ".board-container-DTN_b > div > div",
            ".board-container-DTN_b > div",
            ".route-content > div",
            ".board-container-DTN_b",
            "[class*='board-container'] > div",
            "[class*='board-container']"
        ];

        for (const selector of parentSelectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }

        const boardRows = document.querySelectorAll('.board-row-CoJrZ');
        if (boardRows.length > 0) {
            const parent = boardRows[0].parentElement;
            if (parent) return parent;
        }

        const allContainers = document.querySelectorAll('div[class*="container"], div[class*="board"]');
        for (let container of allContainers) {
            if (container.querySelector('.board-row-CoJrZ')) {
                return container;
            }
        }

        return null;
    }

    async function waitForBoardElements(timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            function checkForElements() {
                if (!shouldShowHero()) {
                    resolve(false);
                    return;
                }
                
                const parent = findParentElement();
                const boardRows = document.querySelectorAll('.board-row-CoJrZ');
                
                if ((parent && boardRows.length > 0) || Date.now() - startTime > timeout) {
                    resolve(parent && boardRows.length > 0);
                } else {
                    setTimeout(checkForElements, 100);
                }
            }
            
            checkForElements();
        });
    }

    function showLoadingScreen() {
        let loadingScreen = document.getElementById('heroLoadingScreen');
        if (!loadingScreen) {
            loadingScreen = document.createElement('div');
            loadingScreen.id = 'heroLoadingScreen';
            loadingScreen.innerHTML = `
                <div class="loading-backdrop"></div>
                <div class="loading-content">
                    <div class="loading-text" id="loadingText">Loading popular content...</div>
                    <div class="loading-bar">
                        <div class="loading-progress" id="loadingProgress"></div>
                    </div>
                    <div class="loading-skip" onclick="skipLoading()" id="loadingSkip" style="margin-top: 20px; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 14px;">
                        Click to skip and use fallback content
                    </div>
                </div>
            `;
            document.body.appendChild(loadingScreen);
        }
        
        loadingScreen.style.cssText = `
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100vh !important;
            z-index: 999999 !important;
            opacity: 1; visibility: visible;
            backdrop-filter: blur(10px);
            pointer-events: auto;
            background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 50%, #0c0c0c 100%);
            display: flex; align-items: center; justify-content: center;
        `;
        
        document.body.style.overflow = 'hidden';
        return loadingScreen;
    }

    function updateLoadingStatus(text, progress = null) {
        const loadingText = document.getElementById('loadingText');
        const loadingProgress = document.getElementById('loadingProgress');
        
        if (loadingText) {
            loadingText.textContent = text;
        }
        
        if (progress !== null && loadingProgress) {
            loadingProgress.style.width = `${progress}%`;
        }
    }

    function hideLoadingScreen() {
        const loadingScreen = document.getElementById('heroLoadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.visibility = 'hidden';
            loadingScreen.style.pointerEvents = 'none';
            document.body.style.overflow = '';
            
            setTimeout(() => {
                if (loadingScreen.parentNode) {
                    document.body.removeChild(loadingScreen);
                }
            }, 500);
        }
    }

    window.skipLoading = function() {
        hideLoadingScreen();
        heroTitles = [...fallbackTitles];
        createHeroDirect();
    };

    window.playTitle = function(titleId) {
        const element = document.querySelector(`a[id="${titleId}"]`);
        if (element) {
            element.click();
        } else {
            const title = heroTitles.find(t => t.id === titleId);
            if (title) {
                const type = title.type === 'movie' ? 'movie' : 'series';
                window.location.hash = `#/detail/${type}/${titleId}`;
            }
        }
    };

    window.showMoreInfo = function(titleId) {
        const element = document.querySelector(`a[id="${titleId}"]`);
        if (element) {
            element.click();
        } else {
            const title = heroTitles.find(t => t.id === titleId);
            if (title) {
                const type = title.type === 'movie' ? 'movie' : 'series';
                window.location.hash = `#/detail/${type}/${titleId}`;
            }
        }
    };

    window.goToTitle = function(index) {
        if (index !== currentIndex && index >= 0 && index < heroTitles.length) {
            currentIndex = index;
            updateHeroContent(heroTitles[currentIndex]);
            resetAutoRotate();
        }
    };

    window.nextTitle = function() {
        currentIndex = (currentIndex + 1) % heroTitles.length;
        updateHeroContent(heroTitles[currentIndex]);
        resetAutoRotate();
    };

    window.previousTitle = function() {
        currentIndex = (currentIndex - 1 + heroTitles.length) % heroTitles.length;
        updateHeroContent(heroTitles[currentIndex]);
        resetAutoRotate();
    };

    window.toggleAutoRotate = function() {
        isAutoRotating = !isAutoRotating;
        const toggleBtn = document.getElementById('autoToggle');
        if (toggleBtn) {
            toggleBtn.textContent = isAutoRotating ? 'Pause' : 'Play';
        }

        if (isAutoRotating) {
            startAutoRotate();
        } else {
            stopAutoRotate();
        }
    };

    async function collectTitlesFromAPI() {
        const collectedTitles = [];
        updateLoadingStatus('Fetching popular movies...', 20);
        
        try {
            // Fetch movies and series in parallel
            const [movies, series] = await Promise.all([
                fetchCatalogTitles('movie', 8),
                fetchCatalogTitles('series', 8)
            ]);
            
            updateLoadingStatus('Fetching popular series...', 40);
            
            // Interleave movies and series for variety
            const maxTitles = 10;
            let movieIndex = 0;
            let seriesIndex = 0;
            let expectMovie = true;
            
            for (let i = 0; i < maxTitles && (movieIndex < movies.length || seriesIndex < series.length); i++) {
                let titleToAdd = null;
                
                if (expectMovie && movieIndex < movies.length) {
                    titleToAdd = movies[movieIndex];
                    movieIndex++;
                } else if (!expectMovie && seriesIndex < series.length) {
                    titleToAdd = series[seriesIndex];
                    seriesIndex++;
                } else if (movieIndex < movies.length) {
                    titleToAdd = movies[movieIndex];
                    movieIndex++;
                } else if (seriesIndex < series.length) {
                    titleToAdd = series[seriesIndex];
                    seriesIndex++;
                }
                
                expectMovie = !expectMovie;
                
                if (titleToAdd) {
                    updateLoadingStatus(`Getting details for ${titleToAdd.title}...`, 50 + (i * 4));
                    
                    // Get detailed metadata for better info
                    const detailedMeta = await getDetailedMetaData(titleToAdd.id, titleToAdd.type);
                    if (detailedMeta) {
                        titleToAdd.year = detailedMeta.year;
                        titleToAdd.duration = detailedMeta.duration;
                        titleToAdd.rating = detailedMeta.rating;
                        titleToAdd.numericRating = detailedMeta.numericRating;
                        titleToAdd.seasons = detailedMeta.seasons;
                        titleToAdd.type = detailedMeta.type; // Update with correct type
                        titleToAdd.genres = detailedMeta.genres;
                        titleToAdd.cast = detailedMeta.cast;
                        titleToAdd.director = detailedMeta.director;
                        titleToAdd.awards = detailedMeta.awards;
                        if (detailedMeta.description && detailedMeta.description !== titleToAdd.description) {
                            titleToAdd.description = detailedMeta.description;
                        }
                    }
                    
                    collectedTitles.push(titleToAdd);
                    
                    // Small delay to avoid overwhelming the API
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
        } catch (error) {
            console.error('Error collecting titles from API:', error);
            updateLoadingStatus('Error occurred, using fallbacks...', 85);
        }
        
        return collectedTitles;
    }

    function createHeroHTML(title) {
        const infoItems = [title.year];
        
        // Add duration if available and not "Unknown"
        if (title.duration && title.duration !== "Unknown") {
            infoItems.push(title.duration);
        }
        
        // Add seasons/type info
        if (title.seasons && title.seasons !== "Unknown") {
            infoItems.push(title.seasons);
        }
        
        return `
            <div class="hero-container">
                <img src="${title.background}" alt="Hero Background" class="hero-image" id="heroImage">
                <div class="hero-overlay">
                    <img src="${title.logo}" alt="Title Logo" class="hero-overlay-image" id="heroLogo">
                    <p class="hero-overlay-description" id="heroDescription">${title.description}</p>
                    <div class="hero-overlay-info" id="heroInfo">
                        ${infoItems.map(item => `<p>${item}</p>`).join('')}
                        ${title.rating && title.rating !== "na" ? 
                            `<p class="rating-item">
                                <span class="rating-text">⭐ ${title.rating}/10</span>
                            </p>` : ''
                        }
                    </div>
                   <div class="hero-overlay-actions">
                        <button class="hero-overlay-button-watch" onclick="event.stopPropagation(); playTitle('${title.id}')">
                            <span class="play-icon">▶</span> 
                            Watch Now
                        </button>
                        <button class="hero-overlay-button" onclick="event.stopPropagation(); showMoreInfo('${title.id}')">
                            <span class="info-icon">ⓘ</span>
                            More Info
                        </button>
                    </div>
                </div>
                <div class="hero-controls">
                    <button class="hero-control-btn" onclick="toggleAutoRotate()" id="autoToggle">
                        ${isAutoRotating ? 'Pause' : 'Play'}
                    </button>
                    <button class="hero-control-btn" onclick="previousTitle()">◀</button>
                    <button class="hero-control-btn" onclick="nextTitle()">▶</button>
                </div>
                <div class="hero-indicators">
                    ${heroTitles.map((_, index) => 
                        `<div class="hero-indicator ${index === currentIndex ? 'active' : ''}" 
                              onclick="goToTitle(${index})" data-index="${index}"></div>`
                    ).join('')}
                </div>
            </div>
        `;
    }

    function updateHeroContent(title, animate = true) {
        const heroImage = document.getElementById('heroImage');
        const heroLogo = document.getElementById('heroLogo');
        const heroDescription = document.getElementById('heroDescription');
        const heroInfo = document.getElementById('heroInfo');
        const heroAdditionalInfo = document.getElementById('heroAdditionalInfo');
        const watchButton = document.querySelector('.hero-overlay-button-watch');
        const moreInfoButton = document.querySelector('.hero-overlay-button');

        if (!heroImage || !heroLogo || !heroDescription || !heroInfo) return;

        const infoItems = [title.year];
        
        // Add duration if available and not "Unknown"
        if (title.duration && title.duration !== "Unknown") {
            infoItems.push(title.duration);
        }
        
        // Add seasons/type info
        if (title.seasons && title.seasons !== "Unknown") {
            infoItems.push(title.seasons);
        }
        
        const infoHTML = infoItems.map(item => `<p>${item}</p>`).join('') +
            (title.rating && title.rating !== "na" ? 
                `<p class="rating-item">
                    <span class="rating-text">⭐ ${title.rating}/10</span>
                </p>` : ''
            );

        // Generate additional info HTML
        let additionalInfoHTML = '';
        if (title.genres && title.genres.length > 0) {
            additionalInfoHTML += `<div class="hero-genres">${title.genres.join(' • ')}</div>`;
        }
        if (title.cast && title.cast.length > 0) {
            additionalInfoHTML += `<div class="hero-cast">Starring: ${title.cast.slice(0, 3).join(', ')}</div>`;
        }
        if (title.director) {
            additionalInfoHTML += `<div class="hero-director">Directed by ${title.director}</div>`;
        }
        if (title.awards) {
            additionalInfoHTML += `<div class="hero-awards">${title.awards}</div>`;
        }

        if (animate) {
            heroImage.style.opacity = '0';
            heroLogo.style.opacity = '0';
            heroDescription.style.opacity = '0';
            heroInfo.style.opacity = '0';
            if (heroAdditionalInfo) heroAdditionalInfo.style.opacity = '0';

            setTimeout(() => {
                heroImage.src = title.background;
                heroLogo.src = title.logo;
                heroDescription.textContent = title.description;
                heroInfo.innerHTML = infoHTML;
                if (heroAdditionalInfo) heroAdditionalInfo.innerHTML = additionalInfoHTML;

                if (watchButton) {
                    watchButton.setAttribute('onclick', `event.stopPropagation(); playTitle('${title.id}')`);
                }
                if (moreInfoButton) {
                    moreInfoButton.setAttribute('onclick', `event.stopPropagation(); showMoreInfo('${title.id}')`);
                }

                setTimeout(() => {
                    heroImage.style.opacity = '1';
                    heroLogo.style.opacity = '1';
                    heroDescription.style.opacity = '1';
                    heroInfo.style.opacity = '1';
                    if (heroAdditionalInfo) heroAdditionalInfo.style.opacity = '1';
                }, 50);

                updateIndicators();
            }, 300);
        } else {
            heroImage.src = title.background;
            heroLogo.src = title.logo;
            heroDescription.textContent = title.description;
            heroInfo.innerHTML = infoHTML;
            if (heroAdditionalInfo) heroAdditionalInfo.innerHTML = additionalInfoHTML;

            if (watchButton) {
                watchButton.setAttribute('onclick', `event.stopPropagation(); playTitle('${title.id}')`);
            }
            if (moreInfoButton) {
                moreInfoButton.setAttribute('onclick', `event.stopPropagation(); showMoreInfo('${title.id}')`);
            }

            updateIndicators();
        }
    }

    function updateIndicators() {
        const indicators = document.querySelectorAll('.hero-indicator');
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentIndex);
        });
    }

    function createHeroDirect() {
        if (!shouldShowHero()) {
            return;
        }
        
        const parent = findParentElement();
        if (!parent) {
            return;
        }
        
        const existingHero = parent.querySelector(".hero-container");
        if (existingHero) {
            existingHero.remove();
        }
        
        if (heroTitles.length === 0) {
            heroTitles = [...fallbackTitles];
        }
        
        currentIndex = 0;
        
        const heroHTML = createHeroHTML(heroTitles[0]);
        parent.insertAdjacentHTML("afterbegin", heroHTML);
        
        const insertedHero = parent.querySelector(".hero-container");
        if (insertedHero) {
            const heroImage = document.getElementById('heroImage');
            const heroLogo = document.getElementById('heroLogo');
            const heroDescription = document.getElementById('heroDescription');
            const heroInfo = document.getElementById('heroInfo');
            
            if (heroImage) heroImage.style.transition = 'opacity 0.3s ease-in-out';
            if (heroLogo) heroLogo.style.transition = 'opacity 0.3s ease-in-out';
            if (heroDescription) heroDescription.style.transition = 'opacity 0.3s ease-in-out';
            if (heroInfo) heroInfo.style.transition = 'opacity 0.3s ease-in-out';
            
            startAutoRotate();
            
            insertedHero.addEventListener('mouseenter', () => {
                if (isAutoRotating) stopAutoRotate();
            });
            
            insertedHero.addEventListener('mouseleave', () => {
                if (isAutoRotating) startAutoRotate();
            });
        }
    }

    function startAutoRotate() {
        if (autoRotateInterval) clearInterval(autoRotateInterval);
        if (isAutoRotating) {
            autoRotateInterval = setInterval(() => {
                currentIndex = (currentIndex + 1) % heroTitles.length;
                updateHeroContent(heroTitles[currentIndex]);
            }, ROTATION_INTERVAL);
        }
    }

    function stopAutoRotate() {
        if (autoRotateInterval) {
            clearInterval(autoRotateInterval);
            autoRotateInterval = null;
        }
    }

    function resetAutoRotate() {
        if (isAutoRotating) {
            stopAutoRotate();
            startAutoRotate();
        }
    }

    async function initializeTitles() {
        if (heroState.isInitializing) {
            return false;
        }
        heroState.isInitializing = true;
        showLoadingScreen();
        updateLoadingStatus('Fetching popular content...', 10);
        
        try {
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => resolve([]), 12000);
            });
            
            const collectionPromise = collectTitlesFromAPI();
            const collectedTitles = await Promise.race([collectionPromise, timeoutPromise]);
            
            updateLoadingStatus('Finalizing...', 90);
            
            if (collectedTitles.length > 0) {
                heroTitles = collectedTitles;
                updateLoadingStatus(`Ready! Found ${collectedTitles.length} popular titles`, 100);
            } else {
                heroTitles = [...fallbackTitles];
                updateLoadingStatus('Using fallback content...', 100);
            }
            
            await new Promise(resolve => setTimeout(resolve, 800));
            hideLoadingScreen();
            
            heroState.initializationComplete = true;
            heroState.titlesReady = true;
            return true;
            
        } catch (error) {
            heroTitles = [...fallbackTitles];
            heroState.titlesReady = true;
            updateLoadingStatus('Error - using fallback content...', 100);
            await new Promise(resolve => setTimeout(resolve, 1000));
            hideLoadingScreen();
            heroState.initializationComplete = true;
            return true;
        } finally {
            heroState.isInitializing = false;
        }
    }

    async function addHeroDiv() {
        if (!shouldShowHero()) {
            return;
        }
        
        const existingHero = document.querySelector('.hero-container');
        if (existingHero) {
            return;
        }
        
        if (heroState.isInitializing) {
            return;
        }
        
        const boardElementsReady = await waitForBoardElements(3000);
        if (!boardElementsReady) {
            return;
        }
        
        if (heroTitles.length > 0 && heroState.titlesReady) {
            createHeroDirect();
            return;
        }
        
        if (heroTitles.length === 0 || !heroState.titlesReady) {
            const success = await initializeTitles();
            if (success) {
                heroState.titlesReady = true;
                createHeroDirect();
            } else {
                if (heroState.retryCount < MAX_RETRIES) {
                    heroState.retryCount++;
                    setTimeout(() => addHeroDiv(), 3000);
                } else {
                    heroTitles = [...fallbackTitles];
                    heroState.titlesReady = true;
                    createHeroDirect();
                }
            }
        }
    }

    function handleNavigation() {
        const currentHash = window.location.hash;
        const heroExists = document.querySelector('.hero-container');
        const shouldShow = shouldShowHero();
        
        if (!shouldShow && heroExists) {
            heroExists.remove();
            resetHeroState();
            return;
        }
        
        if (shouldShow && !heroExists) {
            setTimeout(() => addHeroDiv(), 100);
            setTimeout(() => addHeroDiv(), 500);
            setTimeout(() => addHeroDiv(), 1000);
        }
        
        heroState.lastKnownHash = currentHash;
    }

    window.addEventListener('hashchange', () => {
        handleNavigation();
    });

    window.addEventListener('popstate', () => {
        setTimeout(handleNavigation, 100);
    });

    window.addEventListener('focus', () => {
        setTimeout(handleNavigation, 200);
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(handleNavigation, 300);
        }
    });

    window.heroObserver = new MutationObserver((mutations) => {
        let relevantMutation = false;
        
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.classList?.contains('board-container-DTN_b') || 
                            node.querySelector?.('.board-container-DTN_b') ||
                            node.classList?.contains('board-row-CoJrZ') ||
                            node.querySelector?.('.board-row-CoJrZ')) {
                            relevantMutation = true;
                            break;
                        }
                    }
                }
            }
        });
        
        if (relevantMutation) {
            setTimeout(handleNavigation, 200);
        }
    });

    window.heroObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    setInterval(() => {
        const heroExists = document.querySelector('.hero-container');
        const shouldShow = shouldShowHero();
        
        if (shouldShow && !heroExists && !heroState.isInitializing && !document.getElementById('heroLoadingScreen')) {
            addHeroDiv();
        }
    }, 3000);

    setTimeout(() => {
        handleNavigation();
    }, 1000);

})();