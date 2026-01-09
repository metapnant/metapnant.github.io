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
    
    // PDF layout handles itself via CSS, no reload needed
    if (!isLoading && pdfDoc) {
        if (resizeTimer) clearTimeout(resizeTimer);
        const visiblePage = getVisiblePageNumber();
        pendingScrollPage = visiblePage; 
    }
});

// UI Buttons
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

// 0. LOADSTART / PROGRESS
audioPlayer.addEventListener('loadstart', () => { if (isPlaying) ScrambleEngine.startLoading(domTrackTitle); });
audioPlayer.addEventListener('progress', updateBufferVisuals);

// 1. SEEKING / WAITING
audioPlayer.addEventListener('seeking', startBufferingCheck);
audioPlayer.addEventListener('waiting', startBufferingCheck);
audioPlayer.addEventListener('stalled', startBufferingCheck);

// 2. PLAYING
audioPlayer.addEventListener('playing', () => {
    stopBufferingCheck();
    isPlaying = true;
    updatePlayBtn();

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
    
    // FIX: iOS Silent Playback / Deferred Playback Logic
    if (resumeOnSeek) {
        resumeOnSeek = false;
        
        // Only call play() now that the hardware confirms it has reached the destination
        audioPlayer.play().catch(e => {
            console.warn("Deferred play failed:", e);
            isPlaying = false;
            updatePlayBtn();
        });
    } else if (audioPlayer.paused) {
        // If we're paused, make sure the title isn't stuck in "LOADING"
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    } else {
        // Normal title resolution if playing and not deferred
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
    updateBufferVisuals();

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
        e.preventDefault(); 
        
        btnShowVoice.classList.add('active-state');
        setTimeout(() => btnShowVoice.classList.remove('active-state'), 150);

        if (isLoading) return; 
        
        setTimeout(() => {
            btnShowVoice.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (currentIndex !== 0) {
                waitingForLyrics = true; startLoadingScramble(btnShowVoice); loadDocument(0); 
            } else {
                const p8 = document.getElementById('page-wrapper-8'); 
                if (p8) { jitterScrollTo(p8); } 
                else { waitingForLyrics = true; startLoadingScramble(btnShowVoice); }
            }
        }, 20);
    }); 
}

// Secret / Terminal Trigger
infinityBtn.addEventListener('click', (e) => { 
    e.preventDefault(); SimpleSynth.unlock(); 
    
    // Click-based fallback (mainly for desktop)
    if (appState.terminalFound) { 
        infinityBtn.classList.add('active-state');
        setTimeout(() => infinityBtn.classList.remove('active-state'), 150);
        launchTerminal(); 
        return; 
    } 
    
    if (currentIndex !== 2) return; 
    
    secretClicks++; 
    infinityBtn.style.color = "#ff3333"; 
    infinityBtn.style.textShadow = "0 0 15px #ff0000";
    
    setTimeout(() => {
        infinityBtn.style.color = "";
        infinityBtn.style.textShadow = "";
    }, 200);

    if (secretClicks === 3) { secretClicks = 0; appState.terminalFound = true; updateInfinityState(); launchTerminal(); } 
});

// FIX: Instant Touch Feedback for Infinity Button
// Differentiates between Locked (Red) and Unlocked (White) states
infinityBtn.addEventListener('touchstart', () => {
    if (appState.terminalFound) {
        infinityBtn.classList.add('active-state'); // White
    } else if (currentIndex === 2) {
        infinityBtn.classList.add('active-state-red'); // Red
    }
}, {passive: true});

infinityBtn.addEventListener('touchend', () => {
    setTimeout(() => {
        infinityBtn.classList.remove('active-state');
        infinityBtn.classList.remove('active-state-red');
    }, 150);
}, {passive: true});


// Keyboard Controls
document.addEventListener('keydown', (e) => { 
    const isPlayerVisible = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500; 
    if (e.code === 'Space') { if (isPlayerVisible || terminalRunning) { e.preventDefault(); togglePlay(); } } 
    if (e.code === 'ArrowRight') { if (e.shiftKey) { e.preventDefault(); nextTrack(false); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime += 5; } } 
    if (e.code === 'ArrowLeft') { if (e.shiftKey) { e.preventDefault(); prevTrack(); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime -= 5; } } 
});

const interfaceSelectors = ['.close-terminal', '.cycle-btn', '.tools-toggle', '.tool-btn', '.ctrl-btn', '.voice-btn', '.playlist-item', '.secret-link', '#song-link', '.nav-arrow'];
interfaceSelectors.forEach(s => addTactileListener(s));

// --- BOOT SEQUENCE ---
document.getElementById("currentYear").textContent = new Date().getFullYear();
if (typeof initTerminalState === 'function') initTerminalState();
loadDocument(0); 
initPlaylist(); 
loadTrack(0, false); 
setTimeout(() => { ScrambleEngine.snap(domTrackTitle, albumTracks[0].title); }, 500);