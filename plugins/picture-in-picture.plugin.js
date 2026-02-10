/**
 * @name Picture in Picture
 * @description Adds a picture in picture button to the video player.
 * @version 26.0.1
 * @author Fxy
 */

class PictureInPicturePlugin {
  constructor() {
    this.init();
  }

  init() {
    this.addPiPButton();
    setTimeout(() => this.addPiPButton(), 500);
    const observer = new MutationObserver(() => this.addPiPButton());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  addPiPButton() {
    const controlBarSelectors = [
      ".control-bar-buttons-menu-container-M6L0_",
      "[class*='control-bar-buttons']",
      "[class*='control-bar'] [class*='buttons']",
      ".control-bar-container-xsWA7 [class*='buttons']",
    ];

    let controlBarContainer = null;
    for (const selector of controlBarSelectors) {
      controlBarContainer = document.querySelector(selector);
      if (controlBarContainer) break;
    }

    if (!controlBarContainer) return;
    if (controlBarContainer.querySelector(".pip-plugin-button")) return;

    const pipButton = document.createElement("div");
    pipButton.tabIndex = -1;
    pipButton.className =
      "control-bar-button-FQUsj button-container-zVLH6 pip-plugin-button";
    pipButton.innerHTML = `
      <svg class="icon-qy6I6 custom-icon" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"><g fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.25 18.25h-3.5a3 3 0 0 1-3-3v-8.5a3 3 0 0 1 3-3h12.5a3 3 0 0 1 3 3v3.5"/><rect width="12" height="10" x="11" y="12" fill="currentColor" rx="2"/></g></svg>
    `;

    pipButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePictureInPicture();
    });
    pipButton.addEventListener("mouseenter", () => (pipButton.style.opacity = "0.8"));
    pipButton.addEventListener("mouseleave", () => (pipButton.style.opacity = "1"));

    controlBarContainer.insertAdjacentElement("afterbegin", pipButton);
  }

  togglePictureInPicture() {
    // pick the best candidate video (playing + visible + biggest)
    const pickVideo = () => {
      const videos = Array.from(document.querySelectorAll("video"));
      if (!videos.length) return null;
  
      const score = (v) => {
        const r = v.getBoundingClientRect();
        const area = Math.max(0, r.width) * Math.max(0, r.height);
        const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
        const playing = !v.paused && !v.ended && v.readyState >= 2;
        return (playing ? 1e12 : 0) + (visible ? 1e9 : 0) + area;
      };
  
      return videos.sort((a, b) => score(b) - score(a))[0];
    };
  
    const video = pickVideo();
    if (!video) {
      console.warn("No <video> found.");
      return;
    }
  
    // If standard PiP is active, exit it.
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch((err) => {
        console.error("Failed to exit PiP:", err);
      });
      return;
    }
  
    // 1) Standard PiP (Chrome/Edge, Safari newer versions sometimes)
    if (video.requestPictureInPicture) {
      video.requestPictureInPicture().catch((err) => {
        console.warn("Standard PiP failed, trying WebKit PiP…", err);
  
        // 2) WebKit PiP fallback (Safari/macOS)
        try {
          if (typeof video.webkitSetPresentationMode === "function") {
            video.webkitSetPresentationMode("picture-in-picture");
          } else {
            console.error("WebKit PiP not supported on this video element.");
          }
        } catch (e) {
          console.error("WebKit PiP failed:", e);
        }
      });
      return;
    }
  
    // 2) WebKit PiP only (Safari)
    try {
      if (typeof video.webkitSetPresentationMode === "function") {
        // toggle for WebKit mode
        const mode = typeof video.webkitPresentationMode === "string"
          ? video.webkitPresentationMode
          : "inline";
  
        video.webkitSetPresentationMode(
          mode === "picture-in-picture" ? "inline" : "picture-in-picture"
        );
      } else {
        console.error("No PiP API available (standard or WebKit).");
      }
    } catch (err) {
      console.error("Failed to toggle WebKit PiP:", err);
    }
  }  
}

new PictureInPicturePlugin();
