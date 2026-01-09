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

// --- NAVIGATION & VIEW RESET ---

const performNavReset = () => {
    // FIX: Kill any fighting scroll animations
    killScrollAnimation();
    
    // Force top
    window.scrollTo({ top: 0, behavior: 'auto' });

    // Cancel Voice mode
    waitingForLyrics = false;
    if (voiceScrambleInterval) {
        clearInterval(voiceScrambleInterval);
        voiceScrambleInterval = null;
    }
    if (btnShowVoice) {
        btnShowVoice.innerText = "SHOW VOICE";
        btnShowVoice.style.color = "";
    }
};

document.getElementById('next-doc').addEventListener('click', () => { 
    if(!isLoading && currentIndex < library.length - 1) {
        performNavReset();
        loadDocument(currentIndex + 1); 
    }
});

document.getElementById('prev-doc').addEventListener('click', () => { 
    if(!isLoading && currentIndex > 0) {
        performNavReset();
        loadDocument(currentIndex - 1); 
    }
});

[document.getElementById('next-doc'), document.getElementById('prev-doc')].forEach(arrow => {
    arrow.addEventListener('touchstart', function() { this.classList.add('active-state'); }, {passive: true});
    arrow.addEventListener('touchend', function() { this.classList.remove('active-state'); }, {passive: true});
});

if(btnPlay) btnPlay.addEventListener('click', (e) => { e.preventDefault(); togglePlay(); });
if(btnNext) btnNext.addEventListener('click', (e) => { e.preventDefault(); nextTrack(false); });
if(btnPrev) btnPrev.addEventListener('click', (e) => { e.preventDefault(); prevTrack(); });
if(btnLoop) btnLoop.addEventListener('click', (e) => { e.preventDefault(); toggleLoop(); });

// Note: Drag events are bound in audio.js

// --- AUDIO EVENT HANDLING ---

const startBufferingCheck = () => {
    if (bufferDebounceTimer) clearTimeout(bufferDebounceTimer);
    
    const thisOpId = currentAudioOpId;

    if (isPlaying && !audioPlayer.paused) {
        bufferDebounceTimer = setTimeout(() => {
            if (currentAudioOpId !== thisOpId) return;

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

// 0. LOADSTART
audioPlayer.addEventListener('loadstart', () => {
    if (isPlaying) ScrambleEngine.startLoading(domTrackTitle);
});

// 1. WAITING / STALLED / SEEKING
audioPlayer.addEventListener('seeking', startBufferingCheck);
audioPlayer.addEventListener('waiting', startBufferingCheck);
audioPlayer.addEventListener('stalled', startBufferingCheck);

// 2. PLAYING
audioPlayer.addEventListener('playing', () => {
    stopBufferingCheck();
    isPlaying = true;
    updatePlayBtn();

    // FIX: If we are still seeking (hardware hasn't caught up), DO NOT resolve yet.
    // Wait for the 'seeked' event.
    if (audioPlayer.seeking) return;

    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        if (ScrambleEngine.isLooping || isSwitchingTrack || isSeeking) {
            ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
        } else {
            ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    }
    
    isSwitchingTrack = false;
    isSeeking = false;
});

// 3. PAUSE
audioPlayer.addEventListener('pause', () => {
    stopBufferingCheck();
    if (isSwitchingTrack) return; 

    isPlaying = false;
    updatePlayBtn();
    
    if (domTrackTitle && albumTracks[currentTrackIdx]) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 4. SEEKED
audioPlayer.addEventListener('seeked', () => {
    isSeeking = false;
    stopBufferingCheck();
    
    if (audioPlayer.paused) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    } else {
        ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 5. TIMEUPDATE
audioPlayer.addEventListener('timeupdate', () => { 
    if (!audioPlayer.paused) {
        if (isSeeking) isSeeking = false;
        if (isSwitchingTrack) isSwitchingTrack = false;
        
        if (ScrambleEngine.isLooping) {
            ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
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
        el.addEventListener('pointerdown', function(e) {
            this.classList.add('active-state');
            if(this.releasePointerCapture) this.releasePointerCapture(e.pointerId);
        });
        
        const removeActive = function() {
            const self = this;
            setTimeout(() => { self.classList.remove('active-state'); }, 150);
        };

        el.addEventListener('pointerup', removeActive);
        el.addEventListener('pointerleave', removeActive);
        el.addEventListener('pointercancel', removeActive);
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