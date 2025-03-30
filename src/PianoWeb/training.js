const pianoKeys = document.querySelectorAll('.key[data-note]');
const trainingMessage = document.getElementById('training-message');

const notesToLearn = ["c4", "d4", "e4", "f4", "g4", "a4", "b4", "c5"];
let currentNoteIndex = 0;
let socket;
let pressesRequired = 3;
let currentPressCount = 0;

const melody = ["c4", "c4", "g4", "g4", "a4", "a4", "g4", "f4", "f4", "e4", "e4", "d4", "d4", "c4"];
let melodyIndex = 0;
let inMelodyMode = false;  // Flag to indicate if we are in melody mode

function playSound(note) {
    const audio = document.getElementById(`audio_${note}`);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.error(`Playback error ${note}:`, e));
    } else {
        console.warn("No audio element for note:", note);
    }
}

function highlightNote(note) {
    pianoKeys.forEach(key => key.classList.remove('highlight'));
    const keyElement = document.querySelector(`.key[data-note="${note}"]`);
    if (keyElement) {
        keyElement.classList.add('highlight');
    }
}

function startTraining() {
    if (!inMelodyMode) { // If not in melody mode, continue normal training
        if (currentNoteIndex < notesToLearn.length) {
            const currentNote = notesToLearn[currentNoteIndex];
            trainingMessage.textContent = `Press the ${currentNote} key (${currentPressCount + 1}/${pressesRequired}).`;
            highlightNote(currentNote);
        } else {
            trainingMessage.textContent = "Basic training complete! Get ready to play the melody!";
            inMelodyMode = true; // Switch to melody mode
            melodyIndex = 0;       // Reset melody index
            startMelodyTraining(); // Start melody training
        }
    }
}

function startMelodyTraining() {
    if (inMelodyMode) {
        if (melodyIndex < melody.length) {
            const currentNote = melody[melodyIndex];
            trainingMessage.textContent = `Play the melody. Next: ${currentNote}`;
            highlightNote(currentNote);
        } else {
            trainingMessage.textContent = "You played the melody! Great job!";
            pianoKeys.forEach(key => key.classList.remove('highlight'));
        }
    }
}

function connectWebSocket() {
    socket = new WebSocket("ws://172.20.10.12:81");

    socket.onopen = function() {
        console.log("WebSocket connected for training!");
    };

    socket.onmessage = function(event) {
        const message = event.data;
        const [note, state] = message.split('_');

        if (!inMelodyMode) {
            // Basic Training Mode
            if (state === "on" && note === notesToLearn[currentNoteIndex]) {
                playSound(note);
                currentPressCount++;
                trainingMessage.textContent = `Press the ${note} key (${currentPressCount + 1}/${pressesRequired}).`;

                if (currentPressCount >= pressesRequired) {
                    trainingMessage.textContent = "Excellent! Keep going.";
                    currentNoteIndex++;
                    currentPressCount = 0;
                    startTraining();
                }
            } else if (state === "on") {
                playSound(note);
                trainingMessage.textContent = "Try again!";
            }
        } else {
            // Melody Training Mode
            if (state === "on" && note === melody[melodyIndex]) {
                playSound(note);
                melodyIndex++;
                startMelodyTraining();
            } else if (state === "on") {
                playSound(note);
                trainingMessage.textContent = "Oops! Wrong note. Try again!";
                highlightNote(melody[melodyIndex]); // Re-highlight the correct note
            }
        }
    };

    socket.onclose = function() {
        console.log("WebSocket disconnected. Reconnecting...");
        setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = function(error) {
        console.error("WebSocket error:", error);
    };
}

connectWebSocket();
startTraining();