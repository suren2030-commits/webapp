const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:            process.env.MYSQL_HOST     || 'host.docker.internal',
  port:            process.env.MYSQL_PORT     || 3306,
  user:            process.env.MYSQL_USER     || 'root',
  password:        process.env.MYSQL_PASSWORD,
  database:        process.env.MYSQL_DATABASE || 'webapp_db',
  waitForConnections: true,
  connectionLimit: 10,
  timezone:        'Z',
});

module.exports = pool;
