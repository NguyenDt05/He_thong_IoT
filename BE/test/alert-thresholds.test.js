const assert = require("node:assert/strict");
const test = require("node:test");
const alerts = require("../src/repos/alertRP");
const authRP = require("../src/repos/authRP");
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

test("counter counts every reading above the configured threshold", () => {
    const current = { alertDate: "2026-11-02", dailyCount: 2, isAbove: false };
    let next = current;
    for (let i = 0; i < 5; i++) {
        next = advanceAlertCounter(next, "2026-11-02", 36, 35.5);
    }
    assert.equal(next.dailyCount, 7);
    assert.equal(advanceAlertCounter(next, "2026-11-02", 35.5, 35.5).dailyCount, 7);
    assert.equal(advanceAlertCounter(next, "2026-11-03", 36, 35.5).dailyCount, 1);
});

test("alerts API reads and saves editable thresholds", async (t) => {
    const originalGet = alerts.getThresholds;
    const originalCounts = alerts.dailyAlertCounts;
    const originalUpdate = alerts.updateThresholds;
    const originalFindSession = authRP.findSession;
    t.after(() => {
        alerts.getThresholds = originalGet;
        alerts.dailyAlertCounts = originalCounts;
        alerts.updateThresholds = originalUpdate;
        authRP.findSession = originalFindSession;
    });
    let thresholds = { ...initial };
    alerts.getThresholds = async () => thresholds;
    alerts.dailyAlertCounts = async () => ({ TEMPERATURE: 2, HUMIDITY: 0, LIGHT: 0 });
    alerts.updateThresholds = async (input) => { thresholds = validateThresholds(input); return thresholds; };
    authRP.findSession = async () => ({ userId: 1 });

    const server = require("../src/app").listen(0);
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/hardware/alerts`;
    const headers = { Cookie: `iot_session_v2=${"a".repeat(64)}` };

    assert.equal((await fetch(url)).status, 401);
    const before = await (await fetch(url, { headers })).json();
    assert.deepEqual(before.thresholds, initial);
    assert.equal(before.counts.TEMPERATURE, 2);

    const updated = await fetch(`${url}/thresholds`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds: { ...initial, TEMPERATURE: 36.5 } }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).thresholds.TEMPERATURE, 36.5);
    assert.equal((await (await fetch(url, { headers })).json()).thresholds.TEMPERATURE, 36.5);

    const invalid = await fetch(`${url}/thresholds`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds: { ...initial, LIGHT: 150 } }),
    });
    assert.equal(invalid.status, 400);
});
