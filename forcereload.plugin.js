/**
 * @name ReloadOnShortcut
 * @description Reloads the Electron window when CTRL+SHIFT+R is pressed.
 * @version 1.0.1
 * @author Moerat
 * @updateUrl https://raw.githubusercontent.com/YourUsername/YourRepo/main/ReloadOnShortcut.plugin.js
 */

document.addEventListener("keydown", (e) => {
    // Check if CTRL and SHIFT keys are pressed together with 'R'
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault(); // Prevent the default refresh action
        
        // Try different methods to reload the window
        if (window.stremio && window.stremio.electron && typeof window.stremio.electron.reload === 'function') {
            window.stremio.electron.reload();
        } else if (window.electron && typeof window.electron.reload === 'function') {
            window.electron.reload();
        } else {
            location.reload();
        }
    }
});
