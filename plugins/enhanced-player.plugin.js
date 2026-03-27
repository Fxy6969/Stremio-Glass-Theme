/**
 * @name Enhanced Video Player
 * @description Enhances the video player with subtitle customization, ASS tag cleaning, Arabic RTL fix, and title display.
 * @version 28.0.0
 * @author Fxy, a3harbi
 */

const SUBTITLE_STORAGE_KEY = "stremio-enhanced-subtitle-style";
const ASS_TAG_REGEX = /\{\\[^}]*\}/g;
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const SUBTITLE_PRESETS = {
  default: {
    name: "Default",
    fontSize: 100,
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    backgroundColor: "transparent",
    outlineSize: 2,
    outlineColor: "#000000",
    bottomPercent: 5,
    shadow: "none",
    letterSpacing: "normal",
    lineHeight: 1.4,
  },
  large: {
    name: "Large",
    fontSize: 140,
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    backgroundColor: "transparent",
    outlineSize: 3,
    outlineColor: "#000000",
    bottomPercent: 6,
    shadow: "none",
    letterSpacing: "0.02em",
    lineHeight: 1.5,
  },
  yellow: {
    name: "Yellow",
    fontSize: 110,
    fontFamily: "Arial, sans-serif",
    color: "#ffff00",
    backgroundColor: "transparent",
    outlineSize: 2,
    outlineColor: "#000000",
    bottomPercent: 5,
    shadow: "none",
    letterSpacing: "normal",
    lineHeight: 1.4,
  },
  minimal: {
    name: "Minimal",
    fontSize: 95,
    fontFamily: "Helvetica, Arial, sans-serif",
    color: "#ffffff",
    backgroundColor: "transparent",
    outlineSize: 0,
    outlineColor: "#000000",
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
    backgroundColor: "rgba(0,0,0,0.6)",
    outlineSize: 0,
    outlineColor: "#000000",
    bottomPercent: 4,
    shadow: "none",
    letterSpacing: "0.03em",
    lineHeight: 1.6,
  },
  custom: { name: "Custom", custom: true },
};

const FONT_FAMILY_OPTIONS = [
  "Arial, sans-serif",
  "Helvetica, Arial, sans-serif",
  "Georgia, serif",
  "Courier New, monospace",
  "Impact, sans-serif",
  "Verdana, sans-serif",
  "Times New Roman, serif",
  "Noto Naskh Arabic, sans-serif",
  "Netflix Sans, Helvetica, sans-serif",
  "Roboto, sans-serif",
  "PlusJakartaSans, sans-serif",
];

function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) return resolve(element);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { observer.disconnect(); resolve(el); }
    });
    (document.body || document.documentElement).observe
      ? observer.observe(document.body, { childList: true, subtree: true })
      : observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout: ${selector}`)); }, timeout);
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
  } catch (_) { }
  return { ...SUBTITLE_PRESETS.default, preset: "default" };
}

function saveSubtitleStyle(preset, custom) {
  localStorage.setItem(SUBTITLE_STORAGE_KEY, JSON.stringify({ preset, custom: custom || null }));
}

// ── Generate outline as multi-directional text-shadow (no -webkit-text-stroke) ──

function generateOutlineShadow(size, color) {
  const s = parseFloat(size) || 0;
  if (s <= 0) return "";
  const c = color || "#000000";
  const r = Math.max(s * 0.4, 0.5);
  return [
    `${-s}px ${-s}px ${r}px ${c}`,
    `0px ${-s}px ${r}px ${c}`,
    `${s}px ${-s}px ${r}px ${c}`,
    `${-s}px 0px ${r}px ${c}`,
    `${s}px 0px ${r}px ${c}`,
    `${-s}px ${s}px ${r}px ${c}`,
    `0px ${s}px ${r}px ${c}`,
    `${s}px ${s}px ${r}px ${c}`,
  ].join(", ");
}

function buildCombinedShadow(style) {
  const parts = [];
  const outline = generateOutlineShadow(style.outlineSize, style.outlineColor);
  if (outline) parts.push(outline);
  if (style.shadow && style.shadow !== "none") parts.push(style.shadow);
  return parts.length > 0 ? parts.join(", ") : "none";
}

// ── Direct DOM subtitle application ──

function isSubtitleContainer(el) {
  if (el.tagName !== "DIV") return false;
  const s = el.style;
  return (s.position === "absolute" && s.zIndex === "1" && s.textAlign === "center" &&
    s.bottom && s.left === "0px" && s.right === "0px");
}

function isSubtitleText(el) {
  if (el.tagName !== "DIV") return false;
  const s = el.style;
  return (s.display === "inline-block" && s.whiteSpace === "pre-wrap" &&
    s.fontSize && s.fontSize.includes("vmin"));
}

function applyStyleToSubtitleElement(el, style) {
  if (!style) return;
  if (style.fontFamily) el.style.setProperty("font-family", style.fontFamily, "important");
  if (style.color) el.style.setProperty("color", style.color, "important");
  if (style.backgroundColor != null) el.style.setProperty("background-color", style.backgroundColor, "important");
  const combinedShadow = buildCombinedShadow(style);
  el.style.setProperty("text-shadow", combinedShadow, "important");
  el.style.setProperty("outline", "none", "important");
  el.style.setProperty("-webkit-text-stroke", "0", "important");
  if (style.letterSpacing) el.style.setProperty("letter-spacing", style.letterSpacing, "important");
  if (style.lineHeight) el.style.setProperty("line-height", String(style.lineHeight), "important");
  if (style.fontSize) {
    const scale = (style.fontSize || 100) / 100;
    el.style.setProperty("font-size", `${4 * scale}vmin`, "important");
  }
}

function cleanAssTagsAndFixRTL(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while (node = walker.nextNode()) {
    const original = node.textContent;
    const cleaned = original.replace(ASS_TAG_REGEX, "");
    if (cleaned !== original) node.textContent = cleaned;
  }
  if (ARABIC_REGEX.test(el.textContent)) {
    el.style.setProperty("unicode-bidi", "plaintext", "important");
    el.style.setProperty("text-align", "center", "important");
  }
}

function applySubtitleStyleToDOM() {
  const style = getSubtitleStyle();
  document.querySelectorAll("div").forEach(el => {
    if (isSubtitleContainer(el)) {
      if (style.bottomPercent != null) el.style.setProperty("bottom", style.bottomPercent + "%", "important");
      el.querySelectorAll("div").forEach(child => {
        if (isSubtitleText(child)) { applyStyleToSubtitleElement(child, style); cleanAssTagsAndFixRTL(child); }
      });
    } else if (isSubtitleText(el)) {
      applyStyleToSubtitleElement(el, style);
      cleanAssTagsAndFixRTL(el);
    }
  });
}

function applySubtitleStyle(style) {
  let el = document.getElementById("enhanced-player-subtitle-style");
  if (!el) { el = document.createElement("style"); el.id = "enhanced-player-subtitle-style"; document.head.appendChild(el); }
  const combinedShadow = buildCombinedShadow(style);
  el.textContent = `
    video::cue {
      font-family: ${style.fontFamily || "Arial, sans-serif"} !important;
      color: ${style.color || "#ffffff"} !important;
      background-color: ${style.backgroundColor || "transparent"} !important;
      outline: none !important;
      -webkit-text-stroke: 0 !important;
      text-shadow: ${combinedShadow} !important;
    }
  `;
  applySubtitleStyleToDOM();
}

// ══════════════════════════════════════════════
// ── Enhanced Player Class ──
// ══════════════════════════════════════════════

class EnhancedPlayer {
  constructor() {
    this.subtitleStyle = getSubtitleStyle();
    this.init();
  }

  init() {
    this.moveTitles();
    setTimeout(() => this.moveTitles(), 500);
    const observer = new MutationObserver(() => {
      this.moveTitles();
      this.tryInjectSubtitleCustomizer();
      applySubtitleStyleToDOM();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    this.tryInjectSubtitleCustomizer();
    applySubtitleStyle(this.subtitleStyle);
    setInterval(applySubtitleStyleToDOM, 500);
    console.log("[ Enhanced Video Player ] Loaded v28.0.0");
  }

  injectSubtitleUICssOnce() {
    if (document.getElementById("enhanced-subtitle-ui-styles")) return;
    const el = document.createElement("style");
    el.id = "enhanced-subtitle-ui-styles";
    el.textContent = `
      .enhanced-subtitle-customize-section {
        padding: 16px 20px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      .enhanced-subtitle-customize-header {
        display: flex; align-items: center; gap: 8px;
        font-size: 14px; font-weight: 600; color: #fff;
        text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px;
      }
      .enhanced-header-icon { font-size: 16px; }
      .enhanced-subtitle-presets-bar {
        display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap;
      }
      .enhanced-subtitle-preset-btn {
        padding: 6px 14px; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
        background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7);
        font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;
      }
      .enhanced-subtitle-preset-btn:hover {
        background: rgba(255,255,255,0.12); color: #fff;
      }
      .enhanced-subtitle-preset-btn.selected {
        background: rgba(124,92,252,0.3); border-color: rgba(124,92,252,0.6);
        color: #fff; font-weight: 600;
      }
      .enhanced-subtitle-preview-section { margin-bottom: 16px; }
      .enhanced-subtitle-preview-label {
        font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4);
        text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;
      }
      .enhanced-subtitle-preview-box {
        background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px; padding: 20px;
        display: flex; align-items: center; justify-content: center; min-height: 50px;
      }
      .enhanced-subtitle-preview-text {
        font-size: 1em; transition: all 0.2s ease; text-align: center; padding: 4px 8px;
      }
      .enhanced-settings-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      }
      .enhanced-stepper, .enhanced-select-wrapper, .enhanced-color-wrapper, .enhanced-text-wrapper {
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px; padding: 10px 12px;
      }
      .enhanced-stepper-header, .enhanced-select-header, .enhanced-color-header, .enhanced-text-header {
        font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4);
        text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;
      }
      .enhanced-stepper-content {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
      }
      .enhanced-stepper-button {
        width: 32px; height: 32px; border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.8); cursor: pointer;
        display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;
      }
      .enhanced-stepper-button:hover { background: rgba(255,255,255,0.15); color: #fff; }
      .enhanced-stepper-icon { width: 14px; height: 14px; }
      .enhanced-stepper-value {
        font-size: 14px; font-weight: 600; color: #fff; min-width: 50px; text-align: center;
      }
      .enhanced-select {
        width: 100%; padding: 6px 8px; border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06);
        color: #fff; font-size: 13px; cursor: pointer;
      }
      .enhanced-select option { background: #1a1a2e; color: #fff; }
      .enhanced-color-content { display: flex; align-items: center; gap: 10px; }
      .enhanced-color-input {
        width: 36px; height: 28px; border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px; cursor: pointer; background: transparent; padding: 0;
      }
      .enhanced-color-value { font-size: 13px; color: rgba(255,255,255,0.7); font-family: monospace; }
      .enhanced-text-input {
        width: 100%; padding: 6px 8px; border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06);
        color: #fff; font-size: 13px; box-sizing: border-box;
      }
      .enhanced-text-input::placeholder { color: rgba(255,255,255,0.25); }
    `;
    document.head.appendChild(el);
  }

  updatePreviewStyle(previewText) {
    if (!previewText) return;
    const s = this.subtitleStyle;
    previewText.style.fontSize = `${(s.fontSize || 100) / 100}em`;
    previewText.style.fontFamily = s.fontFamily || "Arial, sans-serif";
    previewText.style.color = s.color || "#ffffff";
    previewText.style.backgroundColor = s.backgroundColor || "transparent";
    previewText.style.outline = "none";
    previewText.style.webkitTextStroke = "0";
    previewText.style.textShadow = buildCombinedShadow(s);
    previewText.style.letterSpacing = s.letterSpacing || "normal";
    previewText.style.lineHeight = s.lineHeight || 1.4;
    previewText.style.padding = "4px 8px";
    previewText.style.borderRadius = "4px";
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
    header.innerHTML = `<span class="enhanced-header-icon">✨</span><span>Customize Subtitles</span>`;

    const presetsBar = document.createElement("div");
    presetsBar.className = "enhanced-subtitle-presets-bar";
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
      outlineSize: this.subtitleStyle.outlineSize,
      outlineColor: this.subtitleStyle.outlineColor,
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
    if (c.outlineSizeValue) c.outlineSizeValue.textContent = `${s.outlineSize != null ? s.outlineSize : 2}px`;
    if (c.fontFamilySelect) c.fontFamilySelect.value = s.fontFamily || "Arial, sans-serif";
    if (c.letterSpacingSelect) c.letterSpacingSelect.value = s.letterSpacing || "normal";
    if (c.colorInput) c.colorInput.value = /^#[0-9a-fA-F]{6}$/i.test(s.color) ? s.color : "#ffffff";
    if (c.colorValue) c.colorValue.textContent = (/^#[0-9a-fA-F]{6}$/i.test(s.color) ? s.color : "#ffffff").toUpperCase();
    if (c.outlineColorInput) c.outlineColorInput.value = /^#[0-9a-fA-F]{6}$/i.test(s.outlineColor) ? s.outlineColor : "#000000";
    if (c.outlineColorValue) c.outlineColorValue.textContent = (/^#[0-9a-fA-F]{6}$/i.test(s.outlineColor) ? s.outlineColor : "#000000").toUpperCase();
    if (c.bgInput) c.bgInput.value = s.backgroundColor || "transparent";
    if (c.shadowInput) c.shadowInput.value = s.shadow || "none";
  }

  buildCustomControls(settingsList, presetsBar, previewText) {
    const style = this.subtitleStyle;
    const controls = {};
    const grid = document.createElement("div");
    grid.className = "enhanced-settings-grid";

    const makeStepper = (label, val, suffix, cb) => {
      const st = this.createStepper(label, val, suffix, cb);
      grid.appendChild(st.element);
      return st;
    };

    const saveAndApply = () => {
      this.subtitleStyle.preset = "custom";
      saveSubtitleStyle("custom", this.getCustomPayload());
      this.updatePreviewStyle(previewText);
      applySubtitleStyle(this.subtitleStyle);
      this.updatePresetSelection(presetsBar);
    };

    // Row 1: Size + Position
    const fs = makeStepper("Size", style.fontSize || 100, "%", (d) => {
      this.subtitleStyle.fontSize = Math.min(200, Math.max(50, (this.subtitleStyle.fontSize || 100) + d * 10));
      controls.fontSizeValue.textContent = `${this.subtitleStyle.fontSize}%`;
      saveAndApply();
    });
    controls.fontSizeValue = fs.valueElement;

    const pos = makeStepper("Position", style.bottomPercent != null ? style.bottomPercent : 5, "%", (d) => {
      this.subtitleStyle.bottomPercent = Math.min(30, Math.max(0, (this.subtitleStyle.bottomPercent != null ? this.subtitleStyle.bottomPercent : 5) + d));
      controls.positionValue.textContent = `${this.subtitleStyle.bottomPercent}%`;
      saveAndApply();
    });
    controls.positionValue = pos.valueElement;

    // Row 2: Line Height + Outline Size
    const lh = makeStepper("Line Height", Math.round((style.lineHeight || 1.4) * 100), "%", (d) => {
      this.subtitleStyle.lineHeight = Math.round(Math.min(2.5, Math.max(1.0, (this.subtitleStyle.lineHeight || 1.4) + d * 0.1)) * 10) / 10;
      controls.lineHeightValue.textContent = `${(this.subtitleStyle.lineHeight * 100).toFixed(0)}%`;
      saveAndApply();
    });
    controls.lineHeightValue = lh.valueElement;

    const ol = makeStepper("Outline", style.outlineSize != null ? style.outlineSize : 2, "px", (d) => {
      this.subtitleStyle.outlineSize = Math.min(6, Math.max(0, (this.subtitleStyle.outlineSize != null ? this.subtitleStyle.outlineSize : 2) + d));
      controls.outlineSizeValue.textContent = `${this.subtitleStyle.outlineSize}px`;
      saveAndApply();
    });
    controls.outlineSizeValue = ol.valueElement;

    // Row 3: Font Family + Letter Spacing
    const ff = this.createSelect("Font Family", FONT_FAMILY_OPTIONS, style.fontFamily || "Arial, sans-serif", (v) => { this.subtitleStyle.fontFamily = v; saveAndApply(); });
    controls.fontFamilySelect = ff.querySelector("select");
    grid.appendChild(ff);

    const ls = this.createSelect("Letter Spacing", [
      { value: "normal", label: "Normal" }, { value: "0.02em", label: "Slight" },
      { value: "0.05em", label: "Medium" }, { value: "0.1em", label: "Wide" },
      { value: "-0.02em", label: "Tight" }
    ], style.letterSpacing || "normal", (v) => { this.subtitleStyle.letterSpacing = v; saveAndApply(); });
    controls.letterSpacingSelect = ls.querySelector("select");
    grid.appendChild(ls);

    // Row 4: Text Color + Outline Color
    const tc = this.createColorPicker("Text Color", /^#[0-9a-fA-F]{6}$/i.test(style.color) ? style.color : "#ffffff", (v) => { this.subtitleStyle.color = v; saveAndApply(); });
    controls.colorInput = tc.querySelector("input");
    controls.colorValue = tc.querySelector(".enhanced-color-value");
    grid.appendChild(tc);

    const oc = this.createColorPicker("Outline Color", /^#[0-9a-fA-F]{6}$/i.test(style.outlineColor) ? style.outlineColor : "#000000", (v) => { this.subtitleStyle.outlineColor = v; saveAndApply(); });
    controls.outlineColorInput = oc.querySelector("input");
    controls.outlineColorValue = oc.querySelector(".enhanced-color-value");
    grid.appendChild(oc);

    // Row 5: Background + Drop Shadow
    const bg = this.createTextInput("Background", style.backgroundColor || "transparent", "transparent, rgba(0,0,0,0.6)", (v) => { this.subtitleStyle.backgroundColor = v || "transparent"; saveAndApply(); });
    controls.bgInput = bg.querySelector("input");
    grid.appendChild(bg);

    const sh = this.createTextInput("Drop Shadow", style.shadow || "none", "none, 2px 2px 8px rgba(0,0,0,1)", (v) => { this.subtitleStyle.shadow = v || "none"; saveAndApply(); });
    controls.shadowInput = sh.querySelector("input");
    grid.appendChild(sh);

    settingsList.appendChild(grid);
    settingsList._controls = controls;
  }

  createStepper(label, initialValue, suffix, onValueChange) {
    const div = document.createElement("div"); div.className = "enhanced-stepper";
    const h = document.createElement("div"); h.className = "enhanced-stepper-header"; h.textContent = label;
    const c = document.createElement("div"); c.className = "enhanced-stepper-content";
    const minus = document.createElement("button"); minus.className = "enhanced-stepper-button"; minus.type = "button";
    minus.innerHTML = `<svg class="enhanced-stepper-icon" viewBox="0 0 512 512"><path d="M400 256H112" style="stroke:currentcolor;stroke-linecap:round;stroke-width:50;fill:none"></path></svg>`;
    minus.onclick = () => onValueChange(-1);
    const val = document.createElement("div"); val.className = "enhanced-stepper-value"; val.textContent = `${initialValue}${suffix}`;
    const plus = document.createElement("button"); plus.className = "enhanced-stepper-button"; plus.type = "button";
    plus.innerHTML = `<svg class="enhanced-stepper-icon" viewBox="0 0 512 512"><path d="M256.1 112v288M400.1 256h-288" style="stroke:currentcolor;stroke-linecap:round;stroke-width:50;fill:none"></path></svg>`;
    plus.onclick = () => onValueChange(1);
    c.appendChild(minus); c.appendChild(val); c.appendChild(plus);
    div.appendChild(h); div.appendChild(c);
    return { element: div, valueElement: val };
  }

  createSelect(label, options, currentValue, onChange) {
    const w = document.createElement("div"); w.className = "enhanced-select-wrapper";
    const h = document.createElement("div"); h.className = "enhanced-select-header"; h.textContent = label;
    const s = document.createElement("select"); s.className = "enhanced-select";
    options.forEach((opt) => {
      const o = document.createElement("option");
      if (typeof opt === "string") { o.value = opt; o.textContent = opt.split(",")[0]; if (currentValue && currentValue.indexOf(opt.split(",")[0]) !== -1) o.selected = true; }
      else { o.value = opt.value; o.textContent = opt.label; if (currentValue === opt.value) o.selected = true; }
      s.appendChild(o);
    });
    s.onchange = () => onChange(s.value);
    w.appendChild(h); w.appendChild(s); return w;
  }

  createColorPicker(label, initialColor, onChange) {
    const w = document.createElement("div"); w.className = "enhanced-color-wrapper";
    const h = document.createElement("div"); h.className = "enhanced-color-header"; h.textContent = label;
    const c = document.createElement("div"); c.className = "enhanced-color-content";
    const i = document.createElement("input"); i.type = "color"; i.className = "enhanced-color-input"; i.value = initialColor;
    const v = document.createElement("div"); v.className = "enhanced-color-value"; v.textContent = initialColor.toUpperCase();
    i.oninput = () => { v.textContent = i.value.toUpperCase(); onChange(i.value); };
    c.appendChild(i); c.appendChild(v); w.appendChild(h); w.appendChild(c); return w;
  }

  createTextInput(label, initialValue, placeholder, onChange) {
    const w = document.createElement("div"); w.className = "enhanced-text-wrapper";
    const h = document.createElement("div"); h.className = "enhanced-text-header"; h.textContent = label;
    const i = document.createElement("input"); i.type = "text"; i.className = "enhanced-text-input";
    i.placeholder = placeholder; i.value = initialValue; i.onchange = () => onChange(i.value);
    w.appendChild(h); w.appendChild(i); return w;
  }

  updatePresetSelection(presetsBar) {
    presetsBar.querySelectorAll(".enhanced-subtitle-preset-btn").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.preset === "custom");
    });
  }

  // ══════════════════════════════════════════════
  // ── Title Display ──
  // ══════════════════════════════════════════════

  moveTitles() {
    const titleSelectors = [
      ".meta-info-container > [class*='name']:not(.enhanced-cast-name):not(.enhanced-cast-character)",
      ".meta-info-container > [class*='title']:not(.enhanced-section-header)",
      "[class*='meta-preview'] > [class*='name']:not(.enhanced-cast-name)",
      "[class*='meta-preview'] > [class*='title']:not(.enhanced-section-header)",
      "[class*='side-drawer'] > [class*='name']:not(.enhanced-cast-name)",
      "[class*='side-drawer'] .logo-X3hTV", "h2.title-DGh6h", ".title-DGh6h",
      "[class*='title-bar'] h2", ".nav-bar-container h2",
      "#app > div.router-_65XU.routes-container > div:nth-child(3) > div.route-content > div > nav > h2",
      "nav h2[class*='title']",
    ];
    let fallbackTitle = null;
    const docTitle = document.title;
    if (docTitle && !docTitle.toLowerCase().includes("stremio") && docTitle.length > 3) {
      fallbackTitle = docTitle.replace(" - Stremio", "").replace("Stremio - ", "").trim();
    }
    let titleElement = null, titleText = null;
    for (const selector of titleSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.closest(".enhanced-cast-section") || el.closest(".enhanced-similar-section") ||
          el.closest(".enhanced-collection-section") || el.closest(".enhanced-content-wrapper") ||
          el.closest('[class*="enhanced-"]')) continue;
        const text = el.textContent || el.alt || el.title;
        if (text && this.isValidTitle(text)) { titleElement = el; titleText = text.trim(); break; }
      }
      if (titleElement) break;
    }
    if (!titleText && fallbackTitle && this.isValidTitle(fallbackTitle)) titleText = fallbackTitle;
    const containerSelectors = [
      ".control-bar-container-xsWA7", "div[class*='control-bar-container']", "div[class*='control-bar-layer']",
      "#app > div.router-_65XU.routes-container > div:nth-child(2) > div.route-content > div > div.layer-qalDW.control-bar-layer-m2jto.control-bar-container-xsWA7",
      ".video-player-controls",
    ];
    let targetContainer = null;
    for (const s of containerSelectors) { targetContainer = document.querySelector(s); if (targetContainer) break; }
    if (!titleText || !targetContainer) return;
    if (targetContainer.querySelector(".custom-series-name") || targetContainer.querySelector(".custom-movie-title")) return;

    let match = titleText.match(/^(.+?): (.+?) - (.+?) \((\d+x\d+)\)$/);
    if (!match) {
      match = titleText.match(/^(.+?) - (.+?) \((\d+x\d+)\)$/);
      if (match) {
        const [, sn, et, se] = match;
        const s1 = document.createElement("div"); s1.className = "custom-series-name"; s1.textContent = sn;
        const s2 = document.createElement("div"); s2.className = "custom-episode-title"; s2.textContent = `${et} (${se})`;
        targetContainer.insertBefore(s1, targetContainer.firstChild); targetContainer.insertBefore(s2, s1.nextSibling);
        if (titleElement) titleElement.style.display = "none"; return;
      }
    }
    if (!match) {
      match = titleText.match(/^(.+?) \((\d+x\d+)\) (.+?)$/);
      if (match) {
        const [, sn, se, et] = match;
        const s1 = document.createElement("div"); s1.className = "custom-series-name"; s1.textContent = sn;
        const s2 = document.createElement("div"); s2.className = "custom-episode-title"; s2.textContent = `${et} (${se})`;
        targetContainer.insertBefore(s1, targetContainer.firstChild); targetContainer.insertBefore(s2, s1.nextSibling);
        if (titleElement) titleElement.style.display = "none"; return;
      }
    }
    if (match && match.length === 5) {
      const [, sn, et, desc, se] = match;
      const s1 = document.createElement("div"); s1.className = "custom-series-name"; s1.textContent = `${desc} (${se})`;
      const s2 = document.createElement("div"); s2.className = "custom-episode-title"; s2.textContent = `${sn}: ${et}`;
      targetContainer.insertBefore(s1, targetContainer.firstChild); targetContainer.insertBefore(s2, s1.nextSibling);
      if (titleElement) titleElement.style.display = "none"; return;
    }
    if (titleText && titleText.length > 0) {
      const d = document.createElement("div"); d.className = "custom-series-name"; d.textContent = titleText;
      targetContainer.insertBefore(d, targetContainer.firstChild);
      if (titleElement) titleElement.style.display = "none";
    }
  }

  isValidTitle(text) {
    if (!text || text.trim().length === 0) return false;
    const t = text.trim();
    const bad = [/torrentio/i, /^\[RD/i, /^\[AD/i, /^\[PM/i, /^\[DL/i, /\[.*debrid.*\]/i, /^\[.*\]\s*torrentio/i, /^\[.*\]$/, /^http/i, /\.torrent$/i, /^magnet:/i, /debrid/i, /1080p/i, /720p/i, /2160p/i, /4k\b/i, /HDR/i, /HEVC/i, /x264/i, /x265/i, /WEB-?DL/i, /BluRay/i, /BRRip/i, /stream/i, /addon/i];
    for (const p of bad) { if (p.test(t)) return false; }
    if (t.includes("x") && /\d+x\d+/.test(t)) return true;
    return t.length >= 2 && t.length <= 200;
  }
}

new EnhancedPlayer();
