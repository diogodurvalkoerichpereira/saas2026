const mysql = require('mysql2/promise');
const { env } = require('./env');

const pool = mysql.createPool({
  ...env.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci'
});

module.exports = { pool };
