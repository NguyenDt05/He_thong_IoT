# ESP32 firmware

Open `esp32_iot.ino` in Arduino IDE with an ESP32 board selected. Install the
`PubSubClient`, `ArduinoJson` and `DHT sensor library` dependencies. Copy
`secrets.h.example` to `secrets.h` and set the Wi-Fi and MQTT credentials there.
The MQTT broker must match `BE/.env`. `secrets.h` is ignored by Git.

Open Serial Monitor at 115200 baud and reset the board to see connection logs.
The firmware reports the Wi-Fi status every 10 seconds while disconnected and
the MQTT state every 5 seconds after Wi-Fi connects. A successful startup prints
`Wi-Fi connected` and `MQTT connected`, then sensor readings every 2 seconds.
If MQTT reports state `-2`, check that the broker address and port are reachable
from the ESP32 network; state `4` or `5` indicates an authentication or
authorization failure. The board retries both connections automatically.

The board listens to `device/control`. IDs 1, 2 and 3 control individual LEDs;
ID 0 controls all three. After a command, it publishes one `device/status`
message for each affected LED using its real ID and requested steady state. Group command
responses include `groupCommand: true`, so the backend records three history
rows; periodic status reports do not create history. It also reports
all three states after MQTT reconnection and every five seconds. The backend
uses these messages to update `devices.status`; Dashboard polls `/api/devices`.

Each sensor controls one alert LED: temperature blinks LED 1, humidity blinks
LED 2, and light blinks LED 3 when its configured threshold is exceeded.
The LED changes every 500 ms
while its sensor remains above the threshold. Manual ON/OFF commands set the
steady state restored when the alert ends. During an alert, `device/status`
reports that requested steady state rather than each blink phase, so the
backend does not fill action history with blink transitions. The Dashboard
fetches daily crossing counts and editable thresholds from `/api/hardware/alerts`.
The backend publishes the current thresholds to the retained MQTT topic
`sensor/thresholds` as `{ "temperature": 35, "humidity": 80, "light": 80 }`
on connection and after a Dashboard edit. The board subscribes on every MQTT
connection and stores received values in ESP32 Preferences, so rebooting while
offline keeps the last configuration. The original 35/80/80 values are only
first-boot fallbacks. Flash this firmware once to enable live threshold updates.

For a terminal command, omit `actionId` because it is reserved for commands
created by the Dashboard. Example payload:

```json
{"deviceId":0,"command":"ON"}
```

Expected group status payloads are `{"deviceId":1,"status":"ON","groupCommand":true}`
and the same for IDs 2 and 3. The backend updates `devices.status` and records
one successful action per LED in `action_history` after receiving these replies.
