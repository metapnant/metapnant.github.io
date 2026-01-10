// ==========================================
// PDF ENGINE
// ==========================================

function getLODScale() {
    // FIX: Always use the largest dimension to determine scale.
    // This ensures that even if loaded in Portrait, the PDF resolution 
    // is high enough to look crisp if rotated to Landscape later.
    const maxDim = Math.max(window.innerWidth, window.innerHeight);
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    
    if (!isMobileDevice) return 3.5;
    
    // On mobile, if we are in portrait, assume user might rotate.
    // Scale based on the larger dimension.
    // Base logic: 2.5 is usually good for mobile retina.
    return 2.5; 
}

async function loadDocument(index) {
    if (isLoading) return;
    isLoading = true; renderSession++; const currentSession = renderSession;
    
    // Visual Reset
    if (prevArrow) prevArrow.classList.remove('active-state');
    if (nextArrow) nextArrow.classList.remove('active-state');
    songContainer.style.opacity = "0"; 
    songContainer.style.visibility = "hidden";
    
    // FIX: SCROLL ANCHORING
    // If switching via "Show Voice", we lock the height of the PDF container 
    // to its current size. This keeps the button below it from moving 
    // while the PDF is cleared and re-rendered.
    if (waitingForLyrics) {
        const currentHeight = pdfWrapper.offsetHeight;
        if (currentHeight > 0) {
            pdfWrapper.style.minHeight = `${currentHeight}px`;
        }
        // Force the browser to stay centered on the button during the document swap
        btnShowVoice.scrollIntoView({ block: 'center', behavior: 'instant' });
    } else {
        pdfWrapper.style.minHeight = '';
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
  
    // Clear canvases
    const existingPages = document.querySelectorAll('.pdf-page-wrapper');
    existingPages.forEach(p => {
        const canvas = p.querySelector('canvas');
        if (canvas) { canvas.width = 1; canvas.height = 1; } 
        p.remove();
    });
  
    if (!waitingForLyrics) loadingOverlay.style.display = 'flex';
    
    prevArrow.classList.add('disabled'); 
    nextArrow.classList.add('disabled');
  
    currentIndex = index;
    const currentDoc = library[currentIndex];
    docTitle.textContent = currentDoc.title;
    downloadBtn.href = currentDoc.url + '?t=' + new Date().getTime();
    
    updateInfinityState();
  
    try {
      pdfDoc = await pdfjsLib.getDocument(downloadBtn.href).promise;
      
      // Render first page immediately
      await renderPage(1, currentSession);
      
      if (currentSession === renderSession) {
          if (!waitingForLyrics) loadingOverlay.style.display = 'none';
          document.body.classList.add("loaded");
  
          if (currentDoc.songUrl) {
              songLink.href = currentDoc.songUrl; songLink.textContent = currentDoc.songTitle;
              songContainer.style.opacity = "1"; songContainer.style.visibility = "visible";
          }
          
          isLoading = false;
          prevArrow.classList.remove('disabled'); 
          nextArrow.classList.remove('disabled');
          if (currentIndex === 0) prevArrow.classList.add('disabled');
          if (currentIndex === library.length - 1) nextArrow.classList.add('disabled');
  
          // Start rendering the rest of the document
          if (pdfDoc.numPages > 1) {
              renderRestOfPages(2, currentSession);
          } else if (waitingForLyrics) {
              // Document only has 1 page (unlikely for METAPNANT, but for safety)
              finishVoiceTransition();
          }
      }
    } catch (err) {
      console.error("Archive Load Error:", err);
      pdfWrapper.style.minHeight = '';
      isLoading = false;
      waitingForLyrics = false;
      if (voiceScrambleInterval) resolveLoadingScramble(btnShowVoice, "SHOW VOICE");
    }
  }
  
// Updated in js/pdf.js

async function renderRestOfPages(pageNum, sessionID) {
    if (sessionID !== renderSession) return;

    // IF ALL PAGES FINISHED: Trigger the final scroll UP
    if (pageNum > pdfDoc.numPages) {
        if (waitingForLyrics) {
            // Wait a tiny beat for the last page to physically mount to the DOM
            setTimeout(() => {
                finishVoiceTransition();
            }, 100);
        } else {
            pdfWrapper.style.minHeight = ''; 
        }
        return;
    }

    // Render the current page
    await renderPage(pageNum, sessionID);
    
    // FIX: THE SCROLL LOCK
    // While loading, keep the "Show Voice" button centered in the viewport
    // even as the document above it grows and tries to push it down.
    if (waitingForLyrics) {
        btnShowVoice.scrollIntoView({ block: 'center', behavior: 'instant' });
    }

    // Continue loop
    setTimeout(() => { renderRestOfPages(pageNum + 1, sessionID); }, 50); 
}

function finishVoiceTransition() {
    // 1. Resolve Scramble
    resolveLoadingScramble(btnShowVoice, "SHOW VOICE");
    
    // 2. Release Height Lock
    pdfWrapper.style.minHeight = '';
    
    // 3. Perform the final scroll UP to the lyrics
    const p8 = document.getElementById('page-wrapper-8'); 
    if (p8) { 
        jitterScrollTo(p8); 
    } else {
        // Fallback: If page 8 doesn't exist, scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    waitingForLyrics = false;
}

async function renderPage(num, sessionID) {
    try {
        if (sessionID !== renderSession) return;
        
        // SAFETY: Ensure the container has width before rendering.
        // If the browser is still "reloading", width might be 0.
        if (pdfWrapper.clientWidth === 0) {
            await new Promise(r => setTimeout(r, 50));
            return renderPage(num, sessionID);
        }
  
        let docToRender = pdfDoc;
        let pageIndexToRender = num;
        
        if (currentIndex === 0 && num === 8 && appState.musicUnlocked) {
            if (!lyricsDoc) lyricsDoc = await pdfjsLib.getDocument('lyrics.pdf').promise;
            docToRender = lyricsDoc; pageIndexToRender = currentTrackIdx + 1;
        }
  
        const page = await docToRender.getPage(pageIndexToRender);
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page-wrapper';
        wrapper.id = `page-wrapper-${num}`; 
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        wrapper.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        const lodScale = getLODScale();
        
        // FIX: Defensive viewport check
        const viewport = page.getViewport({ scale: lodScale });
        if (!viewport || viewport.width === 0) throw new Error("Invalid Viewport");
  
        canvas.height = Math.floor(viewport.height);
        canvas.width = Math.floor(viewport.width);
        
        const renderContext = { canvasContext: ctx, viewport: viewport };
        await page.render(renderContext).promise;
        
        if (sessionID !== renderSession) return;
        pdfWrapper.appendChild(wrapper);
        
        // Trigger CSS animation
        requestAnimationFrame(() => wrapper.classList.add('revealed'));
  
        if (num === pendingScrollPage && !waitingForLyrics) { 
            setTimeout(() => { smartScrollTo(wrapper); pendingScrollPage = null; }, 50);
        }
    } catch (e) { 
        console.warn("Render Page Error (Retrying...):", e);
        // If it fails because of a blank viewport, try one more time
        if (sessionID === renderSession) {
            setTimeout(() => renderPage(num, sessionID), 100);
        }
    }
}

async function refreshDynamicPage() {
    if (currentIndex !== 0 || !appState.musicUnlocked) return;
    const wrapper = document.getElementById('page-wrapper-8');
    if (!wrapper) return; 
    try {
        if (!lyricsDoc) lyricsDoc = await pdfjsLib.getDocument('lyrics.pdf').promise;
        const pageNum = currentTrackIdx + 1;
        const page = await lyricsDoc.getPage(pageNum);
        const currentHeight = wrapper.offsetHeight;
        wrapper.style.minHeight = `${currentHeight}px`;
        wrapper.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        wrapper.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const lodScale = getLODScale();
        const scaledViewport = page.getViewport({ scale: lodScale });
        canvas.height = Math.floor(scaledViewport.height); 
        canvas.width = Math.floor(scaledViewport.width);
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        wrapper.style.minHeight = '';
    } catch (e) { console.error("Failed to refresh lyrics page", e); }
}