const { createClient } = require('@clickhouse/client');

const clickhouse = createClient({
  url:      process.env.CLICKHOUSE_URL      || 'http://clickhouse.clickhouse.svc.cluster.local:8123',
  username: process.env.CLICKHOUSE_USER     || 'apoc_user',
  password: process.env.CLICKHOUSE_PASSWORD || 'apoc123',
  database: process.env.CLICKHOUSE_DATABASE || 'apoc_analytics',
});

module.exports = clickhouse;
