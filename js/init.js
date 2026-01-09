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

// --- ROBUST BUFFERING DETECTION SYSTEM ---

let bufferingTimer = null; // Timer for the 100ms debounce

// Helper: Starts the countdown to show "LOADING..."
// This is the core debounce logic.
const startBufferingCheck = () => {
    if (bufferingTimer) clearTimeout(bufferingTimer);
    
    // Only trigger if we're supposed to be playing and audio is actually stuck
    // (readyState < 3 means NOT ENOUGH DATA FOR IMMEDIATE PLAYBACK)
    if (isPlaying && audioPlayer.readyState < 3 && !audioPlayer.paused) {
        bufferingTimer = setTimeout(() => {
            // If we are STILL waiting after 100ms, trigger the Alien Glyphs
            ScrambleEngine.startLoading(domTrackTitle);
        }, 100); 
    }
};

// Helper: Clears the buffering check
const stopBufferingCheck = () => {
    if (bufferingTimer) {
        clearTimeout(bufferingTimer);
        bufferingTimer = null;
    }
};

// 1. AUDIO EVENTS THAT INDICATE POTENTIAL LOADING
audioPlayer.addEventListener('seeking', startBufferingCheck);
audioPlayer.addEventListener('waiting', startBufferingCheck);
audioPlayer.addEventListener('stalled', startBufferingCheck);


// 2. PLAYING (Audio is actually flowing)
audioPlayer.addEventListener('playing', () => {
    stopBufferingCheck(); // Kill any pending loading animations
    isPlaying = true;
    updatePlayBtn();

    // RESOLVE LOGIC:
    // Only trigger the Matrix Reveal if the ScrambleEngine was actively "looping"
    // (showing Alien Glyphs) OR if we just initiated a track switch.
    // Otherwise, just ensure the text is static and correct.
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        if (ScrambleEngine.isLooping || isSwitchingTrack) {
            ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
        } else {
            ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    }
    
    isSwitchingTrack = false; // Reset track switch flag
});


// 3. PAUSE (User stopped playback)
audioPlayer.addEventListener('pause', () => {
    stopBufferingCheck(); // Kill any loading animations
    isPlaying = false;
    updatePlayBtn();
    
    // Force snap to static text immediately on pause
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});


// 4. SEEKED (Seek operation completed)
audioPlayer.addEventListener('seeked', () => {
    stopBufferingCheck(); // Crucial: A seek just finished, so we are no longer "buffering"
    if (audioPlayer.paused) {
        // If paused after seek, ensure text is static
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
    // If playing, the 'playing' event will handle resolution
});


// 5. TIMEUPDATE (The UI Progress Bar's Heartbeat & Animation Safety Net)
audioPlayer.addEventListener('timeupdate', () => { 
    // SAFETY NET: If time is moving, but the loading scramble is stuck, force resolve.
    // This catches race conditions where 'playing' might be missed or delayed.
    if (ScrambleEngine.isLooping && isPlaying && !audioPlayer.paused) {
        ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
    }

    // Only update progress bar if user is NOT dragging AND there's no pending cold seek.
    if (!isDragging && pendingSeekPercent === null && audioPlayer.duration) { 
        const p = (audioPlayer.currentTime / audioPlayer.duration) * 100; 
        domProgressBar.style.setProperty('--progress', `${p}%`); 
        domCurrentTime.textContent = formatTime(audioPlayer.currentTime); 
        domDuration.textContent = formatTime(audioPlayer.duration); 
    }
});


// 6. ENDED (Track finished)
audioPlayer.addEventListener('ended', () => { 
    ScrambleEngine.clear();
    nextTrack(true); 
});

// 7. LOADEDMETADATA (Audio metadata available)
audioPlayer.addEventListener('loadedmetadata', () => { 
    domDuration.textContent = formatTime(audioPlayer.duration); 
    // Cold Seek Recovery: If there was a pending seek (from a paused scrub),
    // apply it to the hardware now.
    if (pendingSeekPercent !== null && audioPlayer.duration && isFinite(audioPlayer.duration)) { 
        audioPlayer.currentTime = (pendingSeekPercent / 100) * audioPlayer.duration; 
        // Do NOT clear pendingSeekPercent here; 'playing' event clears it to ensure sync
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