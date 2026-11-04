const mqtt = require("mqtt");
const hardware = require("../repos/hardwareRP");
const alerts = require("../repos/alertRP");

// Topic phải khớp với firmware: ESP32 gửi số đo/trạng thái và nhận lệnh/ngưỡng.
const SENSOR_TOPIC = "sensor/data";
const CONTROL_TOPIC = "device/control";
const STATUS_TOPIC = "device/status";
const THRESHOLD_TOPIC = "sensor/thresholds";
const DEVICE_IDS = new Set((process.env.MQTT_DEVICE_IDS || "1,2,3").split(",")
    .map((id) => Number(id.trim())).filter((id) => Number.isSafeInteger(id) && id > 0));

let client = null;
let lastSensorMessageAt = 0;

// Chỉ cho phép gửi lệnh tới các LED đã khai báo trong cấu hình backend.
function isControllableDeviceId(id) {
    return DEVICE_IDS.has(Number(id));
}

// Luồng cảm biến được xem là đang hoạt động khi MQTT còn nối và có số đo mới.
function isSensorStreamLive(now = Date.now()) {
    const staleMs = Number(process.env.HARDWARE_STALE_MS) > 0 ? Number(process.env.HARDWARE_STALE_MS) : 6000;
    return Boolean(client?.connected) && lastSensorMessageAt > 0 && now - lastSensorMessageAt <= staleMs;
}

// Kiểm tra gói sensor/data rồi đổi tên trường của firmware sang ID cảm biến trong DB.
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

// Kiểm tra trạng thái LED; actionId chỉ xác nhận một lệnh riêng từ Dashboard.
function parseDeviceStatus(payload) {
    const message = JSON.parse(payload.toString());
    const actionId = message?.actionId == null || message.actionId === 0 ? null : message.actionId;
    if (!message || (actionId !== null && (!Number.isSafeInteger(actionId) || actionId < 1))
        || !Number.isSafeInteger(message.deviceId) || message.deviceId < 0
        || (message.groupCommand !== undefined && typeof message.groupCommand !== "boolean")
        || (message.groupCommand === true && (message.deviceId === 0 || actionId !== null))
        || !["ON", "OFF"].includes(message.status)) {
        throw new Error("Gói device/status không hợp lệ");
    }
   
    return { actionId: message.deviceId === 0 ? null : actionId,
        deviceId: message.deviceId, status: message.status,
        ...(message.groupCommand === true && { groupCommand: true }) };
}

// Đóng gói lệnh theo ba trường mà mqttCallback() trên ESP32 đọc.
function controlMessage(command) {
    return JSON.stringify({ actionId: command.id, deviceId: command.deviceId, command: command.action });
}

// Gửi ngưỡng hiện tại với retain để ESP32 nhận lại sau khi kết nối MQTT.
async function publishThresholds(thresholds) {
    if (!client?.connected) return false;
    const payload = JSON.stringify({
        temperature: thresholds.TEMPERATURE,
        humidity: thresholds.HUMIDITY,
        light: thresholds.LIGHT,
    });
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        client.publish(THRESHOLD_TOPIC, payload, { qos: 1, retain: true }, (error) => {
            clearTimeout(timeout);
            if (error) console.error("Không thể gửi sensor/thresholds:", error.message);
            resolve(!error);
        });
    });
}

// Tạo cầu nối MQTT một lần và đăng ký các luồng trao đổi với ESP32.
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

    // Khi kết nối lại, đăng ký topic nhận và đồng bộ ngưỡng từ cơ sở dữ liệu.
    client.on("connect", () => {
        client.subscribe([SENSOR_TOPIC, STATUS_TOPIC], { qos: 0 }, (error) => {
            if (error) console.error("Không thể đăng ký topic MQTT:", error.message);
        });
        alerts.getThresholds().then(publishThresholds).then((published) => {
            if (!published) console.error("Chưa thể đồng bộ ngưỡng lên MQTT");
        }).catch((error) => console.error("Không thể tải ngưỡng cho MQTT:", error.message));
    });
    client.on("error", (error) => console.error("Lỗi MQTT:", error.message));
    client.on("close", () => { lastSensorMessageAt = 0; });

    // Xử lý số đo theo thứ tự để việc ghi DB và thời điểm nhận không bị đảo.
    let sensorQueue = Promise.resolve();
    client.on("message", (topic, payload) => {
        if (topic === SENSOR_TOPIC) {
            sensorQueue = sensorQueue.then(async () => {
                const readings = parseSensorMessage(payload, await hardware.sensorIds());
                await hardware.saveReadings(readings);
                lastSensorMessageAt = Date.now();
            }).catch((error) => console.error("Không thể lưu sensor/data:", error.message));
        } else if (topic === STATUS_TOPIC) {
            // Firmware báo trạng thái ổn định của LED; lưu trạng thái và kết quả lệnh.
            try {
                const message = parseDeviceStatus(payload);
                const save = message.deviceId === 0
                    ? hardware.saveBroadcastDeviceStatus(
                        [1, 2, 3].filter((id) => DEVICE_IDS.has(id)), message.status)
                    : hardware.saveDeviceStatus(message.actionId, message.deviceId, message.status,
                        message.groupCommand === true);
                save
                    .catch((error) => console.error("Không thể lưu device/status:", error.message));
            } catch (error) {
                console.error("Bỏ qua device/status:", error.message);
            }
        }
    });

    // Phát lại các lệnh còn chờ mỗi giây đến khi ESP32 phản hồi hoặc lệnh hết hạn.
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

module.exports = { startMqttBridge, publishThresholds, isSensorStreamLive, isControllableDeviceId,
    parseSensorMessage, parseDeviceStatus, controlMessage };
