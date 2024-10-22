/**
 * @name MP4Only
 * @description Shows MP4 Files only since mkv doesn't have any audio on Web Clients.
 * @version 1.0.0
 * @author Fxy
 */
function hideFile() {
    const parent = document.querySelectorAll("#detail > div.sidebar.ng-scope > div.streams-container > ul > li");
    if (parent.length > 0) {
        parent.forEach((div) => {
            const fileTitle = div.querySelector("div.stream-content > div.description > div");

            if(fileTitle.innerHTML.includes("mp4")) return;
            div.style.display = "none";
        });
    } else {
        setTimeout(hideFile, 1500);
    }
}

setInterval(() => {
    hideFile();
}, 200);
