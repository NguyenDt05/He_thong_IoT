const assert = require("node:assert/strict");
const { scryptSync } = require("node:crypto");
const test = require("node:test");
const authRP = require("../src/repos/authRP");
const authService = require("../src/service/authSV");
const avatarService = require("../src/service/avatarSV");

test("login checks the password and does not expose its hash", async (t) => {
    const original = authRP.findCredentialsByUsername;
    t.after(() => { authRP.findCredentialsByUsername = original; });
    const salt = "0123456789abcdef0123456789abcdef";
    const passwordHash = `${salt}:${scryptSync("correct-password", salt, 64).toString("hex")}`;
    authRP.findCredentialsByUsername = async (username) => username === "student"
        ? { userId: 1, username, fullName: "Student", passwordHash } : null;

    const user = await authService.login({ username: "student", password: "correct-password" });
    assert.equal(user.userId, 1);
    assert.equal(user.passwordHash, undefined);
    await assert.rejects(authService.login({ username: "student", password: "wrong-password" }), { code: "BAD_CREDENTIALS" });
    await assert.rejects(authService.login({ username: "missing", password: "correct-password" }), { code: "BAD_CREDENTIALS" });
});

test("registration rejects short passwords before inserting a user", async () => {
    await assert.rejects(authService.register({ fullName: "Student", username: "student", password: "short" }), { code: "INVALID_INPUT" });
});

test("avatar upload rejects invalid image bytes", async () => {
    await assert.rejects(avatarService.saveAvatar(1, Buffer.from("invalid"), "image/png"), { code: "INVALID_IMAGE" });
    await assert.rejects(avatarService.saveAvatar(1, Buffer.alloc(avatarService.MAX_AVATAR_BYTES + 1), "image/png"), { code: "INVALID_IMAGE" });
});

test("profile and avatar endpoints require a session", async (t) => {
    const server = require("../src/app").listen(0);
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api/auth/me`;
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: { Cookie: `iot_session=${"a".repeat(64)}` } })).status, 401);
    assert.equal((await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Student" }),
    })).status, 401);
    const avatarUrl = base.replace(/\/me$/, "/avatar");
    assert.equal((await fetch(avatarUrl)).status, 401);
    assert.equal((await fetch(avatarUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: Buffer.from("invalid") })).status, 401);
});

test("profile uses authenticated GET and PUT", async (t) => {
    const originalSession = authRP.findSession;
    const originalFind = authRP.findById;
    const originalUpdate = authRP.updateUser;
    t.after(() => {
        authRP.findSession = originalSession;
        authRP.findById = originalFind;
        authRP.updateUser = originalUpdate;
    });
    let user = { userId: 1, username: "student", fullName: "Old name", avatarFile: null };
    authRP.findSession = async () => ({ userId: 1 });
    authRP.findById = async () => user;
    authRP.updateUser = async (_userId, profile) => {
        user = { ...user, ...profile };
        return user;
    };
    const server = require("../src/app").listen(0);
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api/auth/me`;
    const headers = { Cookie: `iot_session_v2=${"a".repeat(64)}` };

    const current = await fetch(base, { headers });
    assert.equal(current.status, 200);
    assert.equal((await current.json()).fullName, "Old name");

    const updated = await fetch(base, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "New name" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).fullName, "New name");
});

test("avatar GET returns image bytes and PUT updates the current user's image", async (t) => {
    const originalSession = authRP.findSession;
    const originalRead = avatarService.readAvatar;
    const originalSave = avatarService.saveAvatar;
    t.after(() => {
        authRP.findSession = originalSession;
        avatarService.readAvatar = originalRead;
        avatarService.saveAvatar = originalSave;
    });
    authRP.findSession = async () => ({ userId: 1 });
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    avatarService.readAvatar = async () => ({ data: bytes, contentType: "image/png" });
    avatarService.saveAvatar = async (userId, data, contentType) => {
        assert.equal(userId, 1);
        assert.deepEqual(data, bytes);
        assert.equal(contentType, "image/png");
        return { userId, avatarFile: "updated.png" };
    };
    const server = require("../src/app").listen(0);
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api/auth/avatar`;
    const headers = { Cookie: `iot_session_v2=${"a".repeat(64)}` };

    const image = await fetch(base, { headers });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
    const updated = await fetch(base, { method: "PUT", headers: { ...headers, "Content-Type": "image/png" }, body: bytes });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).avatarFile, "updated.png");
});
