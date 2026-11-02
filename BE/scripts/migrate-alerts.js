require("dotenv").config();

const db = require("../src/db");
const { DEFAULT_ALERT_THRESHOLDS, SENSOR_TYPES, advanceAlertCounter } = require("../src/service/alertThresholds");

async function migrate() {
    await db.query(`CREATE TABLE IF NOT EXISTS sensor_alert_counters (
        sensor_id INT NOT NULL PRIMARY KEY,
        alert_date DATE NOT NULL,
        daily_count INT UNSIGNED NOT NULL DEFAULT 0,
        is_above TINYINT(1) NOT NULL DEFAULT 0
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS sensor_alert_thresholds (
        sensor_type VARCHAR(20) NOT NULL PRIMARY KEY,
        threshold DECIMAL(10, 2) NOT NULL
    )`);
    const [[column]] = await db.query(
        `SELECT NUMERIC_PRECISION AS numericPrecision, NUMERIC_SCALE AS numericScale
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sensor_alert_thresholds'
           AND COLUMN_NAME = 'threshold'`,
    );
    if (Number(column.numericPrecision) !== 10 || Number(column.numericScale) !== 2) {
        await db.query("ALTER TABLE sensor_alert_thresholds MODIFY COLUMN threshold DECIMAL(10, 2) NOT NULL");
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        for (const type of SENSOR_TYPES) {
            await connection.execute(
                "INSERT IGNORE INTO sensor_alert_thresholds (sensor_type, threshold) VALUES (?, ?)",
                [type, DEFAULT_ALERT_THRESHOLDS[type]],
            );
        }
        const [thresholdRows] = await connection.execute(
            "SELECT sensor_type AS sensorType, threshold FROM sensor_alert_thresholds",
        );
        const thresholds = Object.fromEntries(thresholdRows.map((row) => [row.sensorType, Number(row.threshold)]));
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
            const threshold = thresholds[sensor.sensorType];
            const [readings] = await connection.execute(
                `SELECT value FROM data_sensor
                 WHERE sensor_id = ? AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
                 ORDER BY created_at, data_id`,
                [sensor.sensorId, today, today],
            );
            let counter = {
                alertDate: today,
                dailyCount: 0,
                isAbove: false,
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
