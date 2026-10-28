const db = require("../db");
const alerts = require("./alertRP");
const { formatDateTime } = require("./rowFormat");

const SENSOR_TYPES = ["TEMPERATURE", "HUMIDITY", "LIGHT"];
const STALE_MS = Number(process.env.HARDWARE_STALE_MS) > 0 ? Number(process.env.HARDWARE_STALE_MS) : 6000;
const COMMAND_TIMEOUT_SECONDS = Number(process.env.HARDWARE_COMMAND_TIMEOUT_MS) > 0
    ? Math.ceil(Number(process.env.HARDWARE_COMMAND_TIMEOUT_MS) / 1000) : 30;

async function latestReadings() {
    const [rows] = await db.execute(
        `SELECT s.sensor_type AS sensorType, MAX(ds.created_at) AS lastSeenLocal
         FROM sensors s LEFT JOIN data_sensor ds ON ds.sensor_id = s.sensor_id
         WHERE s.sensor_type IN ('TEMPERATURE', 'HUMIDITY', 'LIGHT')
         GROUP BY s.sensor_type`,
    );
    return rows;
}

async function sensorIds() {
    const [rows] = await db.execute(
        "SELECT sensor_id AS sensorId, sensor_type AS sensorType FROM sensors WHERE sensor_type IN ('TEMPERATURE', 'HUMIDITY', 'LIGHT')",
    );
    const result = {};
    for (const row of rows) {
        if (result[row.sensorType]) throw new Error(`Có nhiều sensor_id cho ${row.sensorType}`);
        result[row.sensorType] = row.sensorId;
    }
    if (!SENSOR_TYPES.every((type) => result[type])) throw new Error("Thiếu cảm biến trong bảng sensors");
    return result;
}

function hardwareStatus(rows, now = Date.now(), streamLive = false) {
    const lastSeen = Object.fromEntries(rows.map((row) =>
        [row.sensorType, formatDateTime(row.lastSeenLocal).iso]));
    const connected = streamLive && SENSOR_TYPES.every((type) => {
        const time = Date.parse(lastSeen[type]);
        return Number.isFinite(time) && now - time >= 0 && now - time <= STALE_MS;
    });
    return { connected, lastSeen, staleAfterMs: STALE_MS, checkedAt: new Date(now).toISOString() };
}

async function saveReadings(readings) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const ids = [...new Set(readings.map((row) => row.sensorId))];
        const [sensors] = await connection.query(
            `SELECT sensor_id AS sensorId, sensor_type AS sensorType
             FROM sensors WHERE sensor_id IN (${ids.map(() => "?").join(",")})`, ids,
        );
        if (sensors.length !== ids.length) {
            const error = new Error("sensorId không tồn tại");
            error.code = "UNKNOWN_SENSOR";
            throw error;
        }
        const [[{ receivedAt }]] = await connection.query(
            "SELECT CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00') AS receivedAt",
        );
        const day = String(receivedAt).slice(0, 10);
        const types = new Map(sensors.map((sensor) => [sensor.sensorId, sensor.sensorType]));
        for (const reading of readings) {
            await connection.execute(
                "INSERT INTO data_sensor (sensor_id, value, created_at) VALUES (?, ?, ?)",
                [reading.sensorId, reading.value, receivedAt],
            );
            await alerts.recordReading(connection, reading.sensorId, types.get(reading.sensorId), reading.value, day);
        }
        await connection.commit();
        return readings.length;
    } catch (error) {
        try { await connection.rollback(); } catch { /* Giao dịch đã hoàn tất. */ }
        throw error;
    } finally {
        connection.release();
    }
}

// Firmware cũ phản hồi deviceId=0 cho một lệnh bật/tắt đồng thời ba LED.
// Đồng bộ trạng thái và ghi ba hành động đã xác nhận trong cùng một transaction.
async function saveBroadcastDeviceStatus(deviceIds, physicalStatus) {
    if (deviceIds.length === 0) return 0;
    const connection = await db.getConnection();
    const placeholders = deviceIds.map(() => "?").join(",");
    try {
        await connection.beginTransaction();
        const [devices] = await connection.execute(
            `SELECT device_id AS deviceId FROM devices WHERE device_id IN (${placeholders}) FOR UPDATE`,
            deviceIds,
        );
        if (devices.length > 0) {
            const ids = devices.map((device) => device.deviceId);
            await connection.execute(
                `UPDATE devices SET status = ? WHERE device_id IN (${ids.map(() => "?").join(",")})`,
                [physicalStatus, ...ids],
            );
            await connection.execute(
                `INSERT INTO action_history (user_id, device_id, action, status)
                 VALUES ${ids.map(() => "(NULL, ?, ?, 'SUCCESS')").join(",")}`,
                ids.flatMap((id) => [id, physicalStatus]),
            );
        }
        await connection.commit();
        return devices.length;
    } catch (error) {
        try { await connection.rollback(); } catch { /* Giao dịch đã hoàn tất. */ }
        throw error;
    } finally {
        connection.release();
    }
}

async function pendingCommands() {
    const [rows] = await db.execute(
        `SELECT action_id AS id, device_id AS deviceId, action FROM action_history
         WHERE status = 'PENDING'
           AND created_at >= DATE_SUB(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'), INTERVAL ? SECOND)
         ORDER BY action_id`,
        [COMMAND_TIMEOUT_SECONDS],
    );
    return rows;
}

// Luôn đồng bộ trạng thái chân vào devices. actionId chỉ dùng để đối chiếu
// lịch sử khi trạng thái là phản hồi của một lệnh do Dashboard tạo.
async function saveDeviceStatus(id, deviceId, physicalStatus, recordExternalAction = false) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[device]] = await connection.execute(
            "SELECT device_id, status FROM devices WHERE device_id = ? FOR UPDATE", [deviceId],
        );
        if (!device) {
            await connection.rollback();
            return null;
        }

        await connection.execute("UPDATE devices SET status = ? WHERE device_id = ?", [physicalStatus, deviceId]);
        let commandStatus = null;
        let dashboardAction = false;
        if (id !== null) {
            const [[command]] = await connection.execute(
                `SELECT action_id, device_id, action, status,
                        created_at < DATE_SUB(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'), INTERVAL ? SECOND) AS expired
                 FROM action_history WHERE action_id = ? AND device_id = ? FOR UPDATE`,
                [COMMAND_TIMEOUT_SECONDS, id, deviceId],
            );
            if (command?.status === "PENDING" && !command.expired) {
                dashboardAction = true;
                commandStatus = command.action === physicalStatus ? "SUCCESS" : "FAILED";
                await connection.execute(
                    "UPDATE action_history SET status = ? WHERE action_id = ?", [commandStatus, id],
                );
            } else if (command?.status === "PENDING" && command.expired) {
                dashboardAction = true;
                commandStatus = "FAILED";
                await connection.execute("UPDATE action_history SET status = 'FAILED' WHERE action_id = ?", [id]);
            } else if (command) {
                commandStatus = command.status;
                dashboardAction = !command.expired;
            }
        }

        // Ghi một lần khi trạng thái vật lý đổi ngoài Dashboard. Gói trạng thái
        // định kỳ giữ nguyên giá trị sẽ không tạo thêm lịch sử.
        if (recordExternalAction || (device.status !== physicalStatus && !dashboardAction)) {
            await connection.execute(
                "INSERT INTO action_history (user_id, device_id, action, status) VALUES (NULL, ?, ?, 'SUCCESS')",
                [deviceId, physicalStatus],
            );
        }
        await connection.commit();
        return { id, deviceId, physicalStatus, status: commandStatus };
    } catch (error) {
        try { await connection.rollback(); } catch { /* Giao dịch đã hoàn tất. */ }
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { SENSOR_TYPES, hardwareStatus, latestReadings, sensorIds, saveReadings, saveBroadcastDeviceStatus,
    pendingCommands, saveDeviceStatus };
