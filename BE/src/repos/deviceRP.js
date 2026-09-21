const db = require("../db");
const { formatDateTime } = require("./rowFormat");

// Đọc thiết bị từ MySQL và định dạng thời điểm cập nhật cho API.
async function listDevices() {
    const [rows] = await db.execute(
        "SELECT device_id AS deviceId, device_name AS deviceName, status, updated_at AS updatedAtLocal FROM devices ORDER BY device_id",
    );
    return rows.map(({ updatedAtLocal, ...row }) => ({
        ...row,
        updatedAt: formatDateTime(updatedAtLocal).iso,
    }));
}

module.exports = { listDevices };
