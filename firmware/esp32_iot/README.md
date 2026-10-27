# ESP32 firmware

Open `esp32_iot.ino` in Arduino IDE with an ESP32 board selected. Install the
`PubSubClient`, `ArduinoJson` and `DHT sensor library` dependencies. Copy
`secrets.h.example` to `secrets.h` and set the Wi-Fi and MQTT credentials there.
The MQTT broker must match `BE/.env`. `secrets.h` is ignored by Git.

The board listens to `device/control`. IDs 1, 2 and 3 control individual LEDs;
ID 0 controls all three. After a command, it publishes one `device/status`
message for each affected LED using its real ID and GPIO state. Group command
responses include `groupCommand: true`, so the backend records three history
rows; periodic status reports do not create history. It also reports
all three states after MQTT reconnection and every five seconds. The backend
uses these messages to update `devices.status`; Dashboard polls `/api/devices`.

For a terminal command, omit `actionId` because it is reserved for commands
created by the Dashboard. Example payload:

```json
{"deviceId":0,"command":"ON"}
```

Expected group status payloads are `{"deviceId":1,"status":"ON","groupCommand":true}`
and the same for IDs 2 and 3. The backend updates `devices.status` and records
one successful action per LED in `action_history` after receiving these replies.
