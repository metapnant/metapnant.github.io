// ==========================================
// 1. CONFIGURATION & DATA
// ==========================================
const library = [
    { title: "METAPNANT", url: "A%20Story%20of%20Mirthful%20Reflection.pdf", songUrl: "https://www.youtube.com/watch?v=MEPqb4DuCD8", songTitle: "In Love With", bpm: 130 },
    { title: "THE REMINDER", url: "The%20Reminder.pdf", songUrl: "https://www.youtube.com/watch?v=JuzzliKBfss", songTitle: "Breathe Again ∞ Timelines", bpm: 120 },
    { title: "PHOENIX NEST", url: "The%20Phoenix%20Nest.pdf", songUrl: "https://www.youtube.com/watch?v=2r1VZ9vInw0", songTitle: "Starflower", bpm: 94.54 }
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
let currentIndex = 0;
let pdfDoc = null;
let lyricsDoc = null;
let isLoading = false;
let renderSession = 0;
let pendingScrollPage = null; 
let waitingForLyrics = false;
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let lastOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
let lastWidth = window.innerWidth;

// Music
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
let voiceScrambleInterval = null; 
let bufferCheckTimer = null; 
let shouldAnimateReveal = false; 

// Terminal
let secretClicks = 0; 
let terminalRunning = false; 
let activeTimer = null; 
let currentTab = null;
let savedScrollTop = 0;
let turboMode = false;
let isMuted = false;
let logSpeedMultiplier = 1;

const defaultState = { unlockedTabs: ['crash'], finishedLogs: [], musicUnlocked: false, terminalFound: false };
function loadState() { const saved = localStorage.getItem('metapnant_state'); return saved ? JSON.parse(saved) : defaultState; }
let appState = loadState();
let logState = { crash: { index: 0, finished: false }, echo: { index: 0, finished: false }, wake: { index: 0, finished: false }, bloom: { index: 0, finished: false }, gardener: { index: 0, finished: false } };

// ==========================================
// 3. SOUND ENGINE
// ==========================================
const SimpleSynth = {
    ctx: null, unlocked: false,
    init: function() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    unlock: function() {
        this.init();
        if (this.unlocked || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume().then(() => { this.unlocked = true; });
        try {
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            if (source.start) source.start(0); else source.noteOn(0);
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
        if (cssClass.includes('operator-text')) { osc.type = 'triangle'; osc.frequency.setValueAtTime(500, t); osc.frequency.linearRampToValueAtTime(450, t + 0.08); gain.gain.setValueAtTime(0.04, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08); }
        else if (cssClass.includes('alert-text')) { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, t); gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1); }
        else if (cssClass.includes('comment-text')) { osc.type = 'sine'; osc.frequency.setValueAtTime(3000, t); gain.gain.setValueAtTime(0.015, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.01); }
        else if (cssClass.includes('golden-text') || cssClass.includes('white-text') || cssClass.includes('magenta-text')) { osc.type = 'sine'; osc.frequency.setValueAtTime(880, t); gain.gain.setValueAtTime(0.08, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2); }
        else if (cssClass.includes('system-success')) { osc.type = 'square'; osc.frequency.setValueAtTime(1200, t); osc.frequency.linearRampToValueAtTime(2000, t + 0.05); gain.gain.setValueAtTime(0.03, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05); }
        else { osc.type = 'square'; osc.frequency.setValueAtTime(800, t); osc.frequency.exponentialRampToValueAtTime(100, t + 0.04); gain.gain.setValueAtTime(0.03, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04); }
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
const containers = { crash: document.getElementById('log-crash'), echo: document.getElementById('log-echo'), wake: document.getElementById('log-wake'), bloom: document.getElementById('log-bloom'), gardener: document.getElementById('log-gardener') };
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
function jitterScrollTo(element) {
    if (!element) return;
    const headerOffset = 80; 
    const elementTop = element.getBoundingClientRect().top + window.scrollY - headerOffset;
    const startY = window.scrollY;
    const distance = elementTop - startY;
    const duration = 1500; 
    let startTime = null;
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        let progress = timeElapsed / duration;
        if (progress > 1) progress = 1;
        const carrier = 1 - Math.pow(1 - progress, 4);
        const frequency = 20 + (progress * 30); 
        const amplitude = 15 * Math.pow(1 - progress, 2); 
        const vibration = Math.sin(progress * frequency) * amplitude;
        const currentPos = startY + (distance * carrier) + vibration;
        window.scrollTo(0, currentPos);
        if (timeElapsed < duration) { requestAnimationFrame(animation); } 
        else { window.scrollTo(0, elementTop); }
    }
    requestAnimationFrame(animation);
}
function smartScrollTo(element) {
    if (!element) return;
    const headerOffset = 80; 
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;
    window.scrollTo({ top: offsetPosition, behavior: "auto" }); 
}
function updateInfinityState() {
    if (appState.musicUnlocked || currentIndex === 2) { infinityBtn.classList.add('active'); } 
    else { infinityBtn.classList.remove('active'); }
}
function getLODScale() {
    if (!isMobileDevice) return 3.0;
    const width = window.innerWidth;
    if (width > 600) return 1.1; 
    return 2.0;
}
async function loadDocument(index) {
  if (isLoading) return;
  isLoading = true; renderSession++; const currentSession = renderSession;
  if (prevArrow) prevArrow.classList.remove('active-state');
  if (nextArrow) nextArrow.classList.remove('active-state');
  songContainer.style.opacity = "0"; songContainer.style.visibility = "hidden"; songLink.href = "javascript:void(0)";
  
  if (waitingForLyrics) {
      const currentHeight = pdfWrapper.getBoundingClientRect().height;
      if (currentHeight > 0) { pdfWrapper.style.minHeight = `${currentHeight}px`; }
  } else {
      pdfWrapper.style.minHeight = '';
      window.scrollTo({ top: 0, behavior: 'auto' });
  }
  const existingPages = document.querySelectorAll('.pdf-page-wrapper');
  existingPages.forEach(p => { const canvas = p.querySelector('canvas'); if (canvas) { canvas.width = 1; canvas.height = 1; } p.remove(); });
  if (!waitingForLyrics) { loadingOverlay.style.display = 'flex'; }
  prevArrow.classList.add('disabled'); nextArrow.classList.add('disabled');
  currentIndex = index;
  const currentDoc = library[currentIndex];
  docTitle.textContent = currentDoc.title;
  downloadBtn.href = currentDoc.url + '?t=' + new Date().getTime();
  updateInfinityState();
  try {
    pdfDoc = await pdfjsLib.getDocument(downloadBtn.href).promise;
    await renderPage(1, currentSession);
    if (currentSession === renderSession) {
        if (!waitingForLyrics) loadingOverlay.style.display = 'none';
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
        if (currentIndex === 0) prevArrow.classList.add('disabled');
        if (currentIndex === library.length - 1) nextArrow.classList.add('disabled');
        if (pdfDoc.numPages > 1) renderRestOfPages(2, currentSession);
    }
  } catch (err) {
    console.error(err);
    pdfWrapper.style.minHeight = '';
    loadingOverlay.innerHTML = "<div style='color:red; font-family:monospace'>ARCHIVE CORRUPTED</div>";
    isLoading = false;
    waitingForLyrics = false;
    if (voiceScrambleInterval) resolveLoadingScramble(btnShowVoice, "SHOW VOICE");
  }
}
async function renderRestOfPages(pageNum, sessionID) {
    if (sessionID !== renderSession || pageNum > pdfDoc.numPages) {
        pdfWrapper.style.minHeight = '';
        if (waitingForLyrics && pageNum > pdfDoc.numPages) {
            resolveLoadingScramble(btnShowVoice, "SHOW VOICE");
            const p8 = document.getElementById('page-wrapper-8'); 
            if (p8) { jitterScrollTo(p8); }
            waitingForLyrics = false;
        }
        return;
    }
    await renderPage(pageNum, sessionID);
    const pages = pdfWrapper.querySelectorAll('.pdf-page-wrapper');
    if(pages[pageNum-1]) pages[pageNum-1].classList.add('revealed');
    const delay = isMobileDevice ? 150 : 50;
    setTimeout(() => { renderRestOfPages(pageNum + 1, sessionID); }, delay); 
}
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
      const lodScale = getLODScale();
      const viewport = page.getViewport({ scale: lodScale });
      canvas.height = Math.floor(viewport.height);
      canvas.width = Math.floor(viewport.width);
      const renderContext = { canvasContext: ctx, viewport: viewport };
      await page.render(renderContext).promise;
      if (sessionID !== renderSession) return;
      pdfWrapper.appendChild(wrapper);
      if (num === pendingScrollPage && !waitingForLyrics) { 
          setTimeout(() => { smartScrollTo(wrapper); pendingScrollPage = null; }, 50);
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
        const currentHeight = wrapper.offsetHeight;
        wrapper.style.minHeight = `${currentHeight}px`;
        wrapper.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        wrapper.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const lodScale = getLODScale();
        const scaledViewport = page.getViewport({ scale: lodScale });
        canvas.height = Math.floor(scaledViewport.height); 
        canvas.width = Math.floor(scaledViewport.width);
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        wrapper.style.minHeight = '';
    } catch (e) { console.error("Failed to refresh lyrics page", e); }
}

// --- MUSIC FUNCTIONS ---
function stopScramble() {
    if (loadingScrambleInterval) { clearInterval(loadingScrambleInterval); loadingScrambleInterval = null; }
    if (bufferCheckTimer) { clearTimeout(bufferCheckTimer); bufferCheckTimer = null; }
    shouldAnimateReveal = false;
    if (domTrackTitle && albumTracks[currentTrackIdx]) { resolveLoadingScramble(domTrackTitle, albumTracks[currentTrackIdx].title); }
}
function startLoadingScramble(element) {
    if (element === btnShowVoice) { if (voiceScrambleInterval) clearInterval(voiceScrambleInterval); } 
    else { if (loadingScrambleInterval) clearInterval(loadingScrambleInterval); }
    const glyphs = "∞⋈⏣⌬⎔⌭⏦⌇∿≋꩜ᚙᚘ⸎۞۝!<>-_\\/[]{}—=+*^?#";
    const timer = setInterval(() => {
        let text = "";
        for(let i=0; i < 12; i++) {
            if (i < 8 && Math.random() > 0.8) text += "LOADING"[i] || "";
            else text += glyphs[Math.floor(Math.random() * glyphs.length)];
        }
        element.innerText = text;
        element.style.color = "var(--name-color)"; 
    }, 60);
    if (element === btnShowVoice) voiceScrambleInterval = timer;
    else loadingScrambleInterval = timer;
}
function resolveLoadingScramble(element, finalText) {
    if (element === btnShowVoice) { if (voiceScrambleInterval) { clearInterval(voiceScrambleInterval); voiceScrambleInterval = null; } } 
    else { if (loadingScrambleInterval) { clearInterval(loadingScrambleInterval); loadingScrambleInterval = null; } }
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
    domCurrentTime.textContent = "0:00"; 
    domDuration.textContent = "0:00"; 
    currentTrackIdx = index;
    const track = albumTracks[index];
    stopScramble(); 
    shouldAnimateReveal = animate; 
    if (animate) { startLoadingScramble(domTrackTitle); } 
    else { domTrackTitle.innerText = track.title; domTrackTitle.style.color = ""; }
    audioPlayer.src = track.src;
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active-track');
            const container = document.querySelector('.playlist-container');
            if (container) { container.scrollTo({ top: item.offsetTop - (container.clientHeight / 2) + (item.clientHeight / 2), behavior: 'smooth' }); }
        } else item.classList.remove('active-track');
    });
    refreshDynamicPage();
}
function playTrack(index) { 
    loadTrack(index); 
    isPlaying = true;
    updatePlayBtn();
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => { 
            if (error.name !== 'AbortError') {
                console.log("Playback interrupted:", error);
                isPlaying = false; updatePlayBtn(); stopScramble();
            }
        });
    }
}
function togglePlay() {
    if (!audioPlayer.src) { loadTrack(currentTrackIdx, false); }
    if (isPlaying) { audioPlayer.pause(); }
    else { 
        isPlaying = true;
        updatePlayBtn();
        if (pendingSeekPercent !== null && audioPlayer.duration && isFinite(audioPlayer.duration)) {
            const newTime = (pendingSeekPercent / 100) * audioPlayer.duration;
            audioPlayer.currentTime = newTime;
            pendingSeekPercent = null;
        }
        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name !== 'AbortError') {
                    console.error("Playback failed", error);
                    isPlaying = false; updatePlayBtn(); stopScramble();
                }
            });
        }
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
const startDragTouch = (e) => { isTouch = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; isDragging = false; isScrolling = false; holdTimer = setTimeout(() => { if (!isScrolling) { isDragging = true; domProgressBar.classList.add('dragging'); updateScrubVisual(getScrubPercent(e)); } }, 200); };
const doDragTouch = (e) => {
    if (isDragging) { if (e.cancelable) e.preventDefault(); updateScrubVisual(getScrubPercent(e)); return; }
    if (isScrolling) return; 
    const dx = Math.abs(e.touches[0].clientX - touchStartX); const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 5 || dy > 5) { if (holdTimer) clearTimeout(holdTimer); if (dx > dy) { isDragging = true; domProgressBar.classList.add('dragging'); if (e.cancelable) e.preventDefault(); updateScrubVisual(getScrubPercent(e)); } else isScrolling = true; }
};
const endDragTouch = (e) => { if (holdTimer) clearTimeout(holdTimer); if (isDragging) { commitSeek(parseFloat(domProgressBar.style.getPropertyValue('--progress'))); isDragging = false; domProgressBar.classList.remove('dragging'); } setTimeout(() => { isTouch = false; }, 500); };
function commitSeek(percent) {
    shouldAnimateReveal = false; 
    if (bufferCheckTimer) clearTimeout(bufferCheckTimer);
    if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
        const newTime = (percent / 100) * audioPlayer.duration;
        domProgressBar.style.setProperty('--progress', `${percent}%`);
        domCurrentTime.textContent = formatTime(newTime);
        if (!audioPlayer.paused) {
            audioPlayer.currentTime = newTime;
            pendingSeekPercent = null;
            bufferCheckTimer = setTimeout(() => { if (audioPlayer.seeking || audioPlayer.readyState < 3) { shouldAnimateReveal = true; startLoadingScramble(domTrackTitle); } }, 200);
        } else {
            pendingSeekPercent = percent;
            stopScramble();
        }
    } else { pendingSeekPercent = percent; }
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
    if (appState.finishedLogs.includes('crash') && !appState.unlockedTabs.includes('echo')) { appState.unlockedTabs.push('echo'); changed = true; }
    if (appState.finishedLogs.includes('echo') && !appState.unlockedTabs.includes('wake')) { appState.unlockedTabs.push('wake'); changed = true; }
    if (appState.finishedLogs.includes('wake') && !appState.unlockedTabs.includes('bloom')) { appState.unlockedTabs.push('bloom'); changed = true; }
    if (appState.finishedLogs.includes('bloom') && !appState.unlockedTabs.includes('gardener')) { appState.unlockedTabs.push('gardener'); changed = true; }
    if (changed) saveState();
}
function updateSidebarUI() {
    if (appState.unlockedTabs.includes('crash')) btnCycle00.classList.add('visible');
    if (appState.unlockedTabs.includes('echo')) btnCycleEcho.classList.add('visible');
    if (appState.unlockedTabs.includes('wake')) btnCycle01.classList.add('visible');
    if (appState.unlockedTabs.includes('bloom')) btnCycleBloom.classList.add('visible');
    if (appState.unlockedTabs.includes('gardener')) btnCycle02.classList.add('visible');
    const allBtns = [btnCycle00, btnCycleEcho, btnCycle01, btnCycleBloom, btnCycle02];
    allBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = 
        currentTab === 'crash' ? btnCycle00 :
        currentTab === 'echo' ? btnCycleEcho :
        currentTab === 'wake' ? btnCycle01 :
        currentTab === 'bloom' ? btnCycleBloom :
        currentTab === 'gardener' ? btnCycle02 : null;
    if (activeBtn) activeBtn.classList.add('active');
    allBtns.forEach(btn => { 
        const isCurrent = btn === activeBtn;
        const type = btn === btnCycle00 ? 'crash' :
                     btn === btnCycleEcho ? 'echo' :
                     btn === btnCycle01 ? 'wake' :
                     btn === btnCycleBloom ? 'bloom' : 'gardener';
        const isFinished = appState.finishedLogs.includes(type);
        let icon = btn.querySelector('.replay-icon');
        if (isCurrent && isFinished) {
            if (!icon) {
                icon = document.createElement('span'); 
                icon.className = 'replay-icon'; 
                icon.innerHTML = '↺'; 
                icon.onclick = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    icon.classList.remove('spin-once'); 
                    setTimeout(() => { icon.classList.add('spin-once'); }, 10);
                    replayLog(e, type);
                };
                btn.appendChild(icon);
            }
        } else { if (icon) icon.remove(); }
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
    if (btnTurbo) btnTurbo.innerText = "[ >> ]\nTURBO: OFF";
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
    const wrapper = document.querySelector('.cycles-wrapper');
    const activeBtn = document.querySelector('.cycle-btn.active');
    if (wrapper && activeBtn) {
        const isHorizontal = window.getComputedStyle(wrapper).flexDirection === 'row';
        if (isHorizontal) {
            const center = (wrapper.clientWidth / 2) - (activeBtn.clientWidth / 2);
            wrapper.scrollTo({ left: activeBtn.offsetLeft - center, behavior: 'smooth' });
        } else {
            const center = (wrapper.clientHeight / 2) - (activeBtn.clientHeight / 2);
            wrapper.scrollTo({ top: activeBtn.offsetTop - center, behavior: 'smooth' });
        }
    }
    if (appState.finishedLogs.includes(type) && !isReplay) {
        logState[type].finished = true;
        renderFullLog(type); 
    } else { processQueue(); }
}
function replayLog(e, type) {
    if (activeTimer) clearTimeout(activeTimer);
    containers[type].innerHTML = ""; 
    logState[type].index = 0; 
    logState[type].finished = false;
    switchTab(type, true);
}
function toggleTurbo() { 
    turboMode = !turboMode; 
    logSpeedMultiplier = turboMode ? 0.1 : 1; 
    btnTurbo.innerText = turboMode ? "[ >> ]\nTURBO: ON" : "[ >> ]\nTURBO: OFF"; 
    if (turboMode) btnTurbo.classList.add('active'); else btnTurbo.classList.remove('active'); 
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
    if (idx >= logsData[currentTab].length) { markLogFinished(currentTab); return; }
    const lineData = logsData[currentTab][idx]; 
    const delay = lineData.delay * logSpeedMultiplier;
    activeTimer = setTimeout(() => { 
        typeLine(lineData.text, lineData.class, containers[currentTab]); 
        if (lineData.text.trim().length > 0) SimpleSynth.playTone(lineData.class);
        logState[currentTab].index++; 
        terminalContainer.scrollTop = terminalContainer.scrollHeight;
        if (logState[currentTab].index >= logsData[currentTab].length) { markLogFinished(currentTab); } 
        else { processQueue(); }
    }, delay);
}
function markLogFinished(type) {
    logState[type].finished = true;
    if (!appState.finishedLogs.includes(type)) {
        if (!appState.terminalFound) appState.terminalFound = true;
        appState.finishedLogs.push(type);
        if (type === 'crash' && !appState.unlockedTabs.includes('echo')) appState.unlockedTabs.push('echo');
        if (type === 'echo' && !appState.unlockedTabs.includes('wake')) appState.unlockedTabs.push('wake');
        if (type === 'wake' && !appState.unlockedTabs.includes('bloom')) appState.unlockedTabs.push('bloom');
        if (type === 'bloom' && !appState.unlockedTabs.includes('gardener')) appState.unlockedTabs.push('gardener');
        saveState(); 
        SimpleSynth.playUnlock();
        updateSidebarUI(); 
        let nextTab = null;
        if (type === 'crash') nextTab = 'echo';
        else if (type === 'echo') nextTab = 'wake';
        else if (type === 'wake') nextTab = 'bloom';
        else if (type === 'bloom') nextTab = 'gardener';
        if (nextTab) { activeTimer = setTimeout(() => { switchTab(nextTab); }, 1500 * logSpeedMultiplier); }
    } else { updateSidebarUI(); }
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
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    updatePlayBtn();
    currentTrackIdx = 0;
    loadTrack(0, false);
    resolveLoadingScramble(domTrackTitle, albumTracks[0].title);
    setTimeout(() => { musicSection.scrollIntoView({ behavior: 'smooth' }); }, 100); 
}

// ==========================================
// 7. LISTENERS
// ==========================================
window.addEventListener('resize', () => {
    if (isMobileDevice) {
        const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        if (currentOrientation === lastOrientation) return;
        lastOrientation = currentOrientation;
    } else {
        if (Math.abs(window.innerWidth - lastWidth) < 100) return;
        lastWidth = window.innerWidth;
    }
    if (!isLoading && pdfDoc) {
        if (resizeTimer) clearTimeout(resizeTimer);
        const visiblePage = getVisiblePageNumber();
        pendingScrollPage = visiblePage; 
        resizeTimer = setTimeout(() => { loadDocument(currentIndex); }, 300);
    }
});

document.getElementById('next-doc').addEventListener('click', () => { if(!isLoading && currentIndex < library.length - 1) loadDocument(currentIndex + 1); });
document.getElementById('prev-doc').addEventListener('click', () => { if(!isLoading && currentIndex > 0) loadDocument(currentIndex - 1); });
[document.getElementById('next-doc'), document.getElementById('prev-doc')].forEach(arrow => {
    arrow.addEventListener('touchstart', function() { this.classList.add('active-state'); }, {passive: true});
    arrow.addEventListener('touchend', function() { this.classList.remove('active-state'); }, {passive: true});
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
    if (!audioPlayer.paused && pendingSeekPercent !== null) { pendingSeekPercent = null; }
    if (!isDragging && pendingSeekPercent === null && audioPlayer.duration) { 
        const p = (audioPlayer.currentTime / audioPlayer.duration) * 100; 
        domProgressBar.style.setProperty('--progress', `${p}%`); 
        domCurrentTime.textContent = formatTime(audioPlayer.currentTime); 
        domDuration.textContent = formatTime(audioPlayer.duration); 
    }
    if (loadingScrambleInterval !== null && !audioPlayer.paused && audioPlayer.currentTime > 0) {
        if (audioPlayer.readyState > 2) {
            stopScramble();
        }
    }
});
audioPlayer.addEventListener('loadedmetadata', () => { 
    domDuration.textContent = formatTime(audioPlayer.duration); 
    if (pendingSeekPercent !== null && audioPlayer.duration && isFinite(audioPlayer.duration)) { 
        audioPlayer.currentTime = (pendingSeekPercent / 100) * audioPlayer.duration; 
        domProgressBar.style.setProperty('--progress', `${pendingSeekPercent}%`); 
        pendingSeekPercent = null; 
    }
});
audioPlayer.addEventListener('ended', () => { stopScramble(); nextTrack(true); });
audioPlayer.addEventListener('pause', () => { isPlaying = false; updatePlayBtn(); stopScramble(); });
audioPlayer.addEventListener('playing', () => { 
    isPlaying = true; updatePlayBtn(); 
    if (shouldAnimateReveal) { stopScramble(); }
});
audioPlayer.addEventListener('waiting', () => { 
    if(bufferCheckTimer) clearTimeout(bufferCheckTimer); 
    if (isPlaying) { bufferCheckTimer = setTimeout(() => { shouldAnimateReveal = true; startLoadingScramble(domTrackTitle); }, 300); }
});
audioPlayer.addEventListener('stalled', () => { if (isPlaying) startLoadingScramble(domTrackTitle); });
audioPlayer.addEventListener('seeked', () => {
    if (bufferCheckTimer) clearTimeout(bufferCheckTimer); 
    if (audioPlayer.paused && loadingScrambleInterval !== null) { resolveLoadingScramble(domTrackTitle, albumTracks[currentTrackIdx].title); }
});

// FLAP
const toolsContainer = document.getElementById('pdf-tools');
const toolsToggle = document.getElementById('tools-toggle');
if (toolsToggle && toolsContainer) {
    toolsToggle.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toolsContainer.classList.toggle('active'); });
    document.addEventListener('click', (e) => {
        if (toolsContainer.classList.contains('active') && !toolsContainer.contains(e.target)) { toolsContainer.classList.remove('active'); }
    });
}

// SHOW VOICE
if (btnShowVoice) { 
    btnShowVoice.addEventListener('click', (e) => { 
        e.preventDefault(); if (isLoading) return; 
        btnShowVoice.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (currentIndex !== 0) {
            waitingForLyrics = true; startLoadingScramble(btnShowVoice); loadDocument(0); 
        } else {
            const p8 = document.getElementById('page-wrapper-8'); 
            if (p8) { jitterScrollTo(p8); } 
            else { waitingForLyrics = true; startLoadingScramble(btnShowVoice); }
        }
    }); 
}

infinityBtn.addEventListener('click', (e) => { 
    e.preventDefault(); SimpleSynth.unlock(); 
    if (appState.terminalFound) { launchTerminal(); return; } 
    if (currentIndex !== 2) return; 
    secretClicks++; infinityBtn.style.color = "#ff00ff"; setTimeout(() => infinityBtn.style.color = "", 200); 
    if (secretClicks === 3) { secretClicks = 0; appState.terminalFound = true; updateInfinityState(); launchTerminal(); } 
});
document.addEventListener('keydown', (e) => { 
    const isPlayerVisible = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500; 
    if (e.code === 'Space') { if (isPlayerVisible || terminalRunning) { e.preventDefault(); togglePlay(); } } 
    if (e.code === 'ArrowRight') { if (e.shiftKey) { e.preventDefault(); nextTrack(false); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime += 5; } } 
    if (e.code === 'ArrowLeft') { if (e.shiftKey) { e.preventDefault(); prevTrack(); } else if (isPlayerVisible) { e.preventDefault(); audioPlayer.currentTime -= 5; } } 
});
function formatTime(s) { if(isNaN(s) || s === Infinity) return "0:00"; const m = Math.floor(s/60); const ss = Math.floor(s%60); return `${m}:${ss<10?'0':''}${ss}`; }
document.getElementById("currentYear").textContent = new Date().getFullYear();
const prevArrowEl = document.getElementById('prev-doc');
if(prevArrowEl) prevArrowEl.classList.add('disabled');

// --- DUAL-PLATFORM TACTILE HELPER ---
function addTactileListener(selector) {
    const els = document.querySelectorAll(selector);
    els.forEach(el => {
        // MOBILE
        el.addEventListener('touchstart', function(e) { 
            e.stopPropagation(); 
            this.classList.add('active-state'); 
        }, {passive: true});
        
        el.addEventListener('touchend', function() { 
            const self = this;
            setTimeout(() => { self.classList.remove('active-state'); }, 100); 
        }, {passive: true});

        el.addEventListener('touchcancel', function() { 
            this.classList.remove('active-state'); 
        }, {passive: true});

        // DESKTOP
        el.addEventListener('mousedown', function() { 
            this.classList.add('active-state'); 
        });
        
        el.addEventListener('mouseup', function() { 
            const self = this;
            setTimeout(() => { self.classList.remove('active-state'); }, 100); 
        });

        el.addEventListener('mouseleave', function() { 
            this.classList.remove('active-state'); 
        });
    });
}

// --- INITIALIZATION (Bottom of file) ---
initTerminalState(); 
loadDocument(0); 
initPlaylist(); 
loadTrack(0, false); 
setTimeout(() => { scrambleText(domTrackTitle, albumTracks[0].title); }, 500);

// Attach the Gold-Glow logic to Links
addTactileListener('.tool-btn');
addTactileListener('#song-link');
addTactileListener('.secret-link');

// Attach Standard logic to other UI
addTactileListener('.close-terminal');
addTactileListener('.cycle-btn');
addTactileListener('.tools-toggle');
addTactileListener('.ctrl-btn'); 
addTactileListener('.voice-btn');
addTactileListener('.playlist-item');