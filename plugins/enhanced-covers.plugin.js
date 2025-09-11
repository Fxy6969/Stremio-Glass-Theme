/**
 * @name EnhancedCovers
 * @description Widens the cover images in the library.
 * @version 1.0.0
 * @author Fxy
 */

function replaceCover() {
  const posters = document.querySelectorAll('[class*="poster-image-layer"] img');
  
  if (posters.length > 0) {
    posters.forEach((img) => {
      if (img.src.includes("background") || img.src.includes("large")) return;
      
      img.src = img.src.replace("/poster/small/", "/background/large/");
    });
  } else {
    setTimeout(replaceCover, 500);
  }
}

setInterval(() => {
  replaceCover();
}, 500);