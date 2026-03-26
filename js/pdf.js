// ==========================================
// PDF ENGINE (VIRTUALIZED & OVERSAMPLED)
// ==========================================

let renderQueue =[];
let isRendering = false;

// Intersection observer for lazy loading and aggressive memory cleanup
const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const wrapper = entry.target;
        if (entry.isIntersecting) {
            if (!wrapper.classList.contains('rendered')) {
                renderCanvasForWrapper(wrapper);
            }
        } else {
            // Unload canvas if it goes out of view to free GPU VRAM
            if (wrapper.classList.contains('rendered') || wrapper.classList.contains('wants-render')) {
                unloadCanvasForWrapper(wrapper);
            }
        }
    });
}, { rootMargin: '150% 0px' }); // Load 1.5 screens ahead and behind

function getOptimalScale(page) {
    // Fallback to window width if container has no width yet
    const containerWidth = pdfWrapper.clientWidth > 0 ? pdfWrapper.clientWidth : Math.min(window.innerWidth, 900);
    
    // THE "ULTRA GRAPHICS" OVERSAMPLER
    // Because we virtualized the DOM, we have massive VRAM headroom.
    // We artificially multiply the Device Pixel Ratio so the texture has 
    // enough raw pixel density to remain razor-sharp when pinch-zoomed.
    const oversampleMultiplier = isMobileDevice ? 2.5 : 1.5;
    const dpr = (window.devicePixelRatio || 1) * oversampleMultiplier; 
    
    const targetWidth = containerWidth * dpr;
    const unscaledViewport = page.getViewport({ scale: 1 });
    
    let scale = targetWidth / unscaledViewport.width;
    
    // Crank the hard cap up to 4096 pixels (True 4K). 
    // 1 or 2 4K canvases is effortless for modern mobile GPUs. 
    // (If we hadn't built the unloader, 41 of these would crash the phone instantly).
    const MAX_CANVAS_WIDTH = 4096; 
    if (unscaledViewport.width * scale > MAX_CANVAS_WIDTH) {
        scale = MAX_CANVAS_WIDTH / unscaledViewport.width;
    }
    
    return scale;
}

async function processRenderQueue() {
    if (isRendering || renderQueue.length === 0) return;
    isRendering = true;
    
    // Process the most recently added item first (LIFO) so fast scrolling feels instantaneous
    const wrapper = renderQueue.pop(); 
    
    try {
        if (wrapper.parentElement && wrapper.classList.contains('wants-render')) {
            const page = wrapper._pdfPage;
            const canvas = wrapper.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            
            const scale = getOptimalScale(page);
            const viewport = page.getViewport({ scale: scale });
            
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            
            if (wrapper._renderTask) {
                wrapper._renderTask.cancel();
            }
            
            wrapper._renderTask = page.render({ canvasContext: ctx, viewport: viewport });
            await wrapper._renderTask.promise;
            
            wrapper.classList.add('rendered');
            wrapper.classList.remove('wants-render');
            wrapper.classList.add('revealed');
            
            if (wrapper.dataset.pageNumber == pendingScrollPage && !waitingForLyrics) {
                setTimeout(() => { smartScrollTo(wrapper); pendingScrollPage = null; }, 50);
            }
        }
    } catch (e) {
        // "RenderingCancelledException" is expected if we scroll past a page before it finishes
        if (e.name !== "RenderingCancelledException") {
            console.error("Render failed", e);
        }
    }
    
    isRendering = false;
    requestAnimationFrame(processRenderQueue);
}

function renderCanvasForWrapper(wrapper) {
    if (!wrapper.classList.contains('wants-render')) {
        wrapper.classList.add('wants-render');
        // Prevent duplicates in queue
        renderQueue = renderQueue.filter(w => w !== wrapper);
        renderQueue.push(wrapper);
        processRenderQueue();
    }
}

function unloadCanvasForWrapper(wrapper) {
    wrapper.classList.remove('wants-render');
    wrapper.classList.remove('rendered');
    wrapper.classList.remove('revealed');
    
    renderQueue = renderQueue.filter(w => w !== wrapper);
    
    if (wrapper._renderTask) {
        wrapper._renderTask.cancel();
        wrapper._renderTask = null;
    }
    const canvas = wrapper.querySelector('canvas');
    if (canvas) {
        // Shrinking dimensions to 1x1 forces the browser to drop the massive texture from memory
        canvas.width = 1;
        canvas.height = 1;
    }
}

async function loadDocument(index) {
    if (isLoading) return;
    isLoading = true; renderSession++; const currentSession = renderSession;
    
    // FIX: Reset the loaded state so arrows and container can fade in again
    document.body.classList.remove("loaded"); 
    
    // Enforce transparency on the container and lock scrolling safely
    pdfWrapper.classList.remove('ready'); 
    if (!waitingForLyrics) {
        document.documentElement.classList.add('loading-lock');
        document.body.classList.add('loading-lock'); 
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
    
    // Visual Reset
    if (prevArrow) prevArrow.classList.remove('active-state');
    if (nextArrow) nextArrow.classList.remove('active-state');
    if (songContainer) {
        songContainer.style.opacity = "0"; 
        songContainer.style.visibility = "hidden";
    }
    
    if (waitingForLyrics) {
        const currentHeight = pdfWrapper.offsetHeight;
        if (currentHeight > 0) pdfWrapper.style.minHeight = `${currentHeight}px`;
        if (btnShowVoice) btnShowVoice.scrollIntoView({ block: 'center', behavior: 'instant' });
    } else {
        pdfWrapper.style.minHeight = '';
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
  
    // Clear old canvases and unobserve them
    const existingPages = document.querySelectorAll('.pdf-page-wrapper');
    existingPages.forEach(p => {
        pageObserver.unobserve(p);
        unloadCanvasForWrapper(p);
        p.remove();
    });
    
    renderQueue =[];
    isRendering = false;
  
    if (!waitingForLyrics && loadingOverlay) loadingOverlay.style.display = 'flex';
    
    if (prevArrow) prevArrow.classList.add('disabled'); 
    if (nextArrow) nextArrow.classList.add('disabled');
  
    currentIndex = index;
    const currentDoc = library[currentIndex];
    if (docTitle) docTitle.textContent = currentDoc.title;
    if (downloadBtn) downloadBtn.href = currentDoc.url + '?t=' + new Date().getTime();
    
    if (typeof updateInfinityState === 'function') updateInfinityState();
  
    try {
      pdfDoc = await pdfjsLib.getDocument(downloadBtn.href).promise;
      
      // Create wrapper for the first page
      await createPageWrapper(1, currentSession);
      
      if (currentSession === renderSession) {
          if (!waitingForLyrics && loadingOverlay) loadingOverlay.style.display = 'none';
          
          // Re-introduce the background, HUD fade, and unlock scroll
          document.body.classList.add("loaded");
          pdfWrapper.classList.add('ready'); 
          document.documentElement.classList.remove('loading-lock');
          document.body.classList.remove('loading-lock');
  
          if (currentDoc.songUrl && songLink && songContainer) {
            songLink.href = currentDoc.songUrl; songLink.textContent = currentDoc.songTitle;
            songContainer.style.opacity = "1"; songContainer.style.visibility = "visible";
            
            // Calculate BPM duration (60 seconds / BPM = seconds per beat)
            if (currentDoc.bpm) {
                const beatDuration = 60 / currentDoc.bpm;
                songLink.style.setProperty('--bpm-duration', `${beatDuration}s`);
            } else {
                songLink.style.setProperty('--bpm-duration', `1s`); // Fallback
            }
        }
          
          isLoading = false;
          if (prevArrow) prevArrow.classList.remove('disabled'); 
          if (nextArrow) nextArrow.classList.remove('disabled');
          if (currentIndex === 0 && prevArrow) prevArrow.classList.add('disabled');
          if (currentIndex === library.length - 1 && nextArrow) nextArrow.classList.add('disabled');
  
          // Lay down placeholders for remaining pages immediately
          if (pdfDoc.numPages > 1) {
              createRestOfWrappers(2, currentSession);
          } else if (waitingForLyrics) {
              finishVoiceTransition();
          }
      }
    } catch (err) {
      console.error("Archive Load Error:", err);
      pdfWrapper.style.minHeight = '';
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      document.documentElement.classList.remove('loading-lock');
      document.body.classList.remove('loading-lock');
      isLoading = false;
      waitingForLyrics = false;
      if (typeof resolveLoadingScramble === 'function' && typeof voiceScrambleInterval !== 'undefined' && voiceScrambleInterval) {
          resolveLoadingScramble(btnShowVoice, "SHOW VOICE");
      }
    }
}

async function createRestOfWrappers(pageNum, sessionID) {
    if (sessionID !== renderSession) return;

    if (pageNum > pdfDoc.numPages) {
        if (waitingForLyrics) {
            setTimeout(() => { finishVoiceTransition(); }, 100);
        } else {
            pdfWrapper.style.minHeight = ''; 
        }
        return;
    }

    await createPageWrapper(pageNum, sessionID);
    
    if (waitingForLyrics && btnShowVoice) {
        btnShowVoice.scrollIntoView({ block: 'center', behavior: 'instant' });
    }

    setTimeout(() => { createRestOfWrappers(pageNum + 1, sessionID); }, 0); 
}

function finishVoiceTransition() {
    if (typeof resolveLoadingScramble === 'function') {
        resolveLoadingScramble(btnShowVoice, "SHOW VOICE");
    }
    
    pdfWrapper.style.minHeight = '';
    
    const p8 = document.getElementById('page-wrapper-8'); 
    if (p8) { 
        if (typeof jitterScrollTo === 'function') jitterScrollTo(p8); 
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    waitingForLyrics = false;
}

async function createPageWrapper(num, sessionID) {
    try {
        if (sessionID !== renderSession) return;
        
        let docToRender = pdfDoc;
        let pageIndexToRender = num;
        
        // Handle Lyrics Sync 
        if (currentIndex === 0 && num === 8 && appState && appState.musicUnlocked) {
            if (!lyricsDoc) lyricsDoc = await pdfjsLib.getDocument('lyrics.pdf').promise;
            docToRender = lyricsDoc; pageIndexToRender = currentTrackIdx + 1;
        }
  
        const page = await docToRender.getPage(pageIndexToRender);
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page-wrapper';
        wrapper.id = `page-wrapper-${num}`; 
        wrapper.dataset.pageNumber = num;
        
        // Pin aspect ratio so layout doesn't collapse when canvas unloads
        const unscaledViewport = page.getViewport({ scale: 1 });
        const aspectRatio = unscaledViewport.width / unscaledViewport.height;
        wrapper.style.aspectRatio = aspectRatio;
        
        // Fallback for extremely old browsers
        if (!CSS.supports("aspect-ratio", "1/1")) {
            wrapper.style.height = `${(pdfWrapper.clientWidth || window.innerWidth) / aspectRatio}px`;
        }
        
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        wrapper.appendChild(canvas);
        
        if (sessionID !== renderSession) return;
        pdfWrapper.appendChild(wrapper);
        
        wrapper._pdfPage = page;
        
        // Track intersection state to decide when to mount/unmount memory
        pageObserver.observe(wrapper);
        
    } catch (e) { 
        console.warn("Create Page Wrapper Error:", e);
    }
}

async function refreshDynamicPage() {
    if (currentIndex !== 0 || !appState || !appState.musicUnlocked) return;
    const wrapper = document.getElementById('page-wrapper-8');
    if (!wrapper) return; 
    
    try {
        if (!lyricsDoc) lyricsDoc = await pdfjsLib.getDocument('lyrics.pdf').promise;
        const pageNum = currentTrackIdx + 1;
        const page = await lyricsDoc.getPage(pageNum);
        
        wrapper._pdfPage = page;
        
        const unscaled = page.getViewport({ scale: 1 });
        wrapper.style.aspectRatio = unscaled.width / unscaled.height;
        
        // Force an immediate re-render of this specific pane
        unloadCanvasForWrapper(wrapper);
        renderCanvasForWrapper(wrapper);
        
    } catch (e) { console.error("Failed to refresh lyrics page", e); }
}