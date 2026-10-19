const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseSensorMessage, parseDeviceStatus, isControllableDeviceId, controlMessage } = require("../src/service/mqttBridge");
const { hardwareStatus } = require("../src/repos/hardwareRP");

test("MQTT sensor/data dùng đúng ba trường firmware và sensor_id từ DB", () => {
    const ids = { TEMPERATURE: 1, HUMIDITY: 2, LIGHT: 3 };
    assert.deepEqual(parseSensorMessage(Buffer.from('{"temperature":27.4,"humidity":68,"light":35.2}'), ids), [
        { sensorId: 1, value: 27.4 },
        { sensorId: 2, value: 68 },
        { sensorId: 3, value: 35.2 },
    ]);
    assert.throws(() => parseSensorMessage(Buffer.from('{"temperature":27.4,"humidity":68}'), ids));
    assert.throws(() => parseSensorMessage(Buffer.from('{"temperature":27.4,"humidity":null,"light":35}'), ids));
});

test("MQTT device/status nhận cả xác nhận lệnh và trạng thái tự phát từ mạch", () => {
    assert.deepEqual(parseDeviceStatus(Buffer.from('{"actionId":12,"deviceId":1,"status":"ON"}')),
        { actionId: 12, deviceId: 1, status: "ON" });
    assert.deepEqual(parseDeviceStatus(Buffer.from('{"deviceId":1,"status":"OFF"}')),
        { actionId: null, deviceId: 1, status: "OFF" });
    assert.deepEqual(parseDeviceStatus(Buffer.from('{"actionId":0,"deviceId":1,"status":"ON"}')),
        { actionId: null, deviceId: 1, status: "ON" });
    assert.throws(() => parseDeviceStatus(Buffer.from('{"actionId":12,"deviceId":1,"status":""}')));
    assert.throws(() => parseDeviceStatus(Buffer.from('{"actionId":"12","deviceId":1,"status":"ON"}')));
    assert.throws(() => parseDeviceStatus(Buffer.from('{"actionId":12,"deviceId":0,"status":"ON"}')));
    assert.equal(isControllableDeviceId(1), true);
    assert.equal(isControllableDeviceId(0), false);
    assert.deepEqual(JSON.parse(controlMessage({ id: 12, deviceId: 1, action: "ON" })),
        { actionId: 12, deviceId: 1, command: "ON" });
});

test("Dashboard chỉ báo kết nối khi MQTT vừa nhận dữ liệu và cả ba cảm biến còn mới", () => {
    const now = Date.parse("2026-10-14T10:00:00.000Z");
    const rows = ["TEMPERATURE", "HUMIDITY", "LIGHT"].map((sensorType) => ({
        sensorType, lastSeenLocal: "2026-10-14 17:00:00",
    }));
    assert.equal(hardwareStatus(rows, now, true).connected, true);
    assert.equal(hardwareStatus(rows, now, false).connected, false);
    assert.equal(hardwareStatus(rows, now + 11000, true).connected, false);
    assert.equal(hardwareStatus(rows.slice(0, 2), now, true).connected, false);
});
