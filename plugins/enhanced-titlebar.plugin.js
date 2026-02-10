/**
 * @name Enhanced Title Bar
 * @description Enhances the title bar with additional information.
 * @version 26.0.1
 * @author Fxy
 */

const CONFIG = {
  apiBase: "https://v3-cinemeta.strem.io/meta",
  timeout: 5000,
};

const metadataCache = new Map();
const RETRY_CONFIG = {
  delay: 1200,
  maxAttempts: 3,
};
let enhanceTimeout = null;
let mutationObserver = null;
let isEnhancing = false;
let lastEnhanceRun = 0;
const MIN_RUN_INTERVAL = 800;

function injectStyles() {
  if (document.getElementById("enhanced-title-bar-styles")) return;

  const style = document.createElement("style");
  style.id = "enhanced-title-bar-styles";
  style.textContent = `
        .enhanced-title-bar {
            position: relative !important;
            padding: 5px 4px !important;
            padding-right: 10px !important;
            overflow: hidden !important;
            max-width: 400px !important;
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

    const response = await fetch(`${CONFIG.apiBase}/${type}/${id}.json`, {
      signal: controller.signal,
    });

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
      genres: Array.isArray(meta.genre)
        ? meta.genre
        : Array.isArray(meta.genres)
          ? meta.genres
          : [],
      runtime: meta.runtime || null,
      type: meta.type || type,
      poster: meta.poster,
      background: meta.background,
    };

    metadataCache.set(cacheKey, metadata);
    return metadata;
  } catch (error) {
    console.log(`Failed to fetch ${id}:`, error);
    return null;
  }
}

async function resolveMetadata(imdbId, typeHints) {
  for (let i = 0; i < typeHints.length; i++) {
    const type = typeHints[i];
    const metadata = await getMetadata(imdbId, type);
    if (metadata) return metadata;
  }
  return null;
}

function extractImdbId(posterImg, detailLink, cardOrContainer) {
  const candidates = [];

  if (posterImg) {
    candidates.push(posterImg.getAttribute("data-imdb-id"));
    candidates.push(posterImg.getAttribute("src"));
    candidates.push(posterImg.getAttribute("data-src"));
    candidates.push(posterImg.getAttribute("data-original"));
  }

  if (cardOrContainer && cardOrContainer.dataset) {
    candidates.push(cardOrContainer.dataset.imdb);
    candidates.push(cardOrContainer.dataset.id);
  }

  if (detailLink) {
    candidates.push(detailLink.getAttribute("href"));
    candidates.push(detailLink.getAttribute("data-id"));
    if (detailLink.id && /^tt\d{7,}$/.test(detailLink.id)) {
      candidates.push(detailLink.id);
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const value = candidates[i];
    if (!value || typeof value !== "string") continue;
    const match = value.match(/tt\d{7,}/);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function createMetadataElements(metadata) {
  const elements = [];

  if (metadata.rating) {
    const rating = document.createElement("span");
    rating.className = "enhanced-metadata-item enhanced-rating";
    rating.textContent = `★ ${metadata.rating}`;
    elements.push(rating);
  }

  if (metadata.year) {
    const year = document.createElement("span");
    year.className = "enhanced-metadata-item";
    year.textContent = metadata.year;
    elements.push(year);
  }

  if (metadata.genres && metadata.genres.length > 0) {
    const genres = document.createElement("span");
    genres.className = "enhanced-metadata-item";
    genres.textContent = metadata.genres.slice(0, 3).join(", ");
    elements.push(genres);
  }

  return elements;
}

async function enhanceMediaContainers() {
  if (isEnhancing) return;
  isEnhancing = true;
  lastEnhanceRun = Date.now();

  try {
    await enhanceMediaContainersImpl();
  } finally {
    isEnhancing = false;
  }
}

async function enhanceMediaContainersImpl() {
  // Find all media containers using multiple possible selectors
  const containerSelectors = [
    '[class*="poster-container"]',
    '[class*="media-item"]',
    '[class*="library-item"]',
    '[class*="board-item"]',
    '[class*="meta-item"]',
    '[class*="catalog-item"]',
    '[class*="poster-card"]',
  ];

  const containerSet = new Set();
  containerSelectors.forEach((selector) => {
    const matches = document.querySelectorAll(selector);
    for (let i = 0; i < matches.length; i++) {
      containerSet.add(matches[i]);
    }
  });

  // Also try finding containers by looking for elements that have both images and titlebars
  const allImages = document.querySelectorAll('img[src*="tt"]');
  allImages.forEach((img) => {
    let container = img.parentElement;
    let attempts = 0;
    while (container && attempts < 5) {
      const titlebar = container.querySelector(
        '[class*="title-bar"], [class*="title-label"]',
      );
      if (titlebar) {
        containerSet.add(container);
        break;
      }
      container = container.parentElement;
      attempts++;
    }
  });

  const containers = Array.from(containerSet);

  console.log(`Found ${containers.length} media containers to check`);

  for (const container of containers) {
    try {
      await enhanceContainer(container);
    } catch (error) {
      // Skip this container if enhancement fails
      console.log("Container enhancement failed:", error);
    }
  }
}

async function enhanceContainer(container) {
  // Find poster image (prefer ones with IMDb IDs)
  let posterImg = container.querySelector('img[src*="tt"]');
  if (!posterImg) {
    posterImg = container.querySelector("img");
  }

  // Card = single tile (one poster + one titlebar). Never use container-level
  // querySelector for link/titlebar or we pair CW with Popular when container spans both.
  const card = posterImg
    ? posterImg.closest("[class*=\"meta-item\"]") ||
      posterImg.closest("[class*=\"poster-container\"]")?.parentElement ||
      posterImg.parentElement
    : null;

  // Only use a detail link that is inside this card (or wraps the poster). Never
  // container.querySelector('a[...]') — that can return another row's link (e.g. Popular).
  let detailLink = posterImg
    ? posterImg.closest('a[href^="stremio:///detail/"], a[href*="#/detail/"]')
    : null;
  if (!detailLink && card) {
    detailLink = card.querySelector('a[href^="stremio:///detail/"], a[href*="#/detail/"]');
  }
  if (!detailLink && posterImg) {
    let node = posterImg.parentElement;
    for (let depth = 0; node && depth < 5; depth++) {
      if (
        node.tagName === "A" &&
        node.href &&
        (node.href.indexOf("stremio:///detail/") === 0 || node.href.indexOf("#/detail/") !== -1)
      ) {
        detailLink = node;
        break;
      }
      node = node.parentElement;
    }
  }

  if (!posterImg && !detailLink) {
    return;
  }
  const titlebarSelectors = [
    '[class*="title-bar-container"]',
    '[class*="title-bar"]',
    '[class*="title-label"]',
    '[class*="title-container"]',
  ];

  let titlebar = null;
  if (card) {
    for (const selector of titlebarSelectors) {
      titlebar = card.querySelector(selector);
      if (titlebar) break;
    }
    if (!titlebar && card.nextElementSibling) {
      const next = card.nextElementSibling;
      if (next.matches && next.matches("[class*=\"title-bar\"], [class*=\"title-label\"]")) {
        titlebar = next;
      } else {
        for (const selector of titlebarSelectors) {
          titlebar = next.querySelector(selector);
          if (titlebar) break;
        }
      }
    }
  }
  if (!titlebar && card) {
    // First titlebar that follows the poster within the same card only
    for (const selector of titlebarSelectors) {
      const list = card.querySelectorAll(selector);
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        if (posterImg.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
          titlebar = el;
          break;
        }
      }
      if (titlebar) break;
    }
  }
  if (!titlebar) {
    for (const selector of titlebarSelectors) {
      const list = (card || container).querySelectorAll(selector);
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        if (posterImg.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
          titlebar = el;
          break;
        }
      }
      if (titlebar) break;
    }
  }
  if (!titlebar) {
    for (const selector of titlebarSelectors) {
      titlebar = (card || container).querySelector(selector);
      if (titlebar) break;
    }
  }

  if (!titlebar) return;
  if (card && !card.contains(titlebar)) return;

  // Get the original title text
  const titleElement = titlebar.querySelector('[class*="title"]') || titlebar;
  let originalTitle = titleElement.textContent.trim();
  if (!originalTitle && posterImg) {
    const altTitle = posterImg.getAttribute("alt");
    if (altTitle && altTitle.trim()) {
      originalTitle = altTitle.trim();
    }
  }
  if (!originalTitle && posterImg) {
    const fallbackTitle = posterImg.getAttribute("title");
    if (fallbackTitle && fallbackTitle.trim()) {
      originalTitle = fallbackTitle.trim();
    }
  }

  // Find associated detail link (used for ID/type detection)
  if (!originalTitle && detailLink) {
    const linkTitle =
      detailLink.getAttribute("title") || detailLink.textContent;
    if (linkTitle && linkTitle.trim()) {
      originalTitle = linkTitle.trim();
    }
  }

  if (!originalTitle) return;

  const imdbId = extractImdbId(posterImg, detailLink, card || container);
  if (!imdbId) return;

  // Check if already enhanced with correct content (like covers plugin)
  const now = Date.now();
  const retryAt = parseInt(titlebar.dataset.enhancedRetryAt || "0", 10);
  if (retryAt && now < retryAt) {
    return;
  }

  let attempts = parseInt(titlebar.dataset.enhancedAttempts || "0", 10);
  const currentId = titlebar.dataset.enhancedId || "";
  const pending = titlebar.dataset.enhancedPending === "true";
  const complete = titlebar.dataset.enhancedComplete === "true";

  if (currentId !== imdbId) {
    attempts = 0;
  } else {
    if (complete) {
      return; // Already enhanced correctly
    }
    if (pending) {
      const updatedAt = parseInt(titlebar.dataset.enhancedUpdatedAt || "0", 10);
      if (!updatedAt || now - updatedAt < CONFIG.timeout) {
        return; // Still waiting on previous fetch
      }
    }
  }

  attempts += 1;
  titlebar.dataset.enhancedAttempts = attempts.toString();
  titlebar.dataset.enhancedUpdatedAt = now.toString();
  titlebar.dataset.enhancedPending = "true";
  titlebar.dataset.enhancedComplete = "false";
  titlebar.dataset.enhancedId = imdbId;
  delete titlebar.dataset.enhancedRetryAt;

  console.log(`Enhancing: "${originalTitle}" with IMDb ID: ${imdbId}`);

  // Mark as enhanced and store ID
  titlebar.classList.add("enhanced-title-bar");

  // Store original content if not already stored
  if (!titlebar.dataset.originalContent) {
    titlebar.dataset.originalContent = titlebar.innerHTML;
  }

  // Create enhanced structure
  titlebar.innerHTML = "";

  const title = document.createElement("div");
  title.className = "enhanced-title";
  title.textContent = originalTitle;
  titlebar.appendChild(title);

  const metadataContainer = document.createElement("div");
  metadataContainer.className = "enhanced-metadata";

  const loading = document.createElement("div");
  loading.className = "enhanced-loading";
  metadataContainer.appendChild(loading);

  titlebar.appendChild(metadataContainer);

  // Determine type hints for metadata fetching
  const typeHints = [];
  if (detailLink && detailLink.href) {
    const match = detailLink.href.match(/detail\/([^/]+)\//);
    if (match && match[1] && typeHints.indexOf(match[1]) === -1) {
      typeHints.push(match[1]);
    }
  }

  if (typeHints.indexOf("series") === -1) typeHints.push("series");
  if (typeHints.indexOf("movie") === -1) typeHints.push("movie");

  // Fetch and display metadata
  try {
    const metadata = await resolveMetadata(imdbId, typeHints);

    if (metadata) {
      if (metadata.title && metadata.title !== originalTitle) {
        title.textContent = metadata.title;
      }

      metadataContainer.innerHTML = "";

      const elements = createMetadataElements(metadata);
      elements.forEach((element, index) => {
        metadataContainer.appendChild(element);
        if (index < elements.length - 1) {
          const separator = document.createElement("span");
          separator.className = "enhanced-separator";
          separator.textContent = "•";
          metadataContainer.appendChild(separator);
        }
      });
      titlebar.dataset.enhancedPending = "false";
      titlebar.dataset.enhancedComplete = "true";
      titlebar.dataset.enhancedAttempts = "0";
      delete titlebar.dataset.enhancedRetryAt;
    } else {
      metadataContainer.innerHTML = "";
      titlebar.dataset.enhancedPending = "false";
      titlebar.dataset.enhancedComplete = "false";
      if (attempts < RETRY_CONFIG.maxAttempts) {
        titlebar.dataset.enhancedRetryAt = (
          Date.now() +
          RETRY_CONFIG.delay * attempts
        ).toString();
        scheduleEnhancement();
      }
    }
  } catch (error) {
    metadataContainer.innerHTML = "";
    console.log("Metadata fetch failed:", error);
    titlebar.dataset.enhancedPending = "false";
    titlebar.dataset.enhancedComplete = "false";
    if (attempts < RETRY_CONFIG.maxAttempts) {
      titlebar.dataset.enhancedRetryAt = (
        Date.now() +
        RETRY_CONFIG.delay * attempts
      ).toString();
      scheduleEnhancement();
    }
  }
}

function isOwnEnhancementMutation(target) {
  return (
    target &&
    typeof target.closest === "function" &&
    target.closest(".enhanced-title-bar")
  );
}

function scheduleEnhancement(mutationTarget) {
  if (mutationTarget && isOwnEnhancementMutation(mutationTarget)) {
    return;
  }
  if (enhanceTimeout) {
    clearTimeout(enhanceTimeout);
  }
  enhanceTimeout = setTimeout(() => {
    enhanceTimeout = null;
    const now = Date.now();
    if (isEnhancing || now - lastEnhanceRun < MIN_RUN_INTERVAL) {
      return;
    }
    enhanceMediaContainers();
  }, 300);
}

function init() {
  injectStyles();
  enhanceMediaContainers();

  if (mutationObserver) {
    mutationObserver.disconnect();
  }
  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const target = mutations[i].target;
        if (!isOwnEnhancementMutation(target)) {
          scheduleEnhancement(target);
          return;
        }
      }
    });
    if (document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  // Run every 2 seconds like covers plugin
  setInterval(() => {
    enhanceMediaContainers();
  }, 2000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

setTimeout(init, 100);
