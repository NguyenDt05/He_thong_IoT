const assert = require("node:assert/strict");
const test = require("node:test");
const alerts = require("../src/repos/alertRP");
const { validateThresholds, advanceAlertCounter } = require("../src/service/alertThresholds");

const initial = { TEMPERATURE: 35, HUMIDITY: 80, LIGHT: 80 };

test("threshold input requires three numeric values within sensor ranges", () => {
    assert.deepEqual(validateThresholds({ ...initial, TEMPERATURE: 36.25 }),
        { ...initial, TEMPERATURE: 36.25 });
    for (const invalid of [
        { ...initial, TEMPERATURE: "36" },
        { ...initial, HUMIDITY: 101 },
        { ...initial, LIGHT: 40.123 },
        { TEMPERATURE: 35, HUMIDITY: 80 },
    ]) {
        assert.throws(() => validateThresholds(invalid), { code: "INVALID_THRESHOLDS" });
    }
});

test("counter uses the configured threshold and counts a crossing once", () => {
    const current = { alertDate: "2026-11-02", dailyCount: 2, isAbove: false };
    const crossed = advanceAlertCounter(current, "2026-11-02", 36, 35.5);
    assert.equal(crossed.dailyCount, 3);
    assert.equal(advanceAlertCounter(crossed, "2026-11-02", 37, 35.5).dailyCount, 3);
});

test("alerts API reads and saves editable thresholds", async (t) => {
    const originalGet = alerts.getThresholds;
    const originalCounts = alerts.dailyAlertCounts;
    const originalUpdate = alerts.updateThresholds;
    t.after(() => {
        alerts.getThresholds = originalGet;
        alerts.dailyAlertCounts = originalCounts;
        alerts.updateThresholds = originalUpdate;
    });
    let thresholds = { ...initial };
    alerts.getThresholds = async () => thresholds;
    alerts.dailyAlertCounts = async () => ({ TEMPERATURE: 2, HUMIDITY: 0, LIGHT: 0 });
    alerts.updateThresholds = async (input) => { thresholds = validateThresholds(input); return thresholds; };

    const server = require("../src/app").listen(0);
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/hardware/alerts`;

    const before = await (await fetch(url)).json();
    assert.deepEqual(before.thresholds, initial);
    assert.equal(before.counts.TEMPERATURE, 2);

    const updated = await fetch(`${url}/thresholds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds: { ...initial, TEMPERATURE: 36.5 } }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).thresholds.TEMPERATURE, 36.5);
    assert.equal((await (await fetch(url)).json()).thresholds.TEMPERATURE, 36.5);

    const invalid = await fetch(`${url}/thresholds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds: { ...initial, LIGHT: 150 } }),
    });
    assert.equal(invalid.status, 400);
});
