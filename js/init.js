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

let bufferingTimer = null;

// Helper to trigger buffering visuals
const startBufferingCheck = () => {
    if (bufferingTimer) clearTimeout(bufferingTimer);
    // Only trigger if we are actively trying to play
    if (isPlaying) {
        bufferingTimer = setTimeout(() => {
            ScrambleEngine.startLoading(domTrackTitle);
        }, 150); 
    }
};

const stopBufferingCheck = () => {
    if (bufferingTimer) {
        clearTimeout(bufferingTimer);
        bufferingTimer = null;
    }
};

// 1. SEEKING / WAITING / STALLED
audioPlayer.addEventListener('seeking', startBufferingCheck);
audioPlayer.addEventListener('waiting', startBufferingCheck);
audioPlayer.addEventListener('stalled', startBufferingCheck);

// 2. PLAYING (The Fix)
audioPlayer.addEventListener('playing', () => {
    stopBufferingCheck();
    isPlaying = true;
    updatePlayBtn();

    // CRITICAL FIX: Unlock the progress bar immediately
    // If we were "cold seeking", this tells the UI it's safe to update again.
    pendingSeekPercent = null; 

    // TRIGGER REVEAL:
    // If we were loading (Alien Glyphs active), resolve to text.
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        if (ScrambleEngine.isLooping || isSwitchingTrack) {
            ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    }
    
    isSwitchingTrack = false;
});

// 3. PAUSE
audioPlayer.addEventListener('pause', () => {
    stopBufferingCheck();
    isPlaying = false;
    updatePlayBtn();
    
    // Snap text to static
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 4. SEEKED
audioPlayer.addEventListener('seeked', () => {
    stopBufferingCheck();
    if (audioPlayer.paused) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 5. TIMEUPDATE (Safety Net)
audioPlayer.addEventListener('timeupdate', () => { 
    // If Alien Glyphs are stuck but audio is moving, force resolve
    if (ScrambleEngine.isLooping && !isSwitchingTrack && isPlaying) {
        ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
    }

    // Only update bar if user is NOT interacting and NOT waiting for a seek to land
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
        // Do NOT clear pendingSeekPercent here; wait for 'playing' event to ensure sync
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