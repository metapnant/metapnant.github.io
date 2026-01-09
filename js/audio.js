// ==========================================
// AUDIO LOGIC
// ==========================================

let domBufferBar = null;

// Updated snippet in js/audio.js
function initPlaylist() {
    if (!playlistList) return;
    
    // FIX: Attach buffer bar INSIDE the progress bar for perfect alignment
    if (!document.querySelector('.buffer-bar') && domProgressBar) {
        domBufferBar = document.createElement('div');
        domBufferBar.className = 'buffer-bar';
        domProgressBar.appendChild(domBufferBar); // Moved from progressArea to domProgressBar
    } else {
        domBufferBar = document.querySelector('.buffer-bar');
    }

    playlistList.innerHTML = '';
    albumTracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        li.id = `track-${index}`;
        li.innerHTML = `<span>${index < 10 ? '0' + index : index} - ${track.title}</span>`;
        li.onclick = () => playTrack(index);
        playlistList.appendChild(li);
    });
    if (typeof addTactileListener === 'function') addTactileListener('.playlist-item');
}

function loadTrack(index, autoPlay = true) {
    if (!domTrackTitle) return;

    currentAudioOpId++;
    
    ScrambleEngine.reset();
    isSwitchingTrack = true; 
    isSeeking = false; 
    pendingSeekPercent = null;
    wasPlayingBeforeDrag = false;
    resumeOnSeek = false;
    
    domProgressBar.style.setProperty('--progress', '0%');
    if (domBufferBar) domBufferBar.style.width = '0%';

    if (index !== currentTrackIdx) {
        domCurrentTime.textContent = "0:00"; 
        domDuration.textContent = "0:00";
    }
    
    currentTrackIdx = index;
    const track = albumTracks[index];

    ScrambleEngine.startLoading(domTrackTitle);

    audioPlayer.src = track.src;
    audioPlayer.load();

    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active-track');
            const container = document.querySelector('.playlist-container');
            if (container) container.scrollTo({ top: item.offsetTop - (container.clientHeight / 2) + (item.clientHeight / 2), behavior: 'smooth' });
        } else item.classList.remove('active-track');
    });

    if (appState.musicUnlocked && currentIndex === 0 && typeof refreshDynamicPage === 'function') {
        refreshDynamicPage();
    }

    if (autoPlay) {
        isPlaying = true;
        updatePlayBtn();
        const thisOpId = currentAudioOpId;

        audioPlayer.play().catch(e => {
            if (currentAudioOpId !== thisOpId) return;
            if (e.name !== 'AbortError') console.log("Auto-play blocked", e);
            
            isSwitchingTrack = false; 
            ScrambleEngine.snap(domTrackTitle, track.title);
            isPlaying = false;
            updatePlayBtn();
        });
    } else {
        ScrambleEngine.snap(domTrackTitle, track.title);
        isSwitchingTrack = false;
    }
}

function playTrack(index) { loadTrack(index, true); }

function togglePlay() {
    if (!audioPlayer.src) { loadTrack(currentTrackIdx, true); return; }

    // PERFORMANCE FIX: Check if connection died during sleep
    // NETWORK_NO_SOURCE (3) means the browser disconnected the stream.
    if (audioPlayer.networkState === 3) {
        console.log("Resurrecting audio connection...");
        const currentTime = audioPlayer.currentTime;
        audioPlayer.src = audioPlayer.src; // Re-assign triggers reconnect
        audioPlayer.currentTime = currentTime;
    }

    if (isPlaying) { 
        audioPlayer.pause(); 
        isPlaying = false;
    } else { 
        isPlaying = true;
        audioPlayer.play().catch(e => {
            console.warn("Play failed", e);
            isPlaying = false;
            updatePlayBtn();
        });
    }
    updatePlayBtn();
}

function updatePlayBtn() {
    if (!iconPlay || !iconPause) return;
    iconPlay.style.display = isPlaying ? 'none' : 'block';
    iconPause.style.display = isPlaying ? 'block' : 'none';
}

function toggleLoop() { loopMode++; if (loopMode > 2) loopMode = 0; updateLoopBtn(); }
function updateLoopBtn() {
    btnLoop.classList.remove('active', 'active-one');
    iconLoopAll.style.display = 'block'; iconLoopOne.style.display = 'none';
    if (loopMode === 1) btnLoop.classList.add('active');
    else if (loopMode === 2) { btnLoop.classList.add('active-one'); iconLoopAll.style.display = 'none'; iconLoopOne.style.display = 'block'; }
}

function nextTrack(auto = false) {
    let nextIdx = currentTrackIdx + 1;
    if (auto) {
        if (loopMode === 2) { playTrack(currentTrackIdx); return; }
        if (loopMode === 0 && nextIdx >= albumTracks.length) { isPlaying = false; updatePlayBtn(); return; }
    }
    if (nextIdx >= albumTracks.length) nextIdx = 0;
    playTrack(nextIdx);
}
function prevTrack() { let prevIdx = currentTrackIdx - 1; if (prevIdx < 0) prevIdx = albumTracks.length - 1; playTrack(prevIdx); }

function updateScrubVisual(percent) {
    domProgressBar.style.setProperty('--progress', `${percent}%`);
    if (audioPlayer.duration && !isNaN(audioPlayer.duration)) domCurrentTime.textContent = formatTime((percent / 100) * audioPlayer.duration);
}

function getScrubPercent(e) {
    const width = progressArea.clientWidth; const clientEvent = e.type.includes('touch') ? (e.touches[0] || e.changedTouches[0]) : e;
    const rect = progressArea.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientEvent.clientX - rect.left) / width) * 100));
}

// ==========================================
// OPTIMIZED DRAG HANDLERS (iPhone 8 Fix)
// ==========================================

let dragRafId = null; // Animation Frame ID

const startDrag = (e) => {
    // Prevent default to stop text selection/scrolling immediately
    if (e.cancelable) e.preventDefault(); 
    
    if (isPlaying) {
        wasPlayingBeforeDrag = true;
        audioPlayer.pause(); 
    } else {
        wasPlayingBeforeDrag = false;
    }
    
    isDragging = true;
    isSeeking = true; 
    domProgressBar.classList.add('dragging');
    
    // Immediate visual update
    updateScrubVisual(getScrubPercent(e));
};

const startDragMouse = (e) => { if (isTouch || e.button !== 0) return; startDrag(e); };

const startDragTouch = (e) => { 
    isTouch = true; 
    touchStartX = e.touches[0].clientX; 
    isScrolling = false; 
    startDrag(e); 
};

// RAF THROTTLED DRAG: Prevents UI locking on older phones
const doDrag = (e) => { 
    if (!isDragging) return; 
    
    // Stop browser from handling this gesture
    if(e.cancelable) e.preventDefault(); 

    // Cancel previous frame if it hasn't run yet
    if (dragRafId) cancelAnimationFrame(dragRafId);

    // Schedule visual update for next paint
    dragRafId = requestAnimationFrame(() => {
        updateScrubVisual(getScrubPercent(e));
    });
};

const endDrag = (e) => { 
    if (isDragging) { 
        if (dragRafId) cancelAnimationFrame(dragRafId);
        
        // Use the exact percentage currently displayed on the bar
        let percent = parseFloat(domProgressBar.style.getPropertyValue('--progress'));
        if (isNaN(percent)) percent = 0;

        commitSeek(percent); 
        isDragging = false; 
        domProgressBar.classList.remove('dragging'); 
    } 
    setTimeout(() => { isTouch = false; }, 500); 
};

// Bind Listeners
if (progressArea) {
    progressArea.addEventListener('mousedown', startDragMouse); 
    document.addEventListener('mousemove', doDrag); 
    document.addEventListener('mouseup', endDrag);
    
    // Passive: false is crucial for preventing scroll interference
    progressArea.addEventListener('touchstart', startDragTouch, { passive: false }); 
    progressArea.addEventListener('touchmove', doDrag, { passive: false }); 
    progressArea.addEventListener('touchend', endDrag);
}

// ==========================================
// ROBUST SEEK LOGIC (Prevents Hanging)
// ==========================================

function commitSeek(percent) {
    currentAudioOpId++;
    
    // Clear any existing buffering timers
    if (bufferDebounceTimer) {
        clearTimeout(bufferDebounceTimer); 
        bufferDebounceTimer = null;
    }

    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        const newTime = (percent / 100) * audioPlayer.duration;
        
        // 1. Force UI to match the final drop point
        domProgressBar.style.setProperty('--progress', `${percent}%`);
        domCurrentTime.textContent = formatTime(newTime);

        if (wasPlayingBeforeDrag) {
            // 2. STATE: We were playing, so we need to resume after seeking
            isSeeking = true;
            resumeOnSeek = true; // Tell init.js to play() only when 'seeked' fires
            
            ScrambleEngine.startLoading(domTrackTitle);
            
            // 3. HARDWARE: Trigger the seek
            audioPlayer.currentTime = newTime;
            
            // 4. SAFETY VALVE: If iOS hangs for more than 2s, force a reset
            const safetyId = currentAudioOpId;
            setTimeout(() => {
                if (currentAudioOpId === safetyId && isSeeking) {
                    isSeeking = false;
                    resumeOnSeek = false;
                    ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
                }
            }, 2000);

        } else {
            // 5. STATE: We were paused, just move the playhead
            audioPlayer.currentTime = newTime;
            pendingSeekPercent = null;
            ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
            isSeeking = false;
            resumeOnSeek = false;
        }
    } else {
        // If metadata isn't loaded yet, store it for later
        pendingSeekPercent = percent;
    }
}

function updateBufferVisuals() {
    if (audioPlayer.duration && domBufferBar) {
        if (audioPlayer.buffered.length > 0) {
            const now = audioPlayer.currentTime;
            let found = false;
            for (let i = 0; i < audioPlayer.buffered.length; i++) {
                const start = audioPlayer.buffered.start(i);
                const end = audioPlayer.buffered.end(i);
                if (now >= start && now <= end) {
                    const width = (end / audioPlayer.duration) * 100;
                    domBufferBar.style.width = `${width}%`;
                    found = true;
                    break;
                }
            }
            if (!found) {
                const lastEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
                domBufferBar.style.width = `${(lastEnd / audioPlayer.duration) * 100}%`;
            }
        } else {
            domBufferBar.style.width = '0%';
        }
    }
}