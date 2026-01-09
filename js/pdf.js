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
  
  if (prevArrow) prevArrow.classList.remove('active-state');
  if (nextArrow) nextArrow.classList.remove('active-state');

  songContainer.style.opacity = "0"; songContainer.style.visibility = "hidden"; songLink.href = "javascript:void(0)";
  
  if (waitingForLyrics) {
      const currentHeight = pdfWrapper.getBoundingClientRect().height;
      if (currentHeight > 0) {
          pdfWrapper.style.minHeight = `${currentHeight}px`;
      }
  } else {
      pdfWrapper.style.minHeight = '';
      window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const existingPages = document.querySelectorAll('.pdf-page-wrapper');
  existingPages.forEach(p => {
      const canvas = p.querySelector('canvas');
      if (canvas) { canvas.width = 1; canvas.height = 1; } 
      p.remove();
  });

  if (!waitingForLyrics) {
      loadingOverlay.style.display = 'flex';
  }
  
  prevArrow.classList.add('disabled'); 
  nextArrow.classList.add('disabled');

  currentIndex = index;
  const currentDoc = library[currentIndex];
  docTitle.textContent = currentDoc.title;
  downloadBtn.href = currentDoc.url + '?t=' + new Date().getTime();
  
  updateInfinityState();

  try {
    pdfDoc = await pdfjsLib.getDocument(downloadBtn.href).promise;
    await renderPage(1, currentSession);
    
    if (currentSession === renderSession) {
        if (!waitingForLyrics) loadingOverlay.style.display = 'none';
        document.body.classList.add("loaded");
        const firstPage = pdfWrapper.querySelector('.pdf-page-wrapper');
        if(firstPage) firstPage.classList.add('revealed');

        if (!waitingForLyrics) { pdfWrapper.style.minHeight = ''; }

        if (currentDoc.songUrl) {
            songLink.href = currentDoc.songUrl; songLink.textContent = currentDoc.songTitle;
            if (currentDoc.bpm > 0) songLink.style.animationDuration = (60 / currentDoc.bpm).toFixed(5) + "s";
            else songLink.style.animationDuration = "";
            songContainer.style.opacity = "1"; songContainer.style.visibility = "visible";
        }
        isLoading = false;
        
        prevArrow.classList.remove('disabled'); 
        nextArrow.classList.remove('disabled');
        
        if (currentIndex === 0) prevArrow.classList.add('disabled');
        if (currentIndex === library.length - 1) nextArrow.classList.add('disabled');

        if (pdfDoc.numPages > 1) renderRestOfPages(2, currentSession);
    }
  } catch (err) {
    console.error(err);
    pdfWrapper.style.minHeight = '';
    loadingOverlay.innerHTML = "<div style='color:red; font-family:monospace'>ARCHIVE CORRUPTED</div>";
    isLoading = false;
    waitingForLyrics = false;
    if (voiceScrambleInterval) resolveLoadingScramble(btnShowVoice, "SHOW VOICE");
  }
}

async function renderRestOfPages(pageNum, sessionID) {
    if (sessionID !== renderSession || pageNum > pdfDoc.numPages) {
        pdfWrapper.style.minHeight = '';
        if (waitingForLyrics && pageNum > pdfDoc.numPages) {
            resolveLoadingScramble(btnShowVoice, "SHOW VOICE");
            const p8 = document.getElementById('page-wrapper-8'); 
            if (p8) { jitterScrollTo(p8); }
            waitingForLyrics = false;
        }
        return;
    }

    await renderPage(pageNum, sessionID);
    const pages = pdfWrapper.querySelectorAll('.pdf-page-wrapper');
    if(pages[pageNum-1]) pages[pageNum-1].classList.add('revealed');
    setTimeout(() => { renderRestOfPages(pageNum + 1, sessionID); }, 150); 
}

// Update in js/pdf.js
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