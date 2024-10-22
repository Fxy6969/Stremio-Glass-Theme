/**
 * @name CoverFix
 * @description Fixes the cropped covers on movies for our Glass Theme.
 * @version 1.0.0
 * @author Fxy
 */
function replaceCover() {
    const parent = document.querySelectorAll("div.thumb");
    if (parent.length > 0) {
        console.log("Number of Cover found:", parent.length);
        parent.forEach((div, index) => {
            console.log("Replacing cover on <div> index:", index);
            if(div.querySelector("img").src.includes("background")) return;
            div.querySelector("img").src = div.querySelector("img").src.replace("poster", "background");
        });
    } else {
        console.log("No <div> elements found yet. Retrying...");
        setTimeout(replaceCover, 500);
    }
}

setInterval(() => {
    replaceCover();
}, 200);
