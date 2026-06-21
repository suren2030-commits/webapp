import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Modal, Form, Input, Select, Space, Typography,
  Row, Col, Card, Statistic, Drawer, Timeline, Badge, Popconfirm, Spin,
} from 'antd';
import {
  PlusOutlined, ExclamationCircleOutlined, CheckOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getIncidents, getStats, createIncident, updateIncident, addUpdate } from '../api/incidents';
import useAppStore from '../store/useAppStore';
import socket, { joinAirport } from '../socket';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;

const SEVERITY_COLOR = { low: 'default', medium: 'warning', high: 'error', critical: 'red' };
const STATUS_COLOR   = { open: 'red', in_progress: 'orange', resolved: 'green', closed: 'default' };
const TYPE_ICON      = { weather: '🌩️', technical: '⚙️', security: '🔒', medical: '🏥', operational: '✈️', fire: '🔥', other: '⚠️' };

export default function Incidents() {
  const { airportId } = useAppStore();
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats]         = useState({});
  const [loading, setLoading]     = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [filters, setFilters]     = useState({ status: null, severity: null });
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (airportId)        params.airport_id = airportId;
      if (filters.status)   params.status     = filters.status;
      if (filters.severity) params.severity   = filters.severity;
      const [list, statsData] = await Promise.all([
        getIncidents(params),
        getStats(airportId ? { airport_id: airportId } : {}),
      ]);
      setIncidents(list.data);
      setStats(statsData);
    } finally {
      setLoading(false);
    }
  }, [airportId, filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!airportId) return;
    joinAirport(airportId);
    const refresh = () => fetchAll();
    socket.on('incident:created', refresh);
    socket.on('incident:updated', refresh);
    return () => { socket.off('incident:created', refresh); socket.off('incident:updated', refresh); };
  }, [airportId, fetchAll]);

  const openDetail = async (id) => {
    const data = await getIncidents({ airport_id: airportId }).then(r =>
      r.data.find(i => i.id === id)
    );
    // Fetch full detail with updates
    const { default: client } = await import('../api/client');
    const full = await client.get(`/api/incidents/${id}`).then(r => r.data);
    setSelected(full);
    setDrawerOpen(true);
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    if (airportId) values.airport_id = airportId;
    await createIncident(values);
    setCreateModal(false);
    form.resetFields();
    fetchAll();
  };

  const handleStatusChange = async (id, status) => {
    await updateIncident(id, { status });
    if (selected?.id === id) {
      const { default: client } = await import('../api/client');
      const full = await client.get(`/api/incidents/${id}`).then(r => r.data);
      setSelected(full);
    }
    fetchAll();
  };

  const handleAddUpdate = async () => {
    if (!updateText.trim() || !selected) return;
    await addUpdate(selected.id, { update_text: updateText });
    setUpdateText('');
    const { default: client } = await import('../api/client');
    const full = await client.get(`/api/incidents/${selected.id}`).then(r => r.data);
    setSelected(full);
  };

  const columns = [
    {
      title: '', dataIndex: 'type', width: 36,
      render: (v) => <span style={{ fontSize: 18 }}>{TYPE_ICON[v] || '⚠️'}</span>,
    },
    {
      title: 'Title', dataIndex: 'title',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(r.id)}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.airport_iata} · {dayjs(r.created_at).fromNow()}</Text>
        </Space>
      ),
    },
    {
      title: 'Severity', dataIndex: 'severity', width: 100,
      render: (v) => <Tag color={SEVERITY_COLOR[v]}>{v.toUpperCase()}</Tag>,
      filters: ['low','medium','high','critical'].map(v => ({ text: v, value: v })),
      onFilter: (val, rec) => rec.severity === val,
    },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: (v) => <Badge status={STATUS_COLOR[v]} text={v.replace('_',' ')} />,
      filters: ['open','in_progress','resolved','closed'].map(v => ({ text: v, value: v })),
      onFilter: (val, rec) => rec.status === val,
    },
    {
      title: 'Flight', dataIndex: 'affected_flight_number', width: 100,
      render: (v) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Actions', width: 180,
      render: (_, r) => (
        <Space>
          {r.status === 'open' && (
            <Button size="small" onClick={() => handleStatusChange(r.id, 'in_progress')}>
              Start
            </Button>
          )}
          {r.status === 'in_progress' && (
            <Popconfirm title="Mark as resolved?" onConfirm={() => handleStatusChange(r.id, 'resolved')}>
              <Button size="small" type="primary" icon={<CheckOutlined />}>Resolve</Button>
            </Popconfirm>
          )}
          <Button size="small" onClick={() => openDetail(r.id)}>Details</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Incidents</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            New Incident
          </Button>
        </Space>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Open" value={stats.open_count ?? 0} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="In Progress" value={stats.in_progress_count ?? 0} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Critical" value={stats.critical_count ?? 0} valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Resolved Today" value={stats.resolved_today ?? 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={incidents}
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20 }}
        rowClassName={(r) => r.severity === 'critical' && r.status !== 'resolved' ? 'row-critical' : ''}
      />

      <style>{`.row-critical { background: #fff1f0; }`}</style>

      {/* Create Modal */}
      <Modal
        title="New Incident"
        open={createModal}
        onOk={handleCreate}
        onCancel={() => { setCreateModal(false); form.resetFields(); }}
        okText="Create"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Brief description of the incident" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select options={['technical','weather','security','medical','operational','fire','other']
                  .map(v => ({ value: v, label: `${TYPE_ICON[v]} ${v}` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'low',      label: <Tag color="default">Low</Tag> },
                  { value: 'medium',   label: <Tag color="warning">Medium</Tag> },
                  { value: 'high',     label: <Tag color="error">High</Tag> },
                  { value: 'critical', label: <Tag color="red">Critical</Tag> },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          {!airportId && (
            <Form.Item name="airport_id" label="Airport ID" rules={[{ required: true }]}>
              <Input type="number" placeholder="Airport ID" />
            </Form.Item>
          )}
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Additional details..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selected ? `#${selected.id} — ${selected.title}` : ''}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelected(null); }}
        width={480}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Space wrap>
              <Tag color={SEVERITY_COLOR[selected.severity]}>{selected.severity.toUpperCase()}</Tag>
              <Badge status={STATUS_COLOR[selected.status]} text={selected.status.replace('_',' ')} />
              <Text type="secondary">{selected.airport_name}</Text>
            </Space>

            <Text>{selected.description || 'No description provided.'}</Text>

            <div>
              <Text strong>Timeline</Text>
              <Timeline
                style={{ marginTop: 12 }}
                items={[
                  { color: 'red', children: <><Text strong>Reported</Text><br /><Text type="secondary">{dayjs(selected.created_at).format('DD MMM HH:mm')}</Text></> },
                  ...(selected.updates || []).map(u => ({
                    color: 'blue',
                    children: (
                      <>
                        <Text>{u.update_text}</Text><br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {u.author_name || 'System'} · {dayjs(u.created_at).format('DD MMM HH:mm')}
                        </Text>
                      </>
                    ),
                  })),
                  ...(selected.resolved_at ? [{
                    color: 'green',
                    children: <><Text strong>Resolved</Text><br /><Text type="secondary">{dayjs(selected.resolved_at).format('DD MMM HH:mm')}</Text></>,
                  }] : []),
                ]}
              />
            </div>

            {selected.status !== 'resolved' && selected.status !== 'closed' && (
              <div>
                <Text strong>Add Update</Text>
                <TextArea
                  rows={3}
                  style={{ marginTop: 8 }}
                  value={updateText}
                  onChange={e => setUpdateText(e.target.value)}
                  placeholder="What's happening now?"
                />
                <Button type="primary" style={{ marginTop: 8 }} onClick={handleAddUpdate}
                  disabled={!updateText.trim()}>
                  Post Update
                </Button>
              </div>
            )}

            <Space>
              {selected.status === 'open' && (
                <Button onClick={() => handleStatusChange(selected.id, 'in_progress')}>
                  Start Response
                </Button>
              )}
              {selected.status === 'in_progress' && (
                <Popconfirm title="Mark as resolved?" onConfirm={() => handleStatusChange(selected.id, 'resolved')}>
                  <Button type="primary" icon={<CheckOutlined />}>Mark Resolved</Button>
                </Popconfirm>
              )}
            </Space>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
