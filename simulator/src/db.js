'use strict';
const mysql = require('mysql2/promise');
const { createClient } = require('@clickhouse/client');

let _pool = null;
let _ch   = null;

function pool() {
  if (!_pool) {
    _pool = mysql.createPool({
      host:               process.env.MYSQL_HOST     || 'mysql.apoc.svc.cluster.local',
      port:               parseInt(process.env.MYSQL_PORT || '3306'),
      user:               process.env.MYSQL_USER     || 'root',
      password:           process.env.MYSQL_PASSWORD,
      database:           process.env.MYSQL_DATABASE || 'webapp_db',
      timezone:           'Z',
      waitForConnections: true,
      connectionLimit:    5,
    });
  }
  return _pool;
}

function ch() {
  if (!_ch) {
    _ch = createClient({
      url:      process.env.CLICKHOUSE_URL      || 'http://clickhouse.clickhouse.svc.cluster.local:8123',
      username: process.env.CLICKHOUSE_USER     || 'apoc_user',
      password: process.env.CLICKHOUSE_PASSWORD || 'apoc123',
      database: process.env.CLICKHOUSE_DATABASE || 'apoc_analytics',
    });
  }
  return _ch;
}

module.exports = { pool, ch };
