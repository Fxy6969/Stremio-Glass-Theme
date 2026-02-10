/**
 * @name EnhancedCovers
 * @description Widens the cover images in the Continue Watching section using background images with logo overlay.
 * @updateUrl none
 * @version 26.0.1
 * @author Fxy rewritten and improved by MrBlu03
 */

(function () {
  // Store references for cleanup
  let coverInterval = null;
  let coverObserver = null;

  // Inject CSS to widen the poster containers - only in continue-watching-row
  function injectStyles() {
    if (document.getElementById("enhanced-covers-styles")) return;

    const style = document.createElement("style");
    style.id = "enhanced-covers-styles";
    style.textContent = `
      /* Only target Continue Watching row using exact class */
      [class*="continue-watching-row"] [class*="meta-item-container"] {
        min-width: 422px !important;
        max-width: 422px !important;
        flex: none !important;
      }

      /* Override the poster-shape-poster aspect ratio */
      [class*="continue-watching-row"] [class*="meta-item-container"][class*="poster-shape-poster"] {
        height: auto !important;
      }

      /* Make poster container height fit content, not use padding trick */
      [class*="continue-watching-row"] [class*="poster-container"] {
        padding-top: 0 !important;
        height: auto !important;
        aspect-ratio: 16 / 9 !important;
      }

      /* Make poster image layer fill the container */
      [class*="continue-watching-row"] [class*="poster-image-layer"] {
        position: relative !important;
        height: 100% !important;
        width: 100% !important;
      }

      /* Ensure the image covers properly */
      [class*="continue-watching-row"] [class*="poster-image-layer"] img[class*="poster-image"] {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        aspect-ratio: 16 / 9 !important;
        object-fit: cover !important;
        object-position: center center !important;
      }

      /* Logo overlay styling */
      .enhanced-logo-overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1;
        max-height: 50%;
        max-width: 70%;
        object-fit: contain;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
        pointer-events: none;
      }

      /* Add vignette overlay for better logo visibility */
      [class*="continue-watching-row"] [class*="poster-container"]::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%);
        pointer-events: none;
        z-index: 0;
        border-radius: var(--border-radius, 0.5rem);
      }

      /* Ensure poster container is relative for absolute positioning */
      [class*="continue-watching-row"] [class*="poster-container"] {
        position: relative;
      }
    `;
    document.head.appendChild(style);
    console.log("[EnhancedCovers] Styles injected");
  }

  // Extract IMDB ID from various URL formats
  function extractImdbId(url) {
    const match = url.match(/(tt\d+)/);
    return match ? match[1] : null;
  }

  // Clean up stale enhanced covers when items change
  function cleanupStaleCovers() {
    const continueWatchingRow = document.querySelector(
      '[class*="continue-watching-row"]',
    );
    if (!continueWatchingRow) return;

    const posters = continueWatchingRow.querySelectorAll(
      'img[class*="poster-image"][data-enhanced-cover]',
    );

    posters.forEach((img) => {
      // Check if the current IMDB ID in the src matches what we stored
      const storedImdbId = img.dataset.imdbId;
      const currentImdbId = extractImdbId(img.src);

      // If the image src was changed back by Stremio (different IMDB ID or no longer our metahub URL)
      if (storedImdbId && currentImdbId && storedImdbId !== currentImdbId) {
        // Reset this image - it's been reused for a different item
        console.log(
          `[EnhancedCovers] Detected stale cover: was ${storedImdbId}, now ${currentImdbId}`,
        );
        delete img.dataset.enhancedCover;
        delete img.dataset.originalSrc;
        delete img.dataset.imdbId;

        // Remove the old logo
        const posterContainer = img.closest('[class*="poster-container"]');
        if (posterContainer) {
          const oldLogo = posterContainer.querySelector(
            ".enhanced-logo-overlay",
          );
          if (oldLogo) oldLogo.remove();
        }
      }
    });

    // Also clean up any orphaned logos (logos without matching enhanced image)
    const allLogos = continueWatchingRow.querySelectorAll(
      ".enhanced-logo-overlay",
    );
    allLogos.forEach((logo) => {
      const posterContainer = logo.closest('[class*="poster-container"]');
      if (posterContainer) {
        const img = posterContainer.querySelector('img[class*="poster-image"]');
        if (!img || img.dataset.enhancedCover !== "true") {
          logo.remove();
          console.log("[EnhancedCovers] Removed orphaned logo");
        }
      }
    });
  }

  function replaceCover() {
    // First cleanup any stale covers
    cleanupStaleCovers();

    // Only target poster images inside continue-watching-row
    const continueWatchingRow = document.querySelector(
      '[class*="continue-watching-row"]',
    );
    if (!continueWatchingRow) return;

    const posters = continueWatchingRow.querySelectorAll(
      'img[class*="poster-image"]',
    );

    posters.forEach((img) => {
      // Skip if already processed
      if (img.dataset.enhancedCover === "true") return;
      if (!img.src) return;

      // Skip if already using background from metahub
      if (img.src.includes("images.metahub.space/background/")) return;

      // Try to extract IMDB ID from any source
      const imdbId = extractImdbId(img.src);

      if (imdbId) {
        // Construct metahub background URL
        const backgroundSrc = `https://images.metahub.space/background/medium/${imdbId}/img`;
        const logoSrc = `https://images.metahub.space/logo/medium/${imdbId}/img`;

        img.dataset.enhancedCover = "true";
        img.dataset.originalSrc = img.src;
        img.dataset.imdbId = imdbId;

        // Get the poster container to add the logo
        const posterContainer = img.closest('[class*="poster-container"]');

        // Remove any existing logo first (in case of mismatch)
        if (posterContainer) {
          const existingLogo = posterContainer.querySelector(
            ".enhanced-logo-overlay",
          );
          if (existingLogo) existingLogo.remove();
        }

        // Preload the background image
        const testImg = new Image();
        testImg.onload = function () {
          img.src = backgroundSrc;

          // Add logo overlay
          if (posterContainer) {
            const logoImg = document.createElement("img");
            logoImg.className = "enhanced-logo-overlay";
            logoImg.alt = "";
            logoImg.loading = "lazy";

            // Test if logo exists before adding
            const testLogo = new Image();
            testLogo.onload = function () {
              logoImg.src = logoSrc;
              posterContainer.appendChild(logoImg);
              console.log(`[EnhancedCovers] Added logo for ${imdbId}`);
            };
            testLogo.onerror = function () {
              console.log(`[EnhancedCovers] No logo found for ${imdbId}`);
            };
            testLogo.src = logoSrc;
          }

          console.log(`[EnhancedCovers] Replaced cover for ${imdbId}`);
        };
        testImg.onerror = function () {
          img.dataset.enhancedCover = "failed";
          console.log(`[EnhancedCovers] No background found for ${imdbId}`);
        };
        testImg.src = backgroundSrc;
      }
    });
  }

  function startPlugin() {
    // Inject styles immediately
    injectStyles();

    // Initial run with delay to let Stremio load
    setTimeout(replaceCover, 1000);
    setTimeout(replaceCover, 2000);

    // Use MutationObserver for efficient DOM change detection
    coverObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      let hasRemovedNodes = false;

      for (const mutation of mutations) {
        // Check for removed nodes (item dismissed)
        if (mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === 1) {
              if (
                node.matches?.('[class*="meta-item"]') ||
                node.querySelector?.('[class*="meta-item"]')
              ) {
                hasRemovedNodes = true;
                shouldUpdate = true;
                break;
              }
            }
          }
        }

        // Check for added nodes
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (
                node.matches?.('[class*="continue-watching"]') ||
                node.querySelector?.('[class*="continue-watching"]') ||
                node.matches?.('[class*="meta-item"]') ||
                node.querySelector?.('[class*="meta-item"]') ||
                node.matches?.('[class*="board-row"]') ||
                node.querySelector?.('[class*="board-row"]')
              ) {
                shouldUpdate = true;
              }
            }
            
            if (shouldUpdate) break;
          }
        }

        // Check for attribute changes on images (src changes)
        if (mutation.type === "attributes" && mutation.attributeName === "src") {
          const target = mutation.target;
          if (target.matches?.('img[class*="poster-image"]')) {
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) break;
      }

      if (shouldUpdate) {
        injectStyles();
        if (hasRemovedNodes) {
          // Item was removed - need immediate cleanup
          cleanupStaleCovers();
          setTimeout(replaceCover, 50);
        }
        setTimeout(replaceCover, 100);
        setTimeout(replaceCover, 500);
      }
    });

    coverObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
  }

  if (document.body && document.head) {
    startPlugin();
  } else {
    const checkReady = () => {
      if (document.body && document.head) {
        startPlugin();
      } else {
        setTimeout(checkReady, 50);
      }
    };
    checkReady();
  }

  // Handle navigation changes
  window.addEventListener("hashchange", () => {
    injectStyles();
    setTimeout(replaceCover, 500);
    setTimeout(replaceCover, 1500);
  });

  console.log("[EnhancedCovers] Plugin loaded successfully v1.6.0");
})();
