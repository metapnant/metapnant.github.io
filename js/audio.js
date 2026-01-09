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

    // 1. Reset UI
    isSwitchingTrack = true; 
    domProgressBar.style.setProperty('--progress', '0%');
    if (index !== currentTrackIdx) {
        domCurrentTime.textContent = "0:00"; 
        domDuration.textContent = "0:00";
    }
    
    pendingSeekPercent = null;
    currentTrackIdx = index;
    const track = albumTracks[index];

    // 2. Force Loading on Switch
    ScrambleEngine.startLoading(domTrackTitle);

    // 3. Update Audio
    audioPlayer.src = track.src;
    audioPlayer.load();

    // 4. Update Playlist
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

    // 5. Autoplay
    if (autoPlay) {
        audioPlayer.play().catch(e => {
            if (e.name !== 'AbortError') console.log("Auto-play blocked", e);
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
        updatePlayBtn();
        ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
    }
    else { 
        isPlaying = true;
        updatePlayBtn();

        // iOS Cold Seek
        if (pendingSeekPercent !== null && audioPlayer.duration) {
            const seekTime = (pendingSeekPercent / 100) * audioPlayer.duration;
            audioPlayer.currentTime = seekTime;
            pendingSeekPercent = null;
        }

        audioPlayer.play();
    }
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

const startDragMouse = (e) => { if (isTouch || e.button !== 0) return; isDragging = true; domProgressBar.classList.add('dragging'); updateScrubVisual(getScrubPercent(e)); };
const doDragMouse = (e) => { if (!isDragging) return; e.preventDefault(); updateScrubVisual(getScrubPercent(e)); };
const endDragMouse = (e) => { if (isDragging) { commitSeek(getScrubPercent(e)); isDragging = false; domProgressBar.classList.remove('dragging'); } };
const startDragTouch = (e) => { 
    isTouch = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; isScrolling = false; 
    isDragging = true; 
    domProgressBar.classList.add('dragging'); 
    updateScrubVisual(getScrubPercent(e));
};
const doDragTouch = (e) => {
    if (isDragging) { if (e.cancelable) e.preventDefault(); updateScrubVisual(getScrubPercent(e)); return; }
};
const endDragTouch = (e) => { 
    if (isDragging) { 
        let percent = parseFloat(domProgressBar.style.getPropertyValue('--progress'));
        if (isNaN(percent)) percent = 0;
        commitSeek(percent); 
        isDragging = false; 
        domProgressBar.classList.remove('dragging'); 
    } 
    setTimeout(() => { isTouch = false; }, 500); 
};

function commitSeek(percent) {
    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        const newTime = (percent / 100) * audioPlayer.duration;
        domProgressBar.style.setProperty('--progress', `${percent}%`);
        domCurrentTime.textContent = formatTime(newTime);

        if (!audioPlayer.paused) {
            // PLAYING: Apply immediate seek. 
            // Feedback is handled by init.js 'seeking' event listener.
            audioPlayer.currentTime = newTime;
            pendingSeekPercent = null;
        } else {
            // PAUSED: Store seek for next Play
            pendingSeekPercent = percent;
            ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    } else {
        pendingSeekPercent = percent;
    }
}