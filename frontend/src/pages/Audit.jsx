import { useState, useEffect, useCallback } from 'react';
import { Table, Card, Typography, Space, Select, Input, Button, Tag, Row, Col, DatePicker } from 'antd';
import { ReloadOutlined, FileSearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAuditLog } from '../api/audit';

const { Title, Text } = Typography;

const ENTITY_TYPE_OPTIONS = [
  { value: 'flight',   label: 'Flight' },
  { value: 'incident', label: 'Incident' },
];

const ACTION_COLORS = {
  flight_status_update: 'blue',
  incident_create:      'red',
  incident_update:      'orange',
};

const COLUMNS = [
  {
    title: 'Time', dataIndex: 'created_at', width: 160,
    render: v => (
      <Space direction="vertical" size={0}>
        <Text style={{ fontSize: 13, fontFamily: 'monospace' }}>{dayjs(v).format('HH:mm:ss')}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format('DD MMM YYYY')}</Text>
      </Space>
    ),
    defaultSortOrder: 'descend',
    sorter: (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
  },
  {
    title: 'User', dataIndex: 'username', width: 150,
    render: v => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
  },
  {
    title: 'Action', dataIndex: 'action', width: 180,
    render: v => <Tag color={ACTION_COLORS[v] || 'default'} style={{ fontSize: 12 }}>{v}</Tag>,
    filters: Object.keys(ACTION_COLORS).map(k => ({ text: k, value: k })),
    onFilter: (val, rec) => rec.action === val,
  },
  {
    title: 'Entity', width: 130,
    render: (_, r) => (
      <Space size={4}>
        <Tag color="geekblue" style={{ margin: 0 }}>{r.entity_type}</Tag>
        {r.entity_id && <Text type="secondary" style={{ fontSize: 12 }}>#{r.entity_id}</Text>}
      </Space>
    ),
  },
  {
    title: 'Description', dataIndex: 'description',
    render: v => <Text style={{ fontSize: 13 }}>{v ?? '—'}</Text>,
  },
  {
    title: 'IP Address', dataIndex: 'ip_address', width: 130,
    render: v => <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{v ?? '—'}</Text>,
  },
];

export default function Audit() {
  const [data, setData]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [entityType, setEntityType] = useState(null);
  const [username, setUsername]   = useState('');
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
      if (entityType) params.entity_type = entityType;
      if (username)   params.username    = username;
      const res = await getAuditLog(params);
      setData(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityType, username, page]);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id); }, [fetchData]);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <FileSearchOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Audit Log
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Role-restricted changes · Admin &amp; Supervisor only · Auto-refresh 30s</Text>
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="Entity type"
              style={{ width: 140 }}
              value={entityType}
              onChange={v => { setEntityType(v); setPage(1); }}
              options={ENTITY_TYPE_OPTIONS}
              allowClear
            />
            <Input
              placeholder="Username…"
              style={{ width: 160 }}
              value={username}
              onChange={e => { setUsername(e.target.value); setPage(1); }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
          </Space>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={COLUMNS}
          dataSource={data}
          loading={loading}
          size="middle"
          scroll={{ x: 900 }}
          pagination={{
            current:      page,
            pageSize:     PAGE_SIZE,
            total,
            onChange:     (p) => setPage(p),
            showTotal:    t => `${t} entries`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: 'No audit entries yet — changes by admin/supervisor users will appear here' }}
        />
      </Card>
    </div>
  );
}
