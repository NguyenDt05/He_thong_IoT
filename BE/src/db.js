require("dotenv").config();

const mysql = require("mysql2/promise");

// Tạo nhóm kết nối tới MySQL để các repository dùng chung.
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 5,
});

module.exports = pool;
