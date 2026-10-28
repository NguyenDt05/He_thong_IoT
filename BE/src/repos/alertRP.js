const db = require("../db");
const { ALERT_THRESHOLDS, advanceAlertCounter } = require("../service/alertThresholds");

async function recordReading(connection, sensorId, sensorType, value, day) {
    const threshold = ALERT_THRESHOLDS[sensorType];
    if (threshold === undefined) return;

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

module.exports = { recordReading, dailyAlertCounts };
