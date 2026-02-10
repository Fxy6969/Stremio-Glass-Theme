/**
 * @name Enhanced Video Player
 * @description Enhances the video player with additional features and designs.
 * @version 26.0.1
 * @author Fxy
 */

const SUBTITLE_STORAGE_KEY = "stremio-enhanced-subtitle-style";

const SUBTITLE_PRESETS = {
  default: {
    name: "Default",
    fontSize: 100,
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.8)",
    outline: "1px solid black",
    bottomPercent: 5,
    shadow: "2px 2px 4px rgba(0,0,0,0.8)",
    letterSpacing: "normal",
    lineHeight: 1.4,
  },
  large: {
    name: "Large",
    fontSize: 140,
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.85)",
    outline: "2px solid black",
    bottomPercent: 6,
    shadow: "3px 3px 6px rgba(0,0,0,0.9)",
    letterSpacing: "0.02em",
    lineHeight: 1.5,
  },
  yellow: {
    name: "Yellow",
    fontSize: 110,
    fontFamily: "Arial, sans-serif",
    color: "#ffff00",
    backgroundColor: "rgba(0,0,0,0.75)",
    outline: "1px solid black",
    bottomPercent: 5,
    shadow: "2px 2px 4px rgba(0,0,0,0.8)",
    letterSpacing: "normal",
    lineHeight: 1.4,
  },
  minimal: {
    name: "Minimal",
    fontSize: 95,
    fontFamily: "Helvetica, Arial, sans-serif",
    color: "#ffffff",
    backgroundColor: "transparent",
    outline: "none",
    bottomPercent: 8,
    shadow: "2px 2px 8px rgba(0,0,0,1)",
    letterSpacing: "normal",
    lineHeight: 1.3,
  },
  cinema: {
    name: "Cinema",
    fontSize: 120,
    fontFamily: "Georgia, serif",
    color: "#f0f0f0",
    backgroundColor: "rgba(0,0,0,0.9)",
    outline: "none",
    bottomPercent: 4,
    shadow: "0 4px 12px rgba(0,0,0,0.9)",
    letterSpacing: "0.03em",
    lineHeight: 1.6,
  },
  custom: { name: "Custom", custom: true },
};

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

function getSubtitleStyle() {
  try {
    const raw = localStorage.getItem(SUBTITLE_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.preset && SUBTITLE_PRESETS[data.preset] && !SUBTITLE_PRESETS[data.preset].custom) {
        return { ...SUBTITLE_PRESETS[data.preset], preset: data.preset };
      }
      if (data.custom) return { ...SUBTITLE_PRESETS.default, ...data.custom, preset: "custom" };
    }
  } catch (_) {}
  return { ...SUBTITLE_PRESETS.default, preset: "default" };
}

function saveSubtitleStyle(preset, custom) {
  localStorage.setItem(
    SUBTITLE_STORAGE_KEY,
    JSON.stringify({ preset, custom: custom || null })
  );
}

function applySubtitleStyle(style) {
  let el = document.getElementById("enhanced-player-subtitle-style");
  if (!el) {
    el = document.createElement("style");
    el.id = "enhanced-player-subtitle-style";
    document.head.appendChild(el);
  }
  const fs = (style.fontSize || 100) / 100;
  const bottom = style.bottomPercent != null ? style.bottomPercent : 5;
  const letterSpacing = style.letterSpacing || "normal";
  const lineHeight = style.lineHeight || 1.4;
  const shadow = style.shadow || "2px 2px 4px rgba(0,0,0,0.8)";
  
  el.textContent = `
    video::cue {
      font-size: ${fs}em !important;
      font-family: ${style.fontFamily || "Arial, sans-serif"} !important;
      color: ${style.color || "#ffffff"} !important;
      background-color: ${style.backgroundColor != null ? style.backgroundColor : "rgba(0,0,0,0.8)"} !important;
      outline: ${style.outline != null ? style.outline : "1px solid black"} !important;
      text-shadow: ${shadow} !important;
      letter-spacing: ${letterSpacing} !important;
      line-height: ${lineHeight} !important;
    }
    [class*="player-container"] video::cue,
    [class*="theater-container"] video::cue {
      font-size: ${fs}em !important;
      font-family: ${style.fontFamily || "Arial, sans-serif"} !important;
      color: ${style.color || "#ffffff"} !important;
      background-color: ${style.backgroundColor != null ? style.backgroundColor : "rgba(0,0,0,0.8)"} !important;
      outline: ${style.outline != null ? style.outline : "1px solid black"} !important;
      text-shadow: ${shadow} !important;
      letter-spacing: ${letterSpacing} !important;
      line-height: ${lineHeight} !important;
    }
    [class*="subtitle"][class*="text"],
    [class*="caption"],
    [class*="cue"] {
      font-size: ${(style.fontSize || 100) / 100}em !important;
      font-family: ${style.fontFamily || "Arial, sans-serif"} !important;
      color: ${style.color || "#ffffff"} !important;
      background: ${style.backgroundColor != null ? style.backgroundColor : "rgba(0,0,0,0.8)"} !important;
      outline: ${style.outline != null ? style.outline : "1px solid black"} !important;
      bottom: ${bottom}% !important;
      text-shadow: ${shadow} !important;
      letter-spacing: ${letterSpacing} !important;
      line-height: ${lineHeight} !important;
    }
  `;
}

class EnhancedPlayer {
  constructor() {
    this.subtitleStyle = getSubtitleStyle();
    this.init();
  }

  init() {
    this.moveTitles();
    setTimeout(() => {
      this.moveTitles();
    }, 500);
    const observer = new MutationObserver(() => {
      this.moveTitles();
      this.tryInjectSubtitleCustomizer();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    this.tryInjectSubtitleCustomizer();
    applySubtitleStyle(this.subtitleStyle);
  }

  injectSubtitleUICssOnce() {
    if (document.getElementById("enhanced-subtitle-ui-styles")) return;
    const el = document.createElement("style");
    el.id = "enhanced-subtitle-ui-styles";
    document.head.appendChild(el);
  }

  updatePreviewStyle(previewText) {
    if (!previewText) return;
    const s = this.subtitleStyle;
    previewText.style.fontSize = `${(s.fontSize || 100) / 100}em`;
    previewText.style.fontFamily = s.fontFamily || "Arial, sans-serif";
    previewText.style.color = s.color || "#ffffff";
    previewText.style.backgroundColor = s.backgroundColor != null ? s.backgroundColor : "rgba(0,0,0,0.8)";
    previewText.style.outline = s.outline != null ? s.outline : "1px solid black";
    previewText.style.textShadow = s.shadow || "2px 2px 4px rgba(0,0,0,0.8)";
    previewText.style.letterSpacing = s.letterSpacing || "normal";
    previewText.style.lineHeight = s.lineHeight || 1.4;
  }

  tryInjectSubtitleCustomizer() {
    const container = document.querySelector('[class*="subtitles-menu-container"]');
    if (!container || container.querySelector(".enhanced-subtitle-customize-section")) return;

    this.injectSubtitleUICssOnce();
    const settingsSection = container.querySelector('[class*="subtitles-settings-container"]');
    const wrap = document.createElement("div");
    wrap.className = "enhanced-subtitle-customize-section";

    const header = document.createElement("div");
    header.className = "enhanced-subtitle-customize-header";
    header.innerHTML = `
      <span class="enhanced-header-icon">✨</span>
      <span>Customize Subtitles</span>
    `;

    const presetsBar = document.createElement("div");
    presetsBar.className = "enhanced-subtitle-presets-bar";
    presetsBar.setAttribute("role", "tablist");

    const presetIds = ["default", "large", "yellow", "minimal", "cinema", "custom"];
    presetIds.forEach((id) => {
      const preset = SUBTITLE_PRESETS[id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "enhanced-subtitle-preset-btn" + (this.subtitleStyle.preset === id ? " selected" : "");
      btn.textContent = preset.name;
      btn.dataset.preset = id;
      btn.onclick = () => this.selectPreset(id, presetsBar, settingsList, previewText);
      presetsBar.appendChild(btn);
    });

    const previewSection = document.createElement("div");
    previewSection.className = "enhanced-subtitle-preview-section";
    
    const previewLabel = document.createElement("div");
    previewLabel.className = "enhanced-subtitle-preview-label";
    previewLabel.textContent = "Preview";
    
    const previewBox = document.createElement("div");
    previewBox.className = "enhanced-subtitle-preview-box";
    
    const previewText = document.createElement("div");
    previewText.className = "enhanced-subtitle-preview-text";
    previewText.textContent = "The quick brown fox jumps over the lazy dog";
    
    previewBox.appendChild(previewText);
    previewSection.appendChild(previewLabel);
    previewSection.appendChild(previewBox);

    const settingsList = document.createElement("div");
    settingsList.className = "enhanced-subtitle-settings-list";

    this.buildCustomControls(settingsList, presetsBar, previewText);
    this.updatePreviewStyle(previewText);

    wrap.appendChild(header);
    wrap.appendChild(presetsBar);
    wrap.appendChild(previewSection);
    wrap.appendChild(settingsList);
    
    if (settingsSection && settingsSection.nextSibling) {
      container.insertBefore(wrap, settingsSection.nextSibling);
    } else {
      container.appendChild(wrap);
    }
  }

  selectPreset(id, presetsBar, settingsList, previewText) {
    this.subtitleStyle.preset = id;
    presetsBar.querySelectorAll(".enhanced-subtitle-preset-btn").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.preset === id);
    });
    if (id !== "custom") {
      const preset = SUBTITLE_PRESETS[id];
      if (preset && !preset.custom) {
        this.subtitleStyle = { ...preset, preset: id };
        saveSubtitleStyle(id, null);
      }
    } else {
      this.subtitleStyle = { ...getSubtitleStyle(), preset: "custom" };
      if (this.subtitleStyle.custom) delete this.subtitleStyle.custom;
      saveSubtitleStyle("custom", this.getCustomPayload());
    }
    this.refreshControlValues(settingsList);
    this.updatePreviewStyle(previewText);
    applySubtitleStyle(this.subtitleStyle);
  }

  getCustomPayload() {
    return {
      fontSize: this.subtitleStyle.fontSize,
      fontFamily: this.subtitleStyle.fontFamily,
      color: this.subtitleStyle.color,
      backgroundColor: this.subtitleStyle.backgroundColor,
      outline: this.subtitleStyle.outline,
      bottomPercent: this.subtitleStyle.bottomPercent,
      shadow: this.subtitleStyle.shadow,
      letterSpacing: this.subtitleStyle.letterSpacing,
      lineHeight: this.subtitleStyle.lineHeight,
    };
  }

  refreshControlValues(settingsList) {
    if (!settingsList._controls) return;
    const s = this.subtitleStyle;
    const c = settingsList._controls;
    
    if (c.fontSizeValue) c.fontSizeValue.textContent = `${s.fontSize || 100}%`;
    if (c.positionValue) c.positionValue.textContent = `${s.bottomPercent != null ? s.bottomPercent : 5}%`;
    if (c.lineHeightValue) c.lineHeightValue.textContent = `${((s.lineHeight || 1.4) * 100).toFixed(0)}%`;
    if (c.fontFamilySelect) c.fontFamilySelect.value = s.fontFamily || "Arial, sans-serif";
    if (c.letterSpacingSelect) c.letterSpacingSelect.value = s.letterSpacing || "normal";
    if (c.colorInput) c.colorInput.value = /^#[0-9a-fA-F]{6}$/i.test(s.color) ? s.color : "#ffffff";
    if (c.colorValue) c.colorValue.textContent = (/^#[0-9a-fA-F]{6}$/i.test(s.color) ? s.color : "#ffffff").toUpperCase();
    if (c.bgInput) c.bgInput.value = s.backgroundColor != null ? String(s.backgroundColor) : "rgba(0,0,0,0.8)";
    if (c.outlineInput) c.outlineInput.value = s.outline != null ? String(s.outline) : "1px solid black";
    if (c.shadowInput) c.shadowInput.value = s.shadow != null ? String(s.shadow) : "2px 2px 4px rgba(0,0,0,0.8)";
  }

  buildCustomControls(settingsList, presetsBar, previewText) {
    const style = this.subtitleStyle;
    const controls = {};

    // Create two-column grid container
    const gridContainer = document.createElement("div");
    gridContainer.className = "enhanced-settings-grid";

    // Font Size Stepper
    const fontSizeStepper = this.createStepper(
      "Size",
      style.fontSize || 100,
      "%",
      (delta) => {
        const currentValue = this.subtitleStyle.fontSize || 100;
        const newValue = Math.min(200, Math.max(50, currentValue + delta * 10));
        this.subtitleStyle.fontSize = newValue;
        this.subtitleStyle.preset = "custom";
        saveSubtitleStyle("custom", this.getCustomPayload());
        this.updatePreviewStyle(previewText);
        applySubtitleStyle(this.subtitleStyle);
        controls.fontSizeValue.textContent = `${newValue}%`;
        this.updatePresetSelection(presetsBar);
      }
    );
    controls.fontSizeValue = fontSizeStepper.valueElement;
    gridContainer.appendChild(fontSizeStepper.element);

    // Position Stepper
    const positionStepper = this.createStepper(
      "Position",
      style.bottomPercent != null ? style.bottomPercent : 5,
      "%",
      (delta) => {
        const currentValue = this.subtitleStyle.bottomPercent != null ? this.subtitleStyle.bottomPercent : 5;
        const newValue = Math.min(30, Math.max(0, currentValue + delta));
        this.subtitleStyle.bottomPercent = newValue;
        this.subtitleStyle.preset = "custom";
        saveSubtitleStyle("custom", this.getCustomPayload());
        applySubtitleStyle(this.subtitleStyle);
        controls.positionValue.textContent = `${newValue}%`;
        this.updatePresetSelection(presetsBar);
      }
    );
    controls.positionValue = positionStepper.valueElement;
    gridContainer.appendChild(positionStepper.element);

    // Line Height Stepper
    const lineHeightStepper = this.createStepper(
      "Line Height",
      Math.round((style.lineHeight || 1.4) * 100),
      "%",
      (delta) => {
        const currentValue = this.subtitleStyle.lineHeight || 1.4;
        const newValue = Math.min(2.5, Math.max(1.0, currentValue + delta * 0.1));
        this.subtitleStyle.lineHeight = Math.round(newValue * 10) / 10;
        this.subtitleStyle.preset = "custom";
        saveSubtitleStyle("custom", this.getCustomPayload());
        this.updatePreviewStyle(previewText);
        applySubtitleStyle(this.subtitleStyle);
        controls.lineHeightValue.textContent = `${(this.subtitleStyle.lineHeight * 100).toFixed(0)}%`;
        this.updatePresetSelection(presetsBar);
      }
    );
    controls.lineHeightValue = lineHeightStepper.valueElement;
    gridContainer.appendChild(lineHeightStepper.element);

    // Font Family Select
    const fontFamilyWrapper = this.createSelect(
      "Font Family",
      ["Arial, sans-serif", "Helvetica, Arial, sans-serif", "Georgia, serif", "Courier New, monospace", "Impact, sans-serif", "Verdana, sans-serif", "Times New Roman, serif"],
      style.fontFamily || "Arial, sans-serif",
      (value) => {
        this.subtitleStyle.fontFamily = value;
        this.subtitleStyle.preset = "custom";
        saveSubtitleStyle("custom", this.getCustomPayload());
        this.updatePreviewStyle(previewText);
        applySubtitleStyle(this.subtitleStyle);
        this.updatePresetSelection(presetsBar);
      }
    );
    controls.fontFamilySelect = fontFamilyWrapper.querySelector("select");
    gridContainer.appendChild(fontFamilyWrapper);

    // Letter Spacing Select
    const letterSpacingWrapper = this.createSelect(
      "Letter Spacing",
      [
        { value: "normal", label: "Normal" },
        { value: "0.02em", label: "Slight" },
        { value: "0.05em", label: "Medium" },
        { value: "0.1em", label: "Wide" },
        { value: "-0.02em", label: "Tight" }
      ],
      style.letterSpacing || "normal",
      (value) => {
        this.subtitleStyle.letterSpacing = value;
        this.subtitleStyle.preset = "custom";
        saveSubtitleStyle("custom", this.getCustomPayload());
        this.updatePreviewStyle(previewText);
        applySubtitleStyle(this.subtitleStyle);
        this.updatePresetSelection(presetsBar);
      }
    );
    controls.letterSpacingSelect = letterSpacingWrapper.querySelector("select");
    gridContainer.appendChild(letterSpacingWrapper);

    // Text Color Picker
    const colorWrapper = document.createElement("div");
    colorWrapper.className = "enhanced-color-wrapper";
    
    const colorHeader = document.createElement("div");
    colorHeader.className = "enhanced-color-header";
    colorHeader.textContent = "Text Color";
    
    const colorContent = document.createElement("div");
    colorContent.className = "enhanced-color-content";
    
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "enhanced-color-input";
    colorInput.value = /^#[0-9a-fA-F]{6}$/i.test(style.color) ? style.color : "#ffffff";
    
    const colorValue = document.createElement("div");
    colorValue.className = "enhanced-color-value";
    colorValue.textContent = colorInput.value.toUpperCase();
    
    colorInput.oninput = () => {
      this.subtitleStyle.color = colorInput.value;
      this.subtitleStyle.preset = "custom";
      saveSubtitleStyle("custom", this.getCustomPayload());
      this.updatePreviewStyle(previewText);
      applySubtitleStyle(this.subtitleStyle);
      colorValue.textContent = colorInput.value.toUpperCase();
      this.updatePresetSelection(presetsBar);
    };
    controls.colorInput = colorInput;
    controls.colorValue = colorValue;
    
    colorContent.appendChild(colorInput);
    colorContent.appendChild(colorValue);
    colorWrapper.appendChild(colorHeader);
    colorWrapper.appendChild(colorContent);
    gridContainer.appendChild(colorWrapper);

    // Background Input
    const bgWrapper = this.createTextInput(
      "Background",
      style.backgroundColor != null ? String(style.backgroundColor) : "rgba(0,0,0,0.8)",
      "e.g. rgba(0,0,0,0.8)",
      (value) => {
        this.subtitleStyle.backgroundColor = value || "rgba(0,0,0,0.8)";
        this.subtitleStyle.preset = "custom";
        saveSubtitleStyle("custom", this.getCustomPayload());
        this.updatePreviewStyle(previewText);
        applySubtitleStyle(this.subtitleStyle);
        this.updatePresetSelection(presetsBar);
      }
    );
    controls.bgInput = bgWrapper.querySelector("input");
    gridContainer.appendChild(bgWrapper);

    // Outline Input
    const outlineWrapper = this.createTextInput(
      "Outline",
      style.outline != null ? String(style.outline) : "1px solid black",
      "e.g. 2px solid black",
      (value) => {
        this.subtitleStyle.outline = value || "1px solid black";
        this.subtitleStyle.preset = "custom";
        saveSubtitleStyle("custom", this.getCustomPayload());
        this.updatePreviewStyle(previewText);
        applySubtitleStyle(this.subtitleStyle);
        this.updatePresetSelection(presetsBar);
      }
    );
    controls.outlineInput = outlineWrapper.querySelector("input");
    gridContainer.appendChild(outlineWrapper);

    // Shadow Input
    const shadowWrapper = this.createTextInput(
      "Text Shadow",
      style.shadow != null ? String(style.shadow) : "2px 2px 4px rgba(0,0,0,0.8)",
      "e.g. 2px 2px 4px rgba(0,0,0,0.8)",
      (value) => {
        this.subtitleStyle.shadow = value || "2px 2px 4px rgba(0,0,0,0.8)";
        this.subtitleStyle.preset = "custom";
        saveSubtitleStyle("custom", this.getCustomPayload());
        this.updatePreviewStyle(previewText);
        applySubtitleStyle(this.subtitleStyle);
        this.updatePresetSelection(presetsBar);
      }
    );
    controls.shadowInput = shadowWrapper.querySelector("input");
    gridContainer.appendChild(shadowWrapper);

    settingsList.appendChild(gridContainer);
    settingsList._controls = controls;
  }

  createStepper(label, initialValue, suffix, onValueChange) {
    const stepperDiv = document.createElement("div");
    stepperDiv.className = "enhanced-stepper";

    const header = document.createElement("div");
    header.className = "enhanced-stepper-header";
    header.textContent = label;

    const content = document.createElement("div");
    content.className = "enhanced-stepper-content";

    const minusBtn = document.createElement("button");
    minusBtn.className = "enhanced-stepper-button";
    minusBtn.type = "button";
    minusBtn.tabIndex = 0;
    minusBtn.innerHTML = `<svg class="enhanced-stepper-icon" viewBox="0 0 512 512"><path d="M400 256H112" style="stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 50; fill: none;"></path></svg>`;
    minusBtn.onclick = () => onValueChange(-1);

    const valueDiv = document.createElement("div");
    valueDiv.className = "enhanced-stepper-value";
    valueDiv.textContent = `${initialValue}${suffix}`;

    const plusBtn = document.createElement("button");
    plusBtn.className = "enhanced-stepper-button";
    plusBtn.type = "button";
    plusBtn.tabIndex = 0;
    plusBtn.innerHTML = `<svg class="enhanced-stepper-icon" viewBox="0 0 512 512"><path d="M256.1 112v288M400.1 256h-288" style="stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 50; fill: none;"></path></svg>`;
    plusBtn.onclick = () => onValueChange(1);

    content.appendChild(minusBtn);
    content.appendChild(valueDiv);
    content.appendChild(plusBtn);

    stepperDiv.appendChild(header);
    stepperDiv.appendChild(content);

    return {
      element: stepperDiv,
      valueElement: valueDiv,
      minusButton: minusBtn,
      plusButton: plusBtn
    };
  }

  createSelect(label, options, currentValue, onChange) {
    const wrapper = document.createElement("div");
    wrapper.className = "enhanced-select-wrapper";
    
    const header = document.createElement("div");
    header.className = "enhanced-select-header";
    header.textContent = label;
    
    const select = document.createElement("select");
    select.className = "enhanced-select";
    
    options.forEach((opt) => {
      const option = document.createElement("option");
      if (typeof opt === 'string') {
        option.value = opt;
        option.textContent = opt.split(",")[0];
        if (currentValue && currentValue.indexOf(opt.split(",")[0]) !== -1) {
          option.selected = true;
        }
      } else {
        option.value = opt.value;
        option.textContent = opt.label;
        if (currentValue === opt.value) {
          option.selected = true;
        }
      }
      select.appendChild(option);
    });
    
    select.onchange = () => onChange(select.value);
    
    wrapper.appendChild(header);
    wrapper.appendChild(select);
    return wrapper;
  }

  createTextInput(label, initialValue, placeholder, onChange) {
    const wrapper = document.createElement("div");
    wrapper.className = "enhanced-text-wrapper";
    
    const header = document.createElement("div");
    header.className = "enhanced-text-header";
    header.textContent = label;
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "enhanced-text-input";
    input.placeholder = placeholder;
    input.value = initialValue;
    input.onchange = () => onChange(input.value);
    
    wrapper.appendChild(header);
    wrapper.appendChild(input);
    return wrapper;
  }

  updatePresetSelection(presetsBar) {
    presetsBar.querySelectorAll(".enhanced-subtitle-preset-btn").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.preset === "custom");
    });
  }

  moveTitles() {
    const titleSelectors = [
      ".meta-info-container > [class*='name']:not(.enhanced-cast-name):not(.enhanced-cast-character)",
      ".meta-info-container > [class*='title']:not(.enhanced-section-header)",
      "[class*='meta-preview'] > [class*='name']:not(.enhanced-cast-name)",
      "[class*='meta-preview'] > [class*='title']:not(.enhanced-section-header)",
      "[class*='side-drawer'] > [class*='name']:not(.enhanced-cast-name)",
      "[class*='side-drawer'] .logo-X3hTV",
      "h2.title-DGh6h",
      ".title-DGh6h",
      "[class*='title-bar'] h2",
      ".nav-bar-container h2",
      "#app > div.router-_65XU.routes-container > div:nth-child(3) > div.route-content > div > nav > h2",
      "nav h2[class*='title']",
    ];

    let fallbackTitle = null;
    const docTitle = document.title;
    if (
      docTitle &&
      !docTitle.toLowerCase().includes("stremio") &&
      docTitle.length > 3
    ) {
      fallbackTitle = docTitle
        .replace(" - Stremio", "")
        .replace("Stremio - ", "")
        .trim();
    }

    let titleElement = null;
    let titleText = null;

    for (const selector of titleSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (
          el.closest(".enhanced-cast-section") ||
          el.closest(".enhanced-similar-section") ||
          el.closest(".enhanced-collection-section") ||
          el.closest(".enhanced-content-wrapper") ||
          el.closest('[class*="enhanced-"]')
        ) {
          continue;
        }

        const text = el.textContent || el.alt || el.title;
        if (text && this.isValidTitle(text)) {
          titleElement = el;
          titleText = text.trim();
          break;
        }
      }
      if (titleElement) break;
    }

    if (!titleText && fallbackTitle && this.isValidTitle(fallbackTitle)) {
      titleText = fallbackTitle;
    }

    const containerSelectors = [
      ".control-bar-container-xsWA7",
      "div[class*='control-bar-container']",
      "div[class*='control-bar-layer']",
      "#app > div.router-_65XU.routes-container > div:nth-child(2) > div.route-content > div > div.layer-qalDW.control-bar-layer-m2jto.control-bar-container-xsWA7",
      ".video-player-controls",
    ];

    let targetContainer = null;
    for (const selector of containerSelectors) {
      targetContainer = document.querySelector(selector);
      if (targetContainer) break;
    }

    if (!titleText || !targetContainer) {
      return;
    }

    if (
      targetContainer.querySelector(".custom-series-name") ||
      targetContainer.querySelector(".custom-movie-title")
    ) {
      return;
    }

    let match = titleText.match(/^(.+?): (.+?) - (.+?) \((\d+x\d+)\)$/);

    if (!match) {
      match = titleText.match(/^(.+?) - (.+?) \((\d+x\d+)\)$/);
      if (match) {
        const [, seriesName, episodeTitle, seasonEpisode] = match;

        const seriesDiv = document.createElement("div");
        seriesDiv.className = "custom-series-name";
        seriesDiv.textContent = seriesName;

        const episodeDiv = document.createElement("div");
        episodeDiv.className = "custom-episode-title";
        episodeDiv.textContent = `${episodeTitle} (${seasonEpisode})`;

        targetContainer.insertBefore(seriesDiv, targetContainer.firstChild);
        targetContainer.insertBefore(episodeDiv, seriesDiv.nextSibling);

        if (titleElement) titleElement.style.display = "none";
        return;
      }
    }

    if (!match) {
      match = titleText.match(/^(.+?) \((\d+x\d+)\) (.+?)$/);
      if (match) {
        const [, seriesName, seasonEpisode, episodeTitle] = match;

        const seriesDiv = document.createElement("div");
        seriesDiv.className = "custom-series-name";
        seriesDiv.textContent = seriesName;

        const episodeDiv = document.createElement("div");
        episodeDiv.className = "custom-episode-title";
        episodeDiv.textContent = `${episodeTitle} (${seasonEpisode})`;

        targetContainer.insertBefore(seriesDiv, targetContainer.firstChild);
        targetContainer.insertBefore(episodeDiv, seriesDiv.nextSibling);

        if (titleElement) titleElement.style.display = "none";
        return;
      }
    }

    if (match && match.length === 5) {
      const [, seriesName, episodeTitle, description, seasonEpisode] = match;

      const seriesDiv = document.createElement("div");
      seriesDiv.className = "custom-series-name";
      seriesDiv.textContent = `${description} (${seasonEpisode})`;

      const episodeDiv = document.createElement("div");
      episodeDiv.className = "custom-episode-title";
      episodeDiv.textContent = `${seriesName}: ${episodeTitle}`;

      targetContainer.insertBefore(seriesDiv, targetContainer.firstChild);
      targetContainer.insertBefore(episodeDiv, seriesDiv.nextSibling);

      if (titleElement) titleElement.style.display = "none";
      return;
    }

    if (titleText && titleText.length > 0) {
      const movieDiv = document.createElement("div");
      movieDiv.className = "custom-series-name";
      movieDiv.textContent = titleText;

      targetContainer.insertBefore(movieDiv, targetContainer.firstChild);
      if (titleElement) titleElement.style.display = "none";
    }
  }

  isValidTitle(text) {
    if (!text || text.trim().length === 0) {
      return false;
    }

    const trimmed = text.trim();

    const invalidPatterns = [
      /torrentio/i,
      /^\[RD/i,
      /^\[AD/i,
      /^\[PM/i,
      /^\[DL/i,
      /\[.*debrid.*\]/i,
      /^\[.*\]\s*torrentio/i,
      /^\[.*\]$/,
      /^http/i,
      /\.torrent$/i,
      /^magnet:/i,
      /debrid/i,
      /1080p/i,
      /720p/i,
      /2160p/i,
      /4k\b/i,
      /HDR/i,
      /HEVC/i,
      /x264/i,
      /x265/i,
      /WEB-?DL/i,
      /BluRay/i,
      /BRRip/i,
      /stream/i,
      /addon/i,
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }

    if (trimmed.includes("x") && /\d+x\d+/.test(trimmed)) {
      return true;
    }

    if (trimmed.length >= 2 && trimmed.length <= 200) {
      return true;
    }

    return false;
  }
}

new EnhancedPlayer();