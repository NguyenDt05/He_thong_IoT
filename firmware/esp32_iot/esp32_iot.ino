#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Preferences.h>
#include "secrets.h"

// Cấu hình phần cứng: một cảm biến DHT, một cảm biến ánh sáng và ba LED cảnh báo.
#define DHT_PIN 13
#define DHT_TYPE DHT11
#define LIGHT_PIN 34
#define LED1_PIN 25  // LED đỏ: nhiệt độ
#define LED2_PIN 18  // LED vàng: độ ẩm
#define LED3_PIN 19  // LED xanh: ánh sáng

// Các topic MQTT dùng để trao đổi dữ liệu, lệnh và trạng thái với backend.
const char* CONTROL_TOPIC = "device/control";
const char* STATUS_TOPIC = "device/status";
const char* SENSOR_TOPIC = "sensor/data";
const char* THRESHOLD_TOPIC = "sensor/thresholds";    // nhận ngưỡng cảnh báo từ backend

// Chu kỳ gửi dữ liệu, báo trạng thái, thử kết nối lại và nhấp nháy LED.
const unsigned long SENSOR_MS = 2000;
const unsigned long STATUS_MS = 5000;
const unsigned long WIFI_RETRY_MS = 10000;
const unsigned long MQTT_RETRY_MS = 5000;
const unsigned long BLINK_MS = 500;       // Chu kỳ nhấp nháy LED cảnh báo
// Ngưỡng mặc định khi NVS chưa có dữ liệu và MQTT chưa gửi ngưỡng mới.
float thresholds[3] = { 35.0, 80.0, 80.0 };
const char* nvsKeys[3] = { "temp", "humidity", "light" };
Preferences prefs;    // Lưu trữ ngưỡng cảnh báo vào NVS để giữ qua các lần khởi động.
bool prefsReady = false; // NVS đã sẵn sàng để đọc/ghi ngưỡng cảnh báo.

// Đối tượng kết nối và trạng thái cần giữ giữa các lần chạy loop().
DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
unsigned long lastSend = 0;
unsigned long lastStatus = 0;
unsigned long lastWifiTry = 0;
unsigned long lastMqttTry = 0;
unsigned long lastBlink = 0;
bool wifiWasConnected = false;
bool requestedOn[3] = { false, false, false };
bool alertActive[3] = { false, false, false };
bool blinkOn = true; 

// Ánh xạ deviceId trong lệnh MQTT sang chân LED tương ứng.
int ledPin(int deviceId) {
  if (deviceId == 1) return LED1_PIN;
  if (deviceId == 2) return LED2_PIN;
  if (deviceId == 3) return LED3_PIN;
  return -1;
}

// Kiểm tra xem có LED cảnh báo nào đang nhấp nháy hay không.
bool hasActiveAlert() {
  return alertActive[0] || alertActive[1] || alertActive[2];
}

// Cảnh báo được ưu tiên hiển thị bằng nhấp nháy; nếu không, LED theo lệnh ON/OFF.
void applyLedOutputs() {
  for (int id = 1; id <= 3; id++) {
    digitalWrite(ledPin(id), alertActive[id - 1] ? (blinkOn ? HIGH : LOW) : (requestedOn[id - 1] ? HIGH : LOW));
  }
}

// So sánh số đo với ngưỡng và bắt đầu nhấp nháy khi có cảnh báo mới.
void updateAlerts(float temperature, float humidity, float light) {
  const bool nextAlerts[3] = {
    !isnan(temperature) && temperature > thresholds[0],
    !isnan(humidity) && humidity > thresholds[1],
    !isnan(light) && light > thresholds[2],
  };
  // Cập nhật trạng thái cảnh báo và bắt đầu nhấp nháy nếu có cảnh báo mới.
  for (int i = 0; i < 3; i++) {     // 
    if (nextAlerts[i] && !alertActive[i]) {
      blinkOn = true;
      lastBlink = millis();
    }
    alertActive[i] = nextAlerts[i];
  }
  applyLedOutputs();
}

// Báo trạng thái ON/OFF được yêu cầu về backend, độc lập với pha nhấp nháy hiện tại.
void publishDeviceStatus(int deviceId, int actionId = 0, bool groupCommand = false) {
  const int pin = ledPin(deviceId);
  if (pin < 0 || !mqttClient.connected()) return;

  JsonDocument response;
  if (actionId > 0) response["actionId"] = actionId;
  response["deviceId"] = deviceId;
  response["status"] = requestedOn[deviceId - 1] ? "ON" : "OFF";
  if (groupCommand) response["groupCommand"] = true;

  char json[128];
  serializeJson(response, json, sizeof(json));
  if (!mqttClient.publish(STATUS_TOPIC, json)) {
    Serial.printf("Failed to publish status for LED %d\n", deviceId);
  }
}

// Đồng bộ trạng thái cả ba LED khi vừa kết nối và theo chu kỳ.
void publishAllDeviceStatuses() {
  for (int deviceId = 1; deviceId <= 3; deviceId++) {
    publishDeviceStatus(deviceId);
  }
}

// Xử lý hai loại thông điệp nhận từ backend: ngưỡng cảnh báo và lệnh điều khiển.
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (String(topic) == THRESHOLD_TOPIC) {
    // Chỉ chấp nhận đủ ba ngưỡng hợp lệ rồi lưu các giá trị thay đổi vào NVS.
    JsonDocument settings;
    if (deserializeJson(settings, payload, length)) {
      Serial.println("Invalid sensor/thresholds JSON");
      return;
    }
    if (!settings["temperature"].is<float>()
        || !settings["humidity"].is<float>()
        || !settings["light"].is<float>()) {
      Serial.println("Invalid sensor/thresholds values");
      return;
    }
    const float next[3] = {
      settings["temperature"].as<float>(),
      settings["humidity"].as<float>(),
      settings["light"].as<float>(),
    };
    if (!isfinite(next[0]) || next[0] < -40 || next[0] > 125
        || !isfinite(next[1]) || next[1] < 0 || next[1] > 100
        || !isfinite(next[2]) || next[2] < 0 || next[2] > 100) {
      Serial.println("Out-of-range sensor/thresholds values");
      return;
    }
    for (int i = 0; i < 3; i++) {
      if (fabsf(thresholds[i] - next[i]) < 0.001f) continue;
      thresholds[i] = next[i];
      if (prefsReady) prefs.putFloat(nvsKeys[i], next[i]);
    }
    Serial.printf("Thresholds updated: %.2f, %.2f, %.2f\n",
      thresholds[0], thresholds[1], thresholds[2]);
    return;
  }
  if (String(topic) != CONTROL_TOPIC) return;

  // deviceId 1..3 điều khiển từng LED; deviceId 0 điều khiển cả nhóm.
  JsonDocument cmdDoc;
  if (deserializeJson(cmdDoc, payload, length)) {
    Serial.println("Invalid device/control JSON");
    return;
  }

  const int deviceId = cmdDoc["deviceId"] | -1;
  const String command = cmdDoc["command"] | "";
  if (command != "ON" && command != "OFF") return;

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
    const int actionId = cmdDoc["actionId"] | 0;
    publishDeviceStatus(deviceId, actionId);
  }
}

// Khởi tạo chân GPIO, đọc ngưỡng đã lưu và chuẩn bị kết nối Wi-Fi/MQTT.
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

  prefsReady = prefs.begin("alerts", false);
  if (prefsReady) {
    for (int i = 0; i < 3; i++) {
      const float stored = prefs.getFloat(nvsKeys[i], thresholds[i]);
      const float minValue = i == 0 ? -40.0f : 0.0f;
      const float maxValue = i == 0 ? 125.0f : 100.0f;
      if (isfinite(stored) && stored >= minValue && stored <= maxValue) thresholds[i] = stored;
    }
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  lastWifiTry = millis();
  Serial.println("Connecting to Wi-Fi...");

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

// Vòng lặp không chặn: duy trì kết nối, cập nhật LED và gửi dữ liệu định kỳ.
void loop() {
  // Theo dõi Wi-Fi và thử kết nối lại sau mỗi khoảng chờ khi bị ngắt.
  const bool wifiConnected = WiFi.status() == WL_CONNECTED;
  if (wifiConnected != wifiWasConnected) {
    wifiWasConnected = wifiConnected;
    if (wifiConnected) {
      Serial.print("Wi-Fi connected, IP: ");
      Serial.println(WiFi.localIP());
      lastMqttTry = 0;
    } else {
      Serial.println("Wi-Fi disconnected");
    }
  }
  if (!wifiConnected && millis() - lastWifiTry >= WIFI_RETRY_MS) {
    lastWifiTry = millis();
    Serial.printf("Wi-Fi retry, status=%d\n", WiFi.status());
    WiFi.reconnect();
  }

  // Khi MQTT kết nối lại, đăng ký topic và báo trạng thái hiện tại cho backend.
  if (wifiConnected && !mqttClient.connected()
      && (lastMqttTry == 0 || millis() - lastMqttTry >= MQTT_RETRY_MS)) {
    lastMqttTry = millis();
    char clientId[32];
    snprintf(clientId, sizeof(clientId), "ESP32_Client_%08X", (uint32_t)ESP.getEfuseMac());
    if (mqttClient.connect(clientId, MQTT_USER, MQTT_PASS)) {
      Serial.println("MQTT connected");
      if (!mqttClient.subscribe(CONTROL_TOPIC)) {
        Serial.println("Failed to subscribe to device/control");
      }
      if (!mqttClient.subscribe(THRESHOLD_TOPIC)) {
        Serial.println("Failed to subscribe to sensor/thresholds");
      }
      publishAllDeviceStatuses();
      lastStatus = millis();
    } else {
      Serial.printf("MQTT connection failed, state=%d\n", mqttClient.state());
    }
  }

  if (mqttClient.connected()) mqttClient.loop();

  // nháy led cảnh báo
  if (hasActiveAlert() && millis() - lastBlink >= BLINK_MS) {
    lastBlink = millis();
    blinkOn = !blinkOn;
    applyLedOutputs();
  }

  if (mqttClient.connected() && millis() - lastStatus >= STATUS_MS) {
    lastStatus = millis();
    publishAllDeviceStatuses();
  }

  // Đọc cảm biến, cập nhật cảnh báo rồi phát số đo hợp lệ lên sensor/data.
  if (millis() - lastSend >= SENSOR_MS) {
    lastSend = millis();
    const float t = dht.readTemperature();
    const float h = dht.readHumidity();
    const int lightRaw = analogRead(LIGHT_PIN);
    const float lightPct = (4095.0 - lightRaw) / 4095.0 * 100.0;

    updateAlerts(t, h, lightPct);  //phát hiện vượt ngưỡng và nhấp nháy LED cảnh báo

    Serial.print(t);
    Serial.print("||");
    Serial.print(h);
    Serial.print("||");
    Serial.println(lightPct);

    if (isnan(t) || isnan(h)) return;

    JsonDocument sensorDoc;
    sensorDoc["temperature"] = t;
    sensorDoc["humidity"] = h;
    sensorDoc["light"] = lightPct;
    char json[128];
    serializeJson(sensorDoc, json, sizeof(json));
    mqttClient.publish(SENSOR_TOPIC, json);
  }
}
