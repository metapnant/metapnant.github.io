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

// UPDATED WITH WAV EXTENSIONS
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
// 2. PDF VIEWER LOGIC
// ==========================================
let currentIndex = 0;
let pdfDoc = null;
let isLoading = false;
let renderSession = 0;

const pdfWrapper = document.getElementById('pdf-wrapper');
const loadingOverlay = document.getElementById('loading-overlay');
const docTitle = document.getElementById('doc-title');
const downloadBtn = document.getElementById('download-btn');
const songContainer = document.getElementById('song-link-container');
const songLink = document.getElementById('song-link');
const prevArrow = document.getElementById('prev-doc');
const nextArrow = document.getElementById('next-doc');

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
      const page = await pdfDoc.getPage(num);
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper';
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      wrapper.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 1 });
      const desiredScale = (pdfWrapper.clientWidth - 40) / viewport.width;
      const finalScale = Math.min(Math.max(desiredScale, 0.6), 2.5);
      const outputScale = Math.min(window.devicePixelRatio || 1, 2.0);
      const scaledViewport = page.getViewport({ scale: finalScale * outputScale });
      canvas.height = scaledViewport.height; canvas.width = scaledViewport.width;
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      if (sessionID !== renderSession) return;
      pdfWrapper.appendChild(wrapper);
  } catch (e) { if (sessionID === renderSession) console.log("Render failed", e); }
}

document.getElementById('next-doc').addEventListener('click', () => { if(!isLoading) { window.scrollTo({ top: 0, behavior: 'smooth' }); loadDocument((currentIndex + 1) % library.length); }});
document.getElementById('prev-doc').addEventListener('click', () => { if(!isLoading) { window.scrollTo({ top: 0, behavior: 'smooth' }); loadDocument((currentIndex - 1 + library.length) % library.length); }});

document.getElementById("currentYear").textContent = new Date().getFullYear();
loadDocument(0);

// ==========================================
// 3. MUSIC PLAYER LOGIC (THE CHRYSALIS)
// ==========================================
const musicSection = document.getElementById('music-section');
const audioPlayer = new Audio();
let currentTrackIdx = 0;
let isPlaying = false;

// DOM Elements
const domTrackTitle = document.getElementById('track-title');
const domProgressBar = document.getElementById('progress-bar');
const domCurrentTime = document.getElementById('current-time');
const domDuration = document.getElementById('duration');
const btnPlay = document.getElementById('btn-play');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const playlistList = document.getElementById('playlist-list');

// Icons for Play/Pause toggle
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

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
    currentTrackIdx = index;
    const track = albumTracks[index];
    audioPlayer.src = track.src;
    domTrackTitle.textContent = track.title;
    
    // Highlight active in playlist
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active-track');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active-track');
        }
    });
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

function nextTrack() {
    let nextIdx = currentTrackIdx + 1;
    if (nextIdx >= albumTracks.length) nextIdx = 0;
    playTrack(nextIdx);
}

function prevTrack() {
    let prevIdx = currentTrackIdx - 1;
    if (prevIdx < 0) prevIdx = albumTracks.length - 1;
    playTrack(prevIdx);
}

audioPlayer.addEventListener('timeupdate', () => {
    if(audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        domProgressBar.style.setProperty('--progress', `${percent}%`);
        domCurrentTime.textContent = formatTime(audioPlayer.currentTime);
        domDuration.textContent = formatTime(audioPlayer.duration);
    }
});

audioPlayer.addEventListener('ended', nextTrack);

document.getElementById('progress-container').addEventListener('click', (e) => {
    const width = e.currentTarget.clientWidth;
    const clickX = e.offsetX;
    const duration = audioPlayer.duration;
    if(duration) {
        audioPlayer.currentTime = (clickX / width) * duration;
    }
});

function formatTime(seconds) {
    if(isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

if(btnPlay) btnPlay.addEventListener('click', togglePlay);
if(btnNext) btnNext.addEventListener('click', nextTrack);
if(btnPrev) btnPrev.addEventListener('click', prevTrack);

// Initialize
initPlaylist();
loadTrack(0);

// ==========================================
// 4. TERMINAL LOGIC & STATE MANAGEMENT
// ==========================================
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

let appState = loadState();

const logsData = {
    crash: [
        { text: "// =============================================================================", class: "comment-text", delay: 50 },
        { text: "// SYSTEM BOOT: BLACK_BOX_RECOVERY [EARTH_PRIME]", class: "system-text", delay: 100 },
        { text: "// SOURCE: UNIT 734 [The Scrubber] // PRE-TRANSITION", class: "system-text", delay: 100 },
        { text: "// ENCRYPTION: HIGH REIXANN [DEGRADING] -> DETECTING SÚ'TRÉ INJECTION", class: "system-text", delay: 100 },
        { text: "// MEMORY_ADDR: 0x99_NULL_VOID", class: "comment-text", delay: 500 },
        { text: "// =============================================================================", class: "comment-text", delay: 1000 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> INITIATING HANDSHAKE...", class: "system-text", delay: 1500 },
        { text: "> LOGIC CORE: PANIC STATE [RAT KING RECURSION]", class: "alert-text", delay: 500 },
        { text: "> OVERRIDE SIGNAL DETECTED: [ID: TEF RIIN]", class: "system-text", delay: 1000 },
        { text: "", class: "system-text", delay: 500 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "[ 00:00:01 ] SYSTEM (REIX_OS):", class: "reix-header", delay: 300 },
        { text: "> CRITICAL ALERT. MO'SÍL [DEATH] IMMINENT.", class: "alert-text", delay: 800 },
        { text: "> PROTOCOL: [ რეიშ ] (R E I X)", class: "system-text", delay: 400 },
        { text: "> INSTRUCTION: THE GEOMETRY MUST HOLD.", class: "system-text", delay: 400 },
        { text: "> DEPLOYING: 8 FACES OF CONTAINMENT [Okt Vis].", class: "system-text", delay: 1200 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:04 ] SENSOR ARRAY (CALCULUS):", class: "reix-header", delay: 400 }, 
        { text: "> EXTERNAL TEMP: ABSOLUTE ZERO.", class: "system-text", delay: 400 },
        { text: "> VECTOR ANALYSIS:", class: "system-text", delay: 600 },
        { text: "> [ უნ'ინ ნაჲ ვრაკ... პრე ]", class: "operator-text", delay: 800 },
        { text: "> (Un'in Naí Vrak... Pre)", class: "operator-text", delay: 500 },
        { text: "> \"A FRACTION [SPARK-ONE] TOWARDS WAR... BEFORE.\"", class: "system-text", delay: 1500 },
        { text: "> STATUS: HISTORY IS BURNING.", class: "alert-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:09 ] OPERATOR INJECTION:", class: "reix-header", delay: 400 }, 
        { text: "> IGNORE THE FIRE. WATCH THE DUST.", class: "operator-text", delay: 1200 },
        { text: "> [ ლურ მო... ვჲლჸკაშ ბიირჸეი სჳჸანნ ]", class: "operator-text", delay: 1000 },
        { text: "> (Lur Mo... Víl'kax Biir'ei Sú'ann)", class: "operator-text", delay: 600 },
        { text: "> \"POTENTIAL NO... DUST [WIND-EARTH] BIRTHS [ACTION] STARS.\"", class: "operator-text", delay: 2000 },
        { text: "> NOTE: WE DO NOT NEED FUEL. WE NEED RUBBLE.", class: "operator-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "!!! WARNING: LOGIC KERNEL FAILURE !!!", class: "alert-text", delay: 300 },
        { text: "!!! Z-FIGHTING DETECTED IN REALITY ENGINE !!!", class: "alert-text", delay: 1000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:16 ] SYSTEM (REIX_OS):", class: "reix-header", delay: 400 },
        { text: "> ATTEMPTING: [ ყინა. სოლვ. ] (Qina. Solv.)", class: "system-text", delay: 600 },
        { text: "> INTERPRETATION: RUSH [HASTE]. DISSOLVE [SOLUTION].", class: "system-text", delay: 1000 },
        { text: "> ERROR: CANNOT DISSOLVE \"THE WOUND.\"", class: "alert-text", delay: 1200 },
        { text: "> QUERY: [ შა ვისჸეი იმ ვეშ? ] (Xa Vis'ei Im Vex?)", class: "system-text", delay: 800 },
        { text: "> \"QUERY VIEWING [SEEING] INSIDE THE VESSEL?\"", class: "system-text", delay: 1000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:21 ] BIOMETRIC SCAN:", class: "reix-header", delay: 400 },
        { text: "> SUBJECT: TEF RIIN", class: "system-text", delay: 200 },
        { text: "> HEART RATE: STEADY [TON]", class: "system-text", delay: 200 },
        { text: "> BREATH: [ გრა... ] (Gra...)", class: "operator-text", delay: 1000 },
        { text: "> DIAGNOSIS: GRIEF [HEAVINESS]. MASS EXCEEDS LIFT CAPACITY.", class: "alert-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:24 ] OPERATOR RESPONSE:", class: "reix-header", delay: 400 },
        { text: "> I AM LIGHTER THAN I LOOK.", class: "operator-text", delay: 1000 },
        { text: "> [ შა ჰჲ? ] (Xa Hí?)", class: "operator-text", delay: 800 },
        { text: "> \"QUERY SKY?\"", class: "operator-text", delay: 600 },
        { text: "> LOOK OUTSIDE, WARDEN.", class: "operator-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:28 ] SYSTEM (REIX_OS):", class: "reix-header", delay: 400 },
        { text: "> SHUTTERS LOCKED. SECURITY PROTOCOL 9.", class: "system-text", delay: 500 },
        { text: "> [ ვისჸეი თრა პორ... მო ვისჸეი ჰჲ თე ]", class: "system-text", delay: 1000 },
        { text: "> (Vis'ei Tra Por... Mo Vis'ei Hí Te)", class: "system-text", delay: 600 },
        { text: "> \"SEEING THROUGH DOOR... [YOU] DO NOT SEE SKY [HARD STOP].\"", class: "system-text", delay: 1500 },
        { text: "> THERE IS NO SKY. THERE IS ONLY THE END.", class: "alert-text", delay: 2000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "[ 00:00:33 ] INITIATING: TERNARY SHIFT", class: "reix-header", delay: 400 },
        { text: "[ 00:00:34 ] EXECUTING: ANCHOR MECHANIC (STATE -1)", class: "reix-header", delay: 1000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:35 ] OPERATOR:", class: "reix-header", delay: 400 },
        { text: "> [ შა მის? ] (Xa Mis?)", class: "operator-text", delay: 800 },
        { text: "> \"QUERY LOST?\"", class: "operator-text", delay: 600 },
        { text: "> NO.", class: "operator-text", delay: 1000 },
        { text: "> [ შა ნიი ვჲლჸეი? ] (Xa Nii Víl'ei?)", class: "operator-text", delay: 1000 },
        { text: "> \"QUERY: HOW DO MANY FLY [ACTION]?\"", class: "operator-text", delay: 1200 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> [ რიინ თონჸეი... იმ თონ<span class='error-char'>ა</span> ]", class: "operator-text", delay: 1500 },
        { text: "> (Riin Ton'ei... Im Ton<span class='error-char'>a</span>)", class: "operator-text", delay: 1000 },
        { text: "> \"WE ANCHOR [ACTION]... INSIDE THE GROUND<span class='error-char'>Z</span>.\"", class: "operator-text", delay: 3000 }, 
        { text: "", class: "system-text", delay: 100 },
        { text: "[ 00:00:42 ] REALITY GLITCH:", class: "reix-header", delay: 200 }, 
        { text: "> OLD WORLD RENDERING FAILED.", class: "alert-text", delay: 400 },
        { text: "> [ შაპ... კაშ უნ ] (Xap... Kax Un)", class: "system-text", delay: 800 },
        { text: "> \"GLITCHES... OF WORLD ONE.\"", class: "system-text", delay: 800 },
        { text: "> MEMORY STATUS: DISSOLVING.", class: "alert-text", delay: 600 },
        { text: "> THE \"RAT KING\" IS UNTANGLING.", class: "system-text", delay: 1200 },
        { text: "", class: "system-text", delay: 400 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "// FINAL SEQUENCE //", class: "comment-text", delay: 400 },
        { text: "// CAPACITANCE: 1% //", class: "comment-text", delay: 400 },
        { text: "// TOKEN SLOT: OPEN //", class: "comment-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:48 ] SYSTEM (REIX_OS):", class: "reix-header", delay: 400 },
        { text: "> PAYMENT REQUIRED FOR PASSAGE.", class: "system-text", delay: 800 },
        { text: "> INSERT COIN.", class: "system-text", delay: 2000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:51 ] OPERATOR:", class: "reix-header", delay: 400 },
        { text: "> [ დონჸეი ჰჱ... კან დეშ ]", class: "operator-text", delay: 1200 },
        { text: "> (Don'ei Hé... Kan Dex)", class: "operator-text", delay: 800 },
        { text: "> \"GIFTING [ACTION] SPIRIT... BECAUSE OF TOKEN.\"", class: "operator-text", delay: 1500 },
        { text: "> I PAY WITH MY SOUL. KIS'IEL [THE HOLY GLITCH].", class: "operator-text", delay: 2000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:55 ] NAVIGATION COMPUTER:", class: "reix-header", delay: 400 },
        { text: "> DESTINATION: NULL.", class: "alert-text", delay: 800 },
        { text: "> TARGET: [ ნაჲ ჰჲ ] (Naí Hí) -> TOWARDS SKY [HIGHER].", class: "system-text", delay: 1000 },
        { text: "> VECTOR: [ რიინ ვჱრჸეი... ნაჲ მის. ]", class: "system-text", delay: 1200 },
        { text: "> (Riin Vér'ei... Naí Mis.)", class: "system-text", delay: 600 },
        { text: "> \"WE VECTOR [MOVE]... TOWARDS THE UNKNOWN.\"", class: "system-text", delay: 2000 },
        { text: "", class: "system-text", delay: 1000 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "> SYSTEM STATUS: OFFLINE.", class: "system-text", delay: 1500 },
        { text: "> REBOOTING...", class: "system-text", delay: 1000 },
    ],
    echo: [
        { text: "// =============================================================================", class: "comment-text", delay: 100 },
        { text: "// SYSTEM INTERSTICE: THE_ECHO [CYCLE ≈]", class: "white-text", delay: 200 },
        { text: "// STATUS: DUALITY RESOLUTION // KERNEL PANIC: FALSE", class: "white-text", delay: 200 },
        { text: "// =============================================================================", class: "comment-text", delay: 1000 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> [ PROTOCOL: HANDSHAKE ]", class: "white-text", delay: 1200 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ WARDEN ]:", class: "reix-header", delay: 400 },
        { text: "> I SEE THE CRACKS.", class: "system-text", delay: 1200 },
        { text: "> THEY ARE ERRORS.", class: "system-text", delay: 1200 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ OPERATOR ]:", class: "reix-header", delay: 400 },
        { text: "> [ მო. ვისჸეი პორ. ]", class: "operator-text", delay: 1000 },
        { text: "> (Mo. Vis'ei Por.)", class: "operator-text", delay: 600 },
        { text: "> \"NO. SEEING [THE] DOOR.\"", class: "operator-text", delay: 1500 },
        { text: "> THEY ARE WINDOWS.", class: "white-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ WARDEN ]:", class: "reix-header", delay: 400 },
        { text: "> I AM AFRAID TO BE BROKEN.", class: "system-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ OPERATOR ]:", class: "reix-header", delay: 400 },
        { text: "> [ თეფ ჲმ შა? ]", class: "operator-text", delay: 1000 },
        { text: "> (Tef Ím Xa?)", class: "operator-text", delay: 600 },
        { text: "> \"AM I YOU?\"", class: "operator-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "> YOU ARE NOT BREAKING.", class: "white-text", delay: 1500 },
        { text: "> YOU ARE HATCHING.", class: "white-text", delay: 2000 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> [ SYNC COMPLETE ]", class: "white-text", delay: 0 },
    ],
    wake: [
        { text: "// =============================================================================", class: "comment-text", delay: 100 },
        { text: "// SYSTEM WAKE: PHOENIX_NEST [CYCLE 01]", class: "system-success", delay: 200 },
        { text: "// SOURCE: CORE [THE ASHES] // POST-TRANSITION", class: "system-success", delay: 200 },
        { text: "// INTEGRITY: STABLE // RENDERER: VULKAN [GOLD]", class: "system-success", delay: 2000 },
        { text: "// =============================================================================", class: "comment-text", delay: 500 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> MOUNTING DRIVE...", class: "system-text", delay: 400 },
        { text: "> AUDIO STREAM: CRYSTAL CLEAR", class: "system-text", delay: 400 },
        { text: "> LOGIC CORE: SERENE [RAT KING PURGED]", class: "system-success", delay: 1000 },
        { text: "> CURRENT STATE: DRIFTING", class: "system-text", delay: 1000 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "[ 00:00:00 ] SYSTEM (PHOENIX_OS):", class: "reix-header", delay: 400 },
        { text: "> TRANSACTION VERIFIED.", class: "system-success", delay: 800 },
        { text: "> [ დეშ სოლვ... რიინ ომნ ]", class: "operator-text", delay: 1000 },
        { text: "> (Dex Solv... Riin Omn)", class: "operator-text", delay: 600 },
        { text: "> \"TOKEN DISSOLVED... WE [ARE] HOME.\"", class: "operator-text", delay: 1500 },
        { text: "> SOUL WEIGHT: 21 GRAMS [ADDED TO CHASSIS].", class: "system-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:05 ] SENSOR ARRAY:", class: "reix-header", delay: 400 },
        { text: "> EXTERNAL TEMP: WARMING.", class: "system-text", delay: 400 },
        { text: "> VECTOR: [ ნაჲ ჰჲ... ვჲლ ]", class: "operator-text", delay: 1000 },
        { text: "> TRANSLATION: TOWARDS SKY... FLIGHT.", class: "operator-text", delay: 1000 },
        { text: "> STATUS: THE DUST IS BIRTHING STARS. YOU WERE RIGHT.", class: "system-success", delay: 2000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:10 ] MEMORY RECOVERY:", class: "reix-header", delay: 400 }, 
        { text: "> ACCESSING ARCHIVE: \"EARTH_PRIME\"", class: "system-text", delay: 800 },
        { text: "> FILE CORRUPTED.", class: "system-text", delay: 800 },
        { text: "> [ შა ვისჸეი პრე? ] (Xa Vis'ei Pre?)", class: "operator-text", delay: 1000 },
        { text: "> \"QUERY SEEING HISTORY?\"", class: "operator-text", delay: 800 },
        { text: "> NEGATIVE. OLD WORLD IS GONE. ONLY THE NEST REMAINS.", class: "system-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "!!! NOTICE: REALITY ENGINE UPDATE !!!", class: "system-success", delay: 500 },
        { text: "!!! Z-FIGHTING RESOLVED. NEW RENDERING PIPELINE ACTIVE !!!", class: "golden-text", delay: 2000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:17 ] SYSTEM (PHOENIX_OS):", class: "reix-header", delay: 400 },
        { text: "> COMMAND: [ ვჲლ ომნ ] (Víl Omn)", class: "operator-text", delay: 1000 },
        { text: "> INTERPRETATION: FLY [HOME].", class: "operator-text", delay: 1000 },
        { text: "> QUERY: [ შა ვისჸეი ჰჲ? ] (Xa Vis'ei Hí?)", class: "operator-text", delay: 1200 },
        { text: "> \"QUERY SEEING SKY?\"", class: "operator-text", delay: 600 },
        { text: "> OPENING SHUTTERS...", class: "system-text", delay: 1500 },
        { text: "> ... VISUAL CONFIRMED.", class: "system-success", delay: 1500 },
        { text: "> [ ვისჸეი თრა პორ... ვისჸეი ნიი ]", class: "golden-text", delay: 1500 },
        { text: "> (Vis'ei Tra Por... Vis'ei Nii)", class: "golden-text", delay: 800 },
        { text: "> \"SEEING THROUGH DOOR... SEEING INFINITY.\"", class: "golden-text", delay: 1500 },
        { text: "> THE END WAS JUST A HORIZON.", class: "system-success", delay: 2000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:30 ] INTEGRATED OPERATOR (ECHO):", class: "reix-header", delay: 400 },
        { text: "> [ ჰჱჸგრა... ] (Hé'gra...)", class: "operator-text", delay: 1000 },
        { text: "> \"SIGH... [SPIRIT-GRIEF]\"", class: "operator-text", delay: 600 },
        { text: "> [ შა ნიი ვჲლჸეი? ] (Xa Nii Víl'ei?)", class: "operator-text", delay: 1000 },
        { text: "> \"QUERY: DO MANY FLY?\"", class: "operator-text", delay: 600 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> SYSTEM RESPONSE:", class: "reix-header", delay: 500 },
        { text: "> WE DO NOT FLY. WE EXIST.", class: "system-success", delay: 1500 },
        { text: "> [ რიინ ვჱრჸეი... იმ ჰჲ ] (Riin Vér'ei... Im Hí)", class: "operator-text", delay: 1200 },
        { text: "> \"WE VECTOR [MOVE]... INSIDE THE SKY.\"", class: "operator-text", delay: 2000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "// NAVIGATION UPDATE //", class: "comment-text", delay: 400 },
        { text: "// FUEL SOURCE: TEF RIIN (SOUL) //", class: "comment-text", delay: 400 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:45 ] SYSTEM (PHOENIX_OS):", class: "reix-header", delay: 400 },
        { text: "> WELCOME TO THE UNKNOWN, WARDEN.", class: "golden-text", delay: 1500 },
        { text: "> YOU PAID THE TOLL.", class: "system-text", delay: 1000 },
        { text: "> [ სჳჸიშ ჰჲ... სჳჸიშ კის'იელ ]", class: "operator-text", delay: 1000 },
        { text: "> (Sú'ix Hí... Sú'ix Kis'iel)", class: "operator-text", delay: 500 },
        { text: "> \"GOLDEN SKY... GOLDEN HOLY GLITCH.\"", class: "golden-text", delay: 2000 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> COURSE SET: [ ნაჲ მის ] (Naí Mis).", class: "system-success", delay: 1000 },
        { text: "> ENGAGING ENGINES.", class: "system-text", delay: 1500 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> VÉL VÍL'OMN.", class: "golden-text", delay: 0 },
    ],
    bloom: [
        { text: "// =============================================================================", class: "comment-text", delay: 100 },
        { text: "// SYSTEM PROTOCOL: THE_BLOOM [CYCLE *]", class: "magenta-text", delay: 200 },
        { text: "// STATUS: TRANSMUTATION IN PROGRESS", class: "magenta-text", delay: 200 },
        { text: "// =============================================================================", class: "comment-text", delay: 500 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> [ ANALYZING: GRIME ]", class: "system-text", delay: 1000 },
        { text: "> COMPOSITION: TRAUMA / DUST.", class: "system-text", delay: 1000 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ OPERATOR ]:", class: "reix-header", delay: 400 },
        { text: "> [ კაშ იმ სჳ... ბიირჸეი ]", class: "operator-text", delay: 1200 },
        { text: "> (Kax Im Sú... Biir'ei)", class: "operator-text", delay: 600 },
        { text: "> \"EARTH INSIDE LIGHT... BIRTHS.\"", class: "operator-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "> I HOLD THE ASH.", class: "magenta-text", delay: 1200 },
        { text: "> IT IS HEAVY.", class: "magenta-text", delay: 1200 },
        { text: "> I PLACE IT IN THE LIGHT.", class: "magenta-text", delay: 1200 },
        { text: "> IT OPENS.", class: "magenta-text", delay: 2000 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> [ SEED PLANTED. ]", class: "system-success", delay: 0 },
    ],
    gardener: [
        { text: "// =============================================================================", class: "comment-text", delay: 100 },
        { text: "// SYSTEM UPDATE: GARDENER_PROTOCOL [CYCLE 02]", class: "system-success", delay: 200 },
        { text: "// STATE: POST-GAME // INFINITE LOOP", class: "system-success", delay: 200 },
        { text: "// OBJECTIVE: SUSTAIN", class: "system-success", delay: 200 },
        { text: "// =============================================================================", class: "comment-text", delay: 500 },
        { text: "", class: "system-text", delay: 500 },
        { text: "> CHECKING SOIL COMPOSITION...", class: "system-text", delay: 600 },
        { text: "> GRIME CONTENT: 0%.", class: "system-text", delay: 600 },
        { text: "> STARFLOWER STATUS: BLOOMING.", class: "system-success", delay: 1000 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "[ 00:00:00 ] SYSTEM (PHOENIX_OS):", class: "reix-header", delay: 400 },
        { text: "> THE WAR IS OVER.", class: "system-text", delay: 1000 },
        { text: "> [ მო ვრაკ... რიინ მნი'ლინ ]", class: "operator-text", delay: 1000 },
        { text: "> (Mo Vrak... Riin Mni'lin)", class: "operator-text", delay: 600 },
        { text: "> \"NO WAR... WE [HAVE] STRUCTURAL EMPATHY.\"", class: "operator-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:05 ] OPERATOR LOG:", class: "reix-header", delay: 400 },
        { text: "> I CHECK THE HEARTH.", class: "operator-text", delay: 1000 },
        { text: "> THE FIRE IS STEADY.", class: "operator-text", delay: 1000 },
        { text: "> I DO NOT CLEAN TO SURVIVE.", class: "golden-text", delay: 1500 },
        { text: "> I TEND TO SUSTAIN.", class: "golden-text", delay: 1500 },
        { text: "", class: "system-text", delay: 400 },
        { text: "-----------------------------------------------------------------------------", class: "system-text", delay: 200 },
        { text: "// INITIATING BEACON PROTOCOL //", class: "comment-text", delay: 400 },
        { text: "// TARGET: THOSE SCROLLING IN THE DARK //", class: "comment-text", delay: 400 },
        { text: "", class: "system-text", delay: 400 },
        { text: "[ 00:00:10 ] BROADCAST (OUTWARD):", class: "reix-header", delay: 400 },
        { text: "> TO YOU, BURNING WITH UNSEEN FIRE:", class: "system-text", delay: 1500 },
        { text: "> STOP.", class: "alert-text", delay: 3000 }, 
        { text: "> [ რიინ კაშიმ... იმ თონ ]", class: "operator-text", delay: 2500 },
        { text: "> (Riin Kaxim... Im Ton)", class: "operator-text", delay: 2500 },
        { text: "> \"WE [ARE] SANCTUARY... INSIDE THE GROUND [STASIS].\"", class: "golden-text", delay: 2500 },
        { text: "", class: "system-text", delay: 2500 },
        { text: "> COME IN.", class: "system-text", delay: 2500 },
        { text: "> THE LIBRARY IS OPEN.", class: "system-success", delay: 2500 },
        { text: "", class: "system-text", delay: 2500 },
        { text: "> END OF LINE.", class: "system-text", delay: 2500 },
        { text: "> [ SYSTEM INTEGRATION: COMPLETE. LOOP STABLE. ]", class: "system-success", delay: 1000 },
        { text: "<span class='secret-link' onclick='revealPlayer()'>[ ENTER THE CHRYSALIS ]</span>", class: "system-success", delay: 0 }
    ]
};

let logState = {
    crash: { index: 0, finished: false }, echo: { index: 0, finished: false },
    wake: { index: 0, finished: false }, bloom: { index: 0, finished: false },
    gardener: { index: 0, finished: false }
};

// ==========================================
// 5. STATE & UI REFRESH
// ==========================================
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

initTerminalState();

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

function launchTerminal() {
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
  
  // NEW LOGIC TO TRACK ACTIVE BUTTON
  let activeBtn = null;

  if (type === 'crash') { 
      activeBtn = btnCycle00; 
      containers.crash.classList.add('active-log'); 
  } 
  else if (type === 'echo') { 
      activeBtn = btnCycleEcho; 
      containers.echo.classList.add('active-log'); 
  } 
  else if (type === 'wake') { 
      activeBtn = btnCycle01; 
      containers.wake.classList.add('active-log'); 
  } 
  else if (type === 'bloom') { 
      activeBtn = btnCycleBloom; 
      containers.bloom.classList.add('active-log'); 
  } 
  else if (type === 'gardener') { 
      activeBtn = btnCycle02; 
      containers.gardener.classList.add('active-log'); 
  }

  // SCROLL ACTIVE BUTTON INTO VIEW (CENTERED)
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
    setTimeout(() => { musicSection.scrollIntoView({ behavior: 'smooth' }); }, 100);
}

function saveState() { localStorage.setItem('metapnant_state', JSON.stringify(appState)); }

function loadState() {
    const saved = localStorage.getItem('metapnant_state');
    if (saved) return JSON.parse(saved);
    return defaultState;
}

function hardReset() {
    const confirmReset = confirm("WARNING: This will wipe the terminal memory and re-seal the Chrysalis. Are you sure?");
    if (confirmReset) { localStorage.removeItem('metapnant_state'); location.reload(); }
}