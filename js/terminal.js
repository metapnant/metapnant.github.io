// ==========================================
// TERMINAL LOGIC
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
                    
                    // FIX: Use setTimeout to force iOS to recognize the class change
                    icon.classList.remove('spin-once');
                    setTimeout(() => {
                        icon.classList.add('spin-once');
                    }, 10);
                    
                    replayLog(e, type);
                };
                btn.appendChild(icon);
            }
        } else {
            if (icon) icon.remove();
        }
    });

    if (appState.unlockedTabs.length > 1 || appState.finishedLogs.length > 0) {
        btnReset.classList.add('visible'); 
        btnTurbo.classList.add('visible'); 
        btnMute.classList.add('visible');
    } else {
        btnReset.classList.remove('visible'); 
        btnTurbo.classList.remove('visible'); 
        btnMute.classList.remove('visible');
    }
}

function initTerminalState() {
    checkStateIntegrity(); 
    updateSidebarUI();
    
    if (btnTurbo) {
        btnTurbo.innerText = turboMode ? "[>>]\nTURBO: ON" : "[>>]\nTURBO: OFF";
        if (turboMode) btnTurbo.classList.add('active');
        else btnTurbo.classList.remove('active');
    }
    if (btnMute) {
        btnMute.innerText = isMuted ? "[VOL: OFF]" : "[VOL: ON]";
        if (!isMuted) btnMute.classList.add('active');
        else btnMute.classList.remove('active');
    }
    if (appState.musicUnlocked) {
        musicSection.style.setProperty('display', 'block', 'important');
    }
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
    if (containers[type]) containers[type].classList.add('active-log');

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
    } else {
        containers[type].innerHTML = ""; 
        logState[type].index = 0;
        logState[type].finished = false;
        processQueue();
    }
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
    btnTurbo.innerText = turboMode ? "[>>]\nTURBO: ON" : "[>>]\nTURBO: OFF"; 
    if (turboMode) btnTurbo.classList.add('active');
    else btnTurbo.classList.remove('active'); 
}

function toggleMute() { 
    isMuted = !isMuted; 
    btnMute.innerText = isMuted ? "[VOL: OFF]" : "[VOL: ON]"; 
    if (!isMuted) btnMute.classList.add('active');
    else btnMute.classList.remove('active'); 
}

function processQueue() {
    if (!currentTab || !terminalRunning) return; 
    if (logState[currentTab].finished) return;
    if (!window.logsData || !window.logsData[currentTab]) return;

    const idx = logState[currentTab].index; 
    const currentLogArray = window.logsData[currentTab];
    if (idx >= currentLogArray.length) { markLogFinished(currentTab); return; }

    const lineData = currentLogArray[idx]; 
    const delay = lineData.delay * logSpeedMultiplier;

    activeTimer = setTimeout(() => { 
        typeLine(lineData.text, lineData.class, containers[currentTab]); 
        if (lineData.text.trim().length > 0 && typeof SimpleSynth !== 'undefined') SimpleSynth.playTone(lineData.class);
        logState[currentTab].index++; 
        if (terminalContainer) terminalContainer.scrollTop = terminalContainer.scrollHeight;
        if (logState[currentTab].index >= currentLogArray.length) { markLogFinished(currentTab); } 
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
    if (!containers[type] || !window.logsData[type]) return;
    containers[type].innerHTML = ""; 
    window.logsData[type].forEach(line => { typeLine(line.text, line.class, containers[type]); }); 
    setTimeout(() => { terminalContainer.scrollTop = terminalContainer.scrollHeight; }, 50);
}

function typeLine(htmlText, className, container) { 
    if (!container) return;
    const lineDiv = document.createElement('div'); 
    if (htmlText.includes('----') || htmlText.includes('====')) { lineDiv.className = `terminal-line divider-line ${className}`; } 
    else { lineDiv.className = `terminal-line ${className}`; }
    lineDiv.innerHTML = htmlText; 
    
    // FIX: Detect if this line contains the Secret Link and attach listeners
    const link = lineDiv.querySelector('.secret-link');
    if (link && typeof addTactileListener === 'function') {
        addTactileListener(link);
    }
    
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
    musicSection.style.setProperty('display', 'block', 'important');
    appState.musicUnlocked = true; 
    saveState(); 
    updateInfinityState(); 
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    updatePlayBtn();
    currentTrackIdx = 0;
    
    // Global function from audio.js
    loadTrack(0, false); 
    // Manual trigger for the title scramble since we aren't "playing" yet
    if (typeof ScrambleEngine !== 'undefined' && domTrackTitle && albumTracks[0]) {
        ScrambleEngine.snap(domTrackTitle, albumTracks[0].title);
    }
    setTimeout(() => { musicSection.scrollIntoView({ behavior: 'smooth' }); }, 100); 
}