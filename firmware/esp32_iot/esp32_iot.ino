#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include "secrets.h"

#define DHT_PIN 13
#define DHT_TYPE DHT11
#define LIGHT_PIN 34
#define LED1_PIN 25  // LED đỏ: nhiệt độ
#define LED2_PIN 18  // LED vàng: độ ẩm
#define LED3_PIN 19  // LED xanh: ánh sáng

const char* CONTROL_TOPIC = "device/control";
const char* STATUS_TOPIC = "device/status";
const char* SENSOR_TOPIC = "sensor/data";

const unsigned long SENSOR_INTERVAL_MS = 2000;
const unsigned long STATUS_INTERVAL_MS = 5000;
const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
const unsigned long MQTT_RETRY_INTERVAL_MS = 5000;
const unsigned long ALERT_BLINK_INTERVAL_MS = 500;
const float TEMPERATURE_ALERT_THRESHOLD = 35.0;
const float HUMIDITY_ALERT_THRESHOLD = 80.0;
const float LIGHT_ALERT_THRESHOLD = 80.0;

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
unsigned long lastSend = 0;
unsigned long lastStatusSend = 0;
unsigned long lastWifiRetry = 0;
unsigned long lastMqttRetry = 0;
unsigned long lastBlinkToggle = 0;
bool wifiWasConnected = false;
bool requestedOn[3] = { false, false, false };
bool alertActive[3] = { false, false, false };
bool blinkOn = true;

int ledPin(int deviceId) {
  if (deviceId == 1) return LED1_PIN;
  if (deviceId == 2) return LED2_PIN;
  if (deviceId == 3) return LED3_PIN;
  return -1;
}

bool hasActiveAlert() {
  return alertActive[0] || alertActive[1] || alertActive[2];
}

void applyLedOutputs() {
  for (int id = 1; id <= 3; id++) {
    digitalWrite(ledPin(id), alertActive[id - 1]
      ? (blinkOn ? HIGH : LOW)
      : (requestedOn[id - 1] ? HIGH : LOW));
  }
}

void updateAlerts(float temperature, float humidity, float light) {
  const bool nextAlerts[3] = {
    !isnan(temperature) && temperature > TEMPERATURE_ALERT_THRESHOLD,
    !isnan(humidity) && humidity > HUMIDITY_ALERT_THRESHOLD,
    light > LIGHT_ALERT_THRESHOLD,
  };
  for (int i = 0; i < 3; i++) {
    if (nextAlerts[i] && !alertActive[i]) {
      blinkOn = true;
      lastBlinkToggle = millis();
    }
    alertActive[i] = nextAlerts[i];
  }
  applyLedOutputs();
}

void publishDeviceStatus(int deviceId, int actionId = 0, bool groupCommand = false) {
  const int pin = ledPin(deviceId);
  if (pin < 0 || !mqttClient.connected()) return;

  JsonDocument response;
  // An actionId belongs to one Dashboard command. Broadcast commands have none.
  if (actionId > 0) response["actionId"] = actionId;
  response["deviceId"] = deviceId;
  // Report the requested steady state. Blink phases must not create device history.
  response["status"] = requestedOn[deviceId - 1] ? "ON" : "OFF";
  if (groupCommand) response["groupCommand"] = true;

  char json[128];
  serializeJson(response, json, sizeof(json));
  if (!mqttClient.publish(STATUS_TOPIC, json)) {
    Serial.printf("Failed to publish status for LED %d\n", deviceId);
  }
}

void publishAllDeviceStatuses() {
  for (int deviceId = 1; deviceId <= 3; deviceId++) {
    publishDeviceStatus(deviceId);
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (String(topic) != CONTROL_TOPIC) return;

  JsonDocument commandDoc;
  if (deserializeJson(commandDoc, payload, length)) {
    Serial.println("Invalid device/control JSON");
    return;
  }

  const int deviceId = commandDoc["deviceId"] | -1;
  const String command = commandDoc["command"] | "";
  if (command != "ON" && command != "OFF") return;

  // Giữ cách xử lý if/else của bản gốc; applyLedOutputs quyết định
  // chân LED đang theo lệnh thủ công hay đang nhấp nháy vì cảnh báo.
  if (deviceId == 1 && command == "ON") requestedOn[0] = true;
  else if (deviceId == 1 && command == "OFF") requestedOn[0] = false;
  else if (deviceId == 2 && command == "ON") requestedOn[1] = true;
  else if (deviceId == 2 && command == "OFF") requestedOn[1] = false;
  else if (deviceId == 3 && command == "ON") requestedOn[2] = true;
  else if (deviceId == 3 && command == "OFF") requestedOn[2] = false;
  else if (deviceId == 0 && command == "ON") {
    for (int i = 0; i < 3; i++) requestedOn[i] = true;
  } else if (deviceId == 0 && command == "OFF") {
    for (int i = 0; i < 3; i++) requestedOn[i] = false;
  } else return;

  applyLedOutputs();

  if (deviceId == 0) {
    // Backend lưu ba LED riêng nên lệnh nhóm phải phản hồi ba trạng thái.
    for (int id = 1; id <= 3; id++) publishDeviceStatus(id, 0, true);
  } else {
    const int actionId = commandDoc["actionId"] | 0;
    publishDeviceStatus(deviceId, actionId);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 starting");
  dht.begin();
  pinMode(LIGHT_PIN, INPUT);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(LED3_PIN, OUTPUT);
  digitalWrite(LED1_PIN, LOW);
  digitalWrite(LED2_PIN, LOW);
  digitalWrite(LED3_PIN, LOW);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  lastWifiRetry = millis();
  Serial.println("Connecting to Wi-Fi...");

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  const bool wifiConnected = WiFi.status() == WL_CONNECTED;
  if (wifiConnected != wifiWasConnected) {
    wifiWasConnected = wifiConnected;
    if (wifiConnected) {
      Serial.print("Wi-Fi connected, IP: ");
      Serial.println(WiFi.localIP());
      lastMqttRetry = 0;
    } else {
      Serial.println("Wi-Fi disconnected");
    }
  }
  if (!wifiConnected && millis() - lastWifiRetry >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiRetry = millis();
    Serial.printf("Wi-Fi retry, status=%d\n", WiFi.status());
    WiFi.reconnect();
  }

  if (wifiConnected && !mqttClient.connected()
      && (lastMqttRetry == 0 || millis() - lastMqttRetry >= MQTT_RETRY_INTERVAL_MS)) {
    lastMqttRetry = millis();
    char clientId[32];
    snprintf(clientId, sizeof(clientId), "ESP32_Client_%08X", (uint32_t)ESP.getEfuseMac());
    if (mqttClient.connect(clientId, MQTT_USER, MQTT_PASS)) {
      Serial.println("MQTT connected");
      if (!mqttClient.subscribe(CONTROL_TOPIC)) {
        Serial.println("Failed to subscribe to device/control");
      }
      // Restore the backend's view after a board or MQTT reconnection.
      publishAllDeviceStatuses();
      lastStatusSend = millis();
    } else {
      Serial.printf("MQTT connection failed, state=%d\n", mqttClient.state());
    }
  }

  if (mqttClient.connected()) mqttClient.loop();

  if (hasActiveAlert() && millis() - lastBlinkToggle >= ALERT_BLINK_INTERVAL_MS) {
    lastBlinkToggle = millis();
    blinkOn = !blinkOn;
    applyLedOutputs();
  }

  // Repeat status so the backend can recover from a missed QoS 0 message.
  if (mqttClient.connected() && millis() - lastStatusSend >= STATUS_INTERVAL_MS) {
    lastStatusSend = millis();
    publishAllDeviceStatuses();
  }

  if (millis() - lastSend >= SENSOR_INTERVAL_MS) {
    lastSend = millis();
    const float t = dht.readTemperature();
    const float h = dht.readHumidity();
    const int rawLight = analogRead(LIGHT_PIN);
    const float lightPercent = (4095.0 - rawLight) / 4095.0 * 100.0;

    updateAlerts(t, h, lightPercent);

    Serial.print(t);
    Serial.print("||");
    Serial.print(h);
    Serial.print("||");
    Serial.println(lightPercent);

    if (isnan(t) || isnan(h)) return;

    JsonDocument sensorDoc;
    sensorDoc["temperature"] = t;
    sensorDoc["humidity"] = h;
    sensorDoc["light"] = lightPercent;
    char json[128];
    serializeJson(sensorDoc, json, sizeof(json));
    mqttClient.publish(SENSOR_TOPIC, json);
  }
}
