require("dotenv").config();

const db = require("../src/db");

const actors = [
    { username: "legacy_guest", fullName: "Khách trước đây" },
    { username: "iot_system", fullName: "Hệ thống IoT" },
];

async function migrate() {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const actorIds = {};
        for (const actor of actors) {
            const [[existing]] = await connection.execute(
                "SELECT user_id AS userId, full_name AS fullName, password_hash AS passwordHash FROM users WHERE username = ? FOR UPDATE",
                [actor.username],
            );
            if (existing && (existing.passwordHash !== null || existing.fullName !== actor.fullName)) {
                throw new Error(`Tên tài khoản nội bộ ${actor.username} đã được sử dụng`);
            }
            if (existing) {
                actorIds[actor.username] = existing.userId;
            } else {
                const [result] = await connection.execute(
                    "INSERT INTO users (full_name, username, password_hash) VALUES (?, ?, NULL)",
                    [actor.fullName, actor.username],
                );
                actorIds[actor.username] = result.insertId;
            }
        }
        const [updated] = await connection.execute(
            "UPDATE action_history SET user_id = ? WHERE user_id IS NULL",
            [actorIds.legacy_guest],
        );
        await connection.commit();
        console.log(`Đã gắn ${updated.affectedRows} bản ghi cũ với Khách trước đây`);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    const [[column]] = await db.query(
        `SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'action_history' AND COLUMN_NAME = 'user_id'`,
    );
    if (!column) throw new Error("Không tìm thấy action_history.user_id");
    if (column.nullable === "YES") {
        await db.query("ALTER TABLE action_history MODIFY COLUMN user_id INT NOT NULL");
    }
    console.log("action_history.user_id đã là NOT NULL");
}

migrate()
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => db.end());
