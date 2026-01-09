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

// --- AUDIO EVENT DEBOUNCING ---
// This ensures we only scramble if the network is actually slow/buffering
let bufferingTimer = null;

// 1. PLAYING (The Green Light)
audioPlayer.addEventListener('playing', () => {
    // Clear any pending "Loading..." scramble check
    if (bufferingTimer) clearTimeout(bufferingTimer);

    isPlaying = true;
    updatePlayBtn();

    // TRIGGER THE REVEAL
    // This happens when:
    // a) A new track finishes loading
    // b) A slow seek finishes
    // c) Initial playback starts
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
    
    isSwitchingTrack = false;
});

// 2. WAITING (The Buffer / Seek)
audioPlayer.addEventListener('waiting', () => {
    if (bufferingTimer) clearTimeout(bufferingTimer);

    // DEBOUNCE: Only show "LOADING" scramble if we wait more than 150ms.
    // This makes instant seeks feel instant (no text flash), 
    // but slow connections get the cool effect.
    bufferingTimer = setTimeout(() => {
        if (isPlaying) {
            ScrambleEngine.startLoading(domTrackTitle);
        }
    }, 150); 
});

// 3. PAUSE
audioPlayer.addEventListener('pause', () => {
    if (bufferingTimer) clearTimeout(bufferingTimer);
    
    // If we pause manually, stop any active scrambles immediately
    // and show the clean title.
    if (!isSwitchingTrack) {
        isPlaying = false;
        updatePlayBtn();
        ScrambleEngine.clear();
        if (albumTracks[currentTrackIdx]) {
            domTrackTitle.innerText = albumTracks[currentTrackIdx].title;
            domTrackTitle.style.color = "";
        }
    }
});

// 4. SEEKED (Seek Complete)
audioPlayer.addEventListener('seeked', () => {
    // If seek finished very fast (before 150ms timer), cancel the timer.
    // The text will effectively never have changed, creating a solid feel.
    if (bufferingTimer) clearTimeout(bufferingTimer);
});

// 5. ENDED
audioPlayer.addEventListener('ended', () => { 
    ScrambleEngine.clear();
    nextTrack(true); 
});

// 6. METADATA
audioPlayer.addEventListener('loadedmetadata', () => { 
    domDuration.textContent = formatTime(audioPlayer.duration); 
    // Handle cold start scrub restoration
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
// Set current year
document.getElementById("currentYear").textContent = new Date().getFullYear();

initTerminalState(); 
loadDocument(0); 
initPlaylist(); 
loadTrack(0, false); 
setTimeout(() => { ScrambleEngine.resolve(domTrackTitle, albumTracks[0].title); }, 500);