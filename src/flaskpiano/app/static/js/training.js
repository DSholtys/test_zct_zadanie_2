const pianoKeys = document.querySelectorAll('.key[data-note]');
const trainingMessage = document.getElementById('training-message');

const notesToLearn = ["c4", "d4", "e4", "f4", "g4", "a4", "b4", "c5"];
let currentNoteIndex = 0;
let socket;
let pressesRequired = 3;
let currentPressCount = 0;
let basicTrainingCompleted = false;

//Happy Birthday
const happyBirthday = ["c4", "c4", "d4", "c4", "f4", "e4", "c4", "c4", "d4", "c4", "g4", "f4", "c4", "c4", "c5", "a4", "f4", "e4", "d4"];

const melodies = [
    { name: "Happy Birthday", notes: happyBirthday }
];
let currentMelodyIndex = 0;
let melodyIndex = 0;

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

function startBasicTraining() {
    if (currentNoteIndex < notesToLearn.length) {
        const currentNote = notesToLearn[currentNoteIndex];
        trainingMessage.textContent = `Press the ${currentNote} key (${currentPressCount + 1}/${pressesRequired}).`;
        highlightNote(currentNote);
    } else {
        basicTrainingCompleted = true;
        currentNoteIndex = 0;
        trainingMessage.textContent = "Basic training complete! Click 'Next' to play the melody.";
        showNextButton();
    }
}

function startMelodyTraining() {
    const currentMelody = melodies[currentMelodyIndex];
    if (!currentMelody) {
        trainingMessage.textContent = "All melodies complete! Great job!";
        pianoKeys.forEach(key => key.classList.remove('highlight'));
        return;
    }

    if (melodyIndex < currentMelody.notes.length) {
        const currentNote = currentMelody.notes[melodyIndex];
        trainingMessage.textContent = `Play ${currentMelody.name}. Press the ${currentNote} key.`;
        highlightNote(currentNote);
    } else {
        trainingMessage.textContent = `${currentMelody.name} complete! Great job!`; //No next button
        melodyIndex = 0;
         pianoKeys.forEach(key => key.classList.remove('highlight')); // stop to highlight any keys
        //showNextButton();  //Do not show next button
    }
}

function showNextButton() {
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.onclick = () => {
        removeNextButton();
        if (!basicTrainingCompleted) {
            startBasicTraining();
        } else {
            //currentMelodyIndex++; //Not neccesary
            startMelodyTraining();
        }
    };
    trainingMessage.parentNode.appendChild(nextButton);
}

function removeNextButton() {
    const nextButton = trainingMessage.parentNode.querySelector('button');
    if (nextButton) {
        nextButton.remove();
    }
}

function connectWebSocket() {
    socket = new WebSocket("ws://192.168.0.192:81");

    socket.onopen = function() {
        console.log("WebSocket connected for training!");
    };

    socket.onmessage = function(event) {
        const message = event.data;
        const [note, state] = message.split('_');

        if (state === "on") {
            playSound(note);
            if (!basicTrainingCompleted) {
                if (note === notesToLearn[currentNoteIndex]) {
                    currentPressCount++;
                    trainingMessage.textContent = `Press the ${note} key (${currentPressCount + 1}/${pressesRequired}).`;
                    if (currentPressCount >= pressesRequired) {
                        trainingMessage.textContent = "Excellent! Keep going.";
                        currentNoteIndex++;
                        currentPressCount = 0;
                        startBasicTraining();
                    }
                } else {
                    trainingMessage.textContent = "Try again!";
                }
            } else {
                const currentMelody = melodies[currentMelodyIndex];
                if (currentMelody && note === currentMelody.notes[melodyIndex]) {
                    melodyIndex++;
                    startMelodyTraining();
                } else {
                    trainingMessage.textContent = "Try again!";
                }
            }
        }
    };

    socket.onclose = function() {
        console.log("WebSocket disconnected.  Reconnecting...");
        setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = function(error) {
        console.error("WebSocket error:", error);
    };
}

connectWebSocket();
startBasicTraining();