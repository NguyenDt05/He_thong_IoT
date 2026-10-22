require("dotenv").config();

const db = require("../src/db");

const columns = {
    username: "VARCHAR(50) NULL",
    password_hash: "VARCHAR(255) NULL",
    avatar_file: "VARCHAR(100) NULL",
    student_id: "VARCHAR(30) NULL",
    phone: "VARCHAR(30) NULL",
    github_url: "TEXT NULL",
    figma_url: "TEXT NULL",
    report_url: "TEXT NULL",
    postman_url: "TEXT NULL",
};

async function migrate() {
    const [existingColumns] = await db.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );
    const existing = new Set(existingColumns.map((row) => row.COLUMN_NAME));

    for (const [name, definition] of Object.entries(columns)) {
        if (!existing.has(name)) {
            await db.query(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
            console.log(`Added users.${name}`);
        }
    }

    const [indexes] = await db.execute(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username' AND NON_UNIQUE = 0"
    );
    if (indexes.length === 0) {
        await db.query("ALTER TABLE users ADD UNIQUE KEY uq_users_username (username)");
        console.log("Added unique username index");
    }

    await db.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
        session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
        KEY idx_auth_sessions_expires_at (expires_at),
        KEY idx_auth_sessions_user_id (user_id),
        CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id)
            REFERENCES users(user_id) ON DELETE CASCADE
    )`);
    console.log("Auth schema is ready");
}

migrate()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => db.end());
