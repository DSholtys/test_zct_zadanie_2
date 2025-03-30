// --- Настройки ---
// !!! ВАЖНО: Замени "ВАШ_IP_АДРЕС_ESP32" на реальный IP-адрес ESP32 !!!
const WEBSOCKET_URL = "ws://192.168.0.192:81";
const SOUND_FILES_PATH = ""; // Путь к звуковым файлам (если они не в той же папке)

// --- Получение элементов DOM ---
const pianoKeys = document.querySelectorAll('.key[data-note]'); // Только клавиши с data-note
const wsStatusElement = document.getElementById('ws-status');

// --- Получение предзагруженных аудио элементов ---
const audioElements = {};
// Список нот, для которых ищем аудио элементы (должен соответствовать data-note в HTML и ID аудио)
const soundNotes = ["c4", "d4", "e4", "f4", "g4", "a4", "b4", "c5"];
// Добавь сюда черные ноты, если используешь: "cs4", "ds4", ...

soundNotes.forEach(note => {
    const audioElement = document.getElementById(`audio_${note}`);
    if (audioElement) {
        audioElements[note] = audioElement;
        // "Пробуждение" аудио контекста при первом взаимодействии
        const wakeAudio = () => {
             // Проверяем явно, т.к. 'paused' может быть true и после инициализации
            if (audioElement.readyState === 0 || audioElement.paused) {
                console.log(`Пробуждение аудио для: ${note}`);
                // Кратковременное воспроизведение и пауза для инициализации в некоторых браузерах
                 audioElement.play().then(() => {
                     audioElement.pause();
                     audioElement.currentTime = 0; // Сбросим на всякий случай
                 }).catch((e) => {
                    // Ошибки здесь часто связаны с тем, что пользователь еще не взаимодействовал,
                    // игнорируем их или выводим как предупреждение
                    // console.warn(`Не удалось пробудить аудио ${note}:`, e);
                 });
            }
        };
        // Вешаем на разные события, чтобы повысить шанс срабатывания
        document.body.addEventListener('click', wakeAudio, { once: true, capture: true });
        document.body.addEventListener('touchstart', wakeAudio, { once: true, capture: true });
        document.body.addEventListener('keydown', wakeAudio, { once: true, capture: true });
    } else {
        console.warn(`Не найден <audio> элемент для ноты: ${note}`);
    }
});
console.log("Загруженные аудио элементы:", audioElements);

// --- Состояние нажатых клавиш ---
// Отслеживаем, каким способом нажата каждая клавиша
const espPressedNotes = new Set();      // Ноты, нажатые через ESP32
const uiPressedNotes = new Set();       // Ноты, зажатые мышкой/пальцем
const keyboardPressedNotes = new Set(); // Ноты, зажатые на клавиатуре

// --- WebSocket Логика ---
let socket;

function connectWebSocket() {
    console.log("Попытка подключения к WebSocket:", WEBSOCKET_URL);
    wsStatusElement.textContent = "Статус WebSocket: Подключение...";
    // Закрываем предыдущее соединение, если оно есть
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
    }

    socket = new WebSocket(WEBSOCKET_URL);

    socket.onopen = function() {
        console.log("WebSocket подключен!");
        wsStatusElement.textContent = "Статус WebSocket: Подключено";
        // Сброс состояния при (пере)подключении
        pianoKeys.forEach(key => key.classList.remove('active'));
        espPressedNotes.clear();
        uiPressedNotes.clear();
        keyboardPressedNotes.clear();
    };

    socket.onmessage = function(event) {
        const message = event.data;
        console.log("Получено от ESP32: " + message);
        const [note, state] = message.split('_'); // e.g., "c4_on" -> ["c4", "on"]

        if (audioElements[note]) { // Проверяем, что для этой ноты есть аудио
            if (state === "on") {
                // Воспроизводим звук, только если клавиша еще не нажата другими способами
                if (!isNotePressed(note)) {
                    playSound(note);
                }
                espPressedNotes.add(note); // Регистрируем нажатие от ESP
                visualKeyPress(note, true); // Показываем нажатие визуально
            } else if (state === "off") {
                espPressedNotes.delete(note); // Убираем регистрацию нажатия от ESP
                // НЕ останавливаем звук! Звук играет до конца сам.
                visualKeyPress(note, false); // Пытаемся убрать подсветку (если не нажата иначе)
            }
        } else {
            console.warn("Неизвестное сообщение или нет аудио элемента для ноты от ESP32:", message);
        }
    };

    socket.onerror = function(error) {
        console.error("Ошибка WebSocket:", error);
        wsStatusElement.textContent = "Статус WebSocket: Ошибка";
    };

    socket.onclose = function(event) {
        console.log("WebSocket закрыт. Код:", event.code, "Причина:", event.reason);
        wsStatusElement.textContent = `Статус WebSocket: Закрыто (код ${event.code}). Переподключение через 5 сек...`;
        // Сброс состояния при закрытии
        pianoKeys.forEach(key => key.classList.remove('active'));
        espPressedNotes.clear();
        uiPressedNotes.clear();
        keyboardPressedNotes.clear();
        // Попытка переподключения через 5 секунд
        setTimeout(connectWebSocket, 5000);
    };
}

// --- Функция проверки, нажата ли нота каким-либо способом ---
function isNotePressed(note) {
    // Возвращает true, если нота зарегистрирована хотя бы в одном из Set'ов
    return espPressedNotes.has(note) || uiPressedNotes.has(note) || keyboardPressedNotes.has(note);
}


// --- Функции Звука ---
function playSound(note) {
    const audio = audioElements[note];
    if (audio) {
        audio.currentTime = 0; // **Критически важно:** Сброс на начало для чистого перезапуска звука
        audio.play().catch(e => console.error(`Ошибка воспроизведения ${note}:`, e));
        console.log("Играем " + note);
    } else {
        console.warn("Нет аудио элемента для ноты:", note);
    }
}

// Функция stopSound БОЛЬШЕ НЕ ИСПОЛЬЗУЕТСЯ при отпускании клавиши,
// так как звук должен доиграть до естественного конца.
// Оставляем ее на случай, если понадобится принудительная остановка в будущем.
/*
function stopSound(note) {
    const audio = audioElements[note];
    if (audio) {
        audio.pause();
        audio.currentTime = 0; // Сброс на начало
        console.log("Принудительно остановлен " + note);
    }
}
*/

// --- Визуализация ---
function visualKeyPress(note, isPressed) {
    // Находим элемент клавиши по data-note атрибуту
    const keyElement = document.querySelector(`.key[data-note="${note}"]`);
    if (keyElement) {
        if (isPressed) {
            // Просто добавляем класс, если нужно показать нажатие
            keyElement.classList.add('active');
        } else {
            // Убираем класс `.active`, ТОЛЬКО если нота НЕ удерживается ни одним из способов
            if (!isNotePressed(note)) {
                 keyElement.classList.remove('active');
            }
            // Если нота все еще удерживается другим способом, класс 'active' останется
        }
    } else {
        console.warn("Не найден визуальный элемент для ноты:", note);
    }
}


// --- Обработчики событий для UI (Мышь/Тач) ---

function handleInteractionStart(note) {
    if (!audioElements[note]) return; // Игнорировать, если для ноты нет аудио

    // Воспроизводим звук, только если клавиша еще не была нажата (другим способом)
    if (!isNotePressed(note)) {
        playSound(note);
    }
    uiPressedNotes.add(note); // Регистрируем нажатие через UI
    visualKeyPress(note, true); // Показываем нажатие
    console.log(`UI Нажатие: ${note}`);
}

function handleInteractionEnd(note) {
     if (!audioElements[note]) return;

    // Проверяем, было ли нажатие зарегистрировано через UI
    if (uiPressedNotes.has(note)) {
        console.log(`UI Отпускание: ${note}`);
        uiPressedNotes.delete(note); // Убираем регистрацию UI нажатия
        // НЕ останавливаем звук!
        visualKeyPress(note, false); // Пытаемся убрать подсветку
    }
}

// Навешиваем обработчики на все клавиши с data-note
pianoKeys.forEach(key => {
    const note = key.dataset.note;
    if (note) {
        // Мышь
        key.addEventListener('mousedown', () => handleInteractionStart(note));
        key.addEventListener('mouseup', () => handleInteractionEnd(note));
        // Обрабатываем случай, когда пользователь уводит мышь с зажатой кнопки
        key.addEventListener('mouseleave', () => handleInteractionEnd(note));

        // Тачскрин
        key.addEventListener('touchstart', (e) => {
             // Предотвращаем стандартное поведение (скролл, эмуляция клика)
            e.preventDefault();
            handleInteractionStart(note);
        }, { passive: false }); // passive: false необходимо для preventDefault()
        key.addEventListener('touchend', () => handleInteractionEnd(note));
        // toucancel может понадобиться для некоторых случаев
        key.addEventListener('touchcancel', () => handleInteractionEnd(note));
    }
});


// --- Обработчики событий для Клавиатуры ---

// Создаем карту "Клавиша клавиатуры -> Нота"
const keyNoteMap = {};
pianoKeys.forEach(key => {
    const note = key.dataset.note;
    const kbdKey = key.dataset.key; // Получаем значение data-key
    if (note && kbdKey) {
        keyNoteMap[kbdKey.toLowerCase()] = note; // Сохраняем в нижнем регистре
    }
});
console.log("Карта клавиш клавиатуры:", keyNoteMap);


window.addEventListener('keydown', (event) => {
    // Игнорировать, если нажата клавиша-модификатор, происходит повтор, или фокус в поле ввода
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    const pressedKey = event.key.toLowerCase(); // Клавиша в нижнем регистре
    const note = keyNoteMap[pressedKey]; // Находим соответствующую ноту

    if (note && audioElements[note]) { // Если нота найдена и для нее есть аудио
         // Воспроизводим звук, только если клавиша еще не была нажата другими способами
        if (!isNotePressed(note)) {
            playSound(note);
        }
        // Регистрируем нажатие клавиатурой, даже если уже нажата, чтобы отследить keyup
        keyboardPressedNotes.add(note);
        visualKeyPress(note, true); // Показываем нажатие
        console.log(`Клавиатура Нажатие: ${pressedKey} -> ${note}`);
    }
});

window.addEventListener('keyup', (event) => {
    const releasedKey = event.key.toLowerCase();
    const note = keyNoteMap[releasedKey];

    // Проверяем, была ли эта нота зажата именно клавиатурой
    if (note && keyboardPressedNotes.has(note)) {
        console.log(`Клавиатура Отпускание: ${releasedKey} -> ${note}`);
        keyboardPressedNotes.delete(note); // Убираем регистрацию нажатия клавиатурой
        // НЕ останавливаем звук!
        visualKeyPress(note, false); // Пытаемся убрать подсветку
    }
});


// --- Запуск ---
console.log("Пианино инициализировано. Подключение к WebSocket...");
// Начинаем подключение WebSocket при загрузке скрипта
connectWebSocket();