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
const containers = { crash: document.getElementById('log-crash'), echo: document.getElementById('log-echo'), wake: document.getElementById('log-wake'), bloom: document.getElementById('log-bloom'), gardener: document.getElementById('log-gardener') };
const btnCycle00 = document.getElementById('btn-cycle-00');
const btnCycleEcho = document.getElementById('btn-cycle-echo');
const btnCycle01 = document.getElementById('btn-cycle-01');
const btnCycleBloom = document.getElementById('btn-cycle-bloom');
const btnCycle02 = document.getElementById('btn-cycle-02');
const btnReset = document.getElementById('btn-reset');
const btnTurbo = document.getElementById('btn-turbo');
const btnMute = document.getElementById('btn-mute');

// -- STATE --
let currentIndex = 0;
let pdfDoc = null;
let lyricsDoc = null;
let isLoading = false;
let renderSession = 0;
let pendingScrollPage = null;
let waitingForLyrics = false;
let resizeTimer = null;

// -- AUDIO STATE --
const audioPlayer = new Audio();
let currentTrackIdx = 0;
let isPlaying = false;
let isDragging = false;
let loopMode = 0;
let voiceScrambleInterval = null; 
let scrollAnimationId = null;

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

const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// -- HELPERS --
function formatTime(s) { if (isNaN(s) || s === Infinity) return "0:00"; const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return `${m}:${ss < 10 ? '0' : ''}${ss}`; }

function updateInfinityState() {
    if (appState.musicUnlocked || currentIndex === 2) { infinityBtn.classList.add('active'); }
    else { infinityBtn.classList.remove('active'); }
}

function killScrollAnimation() {
    if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
        scrollAnimationId = null;
    }
}

function performNavReset() {
    killScrollAnimation();
    window.scrollTo({ top: 0, behavior: 'auto' });
    waitingForLyrics = false;
    if (voiceScrambleInterval) {
        clearInterval(voiceScrambleInterval);
        voiceScrambleInterval = null;
    }
    if (btnShowVoice) {
        btnShowVoice.innerText = "SHOW VOICE";
        btnShowVoice.style.color = "";
    }
}

function smartScrollTo(element) {
    if (!element) return;
    const headerOffset = 80;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;
    window.scrollTo({ top: offsetPosition, behavior: "auto" });
}

function jitterScrollTo(element) {
    if (!element) return;
    killScrollAnimation();
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
        if (timeElapsed < duration) { 
            scrollAnimationId = requestAnimationFrame(animation); 
        } else { 
            window.scrollTo(0, elementTop); 
            scrollAnimationId = null;
        }
    }
    scrollAnimationId = requestAnimationFrame(animation);
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

// -- SCRAMBLE ENGINE --
const ScrambleEngine = {
    interval: null,
    targetElement: null,
    isResolving: false,
    
    // Tracks if we are showing the Alien loop
    isLooping: false,

    loadingGlyphs: "∞⋈⏣⌬⎔⌭⏦⌇∿≋꩜ᚙᚘ⸎۞۝",
    revealGlyphs: "!<>-_\\/[]{}—=+*^?#________",

    // Start Alien Loop
    startLoading: function(element) {
        if (this.targetElement === element && this.isLooping && !this.isResolving) return;
        this.reset();
        this.targetElement = element;
        this.isLooping = true;
        this.isResolving = false;
        
        element.style.color = "var(--name-color)";
        
        const update = () => {
            let text = "";
            for (let i = 0; i < 12; i++) {
                if (i < 7 && Math.random() > 0.85) text += "LOADING"[i] || "";
                else text += this.loadingGlyphs[Math.floor(Math.random() * this.loadingGlyphs.length)];
            }
            element.innerText = text;
        };
        update();
        this.interval = setInterval(update, 60);
    },

    // Transition to Text
    resolve: function(element, finalText) {
        // If already correct, stop
        if (!this.isLooping && element.innerText === finalText) {
             this.snap(element, finalText);
             return;
        }

        this.reset();
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
                this.snap(element, finalText);
            }
            iterations += 1 / 2;
        }, 30);
    },

    // Immediate
    snap: function(element, finalText) {
        this.reset();
        element.innerText = finalText;
        element.style.color = "";
    },

    reset: function() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        this.isResolving = false;
        this.isLooping = false;
        this.targetElement = null;
    },
    clear: function() { this.reset(); }
};

// Legacy
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

// Sound
const SimpleSynthObj = SimpleSynth; // Alias if needed
function unlockAudioEngine() { SimpleSynth.unlock(); }