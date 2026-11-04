const db = require("../db");
const { SENSOR_TYPES, validateThresholds, advanceAlertCounter, applyThresholdChange } = require("../service/alertThresholds");

async function getThresholds() {
    const [rows] = await db.execute(
        "SELECT sensor_type AS sensorType, threshold FROM sensor_alert_thresholds",
    );
    const thresholds = Object.fromEntries(rows.map((row) => [row.sensorType, Number(row.threshold)]));
    if (!SENSOR_TYPES.every((type) => Number.isFinite(thresholds[type]))) {
        throw new Error("Chưa khởi tạo đủ ngưỡng cảnh báo; chạy db:migrate:alerts");
    }
    return Object.fromEntries(SENSOR_TYPES.map((type) => [type, thresholds[type]]));
}

// Lưu ngưỡng vào db
async function updateThresholds(input) {
    const thresholds = validateThresholds(input);
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        // Cùng thứ tự khóa với các lần ghi số đo để không đổi ngưỡng giữa transaction.
        for (const type of SENSOR_TYPES) {
            const [[setting]] = await connection.execute(
                "SELECT threshold FROM sensor_alert_thresholds WHERE sensor_type = ? FOR UPDATE",
                [type],
            );
            if (!setting) {
                throw new Error("Chưa khởi tạo đủ ngưỡng cảnh báo; chạy db:migrate:alerts");
            }
            await connection.execute(
                "UPDATE sensor_alert_thresholds SET threshold = ? WHERE sensor_type = ?",
                [thresholds[type], type],
            );
        }
        const [sensors] = await connection.execute(
            "SELECT sensor_id AS sensorId, sensor_type AS sensorType FROM sensors WHERE sensor_type IN ('TEMPERATURE', 'HUMIDITY', 'LIGHT')",
        );
        const [[{ today }]] = await connection.query(
            "SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')) AS today",
        );
        for (const sensor of sensors) {
            const [[latest]] = await connection.execute(
                "SELECT value FROM data_sensor WHERE sensor_id = ? ORDER BY created_at DESC, data_id DESC LIMIT 1",
                [sensor.sensorId],
            );
            if (!latest) continue;
            await connection.execute(
                `INSERT IGNORE INTO sensor_alert_counters (sensor_id, alert_date, daily_count, is_above)
                 VALUES (?, ?, 0, 0)`,
                [sensor.sensorId, today],
            );
            const [[current]] = await connection.execute(
                `SELECT alert_date AS alertDate, daily_count AS dailyCount, is_above AS isAbove
                 FROM sensor_alert_counters WHERE sensor_id = ? FOR UPDATE`,
                [sensor.sensorId],
            );
            // Đổi ngưỡng có thể bắt đầu một đợt cảnh báo mới ngay trên mẫu gần nhất.
            // Chỉ cộng khi trạng thái chuyển từ chưa vượt sang vượt ngưỡng.
            const next = applyThresholdChange(current, today, Number(latest.value), thresholds[sensor.sensorType]);
            await connection.execute(
                `UPDATE sensor_alert_counters
                 SET alert_date = ?, daily_count = ?, is_above = ? WHERE sensor_id = ?`,
                [next.alertDate, next.dailyCount, next.isAbove ? 1 : 0, sensor.sensorId],
            );
        }
        await connection.commit();
        return thresholds;
    } catch (error) {
        try { await connection.rollback(); } catch { /* Giao dịch đã hoàn tất. */ }
        throw error;
    } finally {
        connection.release();
    }
}
// Ghi nhận một số đo mới và cập nhật bộ đếm cảnh báo nếu vượt ngưỡng.
async function recordReading(connection, sensorId, sensorType, value, day) {
    if (!SENSOR_TYPES.includes(sensorType)) return;
    const [[setting]] = await connection.execute(
        "SELECT threshold FROM sensor_alert_thresholds WHERE sensor_type = ? FOR UPDATE",
        [sensorType],
    );
    if (!setting) throw new Error(`Chưa có ngưỡng cảnh báo cho ${sensorType}`);
    const threshold = Number(setting.threshold);

    await connection.execute(
        `INSERT IGNORE INTO sensor_alert_counters (sensor_id, alert_date, daily_count, is_above)
         VALUES (?, ?, 0, 0)`,
        [sensorId, day],
    );
    const [[current]] = await connection.execute(
        `SELECT alert_date AS alertDate, daily_count AS dailyCount, is_above AS isAbove
         FROM sensor_alert_counters WHERE sensor_id = ? FOR UPDATE`,
        [sensorId],
    );
    const next = advanceAlertCounter(current, day, value, threshold);
    await connection.execute(
        `UPDATE sensor_alert_counters
         SET alert_date = ?, daily_count = ?, is_above = ? WHERE sensor_id = ?`,
        [next.alertDate, next.dailyCount, next.isAbove ? 1 : 0, sensorId],
    );
}

async function dailyAlertCounts() {
    const [rows] = await db.execute(
        `SELECT s.sensor_type AS sensorType, c.daily_count AS count
         FROM sensor_alert_counters c
         JOIN sensors s ON s.sensor_id = c.sensor_id
         WHERE c.alert_date = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'))
           AND s.sensor_type IN ('TEMPERATURE', 'HUMIDITY', 'LIGHT')`,
    );
    return Object.fromEntries(rows.map((row) => [row.sensorType, Number(row.count)]));
}

module.exports = { getThresholds, updateThresholds, recordReading, dailyAlertCounts };
