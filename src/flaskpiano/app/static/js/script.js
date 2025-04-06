if (document.location.pathname === "/piano") {    // PASTE ALL YOUR EXISTING script.js CODE HERE
    // (the const declarations, functions, event listeners, etc.)
    // Leave the connectWebSocket() call at the end inside the if block.
    const WEBSOCKET_URL = "ws://192.168.0.192:81";
    const SOUND_FILES_PATH = "";
  
    const pianoKeys = document.querySelectorAll('.key[data-note]');
    const wsStatusElement = document.getElementById('ws-status');
  
    const audioElements = {};
  
    const soundNotes = ["c4", "d4", "e4", "f4", "g4", "a4", "b4", "c5"];
  
    soundNotes.forEach(note => {
        const audioElement = document.getElementById(`audio_${note}`);
        if (audioElement) {
            audioElements[note] = audioElement;
            const wakeAudio = () => {
                if (audioElement.readyState === 0 || audioElement.paused) {
                    console.log(`Waking up audio for: ${note}`);
  
                    audioElement.play().then(() => {
                        audioElement.pause();
                        audioElement.currentTime = 0;
                    }).catch((e) => {
                      
                    });
                }
            };
  
            document.body.addEventListener('click', wakeAudio, { once: true, capture: true });
            document.body.addEventListener('touchstart', wakeAudio, { once: true, capture: true });
            document.body.addEventListener('keydown', wakeAudio, { once: true, capture: true });
        } else {
            console.warn(`No <audio> element found for note: ${note}`);
        }
    });
    console.log("Loaded audio elements:", audioElements);
  
    // --- Key press state ---
    // Track how each key is pressed
    const espPressedNotes = new Set();      // Notes pressed via ESP32
    const uiPressedNotes = new Set();       // Notes pressed by mouse/finger
    const keyboardPressedNotes = new Set(); // Notes pressed on the keyboard
  
    // --- WebSocket Logic ---
    let socket;
  
    function connectWebSocket() {
        console.log("Attempting to connect to WebSocket:", WEBSOCKET_URL);
        wsStatusElement.textContent = "WebSocket Status: Connecting...";
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            socket.close();
        }
  
        socket = new WebSocket(WEBSOCKET_URL);
  
        socket.onopen = function() {
            console.log("WebSocket connected!");
            wsStatusElement.textContent = "WebSocket Status: Connected";
            pianoKeys.forEach(key => key.classList.remove('active'));
            espPressedNotes.clear();
            uiPressedNotes.clear();
            keyboardPressedNotes.clear();
        };
  
        socket.onmessage = function(event) {
            const message = event.data;
            console.log("Received from ESP32: " + message);
            const [note, state] = message.split('_');
  
            if (audioElements[note]) {
                if (state === "on") {
                    if (!isNotePressed(note)) {
                        playSound(note);
                    }
                    espPressedNotes.add(note);
                    visualKeyPress(note, true);
                } else if (state === "off") {
                    espPressedNotes.delete(note);
                    visualKeyPress(note, false);
                }
            } else {
                console.warn("Unknown message or no audio element for note from ESP32:", message);
            }
        };
  
        socket.onerror = function(error) {
            console.error("WebSocket Error:", error);
            wsStatusElement.textContent = "WebSocket Status: Error";
        };
  
        socket.onclose = function(event) {
            console.log("WebSocket closed. Code:", event.code, "Reason:", event.reason);
            wsStatusElement.textContent = `WebSocket Status: Closed (code ${event.code}). Reconnecting in 5 seconds...`;
            pianoKeys.forEach(key => key.classList.remove('active'));
            espPressedNotes.clear();
            uiPressedNotes.clear();
            keyboardPressedNotes.clear();
            setTimeout(connectWebSocket, 5000);
        };
    }
  
    // --- Function to check if a note is pressed in any way ---
    function isNotePressed(note) {
        return espPressedNotes.has(note) || uiPressedNotes.has(note) || keyboardPressedNotes.has(note);
    }
  
    // --- Sound Functions ---
    function playSound(note) {
        const audio = audioElements[note];
        if (audio) {
            audio.currentTime = 0; // **Critical:** Reset to the beginning for a clean restart
            audio.play().catch(e => console.error(`Playback error ${note}:`, e));
            console.log("Playing " + note);
        } else {
            console.warn("No audio element for note:", note);
        }
    }
  
    // --- Visualization ---
    function visualKeyPress(note, isPressed) {
        const keyElement = document.querySelector(`.key[data-note="${note}"]`);
        if (keyElement) {
            if (isPressed) {
                keyElement.classList.add('active');
            } else {
                if (!isNotePressed(note)) {
                    keyElement.classList.remove('active');
                }
            }
        } else {
            console.warn("No visual element found for note:", note);
        }
    }
  
    // --- UI Event Handlers (Mouse/Touch) ---
    function handleInteractionStart(note) {
        if (!audioElements[note]) return;
  
        if (!isNotePressed(note)) {
            playSound(note);
        }
        uiPressedNotes.add(note);
        visualKeyPress(note, true);
        console.log(`UI Press: ${note}`);
    }
  
    function handleInteractionEnd(note) {
        if (!audioElements[note]) return;
  
        if (uiPressedNotes.has(note)) {
            console.log(`UI Release: ${note}`);
            uiPressedNotes.delete(note);
            visualKeyPress(note, false);
        }
    }
  
    pianoKeys.forEach(key => {
        const note = key.dataset.note;
        if (note) {
            key.addEventListener('mousedown', () => handleInteractionStart(note));
            key.addEventListener('mouseup', () => handleInteractionEnd(note));
            key.addEventListener('mouseleave', () => handleInteractionEnd(note));
  
            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleInteractionStart(note);
            }, { passive: false });
            key.addEventListener('touchend', () => handleInteractionEnd(note));
            key.addEventListener('touchcancel', () => handleInteractionEnd(note));
        }
    });
  
    // --- Keyboard Event Handlers ---
    const keyNoteMap = {};
    pianoKeys.forEach(key => {
        const note = key.dataset.note;
        const kbdKey = key.dataset.key;
        if (note && kbdKey) {
            keyNoteMap[kbdKey.toLowerCase()] = note;
        }
    });
    console.log("Keyboard key map:", keyNoteMap);
  
    window.addEventListener('keydown', (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
  
        const pressedKey = event.key.toLowerCase();
        const note = keyNoteMap[pressedKey];
  
        if (note && audioElements[note]) {
            if (!isNotePressed(note)) {
                playSound(note);
            }
            keyboardPressedNotes.add(note);
            visualKeyPress(note, true);
            console.log(`Keyboard Press: ${pressedKey} -> ${note}`);
        }
    });
  
    window.addEventListener('keyup', (event) => {
        const releasedKey = event.key.toLowerCase();
        const note = keyNoteMap[releasedKey];
  
        if (note && keyboardPressedNotes.has(note)) {
            console.log(`Keyboard Release: ${releasedKey} -> ${note}`);
            keyboardPressedNotes.delete(note);
            visualKeyPress(note, false);
        }
    });
  
    console.log("Piano initialized. Connecting to WebSocket...");
  
    connectWebSocket();
  
  }