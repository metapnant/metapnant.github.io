// ==========================================
// PDF ENGINE
// ==========================================

function getLODScale() {
    // FIX: Force high resolution (2.5x to 3.0x) for all scenarios.
    // This allows the user to zoom in/out using browser native zoom
    // without the PDF becoming blurry, and removes the need to reload.
    // Mobile gets slightly less to save memory, Desktop gets max crispness.
    return isMobileDevice ? 2.5 : 3.5;
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

async function renderPage(num, sessionID) {
  try {
      if (sessionID !== renderSession) return;
      
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
      const viewport = page.getViewport({ scale: lodScale });
      canvas.height = Math.floor(viewport.height);
      canvas.width = Math.floor(viewport.width);
      const renderContext = { canvasContext: ctx, viewport: viewport };
      await page.render(renderContext).promise;
      
      if (sessionID !== renderSession) return;
      pdfWrapper.appendChild(wrapper);
      
      if (waitingForLyrics) {
          btnShowVoice.scrollIntoView({ block: 'center', behavior: 'auto' });
      }

      if (num === pendingScrollPage && !waitingForLyrics) { 
          setTimeout(() => { smartScrollTo(wrapper); pendingScrollPage = null; }, 50);
      }
  } catch (e) { 
      if (sessionID === renderSession) console.log("Render failed", e); 
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