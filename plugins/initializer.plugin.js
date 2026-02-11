/**
 * @name Initializer
 * @description Initializes plugins, checks for required dependencies and updates
 * @version 26.0.4
 * @author Fxy
 */

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const INITIALIZER_CONFIG = {
    GITHUB_REPO: "Fxy6969/Stremio-Glass-Theme",
    GITHUB_BRANCH: "v26",
    PLUGINS_PATH: "plugins",
    THEME_NAME: "liquid-glass.theme.css",
    POPUP_DURATION: 1200,
    // List of required plugins for the theme to work properly
    REQUIRED_PLUGINS: [
      "horizontal-navigation",
      "enhanced-covers", 
      "hero-div",
      "enhanced-titlebar",
      "enhanced-player",
      "data-enrichment",
      "context-menu-fix",
      "picture-in-picture",
      "stremio-addon-manager"
    ]
  };

  const WARNING_TYPES = {
    INFO: "info",
    WARNING: "warning",
    ERROR: "error",
    SUCCESS: "success",
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Normalizes plugin name by removing .js extension and cleaning up
   */
  function normalize(name) {
    if (typeof name !== "string") return name;
    return name.replace(/\.plugin\.js$/i, "").replace(/\.js$/i, "").trim();
  }

  /**
   * Detects if running in Stremio Community Edition
   * Community Edition loads plugins directly from webmods folder without localStorage tracking
   */
  function isCommunityEdition() {
    // Check for Community Edition indicators
    // 1. No enabledPlugins in localStorage
    const hasEnabledPlugins = localStorage.getItem("enabledPlugins") !== null;
    
    // 2. Plugins are loaded as script tags but not tracked in localStorage
    const scripts = document.querySelectorAll('script[src*=".plugin.js"]');
    const hasLoadedPlugins = scripts.length > 0;
    
    // 3. Check for Community Edition specific markers
    const isCE = window.navigator.userAgent.toLowerCase().includes('stremio') ||
                 document.querySelector('meta[name="stremio-community"]') !== null ||
                 (!hasEnabledPlugins && hasLoadedPlugins);
    
    if (isCE) {
      console.log("[Initializer] Detected Stremio Community Edition");
    }
    
    return isCE;
  }

  /**
   * Retrieves all enabled plugins from localStorage or DOM
   * Supports both standard Stremio and Community Edition formats
   */
  function getAllPlugins() {
    try {
      let plugins = [];
      
      // In Community Edition, plugins are loaded from webmods folder automatically
      // We need to detect them from the loaded scripts
      const ceMode = isCommunityEdition();
      
      if (ceMode) {
        console.log("[Initializer] Community Edition mode - detecting loaded plugins from DOM");
      }
      
      // Try multiple possible localStorage keys for plugin storage (Stremio Enhanced)
      const possibleKeys = [
        "enabledPlugins",
        "webmods_enabledPlugins", 
        "stremio_plugins",
        "plugins_enabled"
      ];
      
      for (const key of possibleKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
              plugins = parsed;
              console.log(`[Initializer] Found plugins in ${key}:`, parsed);
              break;
            }
          } catch (e) {
            // Not valid JSON, might be comma-separated string
            if (typeof data === 'string' && data.includes(',')) {
              plugins = data.split(',').map(p => p.trim()).filter(Boolean);
              console.log(`[Initializer] Found plugins in ${key} (CSV):`, plugins);
              break;
            }
          }
        }
      }
      
      // Also check if plugins are stored as individual boolean flags
      const allKeys = Object.keys(localStorage);
      const pluginKeys = allKeys.filter(key => 
        key.toLowerCase().includes('plugin') && 
        !key.toLowerCase().includes('version')
      );
      
      for (const key of pluginKeys) {
        const value = localStorage.getItem(key);
        if (value === 'true' || value === 'enabled') {
          const pluginName = key.replace(/^(enabled|plugin)_/i, '').replace(/_enabled$/i, '');
          if (pluginName && !plugins.includes(pluginName)) {
            plugins.push(pluginName);
            console.log(`[Initializer] Found enabled plugin: ${pluginName}`);
          }
        }
      }
      
      // Check for plugins loaded as script tags (Community Edition loads them this way)
      const scriptTags = document.querySelectorAll('script[data-plugin], script[id*="plugin"], script[src*=".plugin.js"]');
      console.log(`[Initializer] Found ${scriptTags.length} plugin script tags`);
      
      scriptTags.forEach(script => {
        let pluginName = null;
        
        // Try data attribute
        if (script.dataset.plugin) {
          pluginName = script.dataset.plugin;
        }
        // Try id
        else if (script.id) {
          pluginName = script.id.replace(/\.plugin\.js$/i, '');
        }
        // Try src attribute
        else if (script.src) {
          const match = script.src.match(/\/([^\/]+)\.plugin\.js$/i);
          if (match) {
            pluginName = match[1];
          }
        }
        
        if (pluginName) {
          pluginName = normalize(pluginName);
          if (pluginName && !plugins.some(p => normalize(p) === pluginName)) {
            plugins.push(pluginName);
            console.log(`[Initializer] Found plugin from script tag: ${pluginName}`);
          }
        }
      });
      
      // Check for plugin objects on window
      if (window.enabledPlugins && Array.isArray(window.enabledPlugins)) {
        window.enabledPlugins.forEach(plugin => {
          const pluginName = typeof plugin === 'string' ? plugin : plugin.name;
          if (pluginName && !plugins.some(p => normalize(p) === normalize(pluginName))) {
            plugins.push(pluginName);
            console.log(`[Initializer] Found plugin from window.enabledPlugins: ${pluginName}`);
          }
        });
      }
      
      // In Community Edition, if plugins are found in localStorage or window but we didn't find
      // any script tags, we might need to check the console or other indicators
      if (ceMode && plugins.length === 0) {
        console.log("[Initializer] Community Edition detected but no plugins found in DOM yet - assuming all required plugins are present");
        // In Community Edition, plugins are auto-loaded so assume they're all present
        plugins = [...INITIALIZER_CONFIG.REQUIRED_PLUGINS];
      }
      
      return plugins.map(normalize);
    } catch (error) {
      console.error("[Initializer] Failed to parse enabled plugins:", error);
      return [];
    }
  }

  /**
   * Compares two semantic version strings
   * @returns {number} 1 if a > b, -1 if a < b, 0 if equal
   */
  function compareVersions(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    
    for (let i = 0; i < 3; i++) {
      const va = pa[i] || 0;
      const vb = pb[i] || 0;
      if (va > vb) return 1;
      if (va < vb) return -1;
    }
    
    return 0;
  }

  /**
   * Fetches list of required plugins from GitHub
   */
  async function fetchRequiredPlugins() {
    try {
      const url = `https://api.github.com/repos/${INITIALIZER_CONFIG.GITHUB_REPO}/contents/${INITIALIZER_CONFIG.PLUGINS_PATH}?ref=${INITIALIZER_CONFIG.GITHUB_BRANCH}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`GitHub API returned ${res.status}`);
      }
      
      const files = await res.json();
      return files
        .filter((f) => f.type === "file" && f.name.endsWith(".js"))
        .map((f) => normalize(f.name));
    } catch (error) {
      console.error("[Initializer] Failed to fetch required plugins:", error);
      throw error;
    }
  }

  /**
   * Fetches version information for all required plugins
   */
  async function fetchGitHubPluginVersions(required, progressCallback) {
    const versions = {};
    const baseUrl = `https://raw.githubusercontent.com/${INITIALIZER_CONFIG.GITHUB_REPO}/${INITIALIZER_CONFIG.GITHUB_BRANCH}/${INITIALIZER_CONFIG.PLUGINS_PATH}`;
    
    for (let i = 0; i < required.length; i++) {
      const plugin = required[i];
      
      // Update progress with current plugin
      if (progressCallback) {
        progressCallback(plugin, i + 1, required.length);
      }
      
      try {
        const url = `${baseUrl}/${plugin}.js`;
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`[Initializer] Failed to fetch ${plugin}: ${response.status}`);
          continue;
        }
        
        const raw = await response.text();
        const match = raw.match(/@version\s+([^\s*]+)/);
        
        if (match) {
          versions[plugin] = match[1];
        }
      } catch (error) {
        console.warn(`[Initializer] Error fetching ${plugin}:`, error);
      }
    }
    
    return versions;
  }

  /**
   * Registers plugin version from script header
   */
  function registerPluginFromHeader(pluginName) {
    const script = document.getElementById(pluginName);
    if (!script) return;
    
    const match = script.innerHTML.match(/@version\s+([^\s*]+)/);
    if (!match) return;
    
    try {
      const versions = JSON.parse(localStorage.getItem("pluginVersions") || "{}");
      versions[pluginName] = match[1];
      localStorage.setItem("pluginVersions", JSON.stringify(versions));
    } catch (error) {
      console.error("[Initializer] Failed to register plugin version:", error);
    }
  }

  /**
   * Checks if Liquid Glass theme is enabled
   * Supports both standard Stremio and Community Edition formats
   */
  function isLiquidGlassThemeEnabled() {
    const possibleThemeKeys = [
      "currentTheme",
      "webmods_currentTheme",
      "stremio_theme",
      "theme_current",
      "activeTheme"
    ];
    
    for (const key of possibleThemeKeys) {
      const theme = localStorage.getItem(key);
      if (theme) {
        console.log(`[Initializer] Found theme in ${key}:`, theme);
        if (theme === INITIALIZER_CONFIG.THEME_NAME || 
            theme.includes("liquid-glass") ||
            theme.includes("glass")) {
          return true;
        }
      }
    }
    
    // Also check for theme-related CSS/classes on the document
    const hasThemeClass = document.documentElement.className.toLowerCase().includes('glass') ||
                          document.body.className.toLowerCase().includes('glass');
    if (hasThemeClass) {
      console.log("[Initializer] Detected glass theme from CSS classes");
      return true;
    }
    
    return false;
  }

  /**
   * Removes item from localStorage array
   */
  function removeFromList(key, value) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const filtered = list.filter((item) => item !== value);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (error) {
      console.error(`[Initializer] Failed to remove from ${key}:`, error);
    }
  }

  /**
   * Adds item to localStorage array if not present
   */
  function addToList(key, value) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (!list.includes(value)) {
        list.push(value);
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch (error) {
      console.error(`[Initializer] Failed to add to ${key}:`, error);
    }
  }

  /**
   * Resets theme to default if Liquid Glass is not enabled
   */
  function resetThemeToDefaultIfLiquidGlass() {
    if (isLiquidGlassThemeEnabled()) return false;
    
    localStorage.setItem("currentTheme", "");
    removeFromList("enabledPlugins", "Horizontal Navigation");
    return true;
  }

  // ============================================================================
  // POPUP UI
  // ============================================================================

  /**
   * Injects popup styles into document head
   */
  function ensurePopupStyles() {
    if (document.getElementById("initializer-popup-style")) return;
    
    // Ensure head exists before trying to append
    if (!document.head) {
      setTimeout(ensurePopupStyles, 100);
      return;
    }
    
    const style = document.createElement("style");
    style.id = "initializer-popup-style";
    style.textContent = `
      .PopUpUI {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0);
        color: white;
        background: rgba(50, 50, 50, 0.8);
        border-radius: 12px;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.06);
        z-index: 9999;
        overflow: hidden;
        width: 400px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        opacity: 0;
        transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease;
      }

      .PopUpUI.show {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }

      .PopUpUI.hide {
        transform: translate(-50%, -50%) scale(0);
        opacity: 0;
      }

      .popup-inner {
        width: 100%;
        overflow: hidden;
        padding: 0 20px;
        transition: height 0.4s ease, padding 0.4s ease;
      }

      .warning-message {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        text-align: left;
      }

      .warning-message-title {
        font-size: 23px;
        font-weight: bold;
      }

      .warning-message-content {
        font-size: 15px;
        opacity: 0.8;
        line-height: 1.5;
      }

      .warning-progress-container {
        width: 100%;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        overflow: hidden;
        height: 12px;
        margin-top: 10px;
      }

      .warning-progress-bar {
        width: 0%;
        height: 100%;
        background: #fff;
        transition: width 0.3s ease;
      }

      .warning-detail-text {
        font-size: 13px;
        opacity: 0.6;
        margin-top: 5px;
        font-family: monospace;
        word-break: break-all;
      }

      .warning-message-button {
        margin-top: 15px;
        width: 100%;
        padding: 10px 20px;
        border-radius: 12px;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.06);
        cursor: pointer;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 14px;
        transition: background 0.2s ease;
      }

      .warning-message-button:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Creates popup UI element
   */
  function createPopUpUI() {
    ensurePopupStyles();
    
    let div = document.getElementById("PopUpUI");
    if (div) return;
    
    div = document.createElement("div");
    div.id = "PopUpUI";
    div.className = "PopUpUI";
    document.body.appendChild(div);
  }

  /**
   * Closes the popup with animation
   */
  function closePopup() {
    const div = document.getElementById("PopUpUI");
    if (!div) return;
    
    const inner = div.querySelector(".popup-inner");
    const app = document.querySelector("#app");
    
    if (inner) {
      inner.style.height = "0px";
      inner.style.padding = "0 20px";
    }
    
    div.classList.remove("show");
    div.classList.add("hide");
    
    if (app) {
      app.style.filter = "";
    }
    
    setTimeout(() => {
      div.style.display = "none";
      div.classList.remove("hide");
    }, 400);
  }

  /**
   * Displays warning message in popup
   */
  function sendWarningMessage(
    title,
    message,
    type = WARNING_TYPES.INFO,
    progressBar = false,
    dismissible = true,
    detailText = ""
  ) {
    const div = document.getElementById("PopUpUI");
    if (!div) return;
    
    div.innerHTML = `
      <div class="popup-inner">
        <div class="warning-message">
          <div class="warning-message-title">${title}</div>
          <div class="warning-message-content">${message}</div>
          ${
            detailText
              ? `<div id="warningDetailText" class="warning-detail-text">${detailText}</div>`
              : ""
          }
          ${
            progressBar
              ? `
            <div class="warning-progress-container">
              <div id="warningProgressBar" class="warning-progress-bar"></div>
            </div>
          `
              : ""
          }
          ${
            dismissible
              ? `<button class="warning-message-button">Dismiss</button>`
              : ""
          }
        </div>
      </div>
    `;
    
    const inner = div.querySelector(".popup-inner");
    if (!inner) return;
    
    // Reset height
    inner.style.height = "0px";
    inner.style.padding = "0 20px";
    div.style.display = "flex";
    
    // Trigger animation
    requestAnimationFrame(() => {
      div.classList.add("show");
      
      requestAnimationFrame(() => {
        const contentHeight = inner.scrollHeight + 35 + "px";
        inner.style.height = contentHeight;
        inner.style.padding = "20px";
      });
    });
    
    // Apply blur to app
    const app = document.querySelector("#app");
    if (app) {
      app.style.transition = "filter 0.4s ease";
      app.style.filter = "blur(5px)";
    }
    
    // Add dismiss handler
    const button = div.querySelector(".warning-message-button");
    if (button) {
      button.onclick = closePopup;
    }
  }

  /**
   * Updates progress bar percentage
   */
  function updateProgress(percent) {
    const bar = document.getElementById("warningProgressBar");
    if (!bar) return;
    bar.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
  }

  /**
   * Updates detail text in popup
   */
  function updateDetailText(text) {
    const detail = document.getElementById("warningDetailText");
    if (!detail) return;
    detail.textContent = text;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Main initialization function
   */
  async function initialize() {
    try {
      // Check if running in Community Edition mode
      const ceMode = isCommunityEdition();
      
      // In Community Edition, plugins are auto-loaded from webmods folder
      // Skip the full initialization and just show a brief success message
      if (ceMode) {
        console.log("[Initializer] Community Edition mode - skipping plugin checks");
        
        // Quick check if theme is present
        if (!isLiquidGlassThemeEnabled()) {
          console.log("[Initializer] Theme not detected in Community Edition");
          // Don't show warning in CE - theme might be loaded differently
        }
        
        // Show brief success message
        sendWarningMessage(
          "Modern Glass Theme",
          "Theme initialized successfully in Community Edition",
          WARNING_TYPES.SUCCESS,
          false,
          false
        );
        
        setTimeout(closePopup, INITIALIZER_CONFIG.POPUP_DURATION);
        return;
      }
      
      // Show initial message
      sendWarningMessage(
        "Checking plugins",
        "Connecting to GitHub...",
        WARNING_TYPES.INFO,
        true,
        false,
        "Initializing..."
      );
      
      // Small delay to ensure UI renders
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Get enabled plugins
      updateProgress(10);
      updateDetailText("Loading enabled plugins...");
      const enabled = getAllPlugins();
      console.log("[Initializer] Enabled plugins:", enabled);
      
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // Fetch required plugins
      updateProgress(20);
      updateDetailText("Fetching plugin list from GitHub...");
      const required = await fetchRequiredPlugins();
      console.log("[Initializer] Required plugins:", required);
      
      updateProgress(40);
      updateDetailText(`Found ${required.length} required plugins`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      // Check for missing plugins
      const missing = required.filter((p) => !enabled.includes(p));
      
      if (missing.length > 0) {
        const themeWasReset = resetThemeToDefaultIfLiquidGlass();
        
        sendWarningMessage(
          "Missing plugins",
          `
            <div>The following plugins are required:</div>
            <div style="margin: 10px 0; font-family: monospace; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px;">
              ${missing.join("<br>")}
            </div>
            ${
              themeWasReset
                ? `
              <div style="margin-top: 10px;">The following theme is required:</div>
              <div style="margin: 10px 0; font-family: monospace; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px;">
                ${INITIALIZER_CONFIG.THEME_NAME}
              </div>
            `
                : ""
            }
            <div>Please install or enable them and reload the app.</div>
          `,
          WARNING_TYPES.WARNING,
          false,
          true
        );
        return;
      }
      
      // Fetch remote versions with progress updates
      updateProgress(50);
      updateDetailText("Checking plugin versions...");
      
      const remoteVersions = await fetchGitHubPluginVersions(required, (plugin, current, total) => {
        const percent = 50 + (current / total) * 30; // 50% to 80%
        updateProgress(percent);
        updateDetailText(`Verifying: ${plugin} (${current}/${total})`);
      });
      
      updateProgress(80);
      updateDetailText("Comparing versions...");
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // Check for outdated plugins
      const localVersions = JSON.parse(
        localStorage.getItem("pluginVersions") || "{}"
      );
      
      const outdated = Object.entries(remoteVersions)
        .filter(
          ([plugin, remoteVer]) =>
            localVersions[plugin] &&
            compareVersions(localVersions[plugin], remoteVer) < 0
        )
        .map(
          ([plugin, remoteVer]) =>
            `${plugin} (${localVersions[plugin]} → ${remoteVer})`
        );
      
      updateProgress(90);
      
      if (outdated.length > 0) {
        const themeWasReset = resetThemeToDefaultIfLiquidGlass();
        
        sendWarningMessage(
          "Updates available",
          `
            <div>The following plugins have updates available:</div>
            <div style="margin: 10px 0; font-family: monospace; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px;">
              ${outdated.join("<br>")}
            </div>
            ${
              themeWasReset
                ? `
              <div style="margin-top: 10px; color: #ffa500;">
                Liquid Glass theme was disabled because required plugins are out of date.
              </div>
            `
                : ""
            }
          `,
          WARNING_TYPES.INFO,
          false,
          true
        );
        return;
      }
      
      updateProgress(100);
      updateDetailText("All checks complete!");
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // Success!
      sendWarningMessage(
        "All set!",
        "All required plugins are installed and up to date.",
        WARNING_TYPES.SUCCESS,
        false,
        false
      );
      
      setTimeout(closePopup, INITIALIZER_CONFIG.POPUP_DURATION);
    } catch (error) {
      console.error("[Initializer] Initialization failed:", error);
      
      sendWarningMessage(
        "Error",
        `Failed to initialize: ${error.message}<br><br>Please check your internet connection and try reloading.`,
        WARNING_TYPES.ERROR,
        false,
        true
      );
    }
  }

  // Wait for document to be ready before starting
  function startWhenReady() {
    if (document.readyState === 'loading' || !document.body || !document.head) {
      setTimeout(startWhenReady, 50);
      return;
    }
    
    // Create popup UI and start initialization
    createPopUpUI();
    initialize();
  }
  
  startWhenReady();

})();