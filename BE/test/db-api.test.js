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
    const result = await get("/api/data-sensor?page=1");
    assert.equal(result.total, total);
    assert.equal(result.limit, 20);
    assert.equal(result.data.length, Math.min(20, total));
    assert.equal(result.data[0]?.dataId, latest?.dataId);
    assert.equal(result.totalPages, Math.ceil(total / 20));
    assert.ok(result.data.every((row) =>
        Number.isSafeInteger(row.dataId)
        && Number.isSafeInteger(row.sensorId)
        && typeof row.sensorName === "string"
        && ["TEMPERATURE", "HUMIDITY", "LIGHT"].includes(row.sensorType)
        && typeof row.unit === "string"
        &&
        Number.isFinite(row.value)
        && Number.isFinite(Date.parse(row.createdAt))
        && /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(row.createdAtText),
    ));

    const filtered = await get("/api/data-sensor?criterion=temperature&limit=100");
    assert.ok(filtered.data.every((row) => row.sensorType === "TEMPERATURE"));
    const pageTwo = await get("/api/data-sensor?page=2&limit=10");
    assert.equal(pageTwo.data[0]?.dataId, (await get("/api/data-sensor?limit=20")).data[10]?.dataId);

    if (result.data.length) {
        const first = result.data[0];
        const allFields = await get(`/api/data-sensor?${new URLSearchParams({ criterion: "all", key: first.sensorName })}`);
        assert.ok(allFields.data.some((row) => row.dataId === first.dataId));
        const byId = await get(`/api/data-sensor?${new URLSearchParams({ criterion: "all", key: String(first.dataId) })}`);
        assert.ok(byId.data.some((row) => row.dataId === first.dataId));
        const byUnit = await get(`/api/data-sensor?${new URLSearchParams({ criterion: "all", key: first.unit })}`);
        assert.ok(byUnit.data.some((row) => row.dataId === first.dataId));
        const byLiteralPercent = await get(`/api/data-sensor?${new URLSearchParams({ criterion: "all", key: "%" })}`);
        assert.ok(byLiteralPercent.data.every((row) =>
            [row.dataId, row.sensorName, row.sensorType, row.value, row.unit, row.createdAtText]
                .some((cell) => String(cell).includes("%")),
        ));

        const typeLabel = {
            TEMPERATURE: "nhiệt độ",
            HUMIDITY: "độ ẩm",
            LIGHT: "ánh sáng",
        }[first.sensorType];
        const byType = await get(`/api/data-sensor?${new URLSearchParams({ criterion: "all", key: typeLabel })}`);
        assert.ok(byType.data.some((row) => row.dataId === first.dataId));
        assert.ok(byType.data.every((row) => row.sensorType === first.sensorType));

        const date = first.createdAtText.slice(0, 10);
        const byDate = await get(`/api/data-sensor?${new URLSearchParams({ criterion: "datetime", key: date })}`);
        assert.ok(byDate.data.some((row) => row.dataId === first.dataId));
        assert.ok(byDate.data.every((row) => row.createdAtText.startsWith(date)));
        const byFullDate = await get(`/api/data-sensor?${new URLSearchParams({ criterion: "datetime", key: first.createdAtText })}`);
        assert.ok(byFullDate.data.some((row) => row.dataId === first.dataId));

        const value = String(first.value);
        const criterion = {
            TEMPERATURE: "temperature",
            HUMIDITY: "humidity",
            LIGHT: "light",
        }[first.sensorType];
        const bySensorValue = await get(`/api/data-sensor?${new URLSearchParams({ criterion, key: value })}`);
        assert.ok(bySensorValue.data.some((row) => row.dataId === first.dataId));
        assert.ok(bySensorValue.data.every((row) => row.sensorType === first.sensorType && String(row.value).includes(value)));
    }
});

// Kiểm tra danh sách thiết bị, bảng lịch sử và thao tác không hỗ trợ.
test("history and device APIs map existing MySQL rows without changing device state", { skip: !hasDatabaseConfig }, async () => {
    const [[{ total }]] = await db.execute("SELECT COUNT(*) AS total FROM action_history");
    const devices = await get("/api/devices");
    const history = await get("/api/history");
    assert.ok(Array.isArray(devices));
    assert.ok(devices.every((row) =>
        Number.isSafeInteger(row.deviceId)
        && row.deviceName
        && !Object.hasOwn(row, "controllable"),
    ));
    assert.equal(history.total, total);
    assert.equal(history.limit, 20);
    assert.ok(history.data.every((row) =>
        Number.isSafeInteger(row.id)
        && typeof row.deviceName === "string"
        && ["ON", "OFF"].includes(row.action)
        && ["SUCCESS", "FAILED", "PENDING"].includes(row.status)
        && Number.isSafeInteger(row.deviceId)
        && !Object.hasOwn(row, "device")
        && (row.username === null || typeof row.username === "string")
        && /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(row.createdAtText)
        && Number.isFinite(Date.parse(row.createdAt)),
    ));

    if (history.data.length) {
        const first = history.data[0];
        const byTime = await get(`/api/history?${new URLSearchParams({ key: first.createdAtText })}`);
        assert.ok(byTime.data.some((row) => row.id === first.id));

        const byDevice = await get(`/api/history?${new URLSearchParams({ deviceId: String(first.deviceId), key: first.deviceName })}`);
        assert.ok(byDevice.data.some((row) => row.id === first.id));
        assert.ok(byDevice.data.every((row) => row.deviceId === first.deviceId));

        const byDeviceOnly = await get(`/api/history?${new URLSearchParams({ deviceId: String(first.deviceId) })}`);
        assert.ok(byDeviceOnly.data.every((row) => row.deviceId === first.deviceId));
        const [[{ deviceTotal }]] = await db.execute(
            `SELECT COUNT(*) AS deviceTotal FROM action_history ah
             JOIN devices d ON d.device_id = ah.device_id
             WHERE ah.device_id = ?`,
            [first.deviceId],
        );
        assert.equal(byDeviceOnly.total, deviceTotal);

        const actionLabel = first.action === "ON" ? "Bật" : "Tắt";
        const byAction = await get(`/api/history?${new URLSearchParams({ action: first.action, key: actionLabel })}`);
        assert.ok(byAction.data.some((row) => row.id === first.id));
        assert.ok(byAction.data.every((row) => row.action === first.action));

        const statusLabel = first.status[0] + first.status.slice(1).toLowerCase();
        const byStatus = await get(`/api/history?${new URLSearchParams({ status: first.status, key: statusLabel })}`);
        assert.ok(byStatus.data.some((row) => row.id === first.id));
        assert.ok(byStatus.data.every((row) => row.status === first.status));
    }

    const identified = history.data.find((row) => row.username);
    if (identified) {
        const filtered = await get(`/api/history?${new URLSearchParams({ key: identified.username })}`);
        assert.ok(filtered.data.some((row) => row.id === identified.id));
    }
    const noControl = await fetch(`${baseUrl}/api/devices/1`, { method: "PATCH" });
    assert.equal(noControl.status, 404);
});

test("history rejects invalid deviceId filters", async () => {
    for (const deviceId of ["0", "abc", "1.5", "9007199254740992", ""]) {
        const response = await fetch(`${baseUrl}/api/history?${new URLSearchParams({ deviceId })}`);
        assert.equal(response.status, 400);
    }
});

test("hardware status is available without a connected board", { skip: !hasDatabaseConfig }, async () => {
    const status = await get("/api/hardware/status");
    assert.equal(typeof status.connected, "boolean");
    assert.equal(typeof status.staleAfterMs, "number");
    assert.ok(Number.isFinite(Date.parse(status.checkedAt)));
    assert.equal(status.connected, false);
});

// Yêu cầu bật/tắt sai phải bị chặn trước khi ghi vào cơ sở dữ liệu.
test("invalid UI action is rejected before any database write", async () => {
    const response = await fetch(`${baseUrl}/api/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: 1, action: "INVALID" }),
    });
    assert.equal(response.status, 400);
    const disconnected = await fetch(`${baseUrl}/api/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: 1, action: "ON" }),
    });
    assert.equal(disconnected.status, 503);
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
            "INSERT INTO action_history (user_id, device_id, action, status) VALUES (NULL, ?, 'ON', 'PENDING')",
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
        assert.equal(row.status, "PENDING");
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

test("password is stored at registration but login only checks username", { skip: !hasDatabaseConfig }, async () => {
    const username = `iot_test_${require("node:crypto").randomBytes(8).toString("hex")}`;
    const secondUsername = `${username}_other`;
    const jsonHeaders = { "Content-Type": "application/json" };
    let userId;
    let avatarFile;

    try {
        const guest = await get("/api/auth/me");
        assert.equal(guest, null);

        const registration = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST", headers: jsonHeaders,
            body: JSON.stringify({
                fullName: "Người dùng thử nghiệm", username, password: "x",
                studentId: "B23TEST", phone: "0123456789",
                githubUrl: "https://github.com/example",
            }),
        });
        assert.equal(registration.status, 201);
        const created = await registration.json();
        userId = created.userId;
        assert.equal(created.username, username);
        assert.equal(created.avatarFile, null);
        assert.equal(created.studentId, "B23TEST");
        assert.equal(created.githubUrl, "https://github.com/example");
        assert.equal(Object.hasOwn(created, "passwordHash"), false);

        const cookie = registration.headers.get("set-cookie")?.split(";")[0];
        assert.match(cookie, /^iot_session=[a-f0-9]{64}$/);
        const [[{ passwordHash }]] = await db.execute(
            "SELECT password_hash AS passwordHash FROM users WHERE user_id = ?", [userId]
        );
        assert.match(passwordHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
        assert.equal(passwordHash.includes(":x"), false);

        const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST", headers: jsonHeaders,
            body: JSON.stringify({ fullName: "Tên khác", username, password: "anything" }),
        });
        assert.equal(duplicate.status, 409);

        const profileResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
        assert.equal(profileResponse.status, 200);
        assert.equal((await profileResponse.json()).userId, userId);

        const updateResponse = await fetch(`${baseUrl}/api/auth/me`, {
            method: "PUT", headers: { ...jsonHeaders, Cookie: cookie },
            body: JSON.stringify({
                fullName: "Tên đã cập nhật", email: "test@example.com", studentId: "B23TEST",
                phone: "0123456789", githubUrl: "https://github.com/example",
                figmaUrl: "https://www.figma.com/", reportUrl: "https://example.com/report",
                postmanUrl: "https://www.postman.com/",
            }),
        });
        assert.equal(updateResponse.status, 200);
        assert.equal((await updateResponse.json()).fullName, "Tên đã cập nhật");

        const image = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=",
            "base64"
        );
        const uploadResponse = await fetch(`${baseUrl}/api/auth/avatar`, {
            method: "PUT", headers: { Cookie: cookie, "Content-Type": "image/png" }, body: image,
        });
        assert.equal(uploadResponse.status, 200);
        const uploaded = await uploadResponse.json();
        avatarFile = uploaded.avatarFile;
        assert.match(avatarFile, new RegExp(`^${userId}-[a-f0-9-]{36}\\.png$`));
        const avatarResponse = await fetch(`${baseUrl}/api/auth/avatar`, { headers: { Cookie: cookie } });
        assert.equal(avatarResponse.status, 200);
        assert.equal(avatarResponse.headers.get("content-type"), "image/png");
        assert.deepEqual(Buffer.from(await avatarResponse.arrayBuffer()), image);

        const secondRegistration = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST", headers: jsonHeaders,
            body: JSON.stringify({ fullName: "Người dùng thứ hai", username: secondUsername, password: "y" }),
        });
        assert.equal(secondRegistration.status, 201);
        assert.equal((await secondRegistration.json()).avatarFile, null);
        const otherCookie = secondRegistration.headers.get("set-cookie")?.split(";")[0];
        const secondAvatar = await fetch(`${baseUrl}/api/auth/avatar`, { headers: { Cookie: otherCookie } });
        assert.equal(secondAvatar.status, 404);
        await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: otherCookie } });

        assert.equal((await get("/api/auth/me")), null);
        const guestAvatar = await fetch(`${baseUrl}/api/auth/avatar`);
        assert.equal(guestAvatar.status, 401);
        const unsupportedImage = await fetch(`${baseUrl}/api/auth/avatar`, {
            method: "PUT", headers: { Cookie: cookie, "Content-Type": "image/svg+xml" },
            body: "<svg></svg>",
        });
        assert.equal(unsupportedImage.status, 400);
        const oversizedImage = await fetch(`${baseUrl}/api/auth/avatar`, {
            method: "PUT", headers: { Cookie: cookie, "Content-Type": "image/png" },
            body: Buffer.alloc(2 * 1024 * 1024 + 1),
        });
        assert.equal(oversizedImage.status, 413);

        const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
        assert.equal(logout.status, 204);
        const oldSessionResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
        assert.equal(await oldSessionResponse.json(), null);

        const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST", headers: jsonHeaders,
            body: JSON.stringify({ username: `${username}_missing`, password: "x" }),
        });
        assert.equal(badLogin.status, 401);

        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST", headers: jsonHeaders,
            body: JSON.stringify({ username, password: "different-from-registration" }),
        });
        assert.equal(loginResponse.status, 200);
        assert.equal((await loginResponse.json()).fullName, "Tên đã cập nhật");
        const secondCookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
        assert.match(secondCookie, /^iot_session=[a-f0-9]{64}$/);
        await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: secondCookie } });
    } finally {
        if (avatarFile) {
            const fs = require("node:fs/promises");
            const path = require("node:path");
            await fs.unlink(path.resolve(__dirname, "../uploads/avatars", avatarFile)).catch(() => {});
        }
        await db.execute("DELETE FROM users WHERE username = ?", [secondUsername]);
        await db.execute("DELETE FROM users WHERE username = ?", [username]);
    }
});

test("history service forwards optional account identity without changing guest behavior", async () => {
    const historyRP = require("../src/repos/historyRP");
    const historyService = require("../src/service/historySV");
    const original = historyRP.recordHistory;
    const calls = [];
    historyRP.recordHistory = async (...args) => { calls.push(args); return { id: 1 }; };
    try {
        await historyService.recordHistory(1, "ON", 42);
        await historyService.recordHistory(1, "OFF");
        assert.deepEqual(calls, [[1, "ON", 42], [1, "OFF", null]]);
    } finally {
        historyRP.recordHistory = original;
    }
});

test("history repository writes the session user or NULL into action_history", async () => {
    const historyRP = require("../src/repos/historyRP");
    const originalGetConnection = db.getConnection;
    const inserts = [];
    const connection = {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        execute: async (sql, params) => {
            if (sql.includes("SELECT device_id FROM devices")) return [[{ device_id: 1 }]];
            if (sql.includes("UPDATE action_history")) return [{ affectedRows: 0 }];
            if (sql.includes("SELECT action_id FROM action_history")) return [[]];
            if (sql.includes("INSERT INTO action_history")) {
                inserts.push(params);
                return [{ insertId: 99 }];
            }
            if (sql.includes("WHERE ah.action_id = ?")) return [[{
                id: 99, deviceId: 1, deviceName: "LED", username: null,
                action: "ON", status: "PENDING", createdAtLocal: "2026-10-22 10:00:00",
            }]];
            throw new Error(`Unexpected SQL: ${sql}`);
        },
    };
    db.getConnection = async () => connection;
    try {
        await historyRP.recordHistory(1, "ON", 42);
        await historyRP.recordHistory(1, "OFF");
        assert.deepEqual(inserts, [[42, 1, "ON"], [null, 1, "OFF"]]);
    } finally {
        db.getConnection = originalGetConnection;
    }
});
