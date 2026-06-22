import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Modal, Form, Input, Select, Space, Typography,
  Row, Col, Card, Drawer, Timeline, Popconfirm, Spin, Alert,
} from 'antd';
import {
  PlusOutlined, ExclamationCircleOutlined, CheckOutlined, ReloadOutlined,
  FireOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getIncidents, getStats, createIncident, updateIncident, addUpdate } from '../api/incidents';
import useAppStore from '../store/useAppStore';
import socket, { joinAirport } from '../socket';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;

const SEVERITY_CONFIG = {
  low:      { color: '#8c8c8c', bg: '#f5f5f5',  border: '#d9d9d9',  label: 'Low' },
  medium:   { color: '#d46b08', bg: '#fff7e6',  border: '#ffd591',  label: 'Medium' },
  high:     { color: '#cf1322', bg: '#fff1f0',  border: '#ffa39e',  label: 'High' },
  critical: { color: '#a8071a', bg: '#ffccc7',  border: '#ff4d4f',  label: 'Critical' },
};

const STATUS_CONFIG = {
  open:        { color: '#f5222d', bg: '#fff1f0', label: 'Open' },
  in_progress: { color: '#d46b08', bg: '#fff7e6', label: 'In Progress' },
  resolved:    { color: '#52c41a', bg: '#f6ffed', label: 'Resolved' },
  closed:      { color: '#8c8c8c', bg: '#f5f5f5', label: 'Closed' },
};

const TYPE_CONFIG = {
  weather:     { icon: '🌩️', color: '#1677ff' },
  technical:   { icon: '⚙️',  color: '#722ed1' },
  security:    { icon: '🔒', color: '#cf1322' },
  medical:     { icon: '🏥', color: '#52c41a' },
  operational: { icon: '✈️',  color: '#13c2c2' },
  fire:        { icon: '🔥', color: '#f5222d' },
  other:       { icon: '⚠️',  color: '#8c8c8c' },
};

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      borderRadius: 12,
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 700,
      display: 'inline-block',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      borderRadius: 12,
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 600,
      display: 'inline-block',
    }}>
      {cfg.label}
    </span>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(20,20,30,0.9)',
      borderRadius: 8,
      padding: '8px 12px',
      color: '#fff',
      fontSize: 12,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.fill || p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Incidents() {
  const { airportId } = useAppStore();
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats]         = useState({});
  const [loading, setLoading]     = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (airportId) params.airport_id = airportId;
      const [list, statsData] = await Promise.all([
        getIncidents(params),
        getStats(airportId ? { airport_id: airportId } : {}),
      ]);
      setIncidents(list.data);
      setStats(statsData);
    } finally {
      setLoading(false);
    }
  }, [airportId]);

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

  const criticalOpen = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'closed');
  const highOpen     = incidents.filter(i => i.severity === 'high'     && i.status !== 'resolved' && i.status !== 'closed');

  // Chart data
  const severityData = ['low', 'medium', 'high', 'critical'].map(s => ({
    name: SEVERITY_CONFIG[s].label,
    value: incidents.filter(i => i.severity === s).length,
    fill: SEVERITY_CONFIG[s].color,
  })).filter(d => d.value > 0);

  const typeData = Object.keys(TYPE_CONFIG).map(t => ({
    type: t,
    icon: TYPE_CONFIG[t].icon,
    count: incidents.filter(i => i.type === t).length,
    fill: TYPE_CONFIG[t].color,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

  const columns = [
    {
      title: '',
      dataIndex: 'type',
      width: 40,
      render: (v) => (
        <span style={{ fontSize: 18 }}>{TYPE_CONFIG[v]?.icon || '⚠️'}</span>
      ),
    },
    {
      title: 'Incident',
      dataIndex: 'title',
      render: (v, r) => (
        <div>
          <Text
            strong
            style={{ cursor: 'pointer', fontSize: 14 }}
            onClick={() => openDetail(r.id)}
          >
            {v}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.airport_iata} · {dayjs(r.created_at).fromNow()}
            {r.affected_flight_number && (
              <span style={{
                marginLeft: 8,
                background: '#f0f5ff', color: '#2f54eb',
                borderRadius: 4, padding: '0 5px', fontSize: 11,
              }}>
                ✈ {r.affected_flight_number}
              </span>
            )}
          </Text>
        </div>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 110,
      filters: ['low','medium','high','critical'].map(v => ({ text: SEVERITY_CONFIG[v].label, value: v })),
      onFilter: (val, rec) => rec.severity === val,
      sorter: (a, b) => ['low','medium','high','critical'].indexOf(a.severity) - ['low','medium','high','critical'].indexOf(b.severity),
      render: (v) => <SeverityBadge severity={v} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      filters: Object.keys(STATUS_CONFIG).map(v => ({ text: STATUS_CONFIG[v].label, value: v })),
      onFilter: (val, rec) => rec.status === val,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'Actions',
      width: 180,
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'open' && (
            <Button size="small" onClick={() => handleStatusChange(r.id, 'in_progress')}
              style={{ fontSize: 11 }}>
              Start
            </Button>
          )}
          {r.status === 'in_progress' && (
            <Popconfirm title="Mark as resolved?" onConfirm={() => handleStatusChange(r.id, 'resolved')}>
              <Button size="small" type="primary" icon={<CheckOutlined />} style={{ fontSize: 11 }}>
                Resolve
              </Button>
            </Popconfirm>
          )}
          <Button size="small" onClick={() => openDetail(r.id)} style={{ fontSize: 11 }}>
            Details
          </Button>
        </Space>
      ),
    },
  ];

  const getRowStyle = (record) => {
    if (record.severity === 'critical' && record.status !== 'resolved' && record.status !== 'closed') {
      return { background: '#fff1f0', borderLeft: '3px solid #f5222d' };
    }
    if (record.severity === 'high' && record.status !== 'resolved' && record.status !== 'closed') {
      return { background: '#fffbe6' };
    }
    return {};
  };

  return (
    <div>
      {/* Critical alert banner */}
      {criticalOpen.length > 0 && (
        <Alert
          message={
            <Space>
              <FireOutlined style={{ color: '#f5222d' }} />
              <Text strong style={{ color: '#a8071a' }}>
                {criticalOpen.length} CRITICAL incident{criticalOpen.length > 1 ? 's' : ''} require immediate attention
              </Text>
              {criticalOpen.slice(0, 3).map(i => (
                <span
                  key={i.id}
                  onClick={() => openDetail(i.id)}
                  style={{
                    cursor: 'pointer',
                    background: '#a8071a',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '1px 8px',
                    fontSize: 12,
                  }}
                >
                  {i.title.length > 30 ? i.title.slice(0, 30) + '…' : i.title}
                </span>
              ))}
            </Space>
          }
          type="error"
          showIcon={false}
          style={{ marginBottom: 16, borderRadius: 10 }}
          closable
        />
      )}

      {highOpen.length > 0 && criticalOpen.length === 0 && (
        <Alert
          message={`${highOpen.length} HIGH severity incident${highOpen.length > 1 ? 's' : ''} in progress`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16, borderRadius: 10 }}
          closable
        />
      )}

      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Incidents</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading} style={{ borderRadius: 8 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)} style={{ borderRadius: 8 }}>
            Report Incident
          </Button>
        </Space>
      </Row>

      {/* KPI Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Open', value: stats.open_count ?? 0, color: '#f5222d', bg: '#fff1f0' },
          { label: 'In Progress', value: stats.in_progress_count ?? 0, color: '#d46b08', bg: '#fff7e6' },
          { label: 'Critical', value: stats.critical_count ?? 0, color: '#a8071a', bg: '#ffccc7' },
          { label: 'Resolved Today', value: stats.resolved_today ?? 0, color: '#389e0d', bg: '#f6ffed' },
        ].map(item => (
          <Col key={item.label} xs={12} sm={6}>
            <div style={{
              background: item.bg,
              border: `1px solid ${item.color}30`,
              borderRadius: 12,
              padding: '14px 18px',
              borderLeft: `4px solid ${item.color}`,
            }}>
              <Text style={{ color: item.color, fontSize: 12, fontWeight: 500 }}>{item.label}</Text>
              <div style={{ fontSize: 28, fontWeight: 700, color: item.color, lineHeight: 1.2, marginTop: 4 }}>
                {item.value}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={10}>
          <Card
            title={<span style={{ fontWeight: 600 }}>Severity Breakdown</span>}
            style={{ borderRadius: 12 }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            {severityData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No incidents</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {severityData.map(entry => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ReTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <Row gutter={[6, 4]} style={{ marginTop: 4 }}>
                  {severityData.map(d => (
                    <Col key={d.name}>
                      <Space size={4}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill, display: 'inline-block' }} />
                        <Text style={{ fontSize: 12 }}>{d.name}: <strong>{d.value}</strong></Text>
                      </Space>
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} md={14}>
          <Card
            title={<span style={{ fontWeight: 600 }}>Incidents by Type</span>}
            style={{ borderRadius: 12 }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            {typeData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No incidents</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={typeData}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 30, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    dataKey="type"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={80}
                    tickFormatter={(v) => `${TYPE_CONFIG[v]?.icon || ''} ${v}`}
                  />
                  <ReTooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                    {typeData.map(entry => (
                      <Cell key={entry.type} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* Incident Table */}
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={incidents}
            size="middle"
            pagination={{ pageSize: 15, showTotal: t => `${t} incidents` }}
            onRow={(record) => ({ style: getRowStyle(record) })}
          />
        </Spin>
      </Card>

      {/* Create Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
            <span>Report New Incident</span>
          </Space>
        }
        open={createModal}
        onOk={handleCreate}
        onCancel={() => { setCreateModal(false); form.resetFields(); }}
        okText="Report"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Brief description of the incident" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select
                  options={Object.entries(TYPE_CONFIG).map(([k, v]) => ({
                    value: k,
                    label: `${v.icon} ${k}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
                <Select
                  options={Object.entries(SEVERITY_CONFIG).map(([k, v]) => ({
                    value: k,
                    label: (
                      <span style={{ color: v.color, fontWeight: 600 }}>{v.label}</span>
                    ),
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          {!airportId && (
            <Form.Item name="airport_id" label="Airport ID" rules={[{ required: true }]}>
              <Input type="number" placeholder="Airport ID" />
            </Form.Item>
          )}
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Additional details, impact, and immediate actions…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={
          selected ? (
            <Space>
              <span style={{ fontSize: 18 }}>{TYPE_CONFIG[selected.type]?.icon || '⚠️'}</span>
              <span style={{ fontWeight: 700 }}>#{selected.id} — {selected.title}</span>
            </Space>
          ) : ''
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelected(null); setUpdateText(''); }}
        width={500}
        extra={
          selected && (
            <Space>
              {selected.status === 'open' && (
                <Button size="small" onClick={() => handleStatusChange(selected.id, 'in_progress')}>
                  Start Response
                </Button>
              )}
              {selected.status === 'in_progress' && (
                <Popconfirm title="Mark as resolved?" onConfirm={() => handleStatusChange(selected.id, 'resolved')}>
                  <Button size="small" type="primary" icon={<CheckOutlined />}>Resolve</Button>
                </Popconfirm>
              )}
            </Space>
          )
        }
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={20}>
            <Row gutter={8}>
              <Col><SeverityBadge severity={selected.severity} /></Col>
              <Col><StatusBadge status={selected.status} /></Col>
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>{selected.airport_name}</Text>
              </Col>
            </Row>

            {selected.description && (
              <Card size="small" style={{ background: '#fafafa', borderRadius: 8 }} bodyStyle={{ padding: 12 }}>
                <Text>{selected.description}</Text>
              </Card>
            )}

            <div>
              <Text strong style={{ fontSize: 14 }}>Timeline</Text>
              <Timeline
                style={{ marginTop: 12 }}
                items={[
                  {
                    color: 'red',
                    children: (
                      <>
                        <Text strong>Incident Reported</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(selected.created_at).format('DD MMM YYYY, HH:mm')}
                        </Text>
                      </>
                    ),
                  },
                  ...(selected.updates || []).map(u => ({
                    color: 'blue',
                    children: (
                      <>
                        <Text>{u.update_text}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {u.author_name || 'Ops'} · {dayjs(u.created_at).format('DD MMM, HH:mm')}
                        </Text>
                      </>
                    ),
                  })),
                  ...(selected.resolved_at ? [{
                    color: 'green',
                    children: (
                      <>
                        <Text strong>Resolved</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(selected.resolved_at).format('DD MMM YYYY, HH:mm')}
                        </Text>
                      </>
                    ),
                  }] : []),
                ]}
              />
            </div>

            {selected.status !== 'resolved' && selected.status !== 'closed' && (
              <div>
                <Text strong>Add Update</Text>
                <TextArea
                  rows={3}
                  style={{ marginTop: 8, borderRadius: 8 }}
                  value={updateText}
                  onChange={e => setUpdateText(e.target.value)}
                  placeholder="What is the current status?"
                />
                <Button
                  type="primary"
                  style={{ marginTop: 8, borderRadius: 8 }}
                  onClick={handleAddUpdate}
                  disabled={!updateText.trim()}
                >
                  Post Update
                </Button>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
}
