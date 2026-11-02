const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../src/db");
const alerts = require("../src/repos/alertRP");

test("changing a threshold counts a new crossing once", async (t) => {
    const originalGetConnection = db.getConnection;
    t.after(() => { db.getConnection = originalGetConnection; });

    const thresholds = { TEMPERATURE: 40, HUMIDITY: 80, LIGHT: 80 };
    const counter = { alertDate: "2026-11-02", dailyCount: 0, isAbove: 0 };
    const connection = {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        query: async (sql) => {
            assert.match(sql, /AS today/);
            return [[{ today: "2026-11-02" }]];
        },
        execute: async (sql, params = []) => {
            if (sql.startsWith("SELECT threshold")) return [[{ threshold: thresholds[params[0]] }]];
            if (sql.startsWith("UPDATE sensor_alert_thresholds")) {
                thresholds[params[1]] = params[0];
                return [{}];
            }
            if (sql.startsWith("SELECT sensor_id AS sensorId")) {
                return [[{ sensorId: 1, sensorType: "TEMPERATURE" }]];
            }
            if (sql.startsWith("SELECT value FROM data_sensor")) return [[{ value: 37 }]];
            if (sql.includes("INSERT IGNORE INTO sensor_alert_counters")) return [{}];
            if (sql.includes("FROM sensor_alert_counters WHERE sensor_id")) return [[{ ...counter }]];
            if (sql.includes("UPDATE sensor_alert_counters")) {
                [counter.alertDate, counter.dailyCount, counter.isAbove] = params;
                return [{}];
            }
            throw new Error(`Unexpected SQL: ${sql}`);
        },
    };
    db.getConnection = async () => connection;

    await alerts.updateThresholds({ ...thresholds, TEMPERATURE: 35 });
    assert.deepEqual(counter, { alertDate: "2026-11-02", dailyCount: 1, isAbove: 1 });

    await alerts.updateThresholds({ ...thresholds });
    assert.equal(counter.dailyCount, 1);

    for (let i = 0; i < 5; i++) {
        await alerts.recordReading(connection, 1, "TEMPERATURE", 37, "2026-11-02");
    }
    assert.equal(counter.dailyCount, 6);

    await alerts.updateThresholds({ ...thresholds, TEMPERATURE: 38 });
    assert.deepEqual(counter, { alertDate: "2026-11-02", dailyCount: 6, isAbove: 0 });

    await alerts.updateThresholds({ ...thresholds, TEMPERATURE: 35 });
    assert.deepEqual(counter, { alertDate: "2026-11-02", dailyCount: 7, isAbove: 1 });
});
