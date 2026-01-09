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

// --- AUDIO EVENT HANDLING ---

// Debounce Helper: Only show "LOADING" if we wait > 100ms
const startBufferingCheck = () => {
    if (bufferDebounceTimer) clearTimeout(bufferDebounceTimer);
    
    // Only trigger if we are supposed to be playing
    if (isPlaying && !audioPlayer.paused) {
        bufferDebounceTimer = setTimeout(() => {
            // Check state again: If we are actively seeking or readyState is low, show loading
            if (audioPlayer.seeking || audioPlayer.readyState < 3) {
                ScrambleEngine.startLoading(domTrackTitle);
            }
        }, 100); 
    }
};

const stopBufferingCheck = () => {
    if (bufferDebounceTimer) {
        clearTimeout(bufferDebounceTimer);
        bufferDebounceTimer = null;
    }
};

// 1. SEEKING (Immediate trigger when scrub is released)
audioPlayer.addEventListener('seeking', startBufferingCheck);

// 2. WAITING / STALLED (Network lag)
audioPlayer.addEventListener('waiting', startBufferingCheck);
audioPlayer.addEventListener('stalled', startBufferingCheck);

// 3. PLAYING (Success)
audioPlayer.addEventListener('playing', () => {
    stopBufferingCheck();
    isPlaying = true;
    updatePlayBtn();

    // TRIGGER REVEAL:
    // Only animate if we were "Looping" (Alien Glyphs) or switching tracks.
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        if (ScrambleEngine.isLooping || isSwitchingTrack) {
            ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
        } else {
            // Instant seek -> Static text
            ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    }
    
    isSwitchingTrack = false;
});

// 4. PAUSE
audioPlayer.addEventListener('pause', () => {
    stopBufferingCheck();
    
    // CRITICAL: Ignore pause event if it's caused by track switch.
    // This keeps the button in "Playing" (Pause icon) state while loading new track.
    if (isSwitchingTrack) return;

    isPlaying = false;
    updatePlayBtn();
    
    // Snap text
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 5. SEEKED
audioPlayer.addEventListener('seeked', () => {
    // Note: We don't resolve text here. We wait for 'playing' or 'timeupdate'.
    // If we resolve here, we might flash text before 'waiting' fires on slow networks.
    
    if (audioPlayer.paused) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 6. TIMEUPDATE (Heartbeat)
audioPlayer.addEventListener('timeupdate', () => { 
    // SAFETY NET:
    // If the "Alien Loop" is active, BUT:
    // 1. We are playing
    // 2. We are NOT paused
    // 3. We are NOT currently seeking (browser says it's done seeking)
    // THEN -> We must resolve.
    if (ScrambleEngine.isLooping && isPlaying && !audioPlayer.paused && !audioPlayer.seeking) {
        ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
    }

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