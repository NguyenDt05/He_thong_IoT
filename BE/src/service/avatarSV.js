const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const authRP = require("../repos/authRP");

const avatarDirectory = path.resolve(__dirname, "../../uploads/avatars");
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const imageTypes = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};
const fileNamePattern = /^[1-9]\d*-[a-f0-9-]{36}\.(jpg|png|webp)$/;

function invalidImage(message) {
    const error = new Error(message);
    error.code = "INVALID_IMAGE";
    return error;
}

function imageMatchesType(buffer, contentType) {
    if (contentType === "image/jpeg") {
        return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (contentType === "image/png") {
        return buffer.length >= 24
            && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            && buffer.toString("ascii", 12, 16) === "IHDR";
    }
    if (contentType === "image/webp") {
        return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF"
            && buffer.toString("ascii", 8, 12) === "WEBP";
    }
    return false;
}

async function saveAvatar(userId, data, contentType) {
    const extension = imageTypes[contentType];
    if (!extension) throw invalidImage("Chỉ nhận ảnh JPG, PNG hoặc WebP");
    if (!Buffer.isBuffer(data) || data.length === 0) throw invalidImage("Vui lòng chọn một ảnh");
    if (data.length > MAX_AVATAR_BYTES) throw invalidImage("Ảnh không được vượt quá 2 MB");
    if (!imageMatchesType(data, contentType)) throw invalidImage("Tệp ảnh không hợp lệ");

    const previousUser = await authRP.findById(userId);
    if (!previousUser) return null;

    const fileName = `${userId}-${randomUUID()}.${extension}`;
    const filePath = path.join(avatarDirectory, fileName);
    await fs.mkdir(avatarDirectory, { recursive: true });
    await fs.writeFile(filePath, data, { flag: "wx" });

    let user;
    try {
        user = await authRP.setAvatarFile(userId, fileName);
    } catch (error) {
        await fs.unlink(filePath).catch(() => {});
        throw error;
    }

    if (previousUser.avatarFile && fileNamePattern.test(previousUser.avatarFile)) {
        await fs.unlink(path.join(avatarDirectory, previousUser.avatarFile)).catch(() => {});
    }
    return user;
}

async function readAvatar(userId) {
    const user = await authRP.findById(userId);
    if (!user?.avatarFile || !fileNamePattern.test(user.avatarFile)) return null;

    try {
        const data = await fs.readFile(path.join(avatarDirectory, user.avatarFile));
        const extension = path.extname(user.avatarFile).slice(1);
        const contentType = Object.keys(imageTypes).find((type) => imageTypes[type] === extension);
        return { data, contentType };
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

module.exports = { saveAvatar, readAvatar, MAX_AVATAR_BYTES };
