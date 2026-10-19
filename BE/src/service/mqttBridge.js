const mqtt = require("mqtt");
const hardware = require("../repos/hardwareRP");

const SENSOR_TOPIC = "sensor/data";
const CONTROL_TOPIC = "device/control";
const STATUS_TOPIC = "device/status";
const DEVICE_IDS = new Set((process.env.MQTT_DEVICE_IDS || "1,2,3").split(",")
    .map((id) => Number(id.trim())).filter((id) => Number.isSafeInteger(id) && id > 0));

let client = null;
let lastSensorMessageAt = 0;

function isControllableDeviceId(id) {
    return DEVICE_IDS.has(Number(id));
}

function isSensorStreamLive(now = Date.now()) {
    const staleMs = Number(process.env.HARDWARE_STALE_MS) > 0 ? Number(process.env.HARDWARE_STALE_MS) : 6000;
    return Boolean(client?.connected) && lastSensorMessageAt > 0 && now - lastSensorMessageAt <= staleMs;
}

function parseSensorMessage(payload, ids) {
    const message = JSON.parse(payload.toString());
    const mapping = [
        ["TEMPERATURE", "temperature"],
        ["HUMIDITY", "humidity"],
        ["LIGHT", "light"],
    ];
    if (!message || typeof message !== "object" || Array.isArray(message)) {
        throw new Error("Gói sensor/data không hợp lệ");
    }
    return mapping.map(([type, key]) => {
        const value = message[key];
        if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 99999999.99) {
            throw new Error(`Giá trị ${key} không hợp lệ`);
        }
        return { sensorId: ids[type], value };
    });
}

function parseDeviceStatus(payload) {
    const message = JSON.parse(payload.toString());
    const actionId = message?.actionId == null || message.actionId === 0 ? null : message.actionId;
    if (!message || (actionId !== null && (!Number.isSafeInteger(actionId) || actionId < 1))
        || !Number.isSafeInteger(message.deviceId) || message.deviceId < 1
        || !["ON", "OFF"].includes(message.status)) {
        throw new Error("Gói device/status không hợp lệ");
    }
    return { actionId, deviceId: message.deviceId, status: message.status };
}

function controlMessage(command) {
    return JSON.stringify({ actionId: command.id, deviceId: command.deviceId, command: command.action });
}

function startMqttBridge() {
    if (!process.env.MQTT_URL) {
        console.warn("MQTT_URL chưa được cấu hình; mạch chưa thể gửi dữ liệu vào backend.");
        return null;
    }
    if (client) return client;

    client = mqtt.connect(process.env.MQTT_URL, {
        username: process.env.MQTT_USER || undefined,
        password: process.env.MQTT_PASSWORD || undefined,
        clientId: `iot-backend-${process.pid}-${Math.random().toString(16).slice(2, 10)}`,
        reconnectPeriod: 2000,
        queueQoSZero: false,
    });

    client.on("connect", () => {
        client.subscribe([SENSOR_TOPIC, STATUS_TOPIC], { qos: 0 }, (error) => {
            if (error) console.error("Không thể đăng ký topic MQTT:", error.message);
        });
    });
    client.on("error", (error) => console.error("Lỗi MQTT:", error.message));
    client.on("close", () => { lastSensorMessageAt = 0; });

    let sensorQueue = Promise.resolve();
    client.on("message", (topic, payload) => {
        if (topic === SENSOR_TOPIC) {
            sensorQueue = sensorQueue.then(async () => {
                const readings = parseSensorMessage(payload, await hardware.sensorIds());
                await hardware.saveReadings(readings);
                lastSensorMessageAt = Date.now();
            }).catch((error) => console.error("Không thể lưu sensor/data:", error.message));
        } else if (topic === STATUS_TOPIC) {
            try {
                const message = parseDeviceStatus(payload);
                hardware.saveDeviceStatus(message.actionId, message.deviceId, message.status)
                    .catch((error) => console.error("Không thể lưu device/status:", error.message));
            } catch (error) {
                console.error("Bỏ qua device/status:", error.message);
            }
        }
    });

    let scanning = false;
    const timer = setInterval(async () => {
        if (!client?.connected || scanning) return;
        scanning = true;
        try {
            for (const command of await hardware.pendingCommands()) {
                if (!isControllableDeviceId(command.deviceId)) continue;
                const payload = controlMessage(command);
                client.publish(CONTROL_TOPIC, payload, { qos: 0, retain: false }, (error) => {
                    if (error) console.error("Không thể gửi device/control:", error.message);
                });
            }
        } catch (error) {
            console.error("Không thể tải lệnh MQTT:", error.message);
        } finally {
            scanning = false;
        }
    }, 1000);
    client.on("end", () => clearInterval(timer));
    return client;
}

module.exports = { startMqttBridge, isSensorStreamLive, isControllableDeviceId, parseSensorMessage, parseDeviceStatus, controlMessage };
