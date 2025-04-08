// This script handles the free-play piano page logic (/piano)

// Run only if on the piano page
if (document.location.pathname === "/piano") {
    // --- Constants ---
    const WEBSOCKET_URL = `ws://10.42.0.119:81`; // Use dynamic hostname, port 81
    const pianoKeys = document.querySelectorAll('.key[data-note]');
    const wsStatusElement = document.getElementById('ws-status');
    const audioElements = {}; // Object to store audio elements for quick access

    // Notes available on this piano
    const soundNotes = ["c4", "d4", "e4", "f4", "g4", "a4", "b4", "c5"];

    // --- Preload and Prepare Audio ---
    soundNotes.forEach(note => {
        const audioElement = document.getElementById(`audio_${note}`);
        if (audioElement) {
            audioElements[note] = audioElement;
            // Attempt to wake up audio context on user interaction
            // This helps overcome browser restrictions on autoplay
            const wakeAudio = () => {
                if (audioElement.readyState < 2 || audioElement.paused) { // Check if not loaded or paused
                    console.log(`Waking up audio for: ${note}`);
                    audioElement.play().then(() => {
                        audioElement.pause();
                        audioElement.currentTime = 0; // Reset after wake-up
                         // Remove the listener after it has run once
                        document.body.removeEventListener('click', wakeAudio, { capture: true });
                        document.body.removeEventListener('touchstart', wakeAudio, { capture: true });
                        document.body.removeEventListener('keydown', wakeAudio, { capture: true });
                    }).catch((e) => {
                        // Ignore errors during wake-up, often due to context not ready
                    });
                }
                 // Remove listeners even if audio was already awake
                 document.body.removeEventListener('click', wakeAudio, { capture: true });
                 document.body.removeEventListener('touchstart', wakeAudio, { capture: true });
                 document.body.removeEventListener('keydown', wakeAudio, { capture: true });
            };
            // Add listeners for first interaction
            document.body.addEventListener('click', wakeAudio, { once: true, capture: true });
            document.body.addEventListener('touchstart', wakeAudio, { once: true, capture: true });
            document.body.addEventListener('keydown', wakeAudio, { once: true, capture: true });
        } else {
            console.warn(`No <audio> element found for note: ${note}`);
        }
    });
    console.log("Loaded audio elements:", audioElements);

    // --- Key Press State Tracking ---
    // Keep track of how each key is currently being pressed
    const espPressedNotes = new Set();      // Notes pressed via ESP32 touch sensors
    const uiPressedNotes = new Set();       // Notes pressed via mouse click or touch on the screen
    const keyboardPressedNotes = new Set(); // Notes pressed via the physical computer keyboard

    // --- WebSocket Connection ---
    let socket;
    let reconnectTimer;

    function connectWebSocket() {
        if (reconnectTimer) clearTimeout(reconnectTimer); // Clear any existing reconnect timer

        console.log("Attempting to connect to WebSocket:", WEBSOCKET_URL);
        wsStatusElement.textContent = "WebSocket Status: Connecting...";
        wsStatusElement.style.color = "#ffa500"; // Orange for connecting

        // Close existing socket if it exists and is open or connecting
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            console.log("Closing previous WebSocket connection.");
            socket.close();
        }

        socket = new WebSocket(WEBSOCKET_URL);

        socket.onopen = function() {
            console.log("WebSocket connected!");
            wsStatusElement.textContent = "WebSocket Status: Connected";
            wsStatusElement.style.color = "#28a745"; // Green for connected
            // Reset visual state on new connection
            pianoKeys.forEach(key => key.classList.remove('active'));
            espPressedNotes.clear();
            // Keep UI/Keyboard state? Maybe clear them too for consistency:
            // uiPressedNotes.clear();
            // keyboardPressedNotes.clear();
        };

        socket.onmessage = function(event) {
            const message = event.data;
            console.log("Received from ESP32:", message);
            const [note, state] = message.split('_'); // e.g., "c4_on" -> ["c4", "on"]

            if (audioElements[note] && (state === "on" || state === "off")) {
                if (state === "on") {
                    if (!isNotePressed(note)) { // Play sound only if not already pressed by UI/Keyboard
                        playSound(note);
                    }
                    espPressedNotes.add(note);
                    visualKeyPress(note, true); // Always show visual feedback
                } else if (state === "off") {
                    espPressedNotes.delete(note);
                    // Only remove visual feedback if no other input method is holding it
                    if (!isNotePressed(note)) {
                       visualKeyPress(note, false);
                    }
                }
            } else {
                console.warn("Unknown message or no audio element for note from ESP32:", message);
            }
        };

        socket.onerror = function(error) {
            console.error("WebSocket Error:", error);
            wsStatusElement.textContent = "WebSocket Status: Error";
            wsStatusElement.style.color = "#dc3545"; // Red for error
            // Attempt to reconnect on error as well
            scheduleReconnect();
        };

        socket.onclose = function(event) {
            console.log("WebSocket closed. Code:", event.code, "Reason:", event.reason);
            wsStatusElement.textContent = `WebSocket Status: Closed (code ${event.code}). Retrying...`;
            wsStatusElement.style.color = "#dc3545"; // Red for closed/disconnected
            // Reset visual state and clear ESP state when disconnected
            pianoKeys.forEach(key => key.classList.remove('active'));
            espPressedNotes.clear();
             // Don't clear UI/Keyboard state here, user might still be holding keys
            scheduleReconnect();
        };
    }

    function scheduleReconnect() {
         // Clear existing timer before setting a new one
        if (reconnectTimer) clearTimeout(reconnectTimer);
        // Schedule reconnection attempt after 5 seconds
        reconnectTimer = setTimeout(connectWebSocket, 5000);
        console.log("Scheduled WebSocket reconnection attempt in 5 seconds.");
    }

    // --- Helper Function: Check if Note is Pressed by Any Means ---
    function isNotePressed(note) {
        return espPressedNotes.has(note) || uiPressedNotes.has(note) || keyboardPressedNotes.has(note);
    }

    // --- Sound Playback ---
    function playSound(note) {
        const audio = audioElements[note];
        if (audio) {
             // Pause and reset time ensures the sound replays from the start if rapidly triggered
            audio.pause();
            audio.currentTime = 0;
            audio.play().catch(e => console.error(`Error playing ${note}:`, e));
            console.log("Playing:", note);
        } else {
            console.warn("playSound: No audio element for note:", note);
        }
    }

    // --- Visual Feedback ---
    function visualKeyPress(note, isPressed) {
        const keyElement = document.querySelector(`.key[data-note="${note}"]`);
        if (keyElement) {
            if (isPressed) {
                keyElement.classList.add('active');
            } else {
                // Only remove 'active' if the key is truly released by all sources
                if (!isNotePressed(note)) {
                    keyElement.classList.remove('active');
                }
            }
        } else {
            console.warn("visualKeyPress: No key element found for note:", note);
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
        console.log(`UI Press Start: ${note}`);
    }

    function handleInteractionEnd(note) {
        if (!audioElements[note]) return;

        if (uiPressedNotes.has(note)) {
            console.log(`UI Press End: ${note}`);
            uiPressedNotes.delete(note);
             // Only remove visual feedback if no other input method is holding it
            if (!isNotePressed(note)) {
                visualKeyPress(note, false);
            }
        }
    }

    pianoKeys.forEach(key => {
        const note = key.dataset.note;
        if (note) {
            // Mouse events
            key.addEventListener('mousedown', () => handleInteractionStart(note));
            key.addEventListener('mouseup', () => handleInteractionEnd(note));
            // Handle case where mouse leaves the key while still pressed down
            key.addEventListener('mouseleave', () => handleInteractionEnd(note));

            // Touch events
            key.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent default touch behavior like scrolling
                handleInteractionStart(note);
            }, { passive: false }); // `passive: false` is needed for preventDefault
            key.addEventListener('touchend', () => handleInteractionEnd(note));
            key.addEventListener('touchcancel', () => handleInteractionEnd(note)); // Handle interrupted touches
        }
    });

    // --- Keyboard Event Handlers ---
    const keyNoteMap = {}; // Map keyboard keys ('a', 's', etc.) to piano notes ('c4', 'd4')
    pianoKeys.forEach(key => {
        const note = key.dataset.note;
        const kbdKey = key.dataset.key; // Get the assigned keyboard key from data-key attribute
        if (note && kbdKey) {
            keyNoteMap[kbdKey.toLowerCase()] = note; // Store in lowercase for easier matching
        }
    });
    console.log("Keyboard-to-Note Map:", keyNoteMap);

    window.addEventListener('keydown', (event) => {
        // Ignore modifier keys, repeated events, and inputs in text fields
        if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') return;

        const pressedKey = event.key.toLowerCase();
        const note = keyNoteMap[pressedKey];

        if (note && audioElements[note] && !keyboardPressedNotes.has(note)) { // Check if note exists and isn't already held down by keyboard
            if (!isNotePressed(note)) { // Play sound only if not already active
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
            // Only remove visual feedback if no other input method is holding it
            if (!isNotePressed(note)) {
                visualKeyPress(note, false);
            }
        }
    });

    // --- Initial Connection ---
    console.log("Piano page initialized. Connecting to WebSocket...");
    connectWebSocket();

} // End of check for piano page path