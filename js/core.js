// ==========================================
// CORE.JS - GLOBAL STATE & SHARED HELPERS
// ==========================================

// -- DOM ELEMENTS --
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
    crash: document.getElementById('log-crash'), 
    echo: document.getElementById('log-echo'), 
    wake: document.getElementById('log-wake'), 
    bloom: document.getElementById('log-bloom'), 
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

// -- PDF STATE --
let currentIndex = 0;
let pdfDoc = null;
let lyricsDoc = null;
let isLoading = false;
let renderSession = 0;
let pendingScrollPage = null;
let waitingForLyrics = false;
let resizeTimer = null;

// -- MOBILE DETECTION --
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let lastOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
let lastWidth = window.innerWidth;

// -- MUSIC STATE --
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
let isSwitchingTrack = false; 
let isSeeking = false; // NEW: Tracks if we are waiting for the browser to seek

// -- ANIMATION STATE --
let voiceScrambleInterval = null; 
let bufferDebounceTimer = null; 

// -- TERMINAL STATE --
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

// -- SOUND ENGINE --
const SimpleSynth = {
    ctx: null, unlocked: false,
    init: function () { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    unlock: function () {
        this.init();
        if (this.unlocked || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume().then(() => { this.unlocked = true; });
        try {
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            if (source.start) source.start(0); else if (source.noteOn) source.noteOn(0);
            this.unlocked = true;
        } catch (e) { console.error(e); }
    },
    playTone: function (cssClass) {
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
    playUnlock: function () {
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

// -- SHARED HELPERS --
function formatTime(s) { if (isNaN(s) || s === Infinity) return "0:00"; const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return `${m}:${ss < 10 ? '0' : ''}${ss}`; }

function updateInfinityState() {
    if (appState.musicUnlocked || currentIndex === 2) { infinityBtn.classList.add('active'); }
    else { infinityBtn.classList.remove('active'); }
}

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

function getVisiblePageNumber() {
    const pages = document.querySelectorAll('.pdf-page-wrapper');
    if (!pages.length) return 1;
    let maxVisibility = 0;
    let bestPageNum = 1;
    const viewportHeight = window.innerHeight;
    pages.forEach((page) => {
        const rect = page.getBoundingClientRect();
        const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
        if (visibleHeight > maxVisibility) {
            maxVisibility = visibleHeight;
            const idParts = page.id.split('-');
            if (idParts.length === 3) {
                bestPageNum = parseInt(idParts[2]);
            }
        }
    });
    return bestPageNum;
}

// ==========================================
// SCRAMBLE ENGINE
// ==========================================

const ScrambleEngine = {
    interval: null,
    targetElement: null,
    isResolving: false,
    isLooping: false,

    loadingGlyphs: "∞⋈⏣⌬⎔⌭⏦⌇∿≋꩜ᚙᚘ⸎۞۝",
    revealGlyphs: "!<>-_\\/[]{}—=+*^?#________",

    startLoading: function(element) {
        if (this.targetElement === element && this.interval && !this.isResolving) return;
        this.clear();
        this.targetElement = element;
        this.isLooping = true;
        this.isResolving = false;
        
        element.style.color = "var(--name-color)";
        
        this.interval = setInterval(() => {
            let text = "";
            for (let i = 0; i < 12; i++) {
                if (i < 7 && Math.random() > 0.85) text += "LOADING"[i] || "";
                else text += this.loadingGlyphs[Math.floor(Math.random() * this.loadingGlyphs.length)];
            }
            element.innerText = text;
        }, 60);
    },

    resolve: function(element, finalText) {
        if (!this.isLooping && element.innerText === finalText) {
             this.snap(element, finalText);
             return;
        }
        this.clear();
        this.targetElement = element;
        this.isResolving = true;
        this.isLooping = false;
        
        let iterations = 0;
        element.style.color = "var(--name-color)"; 

        this.interval = setInterval(() => {
            element.innerText = finalText.split("").map((letter, index) => {
                if (index < iterations) return finalText[index];
                return this.revealGlyphs[Math.floor(Math.random() * this.revealGlyphs.length)];
            }).join("");

            if (iterations >= finalText.length) {
                this.clear();
                element.innerText = finalText; 
                element.style.color = ""; 
            }
            iterations += 1 / 2;
        }, 30);
    },

    snap: function(element, finalText) {
        this.clear();
        this.isLooping = false;
        element.innerText = finalText;
        element.style.color = "";
    },

    clear: function() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isResolving = false;
        this.isLooping = false;
        this.targetElement = null;
    }
};

function startLoadingScramble(element) {
    if (element === btnShowVoice) { if (voiceScrambleInterval) clearInterval(voiceScrambleInterval); }
    const glyphs = "∞⋈⏣⌬⎔⌭⏦⌇∿≋꩜ᚙᚘ⸎۞۝!<>-_\\/[]{}—=+*^?#";
    const timer = setInterval(() => {
        let text = "";
        for (let i = 0; i < 12; i++) {
            if (i < 7 && Math.random() > 0.8) text += "LOADING"[i] || "";
            else text += glyphs[Math.floor(Math.random() * glyphs.length)];
        }
        element.innerText = text;
        element.style.color = "var(--name-color)";
    }, 60);
    if (element === btnShowVoice) voiceScrambleInterval = timer;
}

function resolveLoadingScramble(element, finalText) {
    if (element === btnShowVoice) { 
        if (voiceScrambleInterval) { clearInterval(voiceScrambleInterval); voiceScrambleInterval = null; } 
        const chars = "!<>-_\\/[]{}—=+*^?#________";
        let iterations = 0;
        const interval = setInterval(() => {
            element.innerText = finalText.split("").map((letter, index) => {
                if (index < iterations) return finalText[index];
                return chars[Math.floor(Math.random() * chars.length)];
            }).join("");
            if (iterations >= finalText.length) {
                clearInterval(interval);
                element.style.color = "";
            }
            iterations += 1 / 3;
        }, 30);
    } else {
        ScrambleEngine.resolve(element, finalText);
    }
}