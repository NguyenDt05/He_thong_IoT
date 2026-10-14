const db = require("../db");
const { formatDateTime } = require("./rowFormat");
const { isControllableDeviceId } = require("../service/mqttBridge");

// Đọc thiết bị từ MySQL và định dạng thời điểm cập nhật cho API.
async function listDevices() {
    const [rows] = await db.execute(
        `SELECT d.device_id AS deviceId, d.device_name AS deviceName, d.status,
                d.updated_at AS updatedAtLocal,
                (SELECT ah.action_id FROM action_history ah
                 WHERE ah.device_id = d.device_id AND ah.status = 'PENDING'
                   AND ah.created_at >= DATE_SUB(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'), INTERVAL ? SECOND)
                 ORDER BY ah.action_id DESC LIMIT 1) AS pendingActionId
         FROM devices d ORDER BY d.device_id`,
        [Number(process.env.HARDWARE_COMMAND_TIMEOUT_MS) > 0
            ? Math.ceil(Number(process.env.HARDWARE_COMMAND_TIMEOUT_MS) / 1000) : 30],
    );
    return rows.map(({ updatedAtLocal, ...row }) => ({
        ...row,
        controllable: isControllableDeviceId(row.deviceId),
        updatedAt: formatDateTime(updatedAtLocal).iso,
    }));
}

module.exports = { listDevices };
