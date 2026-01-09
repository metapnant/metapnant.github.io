// ==========================================
// AUDIO LOGIC
// ==========================================

function initPlaylist() {
    if (!playlistList) return;
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

    // 1. STATE RESET
    ScrambleEngine.reset();
    isDragging = false;
    
    domProgressBar.style.setProperty('--progress', '0%');
    if (index !== currentTrackIdx) {
        domCurrentTime.textContent = "0:00"; 
        domDuration.textContent = "0:00";
    }
    
    currentTrackIdx = index;
    const track = albumTracks[index];

    // 2. Visuals
    ScrambleEngine.startLoading(domTrackTitle);

    // 3. Audio
    audioPlayer.src = track.src;
    audioPlayer.load();

    // 4. UI
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

    // 5. Playback
    if (autoPlay) {
        isPlaying = true;
        updatePlayBtn();
        audioPlayer.play().catch(e => {
            if (e.name !== 'AbortError') console.log("Auto-play blocked", e);
            ScrambleEngine.snap(domTrackTitle, track.title);
            isPlaying = false;
            updatePlayBtn();
        });
    } else {
        ScrambleEngine.snap(domTrackTitle, track.title);
    }
}

function playTrack(index) { 
    loadTrack(index, true); 
}

function togglePlay() {
    if (!audioPlayer.src) {
        loadTrack(currentTrackIdx, true);
        return;
    }

    if (isPlaying) { 
        audioPlayer.pause(); 
        isPlaying = false;
    } else { 
        isPlaying = true;
        audioPlayer.play();
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

// --- SCRUBBER MATH & LOGIC (Restored) ---

function updateScrubVisual(percent) {
    domProgressBar.style.setProperty('--progress', `${percent}%`);
    if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
        const time = (percent / 100) * audioPlayer.duration;
        domCurrentTime.textContent = formatTime(time);
    }
}

function getScrubPercent(e) {
    const width = progressArea.clientWidth; 
    // Handle Touch vs Mouse events
    const clientX = e.type.includes('touch') ? (e.touches[0] || e.changedTouches[0]).clientX : e.clientX;
    const rect = progressArea.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / width) * 100));
}

// --- DRAG HANDLERS ---

const startDrag = (e) => {
    isDragging = true;
    
    // Pause immediately to prevent ghosting
    if (isPlaying) {
        audioPlayer.pause();
    }
    
    domProgressBar.classList.add('dragging');
    updateScrubVisual(getScrubPercent(e));
};

const doDrag = (e) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault(); // Stop scrolling on mobile
    updateScrubVisual(getScrubPercent(e));
};

const endDrag = (e) => {
    if (isDragging) {
        const percent = getScrubPercent(e);
        commitSeek(percent);
        isDragging = false;
        domProgressBar.classList.remove('dragging');
    }
};

// --- COMMIT SEEK ---

function commitSeek(percent) {
    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        const newTime = (percent / 100) * audioPlayer.duration;
        
        // 1. Update Hardware
        audioPlayer.currentTime = newTime;
        
        // 2. Resume if we were playing (UI flag)
        if (isPlaying) {
            audioPlayer.play().catch(e => console.log(e));
        }
    }
}

// --- EVENT BINDING ---
// We bind these here to ensure they exist when the file loads
if (progressArea) {
    // Mouse
    progressArea.addEventListener('mousedown', (e) => { if(e.button===0) startDrag(e); });
    document.addEventListener('mousemove', (e) => { if(isDragging) doDrag(e); });
    document.addEventListener('mouseup', (e) => { if(isDragging) endDrag(e); });
    
    // Touch
    progressArea.addEventListener('touchstart', (e) => { startDrag(e); }, { passive: false });
    progressArea.addEventListener('touchmove', (e) => { doDrag(e); }, { passive: false });
    progressArea.addEventListener('touchend', (e) => { endDrag(e); });
}