/**
 * @name Theme
 * @description Manages dark mode and light mode toggle.
 * @version 1.0.0
 * @author Fxy
 */

class ThemeManager {
  constructor() {
    this.currentTheme = "dark";
    this.themeButtonId = "theme";
    this.windowControlsId = "window-controls";
  }

  init() {
    this.addButton();
  }

  addButton() {
    const windowControlsDiv = document.getElementById(this.windowControlsId);
    if (!windowControlsDiv) {
      console.log(`#${this.windowControlsId} not found. Retrying...`);
      setTimeout(() => this.addButton(), 500);
      return;
    }

    const newDiv = document.createElement("div");
    newDiv.innerHTML = `<li class="${this.currentTheme}" id="${this.themeButtonId}"></li>`;
    windowControlsDiv.appendChild(newDiv);

    this.setupThemeButton();
  }

  setupThemeButton() {
    const themeButton = document.getElementById(this.themeButtonId);
    if (!themeButton) return;

    themeButton.innerHTML = this.getIcon();
    themeButton.addEventListener("click", () => this.toggleTheme());
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === "light" ? "dark" : "light";
    const themeButton = document.getElementById(this.themeButtonId);
    if (themeButton) {
      themeButton.className = this.currentTheme;
      themeButton.innerHTML = this.getIcon();

      document.querySelector("html").toggleAttribute("data-light-color");
    }
  }

  getIcon() {
    const icons = {
      dark: `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
        <path d="M14.438 10.148c.19-.425-.321-.787-.748-.601A5.5 5.5 0 0 1 6.453 2.31c.186-.427-.176-.938-.6-.748a6.501 6.501 0 1 0 8.585 8.586Z" />
      </svg>`,
      light: `<svg class="icon" fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <path d="M16 26c1.105 0 2 0.895 2 2v2c0 1.105-0.895 2-2 2s-2-0.895-2-2v-2c0-1.105 0.895-2 2-2zM16 6c-1.105 0-2-0.895-2-2v-2c0-1.105 0.895-2 2-2s2 0.895 2 2v2c0 1.105-0.895 2-2 2zM30 14c1.105 0 2 0.895 2 2s-0.895 2-2 2h-2c-1.105 0-2-0.895-2-2s0.895-2 2-2h2zM6 16c0 1.105-0.895 2-2 2h-2c-1.105 0-2-0.895-2-2s0.895-2 2-2h2c1.105 0 2 0.895 2 2zM25.899 23.071l1.414 1.414c0.781 0.781 0.781 2.047 0 2.828s-2.047 0.781-2.828 0l-1.414-1.414c-0.781-0.781-0.781-2.047 0-2.828s2.047-0.781 2.828 0zM6.101 8.929l-1.414-1.414c-0.781-0.781-0.781-2.047 0-2.828s2.047-0.781 2.828 0l1.414 1.414c0.781 0.781 0.781 2.047 0 2.828s-2.047 0.781-2.828 0zM25.899 8.929c-0.781 0.781-2.047 0.781-2.828 0s-0.781-2.047 0-2.828l1.414-1.414c0.781-0.781 2.047-0.781 2.828 0s0.781 2.047 0 2.828l-1.414 1.414zM6.101 23.071c0.781-0.781 2.047-0.781 2.828 0s0.781 2.047 0 2.828l-1.414 1.414c-0.781 0.781-2.047 0.781-2.828 0s-0.781-2.047 0-2.828l1.414-1.414z"></path>
      <path d="M16 8c-4.418 0-8 3.582-8 8s3.582 8 8 8c4.418 0 8-3.582 8-8s-3.582-8-8-8zM16 21c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5z"></path>
      </svg>`,
    };
    return icons[this.currentTheme] || icons.dark;
  }
}

const themeManager = new ThemeManager();
themeManager.init();
