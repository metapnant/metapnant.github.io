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
let resizeTimer = null; // Debounce for orientation change

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
let loadingScrambleInterval = null; 
let bufferCheckTimer = null; 
let shouldAnimateReveal = false; 

// -- Terminal State --
let secretClicks = 0; 
let terminalRunning = false; 
let activeTimer = null; 
let currentTab = null;
let savedScrollTop = 0;
let turboMode = false;
let isMuted = false;
let logSpeedMultiplier = 1;

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
// 3. SOUND ENGINE (UNIVERSAL IOS FIX)
// ==========================================
const SimpleSynth = {
    ctx: null,
    unlocked: false,
    
    init: function() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
    },

    unlock: function() {
        this.init();
        if (this.unlocked || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => { this.unlocked = true; });
        }
        try {
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            if (source.start) source.start(0); else if (source.noteOn) source.noteOn(0);
            this.unlocked = true;
        } catch(e) { console.error(e); }
    },

    playTone: function(cssClass) {
        if (isMuted) return;
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        
        if (cssClass.includes('operator-text')) {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(500, t); osc.frequency.linearRampToValueAtTime(450, t + 0.08); gain.gain.setValueAtTime(0.04, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        } else if (cssClass.includes('alert-text')) {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, t); gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        } else if (cssClass.includes('comment-text')) {
            osc.type = 'sine'; osc.frequency.setValueAtTime(3000, t); gain.gain.setValueAtTime(0.015, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
        } else if (cssClass.includes('golden-text') || cssClass.includes('white-text') || cssClass.includes('magenta-text')) {
            osc.type = 'sine'; osc.frequency.setValueAtTime(880, t); gain.gain.setValueAtTime(0.08, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        } else if (cssClass.includes('system-success')) {
            osc.type = 'square'; osc.frequency.setValueAtTime(1200, t); osc.frequency.linearRampToValueAtTime(2000, t + 0.05); gain.gain.setValueAtTime(0.03, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        } else {
            osc.type = 'square'; osc.frequency.setValueAtTime(800, t); osc.frequency.exponentialRampToValueAtTime(100, t + 0.04); gain.gain.setValueAtTime(0.03, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        }
        osc.start(); osc.stop(t + 0.2);
    },

    playUnlock: function() {
        if (isMuted) return;
        if (!this.ctx) this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(200, this.ctx.currentTime); osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.3); gain.gain.setValueAtTime(0.05, this.ctx.currentTime); gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3); osc.start(); osc.stop(this.ctx.currentTime + 0.3);
    }
};

function unlockAudioEngine() {
    SimpleSynth.unlock();
    if (SimpleSynth.ctx && SimpleSynth.ctx.state === 'running') {
        document.removeEventListener('click', unlockAudioEngine);
        document.removeEventListener('keydown', unlockAudioEngine);
        document.removeEventListener('touchstart', unlockAudioEngine);
        document.removeEventListener('touchend', unlockAudioEngine);
    }
}
document.addEventListener('click', unlockAudioEngine);
document.addEventListener('keydown', unlockAudioEngine);
document.addEventListener('touchstart', unlockAudioEngine);
document.addEventListener('touchend', unlockAudioEngine);

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
const btnTurbo = document.getElementById('btn-turbo');
const btnMute = document.getElementById('btn-mute');


// ==========================================
// 5. FUNCTIONS
// ==========================================

function smartScrollTo(element) {
    const headerOffset = 80; 
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;
    window.scrollTo({ top: offsetPosition, behavior: "smooth" });
}

function updateInfinityState() {
    if (appState.musicUnlocked || currentIndex === 2) {
        infinityBtn.classList.add('active');
    } else {
        infinityBtn.classList.remove('active');
    }
}

// --- PDF FUNCTIONS ---
async function loadDocument(index) {
  if (isLoading) return;
  isLoading = true; renderSession++; const currentSession = renderSession;
  
  if (prevArrow) prevArrow.classList.remove('active-state');
  if (nextArrow) nextArrow.classList.remove('active-state');

  songContainer.style.opacity = "0"; songContainer.style.visibility = "hidden"; songLink.href = "javascript:void(0)";
  const existingPages = document.querySelectorAll('.pdf-page-wrapper');
  existingPages.forEach(p => p.remove());

  loadingOverlay.style.display = 'flex';
  
  prevArrow.classList.add('disabled'); 
  nextArrow.classList.add('disabled');

  currentIndex = index;
  const currentDoc = library[currentIndex];
  docTitle.textContent = currentDoc.title;
  downloadBtn.href = currentDoc.url + '?t=' + new Date().getTime();
  
  updateInfinityState();

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
        
        // --- FIXED ARROW VISIBILITY LOGIC ---
        prevArrow.classList.remove('disabled'); 
        nextArrow.classList.remove('disabled');
        
        if (currentIndex === 0) prevArrow.classList.add('disabled');
        if (currentIndex === library.length - 1) nextArrow.classList.add('disabled');

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

// --- FIX: MEMORY-SAFE RENDER PAGE FUNCTION ---
async function renderPage(num, sessionID) {
  try {
      if (sessionID !== renderSession) return;
      let docToRender = pdfDoc;
      let pageIndexToRender = num;
      if (currentIndex === 0 && num === 8 && appState.musicUnlocked) {
          if (!lyricsDoc) lyricsDoc = await pdfjsLib.getDocument('lyrics.pdf').promise;
          docToRender = lyricsDoc; pageIndexToRender = currentTrackIdx + 1;
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
      
      // --- MEMORY FIX FOR IOS ---
      // Reduce pixel density on mobile to prevent >16MB canvas crash
      let outputScale = Math.min(window.devicePixelRatio || 1, 2.0);
      if (window.innerWidth < 800) {
          outputScale = 1.4; // Slightly lower density on mobile to save RAM
      }

      const scaledViewport = page.getViewport({ scale: finalScale * outputScale });
      
      // Ensure integer dimensions to prevent sub-pixel blurring
      canvas.height = Math.floor(scaledViewport.height);
      canvas.width = Math.floor(scaledViewport.width);
      
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      
      if (sessionID !== renderSession) return;
      pdfWrapper.appendChild(wrapper);
      if (num === pendingScrollPage) { smartScrollTo(wrapper); pendingScrollPage = null; }
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
        
        // Same memory fix for dynamic pages
        let outputScale = Math.min(window.devicePixelRatio || 1, 2.0);
        if (window.innerWidth < 800) outputScale = 1.4;

        const finalScale = Math.min(Math.max(desiredScale, 0.6), 2.5);
        const scaledViewport = page.getViewport({ scale: finalScale * outputScale });
        canvas.height = Math.floor(scaledViewport.height); 
        canvas.width = Math.floor(scaledViewport.width);
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        wrapper.style.minHeight = '';
    } catch (e) { console.error("Failed to refresh lyrics page", e); }
}

// --- MUSIC FUNCTIONS ---
function startLoadingScramble(element) {
    if (loadingScrambleInterval) clearInterval(loadingScrambleInterval);
    const glyphs = "∞⋈⏣⌬⎔⌭⏦⌇∿≋꩜ᚙᚘ⸎۞۝!<>-_\\/[]{}—=+*^?#";
    const baseText = "LOADING";
    loadingScrambleInterval = setInterval(() => {
        let text = "";
        for(let i=0; i < 12; i++) {
            if (i < baseText.length && Math.random() > 0.8) text += baseText[i];
            else text += glyphs[Math.floor(Math.random() * glyphs.length)];
        }
        element.innerText = text;
        element.style.color = "var(--name-color)"; 
        element.style.fontSize = ""; 
    }, 60);
}

function resolveLoadingScramble(element, finalText) {
    if (loadingScrambleInterval) {
        clearInterval(loadingScrambleInterval);
        loadingScrambleInterval = null; 
    }
    scrambleText(element, finalText); 
}

function scrambleText(element, finalText) {
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let iterations = 0;
    if (element.dataset.interval) clearInterval(element.dataset.interval);
    const interval = setInterval(() => {
        element.innerText = finalText.split("").map((letter, index) => {
            if (index < iterations) return finalText[index];
            return chars[Math.floor(Math.random() * chars.length)];
        }).join("");
        if (iterations >= finalText.length) clearInterval(interval);
        iterations += 1 / 2;
    }, 30);
    element.dataset.interval = interval;
}

function initPlaylist() {
    playlistList.innerHTML = '';
    albumTracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'playlist-item'; li.id = `track-${index}`; 
        li.innerHTML = `<span>${index < 10 ? '0'+index : index} - ${track.title}</span>`;
        li.onclick = () => playTrack(index);
        playlistList.appendChild(li);
    });
}

function loadTrack(index, animate = true) {
    if (!domTrackTitle) return;
    domProgressBar.style.setProperty('--progress', '0%');
    domCurrentTime.textContent = "0:00"; domDuration.textContent = "0:00"; 
    currentTrackIdx = index;
    const track = albumTracks[index];
    
    shouldAnimateReveal = animate; 
    if (animate) {
        startLoadingScramble(domTrackTitle);
    } else {
        domTrackTitle.innerText = track.title;
    }
    
    audioPlayer.src = track.src;
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active-track');
            const container = document.querySelector('.playlist-container');
            if (container) {
                container.scrollTo({ top: item.offsetTop - (container.clientHeight / 2) + (item.clientHeight / 2), behavior: 'smooth' });
            }
        } else item.classList.remove('active-track');
    });
    refreshDynamicPage();
}

function playTrack(index) { 
    loadTrack(index); 
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
        playPromise.then(_ => { isPlaying = true; updatePlayBtn(); })
        .catch(error => { console.log("Autoplay prevented"); isPlaying = false; updatePlayBtn(); });
    }
}

function togglePlay() {
    if (isPlaying) { 
        audioPlayer.pause(); 
        isPlaying = false;
        if (loadingScrambleInterval) {
             resolveLoadingScramble(domTrackTitle, albumTracks[currentTrackIdx].title);
        }
    }
    else { 
        if (!audioPlayer.src) loadTrack(0); 
        audioPlayer.play(); 
        isPlaying = true; 
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

// --- DRAG LOGIC ---
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
const startDragTouch = (e) => { isTouch = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; isDragging = false; isScrolling = false; 
    holdTimer = setTimeout(() => { if (!isScrolling) { isDragging = true; domProgressBar.classList.add('dragging'); updateScrubVisual(getScrubPercent(e)); } }, 200); 
};
const doDragTouch = (e) => {
    if (isDragging) { if (e.cancelable) e.preventDefault(); updateScrubVisual(getScrubPercent(e)); return; }
    if (isScrolling) return; 
    const dx = Math.abs(e.touches[0].clientX - touchStartX); const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 5 || dy > 5) { if (holdTimer) clearTimeout(holdTimer); if (dx > dy) { isDragging = true; domProgressBar.classList.add('dragging'); if (e.cancelable) e.preventDefault(); updateScrubVisual(getScrubPercent(e)); } else isScrolling = true; }
};
const endDragTouch = (e) => { if (holdTimer) clearTimeout(holdTimer); if (isDragging) { commitSeek(parseFloat(domProgressBar.style.getPropertyValue('--progress'))); isDragging = false; domProgressBar.classList.remove('dragging'); } setTimeout(() => { isTouch = false; }, 500); };
function commitSeek(percent) {
    shouldAnimateReveal = false; 
    if (audioPlayer.duration && !isNaN(audioPlayer.duration) && audioPlayer.duration !== Infinity) {
        audioPlayer.currentTime = (percent / 100) * audioPlayer.duration;
        pendingSeekPercent = null;
        if (bufferCheckTimer) clearTimeout(bufferCheckTimer);
        bufferCheckTimer = setTimeout(() => { if (audioPlayer.seeking || audioPlayer.readyState < 3) { shouldAnimateReveal = true; startLoadingScramble(domTrackTitle); } }, 200);
    } else pendingSeekPercent = percent;
}

// ==========================================
// 6. ROBUST TERMINAL LOGIC
// ==========================================

function saveState() { localStorage.setItem('metapnant_state', JSON.stringify(appState)); }

function hardReset() { 
    if (confirm("WARNING: This will wipe the terminal memory and re-seal the Chrysalis. Are you sure?")) { 
        localStorage.removeItem('metapnant_state'); 
        location.reload(); 
    } 
}

function checkStateIntegrity() {
    let changed = false;
    if (appState.finishedLogs.includes('crash') && !appState.unlockedTabs.includes('echo')) { 
        appState.unlockedTabs.push('echo'); changed = true; 
    }
    if (appState.finishedLogs.includes('echo') && !appState.unlockedTabs.includes('wake')) { 
        appState.unlockedTabs.push('wake'); changed = true; 
    }
    if (appState.finishedLogs.includes('wake') && !appState.unlockedTabs.includes('bloom')) { 
        appState.unlockedTabs.push('bloom'); changed = true; 
    }
    if (appState.finishedLogs.includes('bloom') && !appState.unlockedTabs.includes('gardener')) { 
        appState.unlockedTabs.push('gardener'); changed = true; 
    }
    if (changed) saveState();
}

function updateSidebarUI() {
    // Visibility
    if (appState.unlockedTabs.includes('crash')) btnCycle00.classList.add('visible');
    if (appState.unlockedTabs.includes('echo')) btnCycleEcho.classList.add('visible');
    if (appState.unlockedTabs.includes('wake')) btnCycle01.classList.add('visible');
    if (appState.unlockedTabs.includes('bloom')) btnCycleBloom.classList.add('visible');
    if (appState.unlockedTabs.includes('gardener')) btnCycle02.classList.add('visible');

    // Highlights
    const allBtns = [btnCycle00, btnCycleEcho, btnCycle01, btnCycleBloom, btnCycle02];
    allBtns.forEach(btn => btn.classList.remove('active'));

    const activeBtn = 
        currentTab === 'crash' ? btnCycle00 :
        currentTab === 'echo' ? btnCycleEcho :
        currentTab === 'wake' ? btnCycle01 :
        currentTab === 'bloom' ? btnCycleBloom :
        currentTab === 'gardener' ? btnCycle02 : null;

    if (activeBtn) activeBtn.classList.add('active');

    // Replay Icons - REUSE EXISTING ICON TO PREVENT REBUILD FLASH
    allBtns.forEach(btn => { 
        // We only want the icon on the ACTIVE button of a FINISHED log
        const isCurrent = btn === activeBtn;
        const type = btn === btnCycle00 ? 'crash' :
                     btn === btnCycleEcho ? 'echo' :
                     btn === btnCycle01 ? 'wake' :
                     btn === btnCycleBloom ? 'bloom' : 'gardener';
        
        const isFinished = appState.finishedLogs.includes(type);

        let icon = btn.querySelector('.replay-icon');

        if (isCurrent && isFinished) {
            // If it doesn't exist, create it
            if (!icon) {
                icon = document.createElement('span'); 
                icon.className = 'replay-icon'; 
                icon.innerHTML = '↺'; 
                
                // CLICK HANDLER
                icon.onclick = (e) => {
                    e.stopPropagation(); 
                    e.preventDefault();
                    
                    // Trigger Animation
                    icon.classList.remove('spin-once');
                    void icon.offsetWidth; 
                    icon.classList.add('spin-once');
                    
                    replayLog(e, type);
                };
                
                btn.appendChild(icon);
            }
        } else {
            // Remove if it shouldn't be there
            if (icon) icon.remove();
        }
    });

    if (appState.unlockedTabs.length > 1 || appState.finishedLogs.length > 0) {
        btnReset.classList.add('visible'); 
        btnTurbo.classList.add('visible'); 
        btnMute.classList.add('visible');
    }
}

function initTerminalState() {
    checkStateIntegrity(); 
    updateSidebarUI();
    
    // Set initial Turbo text
    if (btnTurbo) {
        btnTurbo.innerText = "[ >> ]\nTURBO: OFF";
    }

    if (appState.musicUnlocked) musicSection.style.display = 'block';
}

function launchTerminal() { 
    SimpleSynth.unlock(); 
    terminalRunning = true; 
    checkStateIntegrity();
    updateSidebarUI();

    savedScrollTop = window.scrollY || document.documentElement.scrollTop; 
    document.body.style.position = 'fixed'; 
    document.body.style.top = `-${savedScrollTop}px`; 
    document.body.classList.add('no-scroll');
    
    secretOverlay.classList.add('active');
    
    if (!currentTab) switchTab(appState.unlockedTabs[appState.unlockedTabs.length - 1]); 
    else switchTab(currentTab); 
}

function switchTab(type, isReplay = false) {
    checkStateIntegrity();
    if (activeTimer) clearTimeout(activeTimer);

    currentTab = type;
    updateSidebarUI();

    const allContainers = [containers.crash, containers.wake, containers.echo, containers.bloom, containers.gardener];
    allContainers.forEach(con => con.classList.remove('active-log'));
    containers[type].classList.add('active-log');

    if (window.innerWidth <= 700) {
        const wrapper = document.querySelector('.cycles-wrapper');
        const activeBtn = document.querySelector('.cycle-btn.active');
        if (wrapper && activeBtn) {
            const center = (wrapper.clientWidth / 2) - (activeBtn.clientWidth / 2);
            wrapper.scrollTo({ left: activeBtn.offsetLeft - center, behavior: 'smooth' });
        }
    }

    // Logic: If in DB and NOT currently running a replay (isReplay flag), show full.
    // If running a replay (flag is true), processQueue.
    if (appState.finishedLogs.includes(type) && !isReplay) {
        logState[type].finished = true;
        renderFullLog(type); 
    } else {
        processQueue();
    }
}

function replayLog(e, type) {
    // Already handled stopPropagation in listener, but kept for safety
    if (activeTimer) clearTimeout(activeTimer);
    
    containers[type].innerHTML = ""; 
    logState[type].index = 0; 
    logState[type].finished = false;
    
    // Pass TRUE to force typing effect
    switchTab(type, true);
}

function toggleTurbo() { 
    turboMode = !turboMode; 
    logSpeedMultiplier = turboMode ? 0.1 : 1; 
    btnTurbo.innerText = turboMode ? "[ >> ]\nTURBO: ON" : "[ >> ]\nTURBO: OFF"; 
    
    if (turboMode) btnTurbo.classList.add('active'); 
    else btnTurbo.classList.remove('active'); 
}

function toggleMute() { 
    isMuted = !isMuted; 
    btnMute.innerText = isMuted ? "[VOL: OFF]" : "[VOL: ON]"; 
    if (!isMuted) btnMute.classList.add('active'); else btnMute.classList.remove('active'); 
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
    const delay = lineData.delay * logSpeedMultiplier;

    activeTimer = setTimeout(() => { 
        typeLine(lineData.text, lineData.class, containers[currentTab]); 
        if (lineData.text.trim().length > 0) SimpleSynth.playTone(lineData.class);
        
        logState[currentTab].index++; 
        terminalContainer.scrollTop = terminalContainer.scrollHeight;
        
        if (logState[currentTab].index >= logsData[currentTab].length) {
            markLogFinished(currentTab);
        } else {
            processQueue();
        }
    }, delay);
}

function markLogFinished(type) {
    logState[type].finished = true;
    
    if (!appState.finishedLogs.includes(type)) {
        // ONLY SAVE STATE ON FIRST FINISH
        if (!appState.terminalFound) {
             appState.terminalFound = true;
        }
        appState.finishedLogs.push(type);
        
        if (type === 'crash' && !appState.unlockedTabs.includes('echo')) appState.unlockedTabs.push('echo');
        if (type === 'echo' && !appState.unlockedTabs.includes('wake')) appState.unlockedTabs.push('wake');
        if (type === 'wake' && !appState.unlockedTabs.includes('bloom')) appState.unlockedTabs.push('bloom');
        if (type === 'bloom' && !appState.unlockedTabs.includes('gardener')) appState.unlockedTabs.push('gardener');
        
        saveState(); // <--- CRITICAL: Save everything now
        SimpleSynth.playUnlock();
        updateSidebarUI(); 

        let nextTab = null;
        if (type === 'crash') nextTab = 'echo';
        else if (type === 'echo') nextTab = 'wake';
        else if (type === 'wake') nextTab = 'bloom';
        else if (type === 'bloom') nextTab = 'gardener';

        if (nextTab) {
            activeTimer = setTimeout(() => { switchTab(nextTab); }, 1500 * logSpeedMultiplier);
        }
    } else {
        updateSidebarUI();
    }
}

function renderFullLog(type) { 
    containers[type].innerHTML = ""; 
    logsData[type].forEach(line => { typeLine(line.text, line.class, containers[type]); }); 
    setTimeout(() => terminalContainer.scrollTop = terminalContainer.scrollHeight, 100); 
}

function typeLine(htmlText, className, container) { 
    const lineDiv = document.createElement('div'); 
    if (htmlText.includes('----') || htmlText.includes('====')) lineDiv.className = `terminal-line divider-line ${className}`; 
    else lineDiv.className = `terminal-line ${className}`; 
    
    lineDiv.innerHTML = htmlText; 
    lineDiv.classList.add('active'); 
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
    updateInfinityState(); 
    
    // Total Reset
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    updatePlayBtn();

    currentTrackIdx = 0;
    // Load track 0 instantly reveals
    loadTrack(0, false);
    resolveLoadingScramble(domTrackTitle, albumTracks[0].title);
    
    setTimeout(() => { musicSection.scrollIntoView({ behavior: 'smooth' }); }, 100); 
}

// --- REFRESH ON ORIENTATION CHANGE ---
window.addEventListener('resize', () => {
    // Only trigger if we are not currently loading
    if (!isLoading && pdfDoc) {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Re-render current page to fit new width
            const firstPage = document.querySelector('.pdf-page-wrapper');
            if (firstPage) {
                // Determine which page to update (usually visible ones)
                // For simplicity, re-render all visible
                const currentPages = document.querySelectorAll('.pdf-page-wrapper');
                currentPages.forEach((wrapper, idx) => {
                    // We must clear the wrapper content first to avoid stacking
                    wrapper.innerHTML = ''; 
                    
                    // Create new canvas
                    const canvas = document.createElement('canvas');
                    canvas.className = 'pdf-page-canvas';
                    wrapper.appendChild(canvas);
                    
                    // Re-render using existing logic
                    // Note: This calls the same function used in loadDocument
                    // We need to pass the correct page number
                    const pageNum = parseInt(wrapper.id.split('-')[2]); 
                    
                    // Manually trigger the internal render logic of renderPage
                    // We can't call renderPage directly easily because it appends new wrappers
                    // So we reload the document fully to be safe.
                });
                // Actually, easiest way is to reload the document at current index
                loadDocument(currentIndex);
            }
        }, 300); // 300ms debounce
    }
});

// --- LISTENERS ---
// REMOVED: Modulo looping logic. Now strictly +1 or -1.
document.getElementById('next-doc').addEventListener('click', () => { 
    if(!isLoading && currentIndex < library.length - 1) { 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
        loadDocument(currentIndex + 1); 
    }
});

document.getElementById('prev-doc').addEventListener('click', () => { 
    if(!isLoading && currentIndex > 0) { 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
        loadDocument(currentIndex - 1); 
    }
});

// --- IOS ACTIVE STATE HELPER ---
// Standard touch listeners to help CSS handle active states
[document.getElementById('next-doc'), document.getElementById('prev-doc')].forEach(arrow => {
    arrow.addEventListener('touchstart', function() {
        this.classList.add('active-state');
    }, {passive: true});
    
    arrow.addEventListener('touchend', function() {
        this.classList.remove('active-state');
    }, {passive: true});
});

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
        const p = (audioPlayer.currentTime / audioPlayer.duration) * 100; 
        domProgressBar.style.setProperty('--progress', `${p}%`); 
        domCurrentTime.textContent = formatTime(audioPlayer.currentTime); 
        domDuration.textContent = formatTime(audioPlayer.duration); 
    }
    // iOS FIX: Stop loading scramble if playing
    if (loadingScrambleInterval !== null && !audioPlayer.paused && audioPlayer.currentTime > 0) {
        resolveLoadingScramble(domTrackTitle, albumTracks[currentTrackIdx].title);
        shouldAnimateReveal = false;
        if (bufferCheckTimer) clearTimeout(bufferCheckTimer);
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
audioPlayer.addEventListener('waiting', () => { 
    if(bufferCheckTimer) clearTimeout(bufferCheckTimer); 
    bufferCheckTimer = setTimeout(() => { shouldAnimateReveal = true; startLoadingScramble(domTrackTitle); }, 300); 
});
audioPlayer.addEventListener('seeked', () => {
    if (loadingScrambleInterval !== null) {
        resolveLoadingScramble(domTrackTitle, albumTracks[currentTrackIdx].title);
        shouldAnimateReveal = false;
    }
});
audioPlayer.addEventListener('playing', () => { 
    if (bufferCheckTimer) clearTimeout(bufferCheckTimer); 
    if (shouldAnimateReveal) { resolveLoadingScramble(domTrackTitle, albumTracks[currentTrackIdx].title); shouldAnimateReveal = false; } 
});

if (btnShowVoice) { 
    btnShowVoice.addEventListener('click', (e) => { 
        e.preventDefault(); 
        if (isLoading) return; 
        if (currentIndex !== 0) {
            loadDocument(0); 
            pendingScrollPage = 8;
        } else {
            const p8 = document.getElementById('page-wrapper-8'); 
            if (p8) { smartScrollTo(p8); pendingScrollPage = null; } 
            else { pendingScrollPage = 8; }
        }
    }); 
}

infinityBtn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    SimpleSynth.unlock(); 
    if (appState.terminalFound) { launchTerminal(); return; } 
    if (currentIndex !== 2) return; 
    secretClicks++; 
    infinityBtn.style.color = "#ff00ff"; 
    setTimeout(() => infinityBtn.style.color = "", 200); 
    if (secretClicks === 3) { 
        secretClicks = 0; 
        appState.terminalFound = true; // Memory only!
        // No saveState() here - wait for finish!
        updateInfinityState(); 
        launchTerminal(); 
    } 
});

document.addEventListener('keydown', (e) => { 
    const isPlayerVisible = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500; 
    if (e.code === 'Space') { if (isPlayerVisible || terminalRunning) { e.preventDefault(); togglePlay(); } } 
    if (e.code === 'ArrowRight') { if (e.shiftKey) { e.preventDefault(); nextTrack(false); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime += 5; } } 
    if (e.code === 'ArrowLeft') { if (e.shiftKey) { e.preventDefault(); prevTrack(); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime -= 5; } } 
});

function formatTime(s) { if(isNaN(s) || s === Infinity) return "0:00"; const m = Math.floor(s/60); const ss = Math.floor(s%60); return `${m}:${ss<10?'0':''}${ss}`; }

document.getElementById("currentYear").textContent = new Date().getFullYear();

// Init
// FIX: Force left arrow hidden BEFORE loading logic starts to avoid initial flash
const prevArrowEl = document.getElementById('prev-doc');
if(prevArrowEl) prevArrowEl.classList.add('disabled');

initTerminalState(); 
loadDocument(0); 
initPlaylist(); 
loadTrack(0, false); // No animation on boot
setTimeout(() => { scrambleText(domTrackTitle, albumTracks[0].title); }, 500); // Matrix reveal once loaded