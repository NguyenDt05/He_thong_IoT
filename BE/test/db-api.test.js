const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("../src/app");
const db = require("../src/db");

// Chuẩn bị máy chủ thử nghiệm; các kiểm tra cần MySQL chỉ chạy khi có cấu hình.
const hasDatabaseConfig = Boolean(process.env.DB_USER && process.env.DB_NAME);
let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.end();
});

// Hàm chung gọi API GET và kiểm tra mã phản hồi thành công.
async function get(path) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    return response.json();
}

// Kiểm tra bảng cảm biến: thứ tự, phân trang, kiểu dữ liệu và lọc theo loại.
test("sensor API reads and pages existing MySQL rows", { skip: !hasDatabaseConfig }, async () => {
    const [[{ total }]] = await db.execute("SELECT COUNT(*) AS total FROM data_sensor");
    const [[latest]] = await db.execute(
        "SELECT data_id AS dataId FROM data_sensor ORDER BY created_at DESC, data_id DESC LIMIT 1",
    );
    const result = await get("/api/data-sensor?page=1&limit=10");
    assert.equal(result.total, total);
    assert.equal(result.data.length, Math.min(10, total));
    assert.equal(result.data[0]?.dataId, latest?.dataId);
    assert.equal(result.totalPages, Math.ceil(total / 10));
    assert.ok(result.data.every((row) =>
        Number.isSafeInteger(row.dataId)
        && Number.isSafeInteger(row.sensorId)
        && typeof row.sensorName === "string"
        && ["TEMPERATURE", "HUMIDITY", "LIGHT"].includes(row.sensorType)
        && typeof row.unit === "string"
        &&
        Number.isFinite(row.value)
        && Number.isFinite(Date.parse(row.createdAt))
        && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(row.createdAtText),
    ));

    const filtered = await get("/api/data-sensor?type=TEMPERATURE&limit=100");
    assert.ok(filtered.data.every((row) => row.sensorType === "TEMPERATURE"));
    const pageTwo = await get("/api/data-sensor?page=2&limit=10");
    assert.equal(pageTwo.data[0]?.dataId, (await get("/api/data-sensor?limit=20")).data[10]?.dataId);

    if (result.data.length) {
        const first = result.data[0];
        const allFields = await get(`/api/data-sensor?${new URLSearchParams({ field: "all", key: first.sensorName })}`);
        assert.ok(allFields.data.some((row) => row.dataId === first.dataId));

        const typeLabel = {
            TEMPERATURE: "nhiệt độ",
            HUMIDITY: "độ ẩm",
            LIGHT: "ánh sáng",
        }[first.sensorType];
        const byType = await get(`/api/data-sensor?${new URLSearchParams({ field: "type", key: typeLabel })}`);
        assert.ok(byType.data.some((row) => row.dataId === first.dataId));
        assert.ok(byType.data.every((row) => row.sensorType === first.sensorType));

        const date = first.createdAtText.slice(0, 10);
        const byDate = await get(`/api/data-sensor?${new URLSearchParams({ field: "datetime", key: date })}`);
        assert.ok(byDate.data.some((row) => row.dataId === first.dataId));
        assert.ok(byDate.data.every((row) => row.createdAtText.startsWith(date)));
        const byFullDate = await get(`/api/data-sensor?${new URLSearchParams({ field: "datetime", key: first.createdAtText })}`);
        assert.ok(byFullDate.data.some((row) => row.dataId === first.dataId));

        const value = String(first.value);
        const byValue = await get(`/api/data-sensor?${new URLSearchParams({ field: "value", key: value })}`);
        assert.ok(byValue.data.some((row) => row.dataId === first.dataId));
        assert.ok(byValue.data.every((row) => String(row.value).includes(value)));
    }
});

// Kiểm tra danh sách thiết bị, bảng lịch sử và thao tác không hỗ trợ.
test("history and device APIs map existing MySQL rows without changing device state", { skip: !hasDatabaseConfig }, async () => {
    const [[{ total }]] = await db.execute("SELECT COUNT(*) AS total FROM action_history");
    const devices = await get("/api/devices");
    const history = await get("/api/history?limit=20");
    assert.ok(Array.isArray(devices));
    assert.ok(devices.every((row) => Number.isSafeInteger(row.deviceId) && row.deviceName));
    assert.equal(history.total, total);
    assert.ok(history.data.every((row) =>
        Number.isSafeInteger(row.id)
        && typeof row.deviceName === "string"
        && ["ON", "OFF"].includes(row.action)
        && ["SUCCESS", "FAILED", "PENDING"].includes(row.status)
        && row.device === `DEVICE_${row.deviceId}`
        && row.username === (row.id % 2 ? "thaonguyen" : "nguyễn văn a")
        && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(row.time)
        && Number.isFinite(Date.parse(row.createdAt)),
    ));

    if (history.data.length) {
        const first = history.data[0];
        const byTime = await get(`/api/history?${new URLSearchParams({ key: first.time })}`);
        assert.ok(byTime.data.some((row) => row.id === first.id));

        const byDevice = await get(`/api/history?${new URLSearchParams({ device: first.device, key: first.deviceName })}`);
        assert.ok(byDevice.data.some((row) => row.id === first.id));
        assert.ok(byDevice.data.every((row) => row.device === first.device));

        const actionLabel = first.action === "ON" ? "Bật" : "Tắt";
        const byAction = await get(`/api/history?${new URLSearchParams({ action: first.action, key: actionLabel })}`);
        assert.ok(byAction.data.some((row) => row.id === first.id));
        assert.ok(byAction.data.every((row) => row.action === first.action));

        const statusLabel = first.status[0] + first.status.slice(1).toLowerCase();
        const byStatus = await get(`/api/history?${new URLSearchParams({ status: first.status, key: statusLabel })}`);
        assert.ok(byStatus.data.some((row) => row.id === first.id));
        assert.ok(byStatus.data.every((row) => row.status === first.status));
    }

    const filtered = await get("/api/history?key=thao");
    assert.ok(filtered.data.every((row) => row.username === "thaonguyen"));
    const noControl = await fetch(`${baseUrl}/api/devices/1`, { method: "PATCH" });
    assert.equal(noControl.status, 404);
});

// Yêu cầu bật/tắt sai phải bị chặn trước khi ghi vào cơ sở dữ liệu.
test("invalid UI action is rejected before any database write", async () => {
    const response = await fetch(`${baseUrl}/api/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: 1, action: "INVALID" }),
    });
    assert.equal(response.status, 400);
});

// Thử ghi lịch sử trong giao dịch rồi hoàn tác để giữ nguyên dữ liệu thật.
test("history insert satisfies MySQL constraints and can be rolled back", {
    skip: !hasDatabaseConfig || process.env.DB_WRITE_ROLLBACK_TEST !== "1",
}, async () => {
    const connection = await db.getConnection();
    let insertedId;
    let inTransaction = false;
    try {
        const [[device]] = await connection.execute("SELECT device_id FROM devices ORDER BY device_id LIMIT 1");
        assert.ok(device, "a device is required for this smoke check");
        await connection.beginTransaction();
        inTransaction = true;
        const [result] = await connection.execute(
            "INSERT INTO action_history (user_id, device_id, action, status) VALUES (NULL, ?, 'ON', 'SUCCESS')",
            [device.device_id],
        );
        insertedId = result.insertId;
        const [[row]] = await connection.execute(
            "SELECT action_id, user_id, device_id, action, status FROM action_history WHERE action_id = ?",
            [insertedId],
        );
        assert.equal(row.user_id, null);
        assert.equal(row.device_id, device.device_id);
        assert.equal(row.action, "ON");
        assert.equal(row.status, "SUCCESS");
        await connection.rollback();
        inTransaction = false;
        const [[{ total }]] = await connection.execute(
            "SELECT COUNT(*) AS total FROM action_history WHERE action_id = ?",
            [insertedId],
        );
        assert.equal(total, 0);
    } finally {
        if (inTransaction) await connection.rollback();
        connection.release();
    }
});
