// ==========================================
// INITIALIZATION & LISTENERS
// ==========================================

// Global Audio Unlock
document.addEventListener('click', unlockAudioEngine);
document.addEventListener('keydown', unlockAudioEngine);
document.addEventListener('touchstart', unlockAudioEngine);
document.addEventListener('touchend', unlockAudioEngine);

// Window Resize
window.addEventListener('resize', () => {
    if (isMobileDevice) {
        const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        if (currentOrientation === lastOrientation) return;
        lastOrientation = currentOrientation;
    } else {
        if (Math.abs(window.innerWidth - lastWidth) < 100) return;
        lastWidth = window.innerWidth;
    }
    if (!isLoading && pdfDoc) {
        if (resizeTimer) clearTimeout(resizeTimer);
        const visiblePage = getVisiblePageNumber();
        pendingScrollPage = visiblePage; 
        resizeTimer = setTimeout(() => { loadDocument(currentIndex); }, 300);
    }
});

// UI Buttons
document.getElementById('next-doc').addEventListener('click', () => { if(!isLoading && currentIndex < library.length - 1) loadDocument(currentIndex + 1); });
document.getElementById('prev-doc').addEventListener('click', () => { if(!isLoading && currentIndex > 0) loadDocument(currentIndex - 1); });

[document.getElementById('next-doc'), document.getElementById('prev-doc')].forEach(arrow => {
    arrow.addEventListener('touchstart', function() { this.classList.add('active-state'); }, {passive: true});
    arrow.addEventListener('touchend', function() { this.classList.remove('active-state'); }, {passive: true});
});

if(btnPlay) btnPlay.addEventListener('click', (e) => { e.preventDefault(); togglePlay(); });
if(btnNext) btnNext.addEventListener('click', (e) => { e.preventDefault(); nextTrack(false); });
if(btnPrev) btnPrev.addEventListener('click', (e) => { e.preventDefault(); prevTrack(); });
if(btnLoop) btnLoop.addEventListener('click', (e) => { e.preventDefault(); toggleLoop(); });

progressArea.addEventListener('mousedown', startDragMouse); 
document.addEventListener('mousemove', doDragMouse); 
document.addEventListener('mouseup', endDragMouse);
progressArea.addEventListener('touchstart', startDragTouch, { passive: false }); 
progressArea.addEventListener('touchmove', doDragTouch, { passive: false }); 
progressArea.addEventListener('touchend', endDragTouch);

// --- AUDIO EVENT HANDLING (Precision Logic) ---

// 1. PLAYING
audioPlayer.addEventListener('playing', () => {
    // Stop the debounce timer immediately
    if (bufferDebounceTimer) { clearTimeout(bufferDebounceTimer); bufferDebounceTimer = null; }

    isPlaying = true;
    updatePlayBtn();

    // TRIGGER REVEAL LOGIC:
    // Only animate if we were currently "Loading" (Alien Loop) OR we just Switched Tracks.
    // If we were just paused or scrubbing fast (scramble engine idle), do NOT animate.
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        if (ScrambleEngine.isLooping || isSwitchingTrack) {
            ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
        } else {
            // Just ensure text is correct without animation
            ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    }
    
    isSwitchingTrack = false;
});

// 2. WAITING (Buffering)
audioPlayer.addEventListener('waiting', () => {
    if (bufferDebounceTimer) clearTimeout(bufferDebounceTimer);

    // DEBOUNCE: 150ms Rule
    // Only switch to Alien Glyphs if we hang for > 150ms.
    bufferDebounceTimer = setTimeout(() => {
        if (isPlaying && !audioPlayer.paused) {
            ScrambleEngine.startLoading(domTrackTitle);
        }
    }, 150); 
});

// 3. PAUSE
audioPlayer.addEventListener('pause', () => {
    if (bufferDebounceTimer) { clearTimeout(bufferDebounceTimer); bufferDebounceTimer = null; }
    
    isPlaying = false;
    updatePlayBtn();
    
    // Snap to static text immediately on pause
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 4. SEEKED
audioPlayer.addEventListener('seeked', () => {
    // If seek happened faster than 150ms, cancel the loading trigger.
    if (bufferDebounceTimer) { clearTimeout(bufferDebounceTimer); bufferDebounceTimer = null; }
    
    if (audioPlayer.paused) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 5. TIMEUPDATE
audioPlayer.addEventListener('timeupdate', () => { 
    if (!isDragging && pendingSeekPercent === null && audioPlayer.duration) { 
        const p = (audioPlayer.currentTime / audioPlayer.duration) * 100; 
        domProgressBar.style.setProperty('--progress', `${p}%`); 
        domCurrentTime.textContent = formatTime(audioPlayer.currentTime); 
        domDuration.textContent = formatTime(audioPlayer.duration); 
    }
});

audioPlayer.addEventListener('ended', () => { 
    ScrambleEngine.clear();
    nextTrack(true); 
});

audioPlayer.addEventListener('loadedmetadata', () => { 
    domDuration.textContent = formatTime(audioPlayer.duration); 
    // Cold seek recovery
    if (pendingSeekPercent !== null && audioPlayer.duration && isFinite(audioPlayer.duration)) { 
        audioPlayer.currentTime = (pendingSeekPercent / 100) * audioPlayer.duration; 
        domProgressBar.style.setProperty('--progress', `${pendingSeekPercent}%`); 
        pendingSeekPercent = null; 
    }
});

// PDF Tools Toggle
const toolsContainer = document.getElementById('pdf-tools');
const toolsToggleEl = document.getElementById('tools-toggle');
if (toolsToggleEl && toolsContainer) {
    toolsToggleEl.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toolsContainer.classList.toggle('active'); });
    document.addEventListener('click', (e) => { if (toolsContainer.classList.contains('active') && !toolsContainer.contains(e.target)) { toolsContainer.classList.remove('active'); } });
}

// Show Voice Button
if (btnShowVoice) { 
    btnShowVoice.addEventListener('click', (e) => { 
        e.preventDefault(); if (isLoading) return; 
        btnShowVoice.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (currentIndex !== 0) {
            waitingForLyrics = true; startLoadingScramble(btnShowVoice); loadDocument(0); 
        } else {
            const p8 = document.getElementById('page-wrapper-8'); 
            if (p8) { jitterScrollTo(p8); } 
            else { waitingForLyrics = true; startLoadingScramble(btnShowVoice); }
        }
    }); 
}

// Secret / Terminal Trigger
infinityBtn.addEventListener('click', (e) => { 
    e.preventDefault(); SimpleSynth.unlock(); 
    if (appState.terminalFound) { launchTerminal(); return; } 
    if (currentIndex !== 2) return; 
    secretClicks++; infinityBtn.style.color = "#ff00ff"; setTimeout(() => infinityBtn.style.color = "", 200); 
    if (secretClicks === 3) { secretClicks = 0; appState.terminalFound = true; updateInfinityState(); launchTerminal(); } 
});

// Keyboard Controls
document.addEventListener('keydown', (e) => { 
    const isPlayerVisible = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500; 
    if (e.code === 'Space') { if (isPlayerVisible || terminalRunning) { e.preventDefault(); togglePlay(); } } 
    if (e.code === 'ArrowRight') { if (e.shiftKey) { e.preventDefault(); nextTrack(false); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime += 5; } } 
    if (e.code === 'ArrowLeft') { if (e.shiftKey) { e.preventDefault(); prevTrack(); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime -= 5; } } 
});

// Tactile Feedback Engine
function addTactileListener(selector) {
    const els = document.querySelectorAll(selector);
    els.forEach(el => {
        const handleStart = function(e) {
            if (e.type === 'touchstart') e.stopPropagation();
            this.classList.add('active-state');
        };
        const handleEnd = function() {
            const self = this;
            setTimeout(() => { self.classList.remove('active-state'); }, 100);
        };
        el.addEventListener('touchstart', handleStart, {passive: true});
        el.addEventListener('touchend', handleEnd, {passive: true});
        el.addEventListener('touchcancel', () => el.classList.remove('active-state'), {passive: true});
        el.addEventListener('mousedown', handleStart);
        el.addEventListener('mouseup', handleEnd);
        el.addEventListener('mouseleave', () => el.classList.remove('active-state'));
    });
}

const interfaceSelectors = ['.close-terminal', '.cycle-btn', '.tools-toggle', '.tool-btn', '.ctrl-btn', '.voice-btn', '.playlist-item', '.secret-link', '#song-link', '.nav-arrow'];
interfaceSelectors.forEach(s => addTactileListener(s));

// --- BOOT SEQUENCE ---
document.getElementById("currentYear").textContent = new Date().getFullYear();
initTerminalState(); 
loadDocument(0); 
initPlaylist(); 
loadTrack(0, false); 
setTimeout(() => { ScrambleEngine.snap(domTrackTitle, albumTracks[0].title); }, 500);