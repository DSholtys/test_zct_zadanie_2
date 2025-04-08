#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>

#define TOUCH_PIN_C4  T0  // GPIO 4
#define TOUCH_PIN_D4  T3  // GPIO 15
#define TOUCH_PIN_E4  T2  // GPIO 2
#define TOUCH_PIN_F4  T4  // GPIO 13
#define TOUCH_PIN_G4  T5  // GPIO 12
#define TOUCH_PIN_A4  T6  // GPIO 14
#define TOUCH_PIN_B4  T7  // GPIO 27
#define TOUCH_PIN_C5  T8  // GPIO 33

const char* ssid = "golovchyk";
const char* password = "123123123";
WebSocketsServer webSocket = WebSocketsServer(81);

bool pressed[8] = {false}; // Состояния для 8 нот
unsigned long lastPressTime[8] = {0}; // Время последнего срабатывания
const unsigned long debounceDelay = 100; // Задержка в миллисекундах

void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("Клиент [%u] отключился\n", num);
      break;
    case WStype_CONNECTED:
      Serial.printf("Клиент [%u] подключился\n", num);
      break;
    case WStype_TEXT:
      Serial.printf("Получено от [%u]: %s\n", num, payload);
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Подключение к Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi подключен!");
  Serial.println("IP-адрес: ");
  Serial.println(WiFi.localIP());

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();

  int pins[8] = {TOUCH_PIN_C4, TOUCH_PIN_D4, TOUCH_PIN_E4, TOUCH_PIN_F4, TOUCH_PIN_G4,
                 TOUCH_PIN_A4, TOUCH_PIN_B4, TOUCH_PIN_C5};
  const char* notes_on[8] = {"c4_on", "d4_on", "e4_on", "f4_on", "g4_on",
                             "a4_on", "b4_on", "c5_on"};
  const char* notes_off[8] = {"c4_off", "d4_off", "e4_off", "f4_off", "g4_off",
                              "a4_off", "b4_off", "c5_off"};

  unsigned long currentTime = millis();

  for (int i = 0; i < 8; i++) {
    int touchValue = touchRead(pins[i]);
    if (touchValue < 50 && !pressed[i] && (currentTime - lastPressTime[i] > debounceDelay)) {
      webSocket.broadcastTXT(notes_on[i]);
      pressed[i] = true;
      lastPressTime[i] = currentTime;
      Serial.println(notes_on[i]);
      

    }
    else if (touchValue >= 50 && pressed[i] && (currentTime - lastPressTime[i] > debounceDelay)) {
      webSocket.broadcastTXT(notes_off[i]);
      pressed[i] = false;
      lastPressTime[i] = currentTime;
      Serial.println(notes_off[i]);
      
    }
  }
  delay(10);
}