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
}

function loadTrack(index, autoPlay = true) {
    if (!domTrackTitle) return;

    // 1. Reset UI & Lock State
    isSwitchingTrack = true; // Signals init.js that we are in a transition
    domProgressBar.style.setProperty('--progress', '0%');
    domCurrentTime.textContent = "0:00"; 
    domDuration.textContent = "0:00";
    currentTrackIdx = index;
    const track = albumTracks[index];

    // 2. Force Loading Scramble
    // Always start scrambling on track switch to show activity
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

    // 5. Dynamic Page (Lyrics)
    if (appState.musicUnlocked && currentIndex === 0 && typeof refreshDynamicPage === 'function') {
        refreshDynamicPage();
    }

    // 6. Autoplay Handling
    if (autoPlay) {
        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => { 
                if (error.name !== 'AbortError') {
                    // If play fails (e.g. no user interaction), stop scramble cleanly
                    isSwitchingTrack = false;
                    isPlaying = false; 
                    updatePlayBtn();
                    ScrambleEngine.resolve(domTrackTitle, track.title);
                }
            });
        }
    } else {
        // Initial load (no autoplay): Resolve immediately to title
        ScrambleEngine.resolve(domTrackTitle, track.title);
        isSwitchingTrack = false;
    }
}

function playTrack(index) { 
    loadTrack(index, true); 
    isPlaying = true;
    updatePlayBtn();
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
        
        // On manual pause, just stop scrambling and show static text
        // No need to re-animate the reveal
        ScrambleEngine.clear();
        if (albumTracks[currentTrackIdx]) {
            domTrackTitle.innerText = albumTracks[currentTrackIdx].title;
            domTrackTitle.style.color = "";
        }
    }
    else { 
        isPlaying = true;
        updatePlayBtn();
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
    isTouch = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; isDragging = false; isScrolling = false; 
    holdTimer = setTimeout(() => { 
        if (!isScrolling) { isDragging = true; domProgressBar.classList.add('dragging'); updateScrubVisual(getScrubPercent(e)); } 
    }, 200); 
};
const doDragTouch = (e) => {
    if (isDragging) { if (e.cancelable) e.preventDefault(); updateScrubVisual(getScrubPercent(e)); return; }
    if (isScrolling) return; 
    const dx = Math.abs(e.touches[0].clientX - touchStartX); const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 5 || dy > 5) { 
        if (holdTimer) clearTimeout(holdTimer); 
        if (dx > dy) { isDragging = true; domProgressBar.classList.add('dragging'); if (e.cancelable) e.preventDefault(); updateScrubVisual(getScrubPercent(e)); } 
        else isScrolling = true; 
    }
};
const endDragTouch = (e) => { 
    if (holdTimer) clearTimeout(holdTimer); 
    if (isDragging) { commitSeek(parseFloat(domProgressBar.style.getPropertyValue('--progress'))); isDragging = false; domProgressBar.classList.remove('dragging'); } 
    setTimeout(() => { isTouch = false; }, 500); 
};

function commitSeek(percent) {
    // Clear any existing debounce timer
    if (typeof bufferingTimer !== 'undefined' && bufferingTimer) clearTimeout(bufferingTimer);

    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        const newTime = (percent / 100) * audioPlayer.duration;
        domProgressBar.style.setProperty('--progress', `${percent}%`);
        domCurrentTime.textContent = formatTime(newTime);

        if (!audioPlayer.paused) {
            audioPlayer.currentTime = newTime;
            pendingSeekPercent = null;
            // Note: init.js 'waiting' event handles the buffering scramble logic now
        } else {
            // Cold seek
            pendingSeekPercent = percent;
            isSwitchingTrack = false;
            ScrambleEngine.clear(); // Ensure static text on drag end
        }
    } else {
        pendingSeekPercent = percent;
    }
}