/**
 * @name Initializer
 * @description Initializes plugins, checks for required dependencies and updates
 * @version 26.0.1
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
   * Normalizes plugin name by removing .js extension
   */
  function normalize(name) {
    if (typeof name !== "string") return name;
    return name.replace(/\.js$/, "");
  }

  /**
   * Retrieves all enabled plugins from localStorage
   */
  function getAllPlugins() {
    try {
      const plugins = JSON.parse(localStorage.getItem("enabledPlugins") || "[]");
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
   */
  function isLiquidGlassThemeEnabled() {
    return (localStorage.getItem("currentTheme") || "") === INITIALIZER_CONFIG.THEME_NAME;
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

  // Create popup UI and start initialization
  createPopUpUI();
  initialize();

})();