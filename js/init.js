// ==========================================
// INITIALIZATION & LISTENERS
// ==========================================

document.addEventListener('click', unlockAudioEngine);
document.addEventListener('keydown', unlockAudioEngine);
document.addEventListener('touchstart', unlockAudioEngine);
document.addEventListener('touchend', unlockAudioEngine);

// UI NAVIGATION
document.getElementById('next-doc').addEventListener('click', () => { if(!isLoading && currentIndex < library.length - 1) { performNavReset(); loadDocument(currentIndex + 1); } });
document.getElementById('prev-doc').addEventListener('click', () => { if(!isLoading && currentIndex > 0) { performNavReset(); loadDocument(currentIndex - 1); } });

if(btnPlay) btnPlay.addEventListener('click', (e) => { e.preventDefault(); togglePlay(); });
if(btnNext) btnNext.addEventListener('click', (e) => { e.preventDefault(); nextTrack(false); });
if(btnPrev) btnPrev.addEventListener('click', (e) => { e.preventDefault(); prevTrack(); });
if(btnLoop) btnLoop.addEventListener('click', (e) => { e.preventDefault(); toggleLoop(); });

// --- AUDIO EVENT HANDLING ---

const startBufferingCheck = () => {
    if (bufferDebounceTimer) clearTimeout(bufferDebounceTimer);
    if (isPlaying && !audioPlayer.paused) {
        bufferDebounceTimer = setTimeout(() => {
            if (audioPlayer.seeking || audioPlayer.readyState < 3) {
                ScrambleEngine.startLoading(domTrackTitle);
            }
        }, 444); 
    }
};

audioPlayer.addEventListener('waiting', startBufferingCheck);
audioPlayer.addEventListener('stalled', startBufferingCheck);

audioPlayer.addEventListener('playing', () => {
    if (bufferDebounceTimer) clearTimeout(bufferDebounceTimer);
    isPlaying = true;
    updatePlayBtn();
    if (!audioPlayer.seeking && (ScrambleEngine.isLooping || isSwitchingTrack || isSeeking)) {
        ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
    isSwitchingTrack = false;
    isSeeking = false;
});

audioPlayer.addEventListener('pause', () => {
    if (isSwitchingTrack || isDragging) return;
    isPlaying = false;
    updatePlayBtn();
    ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
});

audioPlayer.addEventListener('seeked', () => {
    isSeeking = false;
    if (audioPlayer.paused) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
});

audioPlayer.addEventListener('timeupdate', () => { 
    if (isSeeking) return;
    // SUPREME TRUTH: If time is moving and text is wrong, resolve it.
    if (!audioPlayer.paused && ScrambleEngine.isLooping && !audioPlayer.seeking) {
        ScrambleEngine.resolve(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
    if (!isDragging && pendingSeekPercent === null && audioPlayer.duration) { 
        const p = (audioPlayer.currentTime / audioPlayer.duration) * 100; 
        domProgressBar.style.setProperty('--progress', `${p}%`); 
        domCurrentTime.textContent = formatTime(audioPlayer.currentTime); 
        domDuration.textContent = formatTime(audioPlayer.duration); 
    }
});

audioPlayer.addEventListener('ended', () => { ScrambleEngine.clear(); nextTrack(true); });
audioPlayer.addEventListener('loadedmetadata', () => { 
    domDuration.textContent = formatTime(audioPlayer.duration); 
});

// TACTILE FEEDBACK ENGINE
function addTactileListener(selector) {
    const els = document.querySelectorAll(selector);
    els.forEach(el => {
        el.addEventListener('pointerdown', function(e) {
            this.classList.add('active-state');
            if(this.releasePointerCapture) this.releasePointerCapture(e.pointerId);
        });
        
        const removeActive = function() {
            const self = this;
            // Snappy response for buttons, near-zero delay
            const delay = self.classList.contains('secret-link') ? 50 : 150;
            setTimeout(() => { self.classList.remove('active-state'); }, delay);
        };

        el.addEventListener('pointerup', removeActive);
        el.addEventListener('pointerleave', removeActive);
        el.addEventListener('pointercancel', removeActive);
    });
}

const interfaceSelectors = ['.close-terminal', '.cycle-btn', '.tools-toggle', '.tool-btn', '.ctrl-btn', '.voice-btn', '.playlist-item', '.secret-link', '#song-link', '.nav-arrow'];
interfaceSelectors.forEach(s => addTactileListener(s));

// BOOT
document.getElementById("currentYear").textContent = new Date().getFullYear();
initTerminalState(); 
loadDocument(0); 
initPlaylist(); 
loadTrack(0, false); 
setTimeout(() => { ScrambleEngine.snap(domTrackTitle, albumTracks[0].title); }, 500);