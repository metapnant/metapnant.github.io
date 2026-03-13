// ==========================================
// AUDIO LOGIC (OPTIMIZED ENGINE)
// ==========================================

let domBufferBar = null;
let fadeInterval = null; // Used for smooth play/pause transitions
const preloader = new Audio(); // Background worker for gapless playback

function initPlaylist() {
    if (!playlistList) return;
    
    if (!document.querySelector('.buffer-bar') && domProgressBar) {
        domBufferBar = document.createElement('div');
        domBufferBar.className = 'buffer-bar';
        domProgressBar.appendChild(domBufferBar); 
    } else {
        domBufferBar = document.querySelector('.buffer-bar');
    }

    playlistList.innerHTML = '';
    
    if (typeof albumTracks === 'undefined' || !albumTracks) return;

    albumTracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        li.id = `track-${index}`;
        
        // Reapply selected state if it persists
        if (selectedTracks && selectedTracks.includes(index)) {
            li.classList.add('selected-track');
        }
        
        let displayTitle = index === albumTracks.length - 1 
            ? track.title 
            : `${index < 10 ? '0' + index : index} - ${track.title}`;
        
        // Ethereal Glass Puppet Eye
        li.innerHTML = `
            <span class="track-label">${displayTitle}</span>
            <span class="track-selector" aria-label="Select Track">
                <div class="glass-eye"></div>
            </span>
        `;

        li.onclick = (e) => {
            const isSelectorClick = e.target && e.target.closest && e.target.closest('.track-selector');
            
            // Only trigger selection if the eye itself is clicked/tapped
            if (isSelectorClick) {
                toggleTrackSelection(e, index);
                return;
            }
            playTrack(index);
        };
        
        playlistList.appendChild(li);
    });
    
    if (typeof addTactileListener === 'function') {
        addTactileListener('.playlist-item');
        // Add tactile feedback to the selector itself for the snappy sun burst
        addTactileListener('.track-selector');
    }
}

// === SIMPLIFIED MULTI-SELECT LOGIC ===
function toggleTrackSelection(e, index) {
    if (e) e.stopPropagation();
    if (!selectedTracks) selectedTracks =[];
    
    // Standard Toggle (No Shift/Ctrl logic)
    const idxInArray = selectedTracks.indexOf(index);
    if (idxInArray > -1) {
        selectedTracks.splice(idxInArray, 1);
        updateTrackUI(index, false);
    } else {
        selectedTracks.push(index);
        selectedTracks.sort((a, b) => a - b);
        updateTrackUI(index, true);
    }
}

function updateTrackUI(index, isSelected) {
    const li = document.getElementById(`track-${index}`);
    if (!li) return;
    
    if (isSelected) {
        li.classList.add('selected-track');
    } else {
        li.classList.remove('selected-track');
    }
}

function updateMediaSession(track) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: 'Tef Riin',
            album: 'Chrysalis',
            artwork:[
                { src: 'music/cover.jpg', sizes: '512x512', type: 'image/jpeg' }
            ]
        });

        navigator.mediaSession.setActionHandler('play', () => { if (!isPlaying) smoothPlay(); });
        navigator.mediaSession.setActionHandler('pause', () => { if (isPlaying) smoothPause(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false));
    }
}

function preloadNextTrack() {
    if (typeof albumTracks === 'undefined' || !albumTracks) return;
    
    let nextIdx;
    if (selectedTracks && selectedTracks.length > 0) {
        const selIdx = selectedTracks.indexOf(currentTrackIdx);
        if (selIdx === -1) {
            nextIdx = selectedTracks[0];
        } else {
            nextIdx = selectedTracks[(selIdx + 1) % selectedTracks.length];
        }
    } else {
        nextIdx = currentTrackIdx + 1;
        if (nextIdx >= albumTracks.length) nextIdx = 0;
    }
    
    // Background cache the next track for gapless switching
    if (albumTracks[nextIdx] && albumTracks[nextIdx].src) {
        preloader.src = albumTracks[nextIdx].src;
        preloader.preload = "auto";
    }
}

function loadTrack(index, autoPlay = true) {
    if (!domTrackTitle || typeof albumTracks === 'undefined' || !albumTracks[index]) return;

    currentAudioOpId++;
    
    // Reset volume instantly if we were fading
    if (fadeInterval) clearInterval(fadeInterval);
    audioPlayer.volume = 1;
    
    if (typeof ScrambleEngine !== 'undefined') ScrambleEngine.reset();
    isSwitchingTrack = true; 
    isSeeking = false; 
    pendingSeekPercent = null;
    wasPlayingBeforeDrag = false;
    resumeOnSeek = false;
    
    if (domProgressBar) domProgressBar.style.setProperty('--progress', '0%');
    if (domBufferBar) domBufferBar.style.width = '0%';

    if (index !== currentTrackIdx) {
        if (domCurrentTime) domCurrentTime.textContent = "0:00"; 
        if (domDuration) domDuration.textContent = "0:00";
    }
    
    currentTrackIdx = index;
    const track = albumTracks[index];

    if (typeof ScrambleEngine !== 'undefined') ScrambleEngine.startLoading(domTrackTitle);

    audioPlayer.src = track.src;
    audioPlayer.load();
    
    updateMediaSession(track);
    preloadNextTrack();

    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active-track');
            const container = document.querySelector('.playlist-container');
            if (container) container.scrollTo({ top: item.offsetTop - (container.clientHeight / 2) + (item.clientHeight / 2), behavior: 'smooth' });
        } else {
            item.classList.remove('active-track');
        }
    });

    if (appState && appState.musicUnlocked && currentIndex === 0 && typeof refreshDynamicPage === 'function') {
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
            if (typeof ScrambleEngine !== 'undefined') ScrambleEngine.snap(domTrackTitle, track.title);
            isPlaying = false;
            updatePlayBtn();
        });
    } else {
        if (typeof ScrambleEngine !== 'undefined') ScrambleEngine.snap(domTrackTitle, track.title);
        isSwitchingTrack = false;
    }
}

function playTrack(index) { loadTrack(index, true); }

function smoothPlay() {
    if (fadeInterval) clearInterval(fadeInterval);
    audioPlayer.volume = 0;
    isPlaying = true;
    updatePlayBtn();
    
    audioPlayer.play().then(() => {
        let v = 0;
        fadeInterval = setInterval(() => {
            v += 0.1;
            if (v >= 1) { 
                audioPlayer.volume = 1; 
                clearInterval(fadeInterval); 
            } else { 
                audioPlayer.volume = v; 
            }
        }, 15);
    }).catch(e => {
        console.warn("Play failed", e);
        isPlaying = false;
        updatePlayBtn();
    });
}

function smoothPause() {
    if (fadeInterval) clearInterval(fadeInterval);
    let v = audioPlayer.volume;
    
    fadeInterval = setInterval(() => {
        v -= 0.1;
        if (v <= 0) { 
            audioPlayer.volume = 0; 
            audioPlayer.pause(); 
            audioPlayer.volume = 1; // Reset to 1 so the next track doesn't start muted
            isPlaying = false; 
            updatePlayBtn(); 
            clearInterval(fadeInterval); 
        } else { 
            audioPlayer.volume = v; 
        }
    }, 15);
}

function togglePlay() {
    if (!audioPlayer.src) { loadTrack(currentTrackIdx, true); return; }

    if (audioPlayer.networkState === 3) {
        console.log("Resurrecting audio connection...");
        const currentTime = audioPlayer.currentTime;
        audioPlayer.src = audioPlayer.src; 
        audioPlayer.currentTime = currentTime;
    }

    if (isPlaying) { 
        smoothPause();
    } else { 
        smoothPlay();
    }
}

function updatePlayBtn() {
    if (!iconPlay || !iconPause) return;
    iconPlay.style.display = isPlaying ? 'none' : 'block';
    iconPause.style.display = isPlaying ? 'block' : 'none';
}

function toggleLoop() { 
    loopMode++; 
    if (loopMode > 2) loopMode = 0; 
    updateLoopBtn(); 
}

function updateLoopBtn() {
    if (!btnLoop || !iconLoopAll || !iconLoopOne) return;
    btnLoop.classList.remove('active', 'active-one');
    iconLoopAll.style.display = 'block'; 
    iconLoopOne.style.display = 'none';
    
    if (loopMode === 1) {
        btnLoop.classList.add('active');
    } else if (loopMode === 2) { 
        btnLoop.classList.add('active-one'); 
        iconLoopAll.style.display = 'none'; 
        iconLoopOne.style.display = 'block'; 
    }
}

function nextTrack(auto = false) {
    if (typeof albumTracks === 'undefined' || !albumTracks) return;

    if (auto && loopMode === 2) { 
        playTrack(currentTrackIdx); 
        return; 
    }

    let nextIdx;
    if (selectedTracks && selectedTracks.length > 0) {
        const selIdx = selectedTracks.indexOf(currentTrackIdx);
        if (selIdx === -1) {
            nextIdx = selectedTracks[0];
        } else {
            if (auto && loopMode === 0 && selIdx >= selectedTracks.length - 1) {
                isPlaying = false; 
                updatePlayBtn(); 
                return;
            }
            nextIdx = selectedTracks[(selIdx + 1) % selectedTracks.length];
        }
    } else {
        nextIdx = currentTrackIdx + 1;
        if (auto && loopMode === 0 && nextIdx >= albumTracks.length) { 
            isPlaying = false; 
            updatePlayBtn(); 
            return; 
        }
        if (nextIdx >= albumTracks.length) nextIdx = 0;
    }

    playTrack(nextIdx);
}

function prevTrack() {
    if (typeof albumTracks === 'undefined' || !albumTracks) return;
    
    let prevIdx;
    if (selectedTracks && selectedTracks.length > 0) {
        const selIdx = selectedTracks.indexOf(currentTrackIdx);
        if (selIdx === -1) {
            prevIdx = selectedTracks[selectedTracks.length - 1];
        } else {
            prevIdx = selectedTracks[(selIdx - 1 + selectedTracks.length) % selectedTracks.length];
        }
    } else {
        prevIdx = currentTrackIdx - 1; 
        if (prevIdx < 0) prevIdx = albumTracks.length - 1; 
    }
    playTrack(prevIdx);
}

function downloadCurrentTrack() {
    if (typeof albumTracks === 'undefined' || !albumTracks) return;
    const track = albumTracks[currentTrackIdx];
    if (!track || !track.src) return;
    
    const a = document.createElement('a');
    a.href = track.src;
    a.download = track.title + '.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function updateScrubVisual(percent) {
    if (domProgressBar) domProgressBar.style.setProperty('--progress', `${percent}%`);
    if (domCurrentTime && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
        domCurrentTime.textContent = formatTime((percent / 100) * audioPlayer.duration);
    }
}

function getScrubPercent(e) {
    if (!progressArea) return 0;
    const width = progressArea.clientWidth; 
    const clientEvent = e.type.includes('touch') ? (e.touches[0] || e.changedTouches[0]) : e;
    const rect = progressArea.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientEvent.clientX - rect.left) / width) * 100));
}

// ==========================================
// OPTIMIZED DRAG HANDLERS
// ==========================================

let dragRafId = null;

const startDrag = (e) => {
    if (e.cancelable) e.preventDefault(); 
    wasPlayingBeforeDrag = isPlaying;
    
    // Clear any fading logic instantly
    if (fadeInterval) clearInterval(fadeInterval);
    audioPlayer.volume = 1;
    audioPlayer.pause(); 
    
    isDragging = true;
    isSeeking = true; 
    if (domProgressBar) domProgressBar.classList.add('dragging');
    updateScrubVisual(getScrubPercent(e));
};

const startDragMouse = (e) => { if (isTouch || e.button !== 0) return; startDrag(e); };

const startDragTouch = (e) => { 
    isTouch = true; 
    if (e.touches && e.touches.length > 0) touchStartX = e.touches[0].clientX; 
    isScrolling = false; 
    startDrag(e); 
};

const doDrag = (e) => { 
    if (!isDragging) return; 
    if (e.cancelable) e.preventDefault(); 

    if (dragRafId) cancelAnimationFrame(dragRafId);
    dragRafId = requestAnimationFrame(() => {
        updateScrubVisual(getScrubPercent(e));
    });
};

const endDrag = (e) => { 
    if (isDragging) { 
        if (dragRafId) cancelAnimationFrame(dragRafId);
        let percent = 0;
        if (domProgressBar) {
            percent = parseFloat(domProgressBar.style.getPropertyValue('--progress')) || 0;
            domProgressBar.classList.remove('dragging'); 
        }
        commitSeek(percent); 
        isDragging = false; 
    } 
    setTimeout(() => { isTouch = false; }, 500); 
};

if (progressArea) {
    progressArea.addEventListener('mousedown', startDragMouse); 
    document.addEventListener('mousemove', doDrag); 
    document.addEventListener('mouseup', endDrag);
    progressArea.addEventListener('touchstart', startDragTouch, { passive: false }); 
    progressArea.addEventListener('touchmove', doDrag, { passive: false }); 
    progressArea.addEventListener('touchend', endDrag);
}

// ==========================================
// ROBUST SEEK LOGIC
// ==========================================

function commitSeek(percent) {
    currentAudioOpId++;
    const thisOpId = currentAudioOpId;
    
    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        const newTime = (percent / 100) * audioPlayer.duration;
        
        if (domProgressBar) domProgressBar.style.setProperty('--progress', `${percent}%`);
        if (domCurrentTime) domCurrentTime.textContent = formatTime(newTime);
        
        audioPlayer.currentTime = newTime;

        if (wasPlayingBeforeDrag) {
            let isBuffered = false;
            if (audioPlayer.buffered.length > 0) {
                for (let i = 0; i < audioPlayer.buffered.length; i++) {
                    if (newTime >= audioPlayer.buffered.start(i) && newTime <= audioPlayer.buffered.end(i)) {
                        isBuffered = true;
                        break;
                    }
                }
            }

            if (isBuffered) {
                resumeOnSeek = true;
                isSeeking = true;
                if (typeof ScrambleEngine !== 'undefined') ScrambleEngine.startLoading(domTrackTitle);
            } else {
                isPlaying = false;
                updatePlayBtn();
                if (typeof ScrambleEngine !== 'undefined') ScrambleEngine.startLoading(domTrackTitle);
                
                audioPlayer.addEventListener('canplay', () => {
                    if (currentAudioOpId === thisOpId) {
                        isPlaying = true;
                        updatePlayBtn();
                        audioPlayer.play();
                    }
                }, { once: true });
            }
        } else {
            if (typeof ScrambleEngine !== 'undefined' && typeof albumTracks !== 'undefined' && albumTracks[currentTrackIdx]) {
                ScrambleEngine.snap(domTrackTitle, albumTracks[currentTrackIdx].title);
            }
            isSeeking = false;
            resumeOnSeek = false;
        }
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

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);