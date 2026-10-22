const db = require("../db");

const userFields = `user_id AS userId, full_name AS fullName, username, email,
    avatar_file AS avatarFile,
    student_id AS studentId, phone, github_url AS githubUrl,
    figma_url AS figmaUrl, report_url AS reportUrl, postman_url AS postmanUrl`;

async function findByUsername(username) {
    const [[user]] = await db.execute(
        `SELECT ${userFields} FROM users WHERE username = ?`,
        [username]
    );
    return user || null;
}

async function findById(userId) {
    const [[user]] = await db.execute(
        `SELECT ${userFields} FROM users WHERE user_id = ?`, [userId]
    );
    return user || null;
}

async function createUser(user, passwordHash) {
    const [result] = await db.execute(
        `INSERT INTO users (full_name, username, password_hash, email, student_id, phone,
            github_url, figma_url, report_url, postman_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.fullName, user.username, passwordHash, user.email, user.studentId, user.phone,
            user.githubUrl, user.figmaUrl, user.reportUrl, user.postmanUrl]
    );
    return findById(result.insertId);
}

async function updateUser(userId, user) {
    await db.execute(
        `UPDATE users SET full_name = ?, email = ?, student_id = ?, phone = ?,
            github_url = ?, figma_url = ?, report_url = ?, postman_url = ?
         WHERE user_id = ?`,
        [user.fullName, user.email, user.studentId, user.phone, user.githubUrl,
            user.figmaUrl, user.reportUrl, user.postmanUrl, userId]
    );
    return findById(userId);
}

async function setAvatarFile(userId, avatarFile) {
    await db.execute("UPDATE users SET avatar_file = ? WHERE user_id = ?", [avatarFile, userId]);
    return findById(userId);
}

async function createSession(userId, tokenHash) {
    await db.execute(
        `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))`,
        [userId, tokenHash]
    );
}

async function findSession(tokenHash) {
    const [[session]] = await db.execute(
        `SELECT s.user_id AS userId FROM auth_sessions s
         JOIN users u ON u.user_id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()`,
        [tokenHash]
    );
    return session || null;
}

async function deleteSession(tokenHash) {
    await db.execute("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash]);
}

module.exports = {
    findByUsername, findById, createUser, updateUser, setAvatarFile,
    createSession, findSession, deleteSession,
};
