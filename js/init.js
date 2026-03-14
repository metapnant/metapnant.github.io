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
    if (!isLoading && typeof pdfDoc !== 'undefined' && pdfDoc) {
        if (resizeTimer) clearTimeout(resizeTimer);
        const visiblePage = getVisiblePageNumber();
        pendingScrollPage = visiblePage; 
    }
});

// Detects if the page is currently in a momentum scroll
window.addEventListener('scroll', () => {
    isScrolling = true;
    clearTimeout(scrollDebounceTimeout);
    // After 150ms of no scroll events, we consider the scroll stopped
    scrollDebounceTimeout = setTimeout(() => {
        isScrolling = false;
    }, 150);
}, { passive: true });

// UI Buttons
if (nextArrow) nextArrow.addEventListener('click', () => { 
    if(!isLoading && typeof library !== 'undefined' && currentIndex < library.length - 1) {
        performNavReset();
        if (typeof loadDocument === 'function') loadDocument(currentIndex + 1); 
    }
});

if (prevArrow) prevArrow.addEventListener('click', () => { 
    if(!isLoading && currentIndex > 0) {
        performNavReset();
        if (typeof loadDocument === 'function') loadDocument(currentIndex - 1); 
    }
});

[nextArrow, prevArrow].forEach(arrow => {
    if (arrow) {
        arrow.addEventListener('touchstart', function() { 
            // Only highlight if the user isn't stopping a momentum scroll
            if (!isScrolling) {
                this.classList.add('active-state'); 
            }
        }, {passive: true});
        
        arrow.addEventListener('touchend', function() { 
            this.classList.remove('active-state'); 
        }, {passive: true});
    }
});

if(btnPlay) btnPlay.addEventListener('click', (e) => { e.preventDefault(); togglePlay(); });
if(btnNext) btnNext.addEventListener('click', (e) => { e.preventDefault(); nextTrack(false); });
if(btnPrev) btnPrev.addEventListener('click', (e) => { e.preventDefault(); prevTrack(); });
if(btnLoop) btnLoop.addEventListener('click', (e) => { e.preventDefault(); toggleLoop(); });

// Added null check for the renamed audio download button
if(btnAudioDownload) btnAudioDownload.addEventListener('click', (e) => { e.preventDefault(); downloadCurrentTrack(); });

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
if (typeof updateBufferVisuals === 'function') {
    audioPlayer.addEventListener('progress', updateBufferVisuals);
}

// 1. SEEKING / WAITING
audioPlayer.addEventListener('seeking', startBufferingCheck);
audioPlayer.addEventListener('waiting', startBufferingCheck);
audioPlayer.addEventListener('stalled', startBufferingCheck);

// 2. PLAYING
audioPlayer.addEventListener('playing', () => {
    stopBufferingCheck();
    isPlaying = true;
    if (typeof updatePlayBtn === 'function') updatePlayBtn();

    if (domTrackTitle && typeof albumTracks !== 'undefined' && albumTracks[currentTrackIdx]) {
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
    if (typeof updatePlayBtn === 'function') updatePlayBtn();
    
    if (domTrackTitle && typeof albumTracks !== 'undefined' && albumTracks[currentTrackIdx]) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

// 4. SEEKED
audioPlayer.addEventListener('seeked', () => {
    isSeeking = false;
    stopBufferingCheck();
    
    if (resumeOnSeek) {
        resumeOnSeek = false;
        
        audioPlayer.play().then(() => {
            isPlaying = true;
            if (typeof updatePlayBtn === 'function') updatePlayBtn();
        }).catch(e => {
            console.log("iOS delayed play prevented:", e);
        });
    } else if (audioPlayer.paused) {
        if (domTrackTitle && typeof albumTracks !== 'undefined' && albumTracks[currentTrackIdx]) {
            ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    }
});

// 5. TIMEUPDATE
audioPlayer.addEventListener('timeupdate', () => { 
    if (!audioPlayer.paused) {
        if (isSeeking) isSeeking = false;
        if (isSwitchingTrack) isSwitchingTrack = false;
        
        if (ScrambleEngine.isLooping) {
            if (domTrackTitle && typeof albumTracks !== 'undefined' && albumTracks[currentTrackIdx]) {
                ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
            }
        }
    }
    
    if (typeof updateBufferVisuals === 'function') updateBufferVisuals();

    if (!isDragging && pendingSeekPercent === null && audioPlayer.duration) { 
        const p = (audioPlayer.currentTime / audioPlayer.duration) * 100; 
        if (domProgressBar) domProgressBar.style.setProperty('--progress', `${p}%`); 
        if (domCurrentTime) domCurrentTime.textContent = formatTime(audioPlayer.currentTime); 
        if (domDuration) domDuration.textContent = formatTime(audioPlayer.duration); 
    }
});

audioPlayer.addEventListener('ended', () => { 
    ScrambleEngine.clear();
    if (typeof nextTrack === 'function') nextTrack(true); 
});

audioPlayer.addEventListener('loadedmetadata', () => { 
    if (domDuration) domDuration.textContent = formatTime(audioPlayer.duration); 
    if (pendingSeekPercent !== null && audioPlayer.duration && isFinite(audioPlayer.duration)) { 
        audioPlayer.currentTime = (pendingSeekPercent / 100) * audioPlayer.duration; 
        if (domProgressBar) domProgressBar.style.setProperty('--progress', `${pendingSeekPercent}%`); 
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

if (btnShowVoice) { 
    btnShowVoice.addEventListener('click', (e) => { 
        e.preventDefault(); 
        if (isLoading) return; 

        // Tactile Feedback
        btnShowVoice.classList.add('active-state');
        setTimeout(() => btnShowVoice.classList.remove('active-state'), 150);

        // STICKY FOCUS: center immediately
        btnShowVoice.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (currentIndex !== 0) {
            waitingForLyrics = true; 
            startLoadingScramble(btnShowVoice); 
            if (typeof loadDocument === 'function') loadDocument(0);
        } else {
            const p8 = document.getElementById('page-wrapper-8'); 
            if (p8) { 
                jitterScrollTo(p8); 
            } else { 
                waitingForLyrics = true; 
                startLoadingScramble(btnShowVoice); 
            }
        }
    }); 
}

// Secret / Terminal Trigger
if (infinityBtn) {
    infinityBtn.addEventListener('click', (e) => { 
        e.preventDefault(); SimpleSynth.unlock(); 
        
        if (appState.terminalFound) { 
            infinityBtn.classList.add('active-state');
            setTimeout(() => infinityBtn.classList.remove('active-state'), 150);
            if (typeof launchTerminal === 'function') launchTerminal(); 
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

        if (secretClicks === 3) { 
            secretClicks = 0; 
            appState.terminalFound = true; 
            updateInfinityState(); 
            if (typeof launchTerminal === 'function') launchTerminal(); 
        } 
    });

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
}

// Keyboard Controls
document.addEventListener('keydown', (e) => { 
    const isPlayerVisible = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500; 
    if (e.code === 'Space') { if (isPlayerVisible || terminalRunning) { e.preventDefault(); if (typeof togglePlay === 'function') togglePlay(); } } 
    if (e.code === 'ArrowRight') { if (e.shiftKey) { e.preventDefault(); if (typeof nextTrack === 'function') nextTrack(false); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime += 5; } } 
    if (e.code === 'ArrowLeft') { if (e.shiftKey) { e.preventDefault(); if (typeof prevTrack === 'function') prevTrack(); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime -= 5; } } 
});

// Single Master Boot Sequence
document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById("currentYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    if (typeof initTerminalState === 'function') initTerminalState();
    
    if (typeof initPlaylist === 'function') initPlaylist(); 
    if (typeof loadTrack === 'function') loadTrack(0, false); 
    
    // Safety delay for PDF rendering to allow CSS to settle
    setTimeout(() => { 
        if (typeof loadDocument === 'function') loadDocument(0); 
        
        if (typeof ScrambleEngine !== 'undefined' && domTrackTitle && typeof albumTracks !== 'undefined' && albumTracks[0]) {
            ScrambleEngine.snap(domTrackTitle, albumTracks[0].title); 
        }
    }, 150); 
    
    const interfaceSelectors =['.close-terminal', '.cycle-btn', '.tools-toggle', '.tool-btn', '.ctrl-btn', '.voice-btn', '.playlist-item', '.secret-link', '#song-link', '.nav-arrow'];
    if (typeof addTactileListener === 'function') {
        interfaceSelectors.forEach(s => addTactileListener(s));
    }
});