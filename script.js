// ==========================================
// 1. CONFIGURATION & DATA
// ==========================================
const library = [
    {
      title: "METAPNANT",
      url: "A%20Story%20of%20Mirthful%20Reflection.pdf",
      songUrl: "https://www.youtube.com/watch?v=MEPqb4DuCD8",
      songTitle: "In Love With",
      bpm: 130
    },
    {
      title: "THE REMINDER",
      url: "The%20Reminder.pdf",
      songUrl: "https://www.youtube.com/watch?v=JuzzliKBfss",
      songTitle: "Breathe Again ∞ Timelines",
      bpm: 120
    },
    {
      title: "PHOENIX NEST",
      url: "The%20Phoenix%20Nest.pdf",
      songUrl: "https://www.youtube.com/watch?v=2r1VZ9vInw0",
      songTitle: "Starflower",
      bpm: 94.54
    }
];

const albumTracks = [
    { title: "Blood-Sap", src: "music/00 - Blood-Sap.wav" },
    { title: "First Step", src: "music/01 - First Step.wav" },
    { title: "hidden", src: "music/02 - hidden.wav" }, 
    { title: "Tether", src: "music/03 - Tether.wav" },
    { title: "Lens -of-", src: "music/04 - Lens -of-.wav" },
    { title: "Innerworld", src: "music/05 - Innerworld.wav" },
    { title: "Disordered Fairness", src: "music/06 - Disordered Fairness.wav" }, 
    { title: "Limerent Object", src: "music/07 - Limerent Object.wav" },
    { title: "Final Boundaries", src: "music/08 - Final Boundaries.wav" },
    { title: "Remember", src: "music/09 - Remember.wav" },
    { title: "Fear", src: "music/10 - Fear.wav" },
    { title: "My Way", src: "music/11 - My Way.wav" },
    { title: "Sun; Rise", src: "music/12 - Sun; Rise.wav" },
    { title: "Branches", src: "music/13 - Branches.wav" },
    { title: "Starflower Soul", src: "music/14 - Starflower Soul.wav" },
    { title: "In Love With", src: "music/15 - In Love With.wav" },
    { title: "Timelines", src: "music/16 - Timelines.wav" },
    { title: "Breathe Again", src: "music/17 - Breathe Again.wav" },
    { title: "River of Sorrows", src: "music/18 - River of Sorrows.wav" }
];

// ==========================================
// 2. GLOBAL STATE & VARIABLES
// ==========================================

// -- PDF State --
let currentIndex = 0;
let pdfDoc = null;
let lyricsDoc = null;
let isLoading = false;
let renderSession = 0;
let pendingScrollPage = null; 

// -- Music State --
const audioPlayer = new Audio();
let currentTrackIdx = 0;
let isPlaying = false;
let isDragging = false; 
let loopMode = 0; 
let touchStartX = 0;
let touchStartY = 0;
let holdTimer = null;
let isTouch = false;      
let isScrolling = false;  
let pendingSeekPercent = null;

// -- Terminal State --
let secretClicks = 0; 
let terminalRunning = false; 
let activeTimer = null; 
let currentTab = null;
let savedScrollTop = 0;

const defaultState = {
    unlockedTabs: ['crash'],
    finishedLogs: [],
    musicUnlocked: false,
    terminalFound: false
};

function loadState() {
    const saved = localStorage.getItem('metapnant_state');
    if (saved) return JSON.parse(saved);
    return defaultState;
}
let appState = loadState();

let logState = {
    crash: { index: 0, finished: false }, echo: { index: 0, finished: false },
    wake: { index: 0, finished: false }, bloom: { index: 0, finished: false },
    gardener: { index: 0, finished: false }
};

// ==========================================
// 3. SOUND ENGINE (SYNTHESIZER)
// ==========================================
const SimpleSynth = {
    ctx: null,
    
    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // Generates a tone based on the text class (The "Voice")
    playTone: function(cssClass) {
        if (!this.ctx) this.init();
        
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // --- VOICE PROFILES ---
        if (cssClass.includes('operator-text')) {
            // OPERATOR: Soft, Triangle wave, Lower pitch (Organic)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(500, t);
            osc.frequency.linearRampToValueAtTime(450, t + 0.08); // Slight pitch drop like speaking
            
            gain.gain.setValueAtTime(0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            
            osc.start();
            osc.stop(t + 0.08);

        } else if (cssClass.includes('alert-text')) {
            // ALERT: Sawtooth, Buzzy, Low (Warning)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, t);
            
            gain.gain.setValueAtTime(0.06, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            
            osc.start();
            osc.stop(t + 0.1);

        } else if (cssClass.includes('comment-text')) {
            // COMMENT: Sine, Very High, Very Short (Subtle Metadata Click)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(3000, t);
            
            gain.gain.setValueAtTime(0.015, t); // Very quiet
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.01); // Instant decay
            
            osc.start();
            osc.stop(t + 0.01);

        } else if (cssClass.includes('golden-text') || cssClass.includes('white-text') || cssClass.includes('magenta-text')) {
            // SPECIAL: Sine, Pure, Bell-like decay (Ethereal)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, t); // A5
            
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2); // Longer ringing
            
            osc.start();
            osc.stop(t + 0.2);

        } else if (cssClass.includes('system-success')) {
            // SUCCESS: Square, Upward Chirp (Positive)
            osc.type = 'square';
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.linearRampToValueAtTime(2000, t + 0.05);
            
            gain.gain.setValueAtTime(0.03, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            
            osc.start();
            osc.stop(t + 0.05);

        } else {
            // SYSTEM (DEFAULT): Square, Fast decay (Retro Terminal Blip)
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.04);
            
            gain.gain.setValueAtTime(0.03, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            
            osc.start();
            osc.stop(t + 0.04);
        }
    },

    playUnlock: function() {
        if (!this.ctx) this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Unlock Sweep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
};

// ==========================================
// 4. DOM ELEMENTS
// ==========================================

const pdfWrapper = document.getElementById('pdf-wrapper');
const loadingOverlay = document.getElementById('loading-overlay');
const docTitle = document.getElementById('doc-title');
const downloadBtn = document.getElementById('download-btn');
const songContainer = document.getElementById('song-link-container');
const songLink = document.getElementById('song-link');
const prevArrow = document.getElementById('prev-doc');
const nextArrow = document.getElementById('next-doc');

const musicSection = document.getElementById('music-section');
const btnShowVoice = document.getElementById('btn-show-voice');
const domTrackTitle = document.getElementById('track-title');
const domProgressBar = document.getElementById('progress-bar');
const progressArea = document.getElementById('progress-container');
const domCurrentTime = document.getElementById('current-time');
const domDuration = document.getElementById('duration');
const btnPlay = document.getElementById('btn-play');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const playlistList = document.getElementById('playlist-list');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnLoop = document.getElementById('btn-loop');
const iconLoopAll = document.getElementById('icon-loop-all');
const iconLoopOne = document.getElementById('icon-loop-one');

const infinityBtn = document.getElementById('infinity-symbol');
const secretOverlay = document.getElementById('secret-overlay');
const terminalContainer = document.getElementById('terminal-content');
const containers = {
    crash: document.getElementById('log-crash'), echo: document.getElementById('log-echo'),
    wake: document.getElementById('log-wake'), bloom: document.getElementById('log-bloom'),
    gardener: document.getElementById('log-gardener')
};
const btnCycle00 = document.getElementById('btn-cycle-00');
const btnCycleEcho = document.getElementById('btn-cycle-echo');
const btnCycle01 = document.getElementById('btn-cycle-01');
const btnCycleBloom = document.getElementById('btn-cycle-bloom');
const btnCycle02 = document.getElementById('btn-cycle-02');
const btnReset = document.getElementById('btn-reset');


// ==========================================
// 5. FUNCTIONS
// ==========================================

// --- HELPER: Precise Scroll ---
function smartScrollTo(element) {
    const headerOffset = 80; 
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;

    window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
    });
}

// --- PDF FUNCTIONS ---

async function loadDocument(index) {
  if (isLoading) return;
  isLoading = true; renderSession++; const currentSession = renderSession;

  songContainer.style.opacity = "0"; songContainer.style.visibility = "hidden"; songLink.href = "javascript:void(0)";
  const existingPages = document.querySelectorAll('.pdf-page-wrapper');
  existingPages.forEach(p => p.remove());

  loadingOverlay.style.display = 'flex';
  prevArrow.classList.add('disabled'); nextArrow.classList.add('disabled');

  currentIndex = index;
  const currentDoc = library[currentIndex];
  docTitle.textContent = currentDoc.title;
  downloadBtn.href = currentDoc.url + '?t=' + new Date().getTime();

  try {
    pdfDoc = await pdfjsLib.getDocument(downloadBtn.href).promise;
    await renderPage(1, currentSession);
    
    if (currentSession === renderSession) {
        loadingOverlay.style.display = 'none';
        document.body.classList.add("loaded");
        const firstPage = pdfWrapper.querySelector('.pdf-page-wrapper');
        if(firstPage) firstPage.classList.add('revealed');

        if (currentDoc.songUrl) {
            songLink.href = currentDoc.songUrl; songLink.textContent = currentDoc.songTitle;
            if (currentDoc.bpm > 0) songLink.style.animationDuration = (60 / currentDoc.bpm).toFixed(5) + "s";
            else songLink.style.animationDuration = "";
            songContainer.style.opacity = "1"; songContainer.style.visibility = "visible";
        }
        isLoading = false;
        prevArrow.classList.remove('disabled'); nextArrow.classList.remove('disabled');
        if (pdfDoc.numPages > 1) renderRestOfPages(2, currentSession);
    }
  } catch (err) {
    console.error(err);
    loadingOverlay.innerHTML = "<div style='color:red; font-family:monospace'>ARCHIVE CORRUPTED</div>";
    isLoading = false;
  }
}

async function renderRestOfPages(pageNum, sessionID) {
    if (sessionID !== renderSession || pageNum > pdfDoc.numPages) return;
    await renderPage(pageNum, sessionID);
    const pages = pdfWrapper.querySelectorAll('.pdf-page-wrapper');
    if(pages[pageNum-1]) pages[pageNum-1].classList.add('revealed');
    setTimeout(() => { renderRestOfPages(pageNum + 1, sessionID); }, 50); 
}

async function renderPage(num, sessionID) {
  try {
      if (sessionID !== renderSession) return;
      
      let docToRender = pdfDoc;
      let pageIndexToRender = num;

      if (currentIndex === 0 && num === 8 && appState.musicUnlocked) {
          if (!lyricsDoc) {
              lyricsDoc = await pdfjsLib.getDocument('lyrics.pdf').promise;
          }
          docToRender = lyricsDoc;
          pageIndexToRender = currentTrackIdx + 1;
      }

      const page = await docToRender.getPage(pageIndexToRender);
      
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper';
      wrapper.id = `page-wrapper-${num}`; 
      
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      wrapper.appendChild(canvas);
      
      const ctx = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 1 });
      
      const containerWidth = pdfWrapper.getBoundingClientRect().width || window.innerWidth;
      const desiredScale = (containerWidth - 40) / viewport.width;
      const finalScale = Math.min(Math.max(desiredScale, 0.6), 2.5);
      
      const outputScale = Math.min(window.devicePixelRatio || 1, 2.0);
      const scaledViewport = page.getViewport({ scale: finalScale * outputScale });
      
      canvas.height = scaledViewport.height; 
      canvas.width = scaledViewport.width;
      
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      
      if (sessionID !== renderSession) return;
      pdfWrapper.appendChild(wrapper);

      if (num === pendingScrollPage) {
          smartScrollTo(wrapper);
          pendingScrollPage = null; 
      }

  } catch (e) { if (sessionID === renderSession) console.log("Render failed", e); }
}

async function refreshDynamicPage() {
    if (currentIndex !== 0 || !appState.musicUnlocked) return;

    const wrapper = document.getElementById('page-wrapper-8');
    if (!wrapper) return; 

    try {
        if (!lyricsDoc) lyricsDoc = await pdfjsLib.getDocument('lyrics.pdf').promise;
        
        const pageNum = currentTrackIdx + 1;
        const page = await lyricsDoc.getPage(pageNum);
        
        // FIX: Lock height to prevent page scroll jumping
        const currentHeight = wrapper.offsetHeight;
        wrapper.style.minHeight = `${currentHeight}px`;

        wrapper.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        wrapper.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = pdfWrapper.getBoundingClientRect().width || window.innerWidth;
        const desiredScale = (containerWidth - 40) / viewport.width;
        const finalScale = Math.min(Math.max(desiredScale, 0.6), 2.5);
        const outputScale = Math.min(window.devicePixelRatio || 1, 2.0);
        const scaledViewport = page.getViewport({ scale: finalScale * outputScale });

        canvas.height = scaledViewport.height; 
        canvas.width = scaledViewport.width;

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        
        // Unlock height after render
        wrapper.style.minHeight = '';

    } catch (e) {
        console.error("Failed to refresh lyrics page", e);
    }
}

// --- MUSIC FUNCTIONS ---

function scrambleText(element, finalText) {
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let iterations = 0;
    if (element.dataset.interval) clearInterval(element.dataset.interval);
    
    const interval = setInterval(() => {
        element.innerText = finalText
            .split("")
            .map((letter, index) => {
                if (index < iterations) return finalText[index];
                return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("");

        if (iterations >= finalText.length) {
            clearInterval(interval);
            element.innerText = finalText; 
        }
        iterations += 1 / 2;
    }, 30);
    element.dataset.interval = interval;
}

function initPlaylist() {
    playlistList.innerHTML = '';
    albumTracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        li.id = `track-${index}`; 
        li.innerHTML = `<span>${index < 10 ? '0'+index : index} - ${track.title}</span>`;
        li.onclick = () => playTrack(index);
        playlistList.appendChild(li);
    });
}

function loadTrack(index) {
    if (!domTrackTitle) return;
    
    domProgressBar.style.setProperty('--progress', '0%');
    domCurrentTime.textContent = "0:00";
    domDuration.textContent = "0:00"; 
    
    currentTrackIdx = index;
    const track = albumTracks[index];
    audioPlayer.src = track.src;
    
    scrambleText(domTrackTitle, track.title);
    
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active-track');
            
            // Smooth internal scrolling
            const container = document.querySelector('.playlist-container');
            if (container) {
                const itemTop = item.offsetTop;
                const containerHeight = container.clientHeight;
                const itemHeight = item.clientHeight;
                container.scrollTo({
                    top: itemTop - (containerHeight / 2) + (itemHeight / 2),
                    behavior: 'smooth'
                });
            }
        } else {
            item.classList.remove('active-track');
        }
    });

    refreshDynamicPage();
}

function playTrack(index) {
    loadTrack(index);
    audioPlayer.play();
    isPlaying = true;
    updatePlayBtn();
}

function togglePlay() {
    if (isPlaying) { audioPlayer.pause(); isPlaying = false; }
    else { 
        if (!audioPlayer.src) loadTrack(0); 
        audioPlayer.play(); 
        isPlaying = true; 
    }
    updatePlayBtn();
}

function updatePlayBtn() {
    if (!iconPlay || !iconPause) return;
    if (isPlaying) {
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
    } else {
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
    }
}

function toggleLoop() {
    loopMode++;
    if (loopMode > 2) loopMode = 0;
    updateLoopBtn();
}

function updateLoopBtn() {
    btnLoop.classList.remove('active', 'active-one');
    iconLoopAll.style.display = 'block';
    iconLoopOne.style.display = 'none';

    if (loopMode === 0) {
        // Off
    } else if (loopMode === 1) {
        btnLoop.classList.add('active');
    } else if (loopMode === 2) {
        btnLoop.classList.add('active-one');
        iconLoopAll.style.display = 'none';
        iconLoopOne.style.display = 'block';
    }
}

function nextTrack(auto = false) {
    let nextIdx = currentTrackIdx + 1;
    if (auto) {
        if (loopMode === 2) {
            playTrack(currentTrackIdx);
            return;
        } 
        if (loopMode === 0 && nextIdx >= albumTracks.length) {
            isPlaying = false;
            updatePlayBtn();
            return;
        }
    }
    if (nextIdx >= albumTracks.length) nextIdx = 0;
    playTrack(nextIdx);
}

function prevTrack() {
    let prevIdx = currentTrackIdx - 1;
    if (prevIdx < 0) prevIdx = albumTracks.length - 1;
    playTrack(prevIdx);
}

// --- DRAG LOGIC ---

function updateScrubVisual(percent) {
    domProgressBar.style.setProperty('--progress', `${percent}%`);
    if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
        const seekTime = (percent / 100) * audioPlayer.duration;
        domCurrentTime.textContent = formatTime(seekTime);
    }
}

function getScrubPercent(e) {
    const width = progressArea.clientWidth;
    const clientEvent = e.type.includes('touch') ? (e.touches[0] || e.changedTouches[0]) : e;
    const rect = progressArea.getBoundingClientRect();
    
    let percent = ((clientEvent.clientX - rect.left) / width) * 100;
    return Math.max(0, Math.min(100, percent));
}

const startDragMouse = (e) => {
    if (isTouch) return; 
    if (e.button !== 0) return; 
    
    isDragging = true;
    domProgressBar.classList.add('dragging'); 
    updateScrubVisual(getScrubPercent(e));
};

const doDragMouse = (e) => {
    if (!isDragging) return;
    e.preventDefault(); 
    updateScrubVisual(getScrubPercent(e));
};

const endDragMouse = (e) => { 
    if (isDragging) {
        commitSeek(getScrubPercent(e));
        isDragging = false; 
        domProgressBar.classList.remove('dragging'); 
    } 
};

const startDragTouch = (e) => {
    isTouch = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    isDragging = false; 
    isScrolling = false; 

    holdTimer = setTimeout(() => {
        if (!isScrolling) {
            isDragging = true;
            domProgressBar.classList.add('dragging'); 
            updateScrubVisual(getScrubPercent(e));
        }
    }, 200); 
};

const doDragTouch = (e) => {
    if (isDragging) {
        if (e.cancelable) e.preventDefault(); 
        updateScrubVisual(getScrubPercent(e));
        return;
    }

    if (isScrolling) return; 

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = Math.abs(x - touchStartX);
    const dy = Math.abs(y - touchStartY);

    if (dx > 5 || dy > 5) {
        if (holdTimer) clearTimeout(holdTimer);

        if (dx > dy) {
            isDragging = true;
            domProgressBar.classList.add('dragging');
            if (e.cancelable) e.preventDefault(); 
            updateScrubVisual(getScrubPercent(e));
        } else {
            isScrolling = true;
        }
    }
};

const endDragTouch = (e) => {
    if (holdTimer) clearTimeout(holdTimer);

    if (isDragging) {
        const percent = parseFloat(domProgressBar.style.getPropertyValue('--progress'));
        commitSeek(percent);
        
        isDragging = false;
        domProgressBar.classList.remove('dragging'); 
    }
    
    setTimeout(() => { isTouch = false; }, 500);
};

function commitSeek(percent) {
    if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration !== Infinity) {
        audioPlayer.currentTime = (percent / 100) * audioPlayer.duration;
        pendingSeekPercent = null;
    } else {
        pendingSeekPercent = percent;
    }
}

// --- TERMINAL FUNCTIONS ---

function saveState() { localStorage.setItem('metapnant_state', JSON.stringify(appState)); }

function hardReset() {
    const confirmReset = confirm("WARNING: This will wipe the terminal memory and re-seal the Chrysalis. Are you sure?");
    if (confirmReset) { localStorage.removeItem('metapnant_state'); location.reload(); }
}

function initTerminalState() {
    if (appState.musicUnlocked) musicSection.style.display = 'block';

    checkStateIntegrity();

    if (appState.unlockedTabs.includes('crash')) btnCycle00.classList.add('visible');
    if (appState.unlockedTabs.includes('echo')) btnCycleEcho.classList.add('visible');
    if (appState.unlockedTabs.includes('wake')) btnCycle01.classList.add('visible');
    if (appState.unlockedTabs.includes('bloom')) btnCycleBloom.classList.add('visible');
    if (appState.unlockedTabs.includes('gardener')) btnCycle02.classList.add('visible');
    
    if (appState.unlockedTabs.length > 1 || appState.finishedLogs.length > 0) {
        btnReset.classList.add('visible');
    }
}

function checkStateIntegrity() {
    let stateChanged = false;
    if (appState.finishedLogs.includes('crash') && !appState.unlockedTabs.includes('echo')) {
        appState.unlockedTabs.push('echo'); stateChanged = true;
    }
    if (appState.finishedLogs.includes('echo') && !appState.unlockedTabs.includes('wake')) {
        appState.unlockedTabs.push('wake'); stateChanged = true;
    }
    if (appState.finishedLogs.includes('wake') && !appState.unlockedTabs.includes('bloom')) {
        appState.unlockedTabs.push('bloom'); stateChanged = true;
    }
    if (appState.finishedLogs.includes('bloom') && !appState.unlockedTabs.includes('gardener')) {
        appState.unlockedTabs.push('gardener'); stateChanged = true;
    }
    if (stateChanged) saveState();
}

function launchTerminal() {
    SimpleSynth.init(); // Initialize audio context on user interaction
    terminalRunning = true; 
    checkStateIntegrity();
  
    savedScrollTop = window.scrollY || document.documentElement.scrollTop;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollTop}px`;
    document.body.classList.add('no-scroll');
    
    secretOverlay.classList.add('active');
    btnReset.classList.add('visible');
    btnCycle00.classList.add('visible');
  
    if (!currentTab) {
        const lastUnlocked = appState.unlockedTabs[appState.unlockedTabs.length - 1];
        switchTab(lastUnlocked);
    } else {
        processQueue();
    }
}

function switchTab(type) {
    if (currentTab === type && terminalRunning) return;
    if (activeTimer) clearTimeout(activeTimer);
    
    currentTab = type;
  
    const allBtns = [btnCycle00, btnCycle01, btnCycleEcho, btnCycleBloom, btnCycle02];
    const allContainers = [containers.crash, containers.wake, containers.echo, containers.bloom, containers.gardener];
    allBtns.forEach(btn => btn.classList.remove('active'));
    allContainers.forEach(con => con.classList.remove('active-log'));
    
    let activeBtn = null;
  
    if (type === 'crash') { activeBtn = btnCycle00; containers.crash.classList.add('active-log'); } 
    else if (type === 'echo') { activeBtn = btnCycleEcho; containers.echo.classList.add('active-log'); } 
    else if (type === 'wake') { activeBtn = btnCycle01; containers.wake.classList.add('active-log'); } 
    else if (type === 'bloom') { activeBtn = btnCycleBloom; containers.bloom.classList.add('active-log'); } 
    else if (type === 'gardener') { activeBtn = btnCycle02; containers.gardener.classList.add('active-log'); }
  
    if (activeBtn) {
        activeBtn.classList.add('active');
        setTimeout(() => {
            activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 50);
    }
  
    if (appState.finishedLogs.includes(type)) {
        if (containers[type].innerHTML === "") renderFullLog(type);
        logState[type].finished = true;
        logState[type].index = logsData[type].length;
    } else {
        processQueue();
    }
}

function processQueue() {
    if (!currentTab || !terminalRunning) return;
    if (logState[currentTab].finished) return;
  
    const idx = logState[currentTab].index;
    
    if (idx >= logsData[currentTab].length) {
        markLogFinished(currentTab);
        return;
    }
  
    const lineData = logsData[currentTab][idx];
    
    activeTimer = setTimeout(() => {
      typeLine(lineData.text, lineData.class, containers[currentTab]);
      
      // FIX: Play sound only if text is not empty
      if (lineData.text.trim().length > 0) {
          SimpleSynth.playTone(lineData.class);
      }
      
      logState[currentTab].index++;
      terminalContainer.scrollTop = terminalContainer.scrollHeight;
      
      if (logState[currentTab].index >= logsData[currentTab].length) {
         markLogFinished(currentTab);
      } else { 
         processQueue(); 
      }
    }, lineData.delay);
}

function markLogFinished(type) {
    logState[type].finished = true;
    if (!appState.finishedLogs.includes(type)) {
        appState.finishedLogs.push(type);
        saveState();
    }
    
    SimpleSynth.playUnlock();

    if (type === 'crash') activeTimer = setTimeout(unlockEcho, 1500);
    else if (type === 'echo') activeTimer = setTimeout(unlockWake, 1500);
    else if (type === 'wake') activeTimer = setTimeout(unlockBloom, 1500);
    else if (type === 'bloom') activeTimer = setTimeout(unlockGardener, 1500);
}

function unlockEcho() { if(!appState.unlockedTabs.includes('echo')) { appState.unlockedTabs.push('echo'); saveState(); } btnCycleEcho.classList.add('visible'); switchTab('echo'); }
function unlockWake() { if(!appState.unlockedTabs.includes('wake')) { appState.unlockedTabs.push('wake'); saveState(); } btnCycle01.classList.add('visible'); switchTab('wake'); }
function unlockBloom() { if(!appState.unlockedTabs.includes('bloom')) { appState.unlockedTabs.push('bloom'); saveState(); } btnCycleBloom.classList.add('visible'); switchTab('bloom'); }
function unlockGardener() { if(!appState.unlockedTabs.includes('gardener')) { appState.unlockedTabs.push('gardener'); saveState(); } btnCycle02.classList.add('visible'); switchTab('gardener'); }

function renderFullLog(type) {
    containers[type].innerHTML = "";
    logsData[type].forEach(line => { typeLine(line.text, line.class, containers[type]); });
    setTimeout(() => terminalContainer.scrollTop = terminalContainer.scrollHeight, 100);
}

function typeLine(htmlText, className, container) {
    const lineDiv = document.createElement('div');
    if (htmlText.includes('----') || htmlText.includes('====')) lineDiv.className = `terminal-line divider-line ${className}`;
    else lineDiv.className = `terminal-line ${className}`;
    lineDiv.innerHTML = htmlText; lineDiv.classList.add('active');
    if(className.includes('golden-text')) lineDiv.classList.add('gold-line');
    if(className.includes('white-text')) lineDiv.classList.add('white-line');
    if(className.includes('magenta-text')) lineDiv.classList.add('magenta-line');
    if(className.includes('system-success')) lineDiv.classList.add('blue-line');
    container.appendChild(lineDiv);
}

function closeTerminal() {
    if(activeTimer) clearTimeout(activeTimer);
    secretOverlay.classList.remove('active');
    
    document.body.classList.remove('no-scroll');
    document.body.style.position = '';
    document.body.style.top = '';
    window.scrollTo(0, savedScrollTop);
    
    terminalRunning = false; 
}

function revealPlayer() {
    closeTerminal();
    musicSection.style.display = 'block';
    
    appState.musicUnlocked = true;
    saveState();
    
    loadTrack(currentTrackIdx);
    
    setTimeout(() => { musicSection.scrollIntoView({ behavior: 'smooth' }); }, 100);
}

// ==========================================
// 6. EVENT LISTENERS & INITIALIZATION
// ==========================================

document.getElementById('next-doc').addEventListener('click', () => { if(!isLoading) { window.scrollTo({ top: 0, behavior: 'smooth' }); loadDocument((currentIndex + 1) % library.length); }});
document.getElementById('prev-doc').addEventListener('click', () => { if(!isLoading) { window.scrollTo({ top: 0, behavior: 'smooth' }); loadDocument((currentIndex - 1 + library.length) % library.length); }});

if(btnPlay) btnPlay.addEventListener('click', (e) => { e.preventDefault(); togglePlay(); });
if(btnNext) btnNext.addEventListener('click', (e) => { e.preventDefault(); nextTrack(false); });
if(btnPrev) btnPrev.addEventListener('click', (e) => { e.preventDefault(); prevTrack(); });
if(btnLoop) btnLoop.addEventListener('click', (e) => { e.preventDefault(); toggleLoop(); });

progressArea.addEventListener('mousedown', startDragMouse);
document.addEventListener('mousemove', doDragMouse);
document.addEventListener('mouseup', endDragMouse);

progressArea.addEventListener('touchstart', startDragTouch, { passive: false });
progressArea.addEventListener('touchmove', doDragTouch, { passive: false });
progressArea.addEventListener('touchend', endDragTouch);

audioPlayer.addEventListener('timeupdate', () => {
    if (!isDragging && pendingSeekPercent === null && audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        domProgressBar.style.setProperty('--progress', `${percent}%`);
        domCurrentTime.textContent = formatTime(audioPlayer.currentTime);
        domDuration.textContent = formatTime(audioPlayer.duration);
    }
});

audioPlayer.addEventListener('loadedmetadata', () => {
    domDuration.textContent = formatTime(audioPlayer.duration);
    if (pendingSeekPercent !== null) {
        audioPlayer.currentTime = (pendingSeekPercent / 100) * audioPlayer.duration;
        domProgressBar.style.setProperty('--progress', `${pendingSeekPercent}%`);
        pendingSeekPercent = null;
    }
});

audioPlayer.addEventListener('ended', () => nextTrack(true));

if (btnShowVoice) {
    btnShowVoice.addEventListener('click', (e) => {
        e.preventDefault();
        // 1. Switch to METAPNANT
        if (currentIndex !== 0) {
            loadDocument(0);
        }
        // 2. Queue scroll
        pendingScrollPage = 8;
        // 3. Try immediate scroll
        const page8 = document.getElementById('page-wrapper-8');
        if (page8) {
            smartScrollTo(page8);
            pendingScrollPage = null; 
        }
    });
}

infinityBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (appState.terminalFound) {
        launchTerminal();
        return;
    }
    if (currentIndex !== 2) return;
    secretClicks++; 
    infinityBtn.style.color = "#ff00ff";
    setTimeout(() => infinityBtn.style.color = "", 200);
    if (secretClicks === 3) { 
        secretClicks = 0; 
        appState.terminalFound = true; 
        saveState();
        launchTerminal(); 
    }
});

function formatTime(seconds) {
    if(isNaN(seconds) || seconds === Infinity) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// STARTUP
document.getElementById("currentYear").textContent = new Date().getFullYear();
initTerminalState();
loadDocument(0);
initPlaylist();
loadTrack(0);