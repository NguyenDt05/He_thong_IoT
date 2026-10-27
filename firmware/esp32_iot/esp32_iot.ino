#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <cstring>
#include "secrets.h"

#define DHT_PIN 13
#define DHT_TYPE DHT11
#define LIGHT_PIN 34
#define LED1_PIN 25
#define LED2_PIN 18
#define LED3_PIN 19

const char* CONTROL_TOPIC = "device/control";
const char* STATUS_TOPIC = "device/status";
const char* SENSOR_TOPIC = "sensor/data";
const unsigned long SENSOR_INTERVAL_MS = 2000;
const unsigned long STATUS_INTERVAL_MS = 5000;

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
unsigned long lastSensorSend = 0;
unsigned long lastStatusSend = 0;

int ledPin(int deviceId) {
  if (deviceId == 1) return LED1_PIN;
  if (deviceId == 2) return LED2_PIN;
  if (deviceId == 3) return LED3_PIN;
  return -1;
}

void publishDeviceStatus(int deviceId, int actionId = 0, bool groupCommand = false) {
  const int pin = ledPin(deviceId);
  if (pin < 0 || !mqttClient.connected()) return;

  JsonDocument response;
  // An actionId belongs to one Dashboard command. Broadcast commands have none.
  if (actionId > 0) response["actionId"] = actionId;
  response["deviceId"] = deviceId;
  response["status"] = digitalRead(pin) == HIGH ? "ON" : "OFF";
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
  if (strcmp(topic, CONTROL_TOPIC) != 0) return;

  JsonDocument commandDoc;
  if (deserializeJson(commandDoc, payload, length)) {
    Serial.println("Invalid device/control JSON");
    return;
  }

  const int deviceId = commandDoc["deviceId"] | -1;
  const String command = commandDoc["command"] | "";
  if (command != "ON" && command != "OFF") return;
  const int level = command == "ON" ? HIGH : LOW;

  if (deviceId == 0) {
    // 0 controls all LEDs, but the backend stores IDs 1, 2 and 3 separately.
    for (int id = 1; id <= 3; id++) digitalWrite(ledPin(id), level);
    for (int id = 1; id <= 3; id++) publishDeviceStatus(id, 0, true);
    Serial.println(command == "ON" ? "All LEDs ON" : "All LEDs OFF");
    return;
  }

  const int pin = ledPin(deviceId);
  if (pin < 0) return;
  digitalWrite(pin, level);
  // Echo the actionId only for a command targeting one device.
  const int actionId = commandDoc["actionId"] | 0;
  publishDeviceStatus(deviceId, actionId);
  Serial.printf("LED %d %s\n", deviceId, digitalRead(pin) == HIGH ? "ON" : "OFF");
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(LIGHT_PIN, INPUT);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(LED3_PIN, OUTPUT);
  digitalWrite(LED1_PIN, LOW);
  digitalWrite(LED2_PIN, LOW);
  digitalWrite(LED3_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  if (!mqttClient.connected()) {
    if (mqttClient.connect("ESP32_Client_123", MQTT_USER, MQTT_PASS)) {
      if (!mqttClient.subscribe(CONTROL_TOPIC)) {
        Serial.println("Failed to subscribe to device/control");
      }
      // Restore the backend's view after a board or MQTT reconnection.
      publishAllDeviceStatuses();
      lastStatusSend = millis();
    }
  }

  mqttClient.loop();

  // Repeat status so the backend can recover from a missed QoS 0 message.
  if (mqttClient.connected() && millis() - lastStatusSend >= STATUS_INTERVAL_MS) {
    lastStatusSend = millis();
    publishAllDeviceStatuses();
  }

  if (millis() - lastSensorSend >= SENSOR_INTERVAL_MS) {
    lastSensorSend = millis();
    const float temperature = dht.readTemperature();
    const float humidity = dht.readHumidity();
    const int rawLight = analogRead(LIGHT_PIN);
    const float lightPercent = (4095.0 - rawLight) / 4095.0 * 100.0;

    Serial.print(temperature);
    Serial.print("||");
    Serial.print(humidity);
    Serial.print("||");
    Serial.println(lightPercent);

    if (isnan(temperature) || isnan(humidity)) return;

    JsonDocument sensorDoc;
    sensorDoc["temperature"] = temperature;
    sensorDoc["humidity"] = humidity;
    sensorDoc["light"] = lightPercent;
    char json[128];
    serializeJson(sensorDoc, json, sizeof(json));
    mqttClient.publish(SENSOR_TOPIC, json);
  }
}
