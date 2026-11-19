const mysql = require('mysql2/promise');

/**
 * Creates a MySQL/MariaDB connection pool using environment variables.
 * Kept separate from app initialization so unit tests run without a database.
 */
function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? undefined : 'Amazon RDS',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000
  });
}

module.exports = { createPool };
