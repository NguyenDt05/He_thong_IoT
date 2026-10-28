require("dotenv").config();

const db = require("../src/db");
const { ALERT_THRESHOLDS, advanceAlertCounter } = require("../src/service/alertThresholds");

async function migrate() {
    await db.query(`CREATE TABLE IF NOT EXISTS sensor_alert_counters (
        sensor_id INT NOT NULL PRIMARY KEY,
        alert_date DATE NOT NULL,
        daily_count INT UNSIGNED NOT NULL DEFAULT 0,
        is_above TINYINT(1) NOT NULL DEFAULT 0
    )`);

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[{ today }]] = await connection.query(
            "SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')) AS today",
        );
        const [sensors] = await connection.execute(
            "SELECT sensor_id AS sensorId, sensor_type AS sensorType FROM sensors WHERE sensor_type IN ('TEMPERATURE', 'HUMIDITY', 'LIGHT')",
        );
        const [existing] = await connection.execute("SELECT sensor_id AS sensorId FROM sensor_alert_counters");
        const initialized = new Set(existing.map((row) => row.sensorId));

        for (const sensor of sensors) {
            if (initialized.has(sensor.sensorId)) continue;
            const threshold = ALERT_THRESHOLDS[sensor.sensorType];
            const [[previous]] = await connection.execute(
                `SELECT value FROM data_sensor WHERE sensor_id = ? AND created_at < ?
                 ORDER BY created_at DESC, data_id DESC LIMIT 1`,
                [sensor.sensorId, today],
            );
            const [readings] = await connection.execute(
                `SELECT value FROM data_sensor
                 WHERE sensor_id = ? AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
                 ORDER BY created_at, data_id`,
                [sensor.sensorId, today, today],
            );
            let counter = {
                alertDate: today,
                dailyCount: 0,
                isAbove: previous ? Number(previous.value) > threshold : false,
            };
            for (const reading of readings) {
                counter = advanceAlertCounter(counter, today, Number(reading.value), threshold);
            }
            await connection.execute(
                `INSERT INTO sensor_alert_counters (sensor_id, alert_date, daily_count, is_above)
                 VALUES (?, ?, ?, ?)`,
                [sensor.sensorId, today, counter.dailyCount, counter.isAbove ? 1 : 0],
            );
            console.log(`Initialized ${sensor.sensorType}: ${counter.dailyCount} alerts today`);
        }
        await connection.commit();
        console.log("Alert counters are ready");
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

migrate()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => db.end());
