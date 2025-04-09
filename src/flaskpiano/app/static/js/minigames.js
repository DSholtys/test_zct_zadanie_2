// This script handles the mini-games page logic (/minigames)

// Run only if on the minigames page
if (document.location.pathname === "/minigames") {

    // --- DOM Elements ---
    const pianoKeys = document.querySelectorAll('.key[data-note]');
    const gameMessage = document.getElementById('game-message');
    const melodySelect = document.getElementById('melody-select');
    const wsStatusElement = document.getElementById('ws-status');
    const startGameBtn = document.getElementById('start-game-btn'); // Optional start button

    // --- Audio Setup ---
    const audioElements = {};
    const soundNotes = ["c4", "d4", "e4", "f4", "g4", "a4", "b4", "c5"];
    soundNotes.forEach(note => {
        const audioElement = document.getElementById(`audio_${note}`);
        if (audioElement) {
            audioElements[note] = audioElement;
             // Simple wake audio function for this page too
            const wakeAudio = () => {
                audioElement.play().then(() => { audioElement.pause(); audioElement.currentTime=0; }).catch(()=>{});
                document.body.removeEventListener('click', wakeAudio, { capture: true });
                document.body.removeEventListener('touchstart', wakeAudio, { capture: true });
                document.body.removeEventListener('keydown', wakeAudio, { capture: true });
            };
            document.body.addEventListener('click', wakeAudio, { once: true, capture: true });
            document.body.addEventListener('touchstart', wakeAudio, { once: true, capture: true });
            document.body.addEventListener('keydown', wakeAudio, { once: true, capture: true });
        }
    });

    // --- Melody Definitions ---
    const melodies = {
        "happy_birthday": {
            name: "Happy Birthday",
            notes: ["c4", "c4", "d4", "c4", "f4", "e4", null, // null represents a pause/rest
                    "c4", "c4", "d4", "c4", "g4", "f4", null,
                    "c4", "c4", "c5", "a4", "f4", "e4", "d4", null,
                    "b4", "b4", "a4", "f4", "g4", "f4", null]
        },
        "jingle_bells": {
            name: "Jingle Bells",
            notes: ["e4", "e4", "e4", null, "e4", "e4", "e4", null,
                    "e4", "g4", "c4", "d4", "e4", null, null,
                    "f4", "f4", "f4", "f4", "f4", "e4", "e4", "e4", //"e4", // Adjusted rhythm slightly
                    "e4", "d4", "d4", "e4", "d4", null, "g4", null,
                    "e4", "e4", "e4", null, "e4", "e4", "e4", null,
                    "e4", "g4", "c4", "d4", "e4", null, null,
                    "f4", "f4", "f4", "f4", "f4", "e4", "e4", "e4", //"e4",
                    "g4", "g4", "f4", "d4", "c4", null, null]
        }
        // Add more melodies here following the same structure
        // "ode_to_joy": { name: "Ode to Joy", notes: ["e4", "e4", "f4", ...] }
    };

    // --- Game State ---
    let currentGame = {
        melodyId: null,
        melody: null, // Will hold the notes array
        currentIndex: 0,
        isPlaying: false,
        score: 0, // Optional: add scoring
        mistakes: 0 // Optional: track mistakes
    };

    // --- WebSocket Connection (similar to script.js) ---
    let socket;
    let reconnectTimer;
    const WEBSOCKET_URL = `ws://10.42.0.119:81`;

    function connectWebSocket() {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        console.log("MiniGames: Attempting WebSocket connection...");
        wsStatusElement.textContent = "WebSocket Status: Connecting...";
        wsStatusElement.style.color = "#ffa500";

        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            socket.close();
        }

        socket = new WebSocket(WEBSOCKET_URL);

        socket.onopen = () => {
            console.log("MiniGames: WebSocket connected!");
            wsStatusElement.textContent = "WebSocket Status: Connected";
            wsStatusElement.style.color = "#28a745";
        };

        socket.onmessage = (event) => {
            const message = event.data;
            console.log("MiniGames: Received from ESP32:", message);
            const [note, state] = message.split('_');

            // Only process 'on' messages for game input
            if (state === "on" && currentGame.isPlaying) {
                // Play sound feedback regardless of correctness
                 playSound(note);
                 // Check if the pressed note is the correct one for the game
                 handleKeyPress(note);
            }
             // Optionally handle 'off' messages if needed for visual feedback consistency
             if (state === "off") {
                 const keyElement = document.querySelector(`.key[data-note="${note}"]`);
                 if (keyElement) {
                     keyElement.classList.remove('active'); // Remove temp active state from press
                 }
             }
        };

        socket.onerror = (error) => {
            console.error("MiniGames: WebSocket Error:", error);
            wsStatusElement.textContent = "WebSocket Status: Error";
            wsStatusElement.style.color = "#dc3545";
            scheduleReconnect();
        };

        socket.onclose = (event) => {
            console.log("MiniGames: WebSocket closed. Code:", event.code);
            wsStatusElement.textContent = `WebSocket Status: Closed (code ${event.code}). Retrying...`;
            wsStatusElement.style.color = "#dc3545";
             // Stop game if connection lost? Or allow continuing with keyboard? Decide based on desired behavior.
            // currentGame.isPlaying = false;
            // updateGameMessage("WebSocket disconnected. Please reconnect.", true);
            scheduleReconnect();
        };
    }

     function scheduleReconnect() {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectWebSocket, 5000);
         console.log("MiniGames: Scheduled WebSocket reconnection attempt in 5 seconds.");
    }


    // --- Sound Playback ---
    function playSound(note) {
        const audio = audioElements[note];
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.play().catch(e => console.error(`Error playing ${note}:`, e));
             // Briefly flash the key 'active' state for feedback on any press
            const keyElement = document.querySelector(`.key[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.add('active');
                // Remove the flash after a short delay, unless it's the highlighted key
                setTimeout(() => {
                    if (!keyElement.classList.contains('highlight')) {
                         keyElement.classList.remove('active');
                    }
                }, 150);
            }

        } else {
            console.warn("playSound: No audio element for note:", note);
        }
    }

    // --- Game Logic Functions ---

    function highlightNote(note) {
        // Remove highlight from all keys first
        pianoKeys.forEach(key => key.classList.remove('highlight', 'active')); // Remove active too before highlighting

        if (note) {
            const keyElement = document.querySelector(`.key[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.add('highlight');
            } else {
                console.warn("highlightNote: Could not find key element for", note);
            }
        }
    }

    function updateGameMessage(message, isError = false) {
        gameMessage.textContent = message;
        gameMessage.style.color = isError ? "#dc3545" : "#6a85b6"; // Red for error, default otherwise
    }

    function advanceMelody() {
        currentGame.currentIndex++;
        if (currentGame.currentIndex >= currentGame.melody.length) {
            // Melody completed
            currentGame.isPlaying = false;
            highlightNote(null); // Remove highlight
            updateGameMessage(`"${melodies[currentGame.melodyId].name}" completed! Great job! Select another song.`);
            // Optional: Display score/mistakes
            melodySelect.disabled = false; // Re-enable selection
            if(startGameBtn) startGameBtn.style.display = 'none'; // Hide start button again

        } else {
            // Advance to the next note or pause
             let nextNote = currentGame.melody[currentGame.currentIndex];

             // Skip over null (pauses) automatically
             while (nextNote === null && currentGame.currentIndex < currentGame.melody.length) {
                 currentGame.currentIndex++;
                 nextNote = currentGame.melody[currentGame.currentIndex];
                 // Add a slight delay for pauses if desired
                 // await new Promise(resolve => setTimeout(resolve, 200)); // Example delay
             }

             // Check if we reached the end after skipping pauses
              if (currentGame.currentIndex >= currentGame.melody.length) {
                 advanceMelody(); // Call again to trigger completion logic
                 return;
             }


            highlightNote(nextNote);
            updateGameMessage(`Next note: ${nextNote.toUpperCase()}`);
        }
    }

    function handleKeyPress(pressedNote) {
        if (!currentGame.isPlaying) return; // Don't process if game not active

        const expectedNote = currentGame.melody[currentGame.currentIndex];

        if (pressedNote === expectedNote) {
            // Correct key pressed
            currentGame.score++; // Increment score (optional)
            // Provide positive feedback (optional)
            // updateGameMessage("Correct!"); // This might be too fast, message updates in advanceMelody
            advanceMelody(); // Move to the next note
        } else {
            // Incorrect key pressed
            currentGame.mistakes++; // Increment mistakes (optional)
            updateGameMessage(`Oops! Expected ${expectedNote.toUpperCase()}, you pressed ${pressedNote.toUpperCase()}. Try again!`, true);
            // Optional: Add a visual shake effect or flash red?
            const keyElement = document.querySelector(`.key[data-note="${expectedNote}"]`);
            if (keyElement) {
                keyElement.classList.add('shake'); // Need to define 'shake' animation in CSS
                setTimeout(() => keyElement.classList.remove('shake'), 500);
            }
        }
        // Optional: Update score/mistake display on the page
    }

     function startGame() {
        const selectedMelodyId = melodySelect.value;
        if (!selectedMelodyId || !melodies[selectedMelodyId]) {
            updateGameMessage("Please select a valid melody first.", true);
            return;
        }

        console.log("Starting game with melody:", selectedMelodyId);
        currentGame.melodyId = selectedMelodyId;
        currentGame.melody = melodies[selectedMelodyId].notes;
        currentGame.currentIndex = 0;
        currentGame.isPlaying = true;
        currentGame.score = 0;
        currentGame.mistakes = 0;
        melodySelect.disabled = true; // Disable selection during game
        if(startGameBtn) startGameBtn.style.display = 'none'; // Hide start button if used


        // Find the first actual note (skip initial pauses)
        let firstNote = currentGame.melody[currentGame.currentIndex];
         while (firstNote === null && currentGame.currentIndex < currentGame.melody.length) {
             currentGame.currentIndex++;
             firstNote = currentGame.melody[currentGame.currentIndex];
         }

        if (firstNote) {
             highlightNote(firstNote);
             updateGameMessage(`Game started! Play: ${firstNote.toUpperCase()}`);
        } else {
             // Handle case where melody might be empty or all pauses (edge case)
             updateGameMessage("Selected melody seems empty or invalid.", true);
             currentGame.isPlaying = false;
             melodySelect.disabled = false;
        }

    }


    // --- Event Listeners ---
    melodySelect.addEventListener('change', () => {
        const selectedMelodyId = melodySelect.value;
        if (selectedMelodyId) {
             // Option 1: Start game immediately on selection
             // startGame();

             // Option 2: Enable a start button
             updateGameMessage(`Selected: "${melodies[selectedMelodyId].name}". Press Start!`);
             highlightNote(null); // Clear any previous highlight
             if (startGameBtn) {
                startGameBtn.style.display = 'inline-block'; // Show start button
                startGameBtn.onclick = startGame; // Assign function to button
             } else {
                 // Fallback if no start button: Start immediately
                 console.warn("No #start-game-btn found, starting game immediately.");
                 startGame();
             }

        } else {
            // No melody selected
            updateGameMessage("Select a melody to start playing!");
            highlightNote(null);
             currentGame.isPlaying = false; // Ensure game stops if "-- Select --" is chosen
             melodySelect.disabled = false;
            if(startGameBtn) startGameBtn.style.display = 'none'; // Hide start button
        }
    });

    // Add keyboard listeners for playing via computer keyboard
     window.addEventListener('keydown', (event) => {
        if (!currentGame.isPlaying || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') return;

         // Create keyNoteMap dynamically if needed, or reuse from script.js if combined
         const localKeyNoteMap = {};
         pianoKeys.forEach(key => {
            const note = key.dataset.note;
            const kbdKey = key.dataset.key;
            if (note && kbdKey) localKeyNoteMap[kbdKey.toLowerCase()] = note;
         });

        const pressedKey = event.key.toLowerCase();
        const note = localKeyNoteMap[pressedKey];

        if (note) {
             playSound(note); // Play sound feedback on key press
             handleKeyPress(note); // Process the key press in the game logic
        }
    });


    // --- Initial Setup ---
    updateGameMessage("Select a melody to start playing!");
    connectWebSocket(); // Connect WebSocket on page load

} // End of check for minigames page path


// Add CSS for shake animation (optional) in style.css:
/*
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}
.key.shake {
  animation: shake 0.5s ease-in-out;
}
*/