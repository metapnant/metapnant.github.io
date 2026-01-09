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

    currentAudioOpId++;
    ScrambleEngine.reset();
    isSwitchingTrack = true; 
    isSeeking = false; 
    pendingSeekPercent = null;
    wasPlayingBeforeDrag = false;
    resumeOnSeek = false;
    
    domProgressBar.style.setProperty('--progress', '0%');
    if (index !== currentTrackIdx) {
        domCurrentTime.textContent = "0:00"; 
        domDuration.textContent = "0:00";
    }
    
    currentTrackIdx = index;
    const track = albumTracks[index];

    ScrambleEngine.startLoading(domTrackTitle);

    audioPlayer.pause();
    audioPlayer.currentTime = 0;
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
        if (pendingSeekPercent !== null && audioPlayer.duration) {
            audioPlayer.currentTime = (pendingSeekPercent / 100) * audioPlayer.duration;
            pendingSeekPercent = null;
        }
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

function updateScrubVisual(percent) {
    domProgressBar.style.setProperty('--progress', `${percent}%`);
    if (audioPlayer.duration && !isNaN(audioPlayer.duration)) domCurrentTime.textContent = formatTime((percent / 100) * audioPlayer.duration);
}

function getScrubPercent(e) {
    const width = progressArea.clientWidth; 
    const clientX = e.type.includes('touch') ? (e.touches[0] || e.changedTouches[0]).clientX : e.clientX;
    const rect = progressArea.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / width) * 100));
}

const startDrag = (e) => {
    if (isPlaying) {
        wasPlayingBeforeDrag = true;
        audioPlayer.pause(); 
    } else {
        wasPlayingBeforeDrag = false;
    }
    isDragging = true;
    isSeeking = true; 
    domProgressBar.classList.add('dragging');
    updateScrubVisual(getScrubPercent(e));
};

const startDragMouse = (e) => { if (isTouch || e.button !== 0) return; startDrag(e); };
const startDragTouch = (e) => { 
    isTouch = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; isScrolling = false; 
    startDrag(e);
};
const doDragMouse = (e) => { if (!isDragging) return; e.preventDefault(); updateScrubVisual(getScrubPercent(e)); };
const doDragTouch = (e) => {
    if (isDragging) { if (e.cancelable) e.preventDefault(); updateScrubVisual(getScrubPercent(e)); }
};
const endDragMouse = (e) => { if (isDragging) { commitSeek(getScrubPercent(e)); isDragging = false; domProgressBar.classList.remove('dragging'); } };
const endDragTouch = (e) => { 
    if (isDragging) { 
        let percent = parseFloat(domProgressBar.style.getPropertyValue('--progress')) || 0;
        commitSeek(percent); 
        isDragging = false; 
        domProgressBar.classList.remove('dragging'); 
    } 
    setTimeout(() => { isTouch = false; }, 500); 
};

if (progressArea) {
    progressArea.addEventListener('mousedown', startDragMouse); 
    document.addEventListener('mousemove', doDragMouse); 
    document.addEventListener('mouseup', endDragMouse);
    progressArea.addEventListener('touchstart', startDragTouch, { passive: false }); 
    progressArea.addEventListener('touchmove', doDragTouch, { passive: false }); 
    progressArea.addEventListener('touchend', endDragTouch);
}

function commitSeek(percent) {
    currentAudioOpId++;
    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        const newTime = (percent / 100) * audioPlayer.duration;
        domProgressBar.style.setProperty('--progress', `${percent}%`);
        domCurrentTime.textContent = formatTime(newTime);

        // CANON BEHAVIOR: Always stop hardware seeking/loading flags first
        isSeeking = true; 
        
        // Apply hardware jump
        audioPlayer.currentTime = newTime;

        if (wasPlayingBeforeDrag) {
            // "THE ANDROID FIX": 
            // We wait a tiny moment. If the browser isn't ready to play immediately, 
            // we default to Paused. This makes scrubbing feel solid.
            const checkAndPlay = () => {
                if (audioPlayer.readyState >= 3) {
                    audioPlayer.play();
                } else {
                    // Too slow to load? Stay paused.
                    isPlaying = false;
                    updatePlayBtn();
                    isSeeking = false;
                    ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
                }
            };
            // Check in 50ms (nearly instant)
            setTimeout(checkAndPlay, 50);
        } else {
            // Was already paused? Just stay paused.
            isSeeking = false;
            ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    }
}