const authService = require("../service/authSV");
const authRP = require("../repos/authRP");
const avatarService = require("../service/avatarSV");

function handleError(error, res) {
    if (error.code === "INVALID_INPUT") return res.status(400).json({ error: error.message });
    if (error.code === "BAD_CREDENTIALS") return res.status(401).json({ error: error.message });
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Tên đăng nhập đã tồn tại" });
    if (error.code === "INVALID_IMAGE") return res.status(400).json({ error: error.message });
    console.error(error);
    return res.status(500).json({ error: "Không thể xử lý tài khoản" });
}

async function register(req, res) {
    try {
        const user = await authService.register(req.body);
        await authService.startSession(res, user.userId);
        return res.status(201).json(user);
    } catch (error) {
        return handleError(error, res);
    }
}

async function login(req, res) {
    try {
        const user = await authService.login(req.body);
        await authService.startSession(res, user.userId);
        return res.json(user);
    } catch (error) {
        return handleError(error, res);
    }
}

async function me(req, res) {
    if (!req.auth) return res.status(401).json({ error: "Vui lòng đăng nhập" });
    try {
        return res.json(await authRP.findById(req.auth.userId));
    } catch (error) {
        return handleError(error, res);
    }
}

async function updateProfile(req, res) {
    if (!req.auth) return res.status(401).json({ error: "Vui lòng đăng nhập" });
    try {
        return res.json(await authService.updateProfile(req.auth.userId, req.body));
    } catch (error) {
        return handleError(error, res);
    }
}

async function logout(req, res) {
    try {
        if (req.sessionToken) await authRP.deleteSession(authService.tokenHash(req.sessionToken));
        authService.clearSessionCookie(res);
        return res.status(204).end();
    } catch (error) {
        return handleError(error, res);
    }
}

async function uploadAvatar(req, res) {
    if (!req.auth) return res.status(401).json({ error: "Vui lòng đăng nhập" });
    try {
        const contentType = req.headers["content-type"]?.split(";")[0].toLowerCase();
        const user = await avatarService.saveAvatar(req.auth.userId, req.body, contentType);
        if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản" });
        return res.json(user);
    } catch (error) {
        return handleError(error, res);
    }
}

async function getAvatar(req, res) {
    if (!req.auth) return res.status(401).json({ error: "Vui lòng đăng nhập" });
    try {
        const avatar = await avatarService.readAvatar(req.auth.userId);
        if (!avatar) return res.status(404).json({ error: "Chưa có ảnh đại diện" });
        return res.type(avatar.contentType)
            .set("Cache-Control", "private, max-age=86400")
            .set("X-Content-Type-Options", "nosniff")
            .send(avatar.data);
    } catch (error) {
        return handleError(error, res);
    }
}

module.exports = { register, login, me, updateProfile, logout, uploadAvatar, getAvatar };
