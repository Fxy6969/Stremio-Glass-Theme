/**
 * @name HDR Tonemap Tuner
 * @description Alt+H shows a sidepanel in which you can adjust your HDR profile.
 * @version 1.0.2
 * @author stxrgaz
 */

(function() {
    'use strict';

    // ========================================================================
    // -v- edit presets to your liking here if you want -v-
    //       b=brightness, c=contrast, s= saturation
    // ========================================================================
    const MY_PRESETS = {
        preset1: { name: "💯",  b: 104, c: 110, s: 86  },
        preset2: { name: "☀️", b: 200, c: 98, s: 90  },
        preset3: { name: "🌈",    b: 153, c: 100, s: 100  },
        preset4: { name: "📽️",   b: 110, c: 106, s: 80  }
    };

    let activePresetID = sessionStorage.getItem('hdr_active_preset_id') || 'preset1';
    let currentSettings = { 
        b: MY_PRESETS[activePresetID].b, 
        c: MY_PRESETS[activePresetID].c, 
        s: MY_PRESETS[activePresetID].s 
    };

    const style = document.createElement('style');
    style.textContent = `
        video {
            color-profile: display-p3 !important;
            rendering-intent: relative-colorimetric !important;
            content-visibility: auto;
            filter: brightness(var(--hdr-bright, 104%)) contrast(var(--hdr-contrast, 110%)) saturate(var(--hdr-saturate, 86%)) !important;
            -webkit-filter: brightness(var(--hdr-bright, 104%)) contrast(var(--hdr-contrast, 110%)) saturate(var(--hdr-saturate, 86%)) !important;
        }
        #subtitles, .subtitle-text, .shaka-text-container, .video-subtitles, [class*="subtitle"], [class*="Subtitle"], video::-webkit-media-text-track-container, video::-webkit-media-text-track-container * {
            filter: none !important; -webkit-filter: none !important; backdrop-filter: none !important;
            color: #ffffff !important; text-shadow: 0px 0px 4px rgba(0,0,0,0.9) !important; z-index: 2147483647 !important;
        }
        .hdr-hotkey-panel {
            position: fixed !important; top: 50%; right: -300px; transform: translateY(-50%);
            background: rgba(15, 15, 15, 0.7) !important; backdrop-filter: blur(25px) saturate(160%) !important; -webkit-backdrop-filter: blur(25px) saturate(160%) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 14px 0 0 14px;
            padding: 20px; width: 250px; box-shadow: -10px 0px 32px rgba(0, 0, 0, 0.5);
            z-index: 2147483647 !important; display: flex; flex-direction: column; gap: 18px;
            font-family: system-ui, -apple-system, sans-serif !important; color: #ffffff !important;
            transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hdr-hotkey-panel.active { right: 0px; }
        .hdr-header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 10px; }
        .hdr-close-btn { background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 22px; cursor: pointer; transition: color 0.2s; }
        .hdr-close-btn:hover { color: #ff5555; }
        
        .hdr-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
        .hdr-label-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.8); }
        
        .hdr-button-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
        .hdr-preset-btn {
            background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
            color: #ffffff; border-radius: 8px; padding: 10px 4px; font-size: 15px; font-weight: 500;
            cursor: pointer; transition: background 0.2s, border-color 0.2s; text-align: center;
        }
        .hdr-preset-btn:hover { background: rgba(255, 255, 255, 0.18); border-color: rgba(255, 255, 255, 0.3); }
        .hdr-preset-btn.selected { background: rgba(255, 255, 255, 0.25); border-color: #ffffff; font-weight: bold; }

        .hdr-slider { 
            -webkit-appearance: none; 
            width: 100%; 
            height: 10px; 
            border-radius: 5px; 
            background: rgba(255, 255, 255, 0.15); 
            outline: none;
            cursor: pointer;
        }
        
        .hdr-slider::-webkit-slider-thumb { 
            -webkit-appearance: none; 
            width: 20px; 
            height: 20px; 
            border-radius: 50%; 
            background: #ffffff; 
            cursor: pointer; 
            box-shadow: 0 0 10px rgba(255,255,255,0.6), 0 2px 6px rgba(0,0,0,0.5);
            transition: transform 0.1s, background-color 0.1s;
        }
        .hdr-slider::-webkit-slider-thumb:hover {
            transform: scale(1.2);
            background-color: #e0e0e0;
        }
    `;
    document.head.appendChild(style);

    function applyLiveFilters() {
        document.documentElement.style.setProperty('--hdr-bright', currentSettings.b + '%');
        document.documentElement.style.setProperty('--hdr-contrast', currentSettings.c + '%');
        document.documentElement.style.setProperty('--hdr-saturate', currentSettings.s + '%');
    }

    function syncPanelValues(panel, b, c, s) {
        currentSettings.b = b; currentSettings.c = c; currentSettings.s = s;
        panel.querySelector('#slide-b').value = b;
        panel.querySelector('#slide-c').value = c;
        panel.querySelector('#slide-s').value = s;
        panel.querySelector('#val-b').innerText = b + '%';
        panel.querySelector('#val-c').innerText = c + '%';
        panel.querySelector('#val-s').innerText = s + '%';
        applyLiveFilters();
    }
    function createHotkeyPanel() {
        if (document.querySelector('.hdr-hotkey-panel')) return;

        const panel = document.createElement('div');
        panel.className = 'hdr-hotkey-panel';
        panel.innerHTML = `
            <div class="hdr-header-row">
                <div style="font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.95);">⚙️ HDR Profile Tuner 🛠️</div>
                <button class="hdr-close-btn" id="hdr-close">&times;</button>
            </div>
            
            <div class="hdr-row">
                <div class="hdr-label-row"><span>Ready To Use Profiles</span></div>
                <div class="hdr-button-grid" id="hdr-btn-grid">
                    <button class="hdr-preset-btn" data-id="preset1">${MY_PRESETS.preset1.name}</button>
                    <button class="hdr-preset-btn" data-id="preset2">${MY_PRESETS.preset2.name}</button>
                    <button class="hdr-preset-btn" data-id="preset3">${MY_PRESETS.preset3.name}</button>
                    <button class="hdr-preset-btn" data-id="preset4">${MY_PRESETS.preset4.name}</button>
                </div>
            </div>

            <div class="hdr-row" style="margin-top: 5px;">
                <div class="hdr-label-row"><span>Adjustment Sliders</span></div>
            </div>
            <div class="hdr-row">
                <div class="hdr-label-row"><span>Brightness</span><span id="val-b">${currentSettings.b}%</span></div>
                <input type="range" min="50" max="200" value="${currentSettings.b}" class="hdr-slider" id="slide-b">
            </div>
            <div class="hdr-row">
                <div class="hdr-label-row"><span>Contrast</span><span id="val-c">${currentSettings.c}%</span></div>
                <input type="range" min="50" max="200" value="${currentSettings.c}" class="hdr-slider" id="slide-c">
            </div>
            <div class="hdr-row">
                <div class="hdr-label-row"><span>Saturation</span><span id="val-s">${currentSettings.s}%</span></div>
                <input type="range" min="0" max="200" value="${currentSettings.s}" class="hdr-slider" id="slide-s">
            </div>
        `;

        document.body.appendChild(panel);

        const closeBtn = panel.querySelector('#hdr-close');
        const buttonGrid = panel.querySelector('#hdr-btn-grid');

        const currentActiveBtn = buttonGrid.querySelector(`[data-id="${activePresetID}"]`);
        if (currentActiveBtn) currentActiveBtn.classList.add('selected');

        panel.addEventListener('click', e => e.stopPropagation());
        panel.addEventListener('mousedown', e => e.stopPropagation());
        closeBtn.addEventListener('click', () => panel.classList.remove('active'));

        buttonGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.hdr-preset-btn');
            if (!btn) return;

            buttonGrid.querySelectorAll('.hdr-preset-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            activePresetID = btn.dataset.id;
            sessionStorage.setItem('hdr_active_preset_id', activePresetID);

            const selectedData = MY_PRESETS[activePresetID];
            if (selectedData) {
                syncPanelValues(panel, selectedData.b, selectedData.c, selectedData.s);
            }
        });

        const setupSlider = (id, targetKey) => {
            const slider = panel.querySelector(`#${id}`);
            const label = panel.querySelector(`#val-${id.replace('slide-', '')}`);
            slider.addEventListener('input', (e) => {
                buttonGrid.querySelectorAll('.hdr-preset-btn').forEach(b => b.classList.remove('selected'));
                const value = e.target.value;
                label.innerText = value + '%';
                currentSettings[targetKey] = parseFloat(value);
                applyLiveFilters();
            });
        };

        setupSlider('slide-b', 'b');
        setupSlider('slide-c', 'c');
        setupSlider('slide-s', 's');
    }

    document.addEventListener('keydown', function(event) {
        if (event.altKey && event.key.toLowerCase() === 'h') {
            if (document.querySelector('video')) {
                createHotkeyPanel();
                const panel = document.querySelector('.hdr-hotkey-panel');
                if (panel) panel.classList.toggle('active');
            }
        }
    });

    const observer = new MutationObserver(() => {
        const video = document.querySelector('video');
        if (video && !video.dataset.hdrEnforced) {
            video.setAttribute('color-space', 'bt2020');
            video.setAttribute('color-transfer', 'smpte2084');
            video.dataset.hdrEnforced = "true";
            
            activePresetID = sessionStorage.getItem('hdr_active_preset_id') || 'preset1';
            currentSettings.b = MY_PRESETS[activePresetID].b;
            currentSettings.c = MY_PRESETS[activePresetID].c;
            currentSettings.s = MY_PRESETS[activePresetID].s;
            
            applyLiveFilters();
        } else if (!video) {
            const panel = document.querySelector('.hdr-hotkey-panel');
            if (panel) panel.classList.remove('active');
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
