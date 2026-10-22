const { randomBytes, createHash, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");
const authRP = require("../repos/authRP");

const scrypt = promisify(scryptCallback);
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "iot_session";

function validationError(message) {
    const error = new Error(message);
    error.code = "INVALID_INPUT";
    return error;
}

function requiredText(value, label, maxLength) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
        throw validationError(`${label} không hợp lệ`);
    }
    return value.trim();
}

function optionalText(value, label, maxLength) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || value.trim().length > maxLength) {
        throw validationError(`${label} không hợp lệ`);
    }
    return value.trim() || null;
}

function optionalUrl(value, label) {
    const text = optionalText(value, label, 2048);
    if (!text) return null;
    try {
        const url = new URL(text);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
            throw new Error("Invalid URL");
        }
        return url.href;
    } catch {
        throw validationError(`${label} phải là URL http hoặc https`);
    }
}

function validateProfile(body) {
    const fullName = requiredText(body?.fullName, "Họ tên", 100);
    const email = optionalText(body?.email, "Email", 100);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw validationError("Email không hợp lệ");
    }
    return {
        fullName,
        email,
        studentId: optionalText(body?.studentId, "Mã sinh viên", 30),
        phone: optionalText(body?.phone, "Số điện thoại", 30),
        githubUrl: optionalUrl(body?.githubUrl, "GitHub"),
        figmaUrl: optionalUrl(body?.figmaUrl, "Figma"),
        reportUrl: optionalUrl(body?.reportUrl, "Báo cáo"),
        postmanUrl: optionalUrl(body?.postmanUrl, "Postman"),
    };
}

async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);
    return `${salt}:${hash.toString("hex")}`;
}

async function register(body) {
    const username = requiredText(body?.username, "Tên đăng nhập", 50);
    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) {
        throw validationError("Tên đăng nhập cần 3–50 ký tự chữ, số, _, . hoặc -");
    }
    const profile = validateProfile(body);
    const password = typeof body?.password === "string" ? body.password : "";
    return authRP.createUser({ ...profile, username }, await hashPassword(password));
}

async function login(body) {
    const username = requiredText(body?.username, "Tên đăng nhập", 50);
    const user = await authRP.findByUsername(username);
    if (!user) {
        const error = new Error("Tên đăng nhập không tồn tại");
        error.code = "BAD_CREDENTIALS";
        throw error;
    }
    return user;
}

async function updateProfile(userId, body) {
    return authRP.updateUser(userId, validateProfile(body));
}

function tokenHash(token) {
    return createHash("sha256").update(token).digest("hex");
}

async function startSession(res, userId) {
    const token = randomBytes(32).toString("hex");
    await authRP.createSession(userId, tokenHash(token));
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_MS,
        path: "/",
    });
}

function clearSessionCookie(res) {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
    });
}

function readToken(req) {
    const cookie = req.headers.cookie?.split(";").map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    const token = cookie?.slice(COOKIE_NAME.length + 1);
    return /^[a-f0-9]{64}$/.test(token || "") ? token : null;
}

async function optionalAuth(req, _res, next) {
    try {
        const token = readToken(req);
        req.auth = token ? await authRP.findSession(tokenHash(token)) : null;
        req.sessionToken = token;
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = {
    register, login, updateProfile, startSession, clearSessionCookie,
    tokenHash, optionalAuth, SESSION_MS,
};
